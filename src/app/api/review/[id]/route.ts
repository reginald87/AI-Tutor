import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { nextSrs } from "@/lib/srs";

export const runtime = "nodejs";

const gradeSchema = z.object({ rating: z.number().int().min(0).max(5) });

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => null);
  const parsed = gradeSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Invalid input." }, { status: 400 });

  const item = await prisma.reviewItem.findFirst({ where: { id: params.id, userId: user.id } });
  if (!item) return NextResponse.json({ error: "Not found." }, { status: 404 });

  const next = nextSrs(
    { interval: item.interval, ease: item.ease, repetitions: item.repetitions },
    parsed.data.rating
  );

  const updated = await prisma.reviewItem.update({
    where: { id: item.id },
    data: {
      dueAt: next.dueAt,
      interval: next.interval,
      ease: next.ease,
      repetitions: next.repetitions,
      lastRating: parsed.data.rating,
    },
  });

  // How many are still due right now (after this grade)?
  const dueCount = await prisma.reviewItem.count({
    where: { userId: user.id, dueAt: { lte: new Date() } },
  });

  return NextResponse.json({ item: updated, dueCount });
}
