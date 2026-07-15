import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getCurrentUser, requireVerifiedUser } from "@/lib/auth";
import { consumePrompt, getPromptState } from "@/lib/prompts";
import { generate, ollamaHealthy, parseJsonBlock } from "@/lib/ollama";
import { buildFlashcardPrompt } from "@/lib/llm";

export const runtime = "nodejs";
export const maxDuration = 60;

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

  const { system, user: userPrompt } = buildFlashcardPrompt({
    title: title || (topic ? `Cards: ${topic}` : "Study cards"),
    topic: topic || null,
    docText,
    count: count ?? 8,
  });

  let raw: string;
  try {
    raw = await generate(userPrompt, { system });
  } catch (err) {
    return NextResponse.json({ error: "Flashcard generation failed: " + ((err as Error)?.message || "") }, { status: 502 });
  }

  let cleaned: any;
  try {
    cleaned = parseJsonBlock(raw);
  } catch {
    return NextResponse.json({ error: "The model returned invalid flashcards." }, { status: 502 });
  }

  const cards = Array.isArray(cleaned?.cards)
    ? cleaned.cards
        .map((c: any) => ({ front: String(c?.front || "").trim(), back: String(c?.back || "").trim() }))
        .filter((c: any) => c.front && c.back)
    : [];
  if (cards.length === 0) return NextResponse.json({ error: "No valid flashcards were generated." }, { status: 502 });

  const deck = await prisma.flashcardDeck.create({
    data: {
      userId: user.id,
      title: String(cleaned?.title || title || "Study cards").slice(0, 160),
      sourceDocId: fromDoc || null,
      cards: { create: cards },
    },
  });

  return NextResponse.json({ deckId: deck.id, cardCount: cards.length });
}
