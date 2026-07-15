import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser, requireVerifiedUser } from "@/lib/auth";
import { consumePrompt, getPromptState } from "@/lib/prompts";
import { chatStream, ollamaHealthy } from "@/lib/ollama";
import { buildChatMessages, stripConfidence } from "@/lib/llm";
import { retrieveRelevantChunks, retrieveSourceChunks } from "@/lib/retrieve";
import { describeImage } from "@/lib/vision";

export const runtime = "nodejs";
export const maxDuration = 120;

export async function POST(req: NextRequest) {
  const user = await requireVerifiedUser();
  if (!user) {
    return NextResponse.json(
      { error: "Please verify your email address to use the chat." },
      { status: 403 }
    );
  }

  const body = await req.json().catch(() => null);
  if (!body || typeof body.message !== "string") {
    return NextResponse.json({ error: "Message is required." }, { status: 400 });
  }
  const message = body.message.trim();
  const image: string | undefined = body.image;
  if (!message && !image) {
    return NextResponse.json({ error: "Message is required." }, { status: 400 });
  }

  if (!(await ollamaHealthy())) {
    return NextResponse.json(
      { error: "The AI service is unavailable. Please try again later." },
      { status: 503 }
    );
  }

  const { chatId, docId } = body as { chatId?: string; docId?: string | null };

  let chat = chatId
    ? await prisma.chat.findFirst({ where: { id: chatId, userId: user.id } })
    : null;

  if (!chat) {
    chat = await prisma.chat.create({
      data: { userId: user.id, title: (message || "Image chat").slice(0, 60), docId: docId || null },
    });
  } else if (docId && !chat.docId) {
    chat = await prisma.chat.update({ where: { id: chat.id }, data: { docId } });
  }

  // Resolve image description (if any) before spending a prompt.
  let imageDescription: string | null = null;
  if (image) {
    try {
      const res = await describeImage(image, "Describe this image in detail for a medical student. Transcribe any text, diagrams, or whiteboard content you can see.");
      if (!res) {
        return NextResponse.json(
          { error: "Image input is not enabled on this server (no vision model configured)." },
          { status: 400 }
        );
      }
      imageDescription = res.text;
    } catch (err) {
      return NextResponse.json(
        { error: "Could not process the image: " + ((err as Error)?.message || "unknown error") },
        { status: 502 }
      );
    }
  }

  let promptState;
  try {
    promptState = await consumePrompt(user.id);
  } catch {
    const state = await getPromptState(user.id);
    return NextResponse.json(
      { error: "You have used all your prompts for now. They refill daily and weekly.", state },
      { status: 429 }
    );
  }

  let docText: string | null = null;
  let docFilename: string | null = null;
  if (chat.docId) {
    const doc = await prisma.document.findFirst({ where: { id: chat.docId, userId: user.id } });
    docText = doc?.text || null;
    docFilename = doc?.filename || null;
  }

  const context = docText ? retrieveRelevantChunks(docText, message || imageDescription || "") : null;

  const sources = docText
    ? retrieveSourceChunks(docText, message || imageDescription || "").map((snippet) => ({
        filename: docFilename,
        snippet,
      }))
    : [];

  // Build the user turn, folding in any image description.
  const userTurn = imageDescription
    ? `[Image shared by student]\n${imageDescription}\n\n${message}`.trim()
    : message;

  const history = await prisma.message.findMany({
    where: { chatId: chat.id },
    orderBy: { createdAt: "asc" },
    take: 30,
  });

  const llmMessages = buildChatMessages(
    [
      ...history.map((m) => ({ role: m.role as "user" | "assistant", content: m.content })),
      { role: "user" as const, content: userTurn },
    ],
    context,
    { withConfidence: true }
  );

  await prisma.message.create({
    data: { chatId: chat.id, role: "user", content: userTurn },
  });

  const encoder = new TextEncoder();
  const META_SENTINEL = "@@META@@";

  const stream = new ReadableStream({
    async start(controller) {
      let raw = "";
      let confidence: string | null = null;
      let tagResolved = false;
      let emitted = 0;

      function emit(newRaw: string) {
        if (!tagResolved) {
          const nl = newRaw.indexOf("\n");
          if (nl < 0) return; // wait for the first newline (confidence tag line)
          const firstLine = newRaw.slice(0, nl);
          const m = firstLine.match(/^\[(CONF|conf):\s*(high|medium|low)\]/i);
          if (m) {
            confidence = m[2].toLowerCase();
            emitted = nl + 1; // skip the tag line + newline
          } else {
            emitted = 0;
          }
          tagResolved = true;
        }
        const next = newRaw.slice(emitted);
        if (next) {
          controller.enqueue(encoder.encode(next));
          emitted = newRaw.length;
        }
      }

      try {
        for await (const chunk of chatStream(llmMessages, {})) {
          raw += chunk;
          emit(raw);
        }
        if (!tagResolved) {
          const stripped = stripConfidence(raw);
          if (stripped.confidence) confidence = stripped.confidence;
          const cleanAll = stripped.confidence ? stripped.text : raw;
          const tail = cleanAll.slice(emitted);
          if (tail) controller.enqueue(encoder.encode(tail));
          emitted = cleanAll.length;
        }

        const cleanContent = stripConfidence(raw).text;
        await prisma.message.create({
          data: {
            chatId: chat!.id,
            role: "assistant",
            content: cleanContent,
            sources: sources.length ? JSON.stringify(sources) : null,
            confidence,
          },
        });
        await prisma.chat.update({ where: { id: chat!.id }, data: { updatedAt: new Date() } });

        // Append machine-readable metadata for the client to consume.
        const meta = JSON.stringify({ confidence, sources });
        controller.enqueue(encoder.encode(`\n${META_SENTINEL}${meta}${META_SENTINEL}`));
      } catch (err) {
        const note = "\n\n⚠️ Generation failed: " + ((err as Error)?.message || "unknown error");
        controller.enqueue(encoder.encode(note));
        await prisma.message
          .create({ data: { chatId: chat!.id, role: "assistant", content: note } })
          .catch(() => {});
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      "X-Chat-Id": chat.id,
      "X-Prompts": JSON.stringify(promptState),
    },
  });
}
