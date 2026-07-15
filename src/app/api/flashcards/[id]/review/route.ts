import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { nextSrs } from "@/lib/srs";

export const runtime = "nodejs";

const reviewSchema = z.object({
  cardId: z.string(),
  rating: z.number().int().min(0).max(5),
});

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => null);
  const parsed = reviewSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Invalid input." }, { status: 400 });

  const card = await prisma.flashcard.findFirst({
    where: { id: parsed.data.cardId, deckId: params.id, deck: { userId: user.id } },
  });
  if (!card) return NextResponse.json({ error: "Card not found." }, { status: 404 });

  const next = nextSrs(
    { interval: card.interval, ease: card.ease, repetitions: card.repetitions },
    parsed.data.rating
  );

  const updated = await prisma.flashcard.update({
    where: { id: card.id },
    data: {
      dueAt: next.dueAt,
      interval: next.interval,
      ease: next.ease,
      repetitions: next.repetitions,
      lastRating: parsed.data.rating,
    },
  });

  return NextResponse.json({ card: updated });
}
