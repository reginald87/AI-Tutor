import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { consumePrompt, getPromptState } from "@/lib/prompts";
import { chatStream, ollamaHealthy } from "@/lib/ollama";
import { buildChatMessages } from "@/lib/llm";
import { retrieveRelevantChunks } from "@/lib/retrieve";
import { requireVerifiedUser } from "@/lib/auth";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(req: NextRequest) {
  const user = await requireVerifiedUser();
  if (!user) {
    return NextResponse.json(
      { error: "Please verify your email address to use the chat." },
      { status: 403 }
    );
  }

  const body = await req.json().catch(() => null);
  if (!body || typeof body.message !== "string" || !body.message.trim()) {
    return NextResponse.json({ error: "Message is required." }, { status: 400 });
  }

  // Make sure the AI service is reachable before spending a prompt.
  if (!(await ollamaHealthy())) {
    return NextResponse.json(
      { error: "The AI service is unavailable. Please try again later." },
      { status: 503 }
    );
  }

  const { chatId, message, docId } = body as {
    chatId?: string;
    message: string;
    docId?: string | null;
  };

  let chat = chatId
    ? await prisma.chat.findFirst({ where: { id: chatId, userId: user.id } })
    : null;

  if (!chat) {
    chat = await prisma.chat.create({
      data: { userId: user.id, title: message.slice(0, 60), docId: docId || null },
    });
  } else if (docId && !chat.docId) {
    chat = await prisma.chat.update({ where: { id: chat.id }, data: { docId } });
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
  if (chat.docId) {
    const doc = await prisma.document.findFirst({ where: { id: chat.docId, userId: user.id } });
    docText = doc?.text || null;
  }

  // Only send the most relevant excerpts, not the whole document, so the model
  // can answer quickly. Small documents are passed through unchanged.
  const context = docText ? retrieveRelevantChunks(docText, message) : null;

  const history = await prisma.message.findMany({
    where: { chatId: chat.id },
    orderBy: { createdAt: "asc" },
    take: 30,
  });

  const llmMessages = buildChatMessages(
    [
      ...history.map((m) => ({ role: m.role as "user" | "assistant", content: m.content })),
      { role: "user" as const, content: message },
    ],
    context
  );

  await prisma.message.create({
    data: { chatId: chat.id, role: "user", content: message },
  });

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      let full = "";
      try {
        for await (const chunk of chatStream(llmMessages, {})) {
          full += chunk;
          controller.enqueue(encoder.encode(chunk));
        }
        await prisma.message.create({
          data: { chatId: chat!.id, role: "assistant", content: full },
        });
        await prisma.chat.update({ where: { id: chat!.id }, data: { updatedAt: new Date() } });
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
