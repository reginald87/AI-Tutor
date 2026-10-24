import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getCurrentUser, requireVerifiedUser } from "@/lib/auth";
import { consumePrompt, getPromptState } from "@/lib/prompts";
import { generate, ollamaHealthy, parseJsonBlock } from "@/lib/ollama";
import { buildFlashcardPrompt } from "@/lib/llm";
import { runInBackground } from "@/lib/background";

export const runtime = "nodejs";

const genSchema = z.object({
  title: z.string().max(160).optional(),
  topic: z.string().max(300).optional(),
  fromDoc: z.string().optional(),
  count: z.number().int().min(1).max(30).optional(),
});

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const decks = await prisma.flashcardDeck.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      title: true,
      createdAt: true,
      sourceDocId: true,
      sourceQuizId: true,
      status: true,
      error: true,
      _count: { select: { cards: true } },
    },
  });
  return NextResponse.json({ decks });
}

export async function POST(req: NextRequest) {
  const user = await requireVerifiedUser();
  if (!user) return NextResponse.json({ error: "Verify your email to create flashcards." }, { status: 403 });

  const body = await req.json().catch(() => null);
  const parsed = genSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Invalid input." }, { status: 400 });
  const { title, topic, fromDoc, count } = parsed.data;

  let docText: string | null = null;
  if (fromDoc) {
    const doc = await prisma.document.findFirst({ where: { id: fromDoc, userId: user.id } });
    docText = doc?.text || null;
  }
  if (!docText && !topic?.trim()) {
    return NextResponse.json({ error: "Upload a document or provide a topic." }, { status: 400 });
  }
  if (!(await ollamaHealthy())) {
    return NextResponse.json({ error: "The AI service is unavailable." }, { status: 503 });
  }
  try {
    await consumePrompt(user.id);
  } catch {
    const state = await getPromptState(user.id);
    return NextResponse.json({ error: "You have used all your prompts for now.", state }, { status: 429 });
  }

  const deckTitle = title?.trim() || (topic ? `Cards: ${topic}` : "Study cards");

  // Create the deck first as GENERATING, then fill it in the background. This
  // keeps the HTTP response fast so Cloudflare/nginx never cut it off mid-job.
  const deck = await prisma.flashcardDeck.create({
    data: {
      userId: user.id,
      title: deckTitle.slice(0, 160),
      sourceDocId: fromDoc || null,
      status: "GENERATING",
    },
  });

  runInBackground(async () => {
    try {
      const { system, user: userPrompt } = buildFlashcardPrompt({
        title: deckTitle,
        topic: topic || null,
        docText,
        count: count ?? 8,
      });

      const raw = await generate(userPrompt, { system, temperature: 0.2, numPredict: 768, numCtx: 4096 });
      const cleaned: any = parseJsonBlock(raw);

      const cards = Array.isArray(cleaned?.cards)
        ? cleaned.cards
            .map((c: any) => ({ front: String(c?.front || "").trim(), back: String(c?.back || "").trim() }))
            .filter((c: any) => c.front && c.back)
        : [];
      if (cards.length === 0) throw new Error("No valid flashcards were generated.");

      await prisma.flashcardDeck.update({
        where: { id: deck.id },
        data: {
          title: String(cleaned?.title || deckTitle).slice(0, 160),
          status: "PUBLISHED",
          cards: { create: cards },
        },
      });
    } catch (err) {
      await prisma.flashcardDeck
        .update({
          where: { id: deck.id },
          data: { status: "FAILED", error: (err as Error)?.message || "Flashcard generation failed." },
        })
        .catch(() => {});
    }
  });

  return NextResponse.json({ deckId: deck.id, status: "GENERATING" }, { status: 202 });
}
