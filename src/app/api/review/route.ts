import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";

export const runtime = "nodejs";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const now = new Date();
  const due = await prisma.reviewItem.findMany({
    where: { userId: user.id, dueAt: { lte: now } },
    orderBy: { dueAt: "asc" },
  });
  const total = await prisma.reviewItem.count({ where: { userId: user.id } });

  return NextResponse.json({ due, dueCount: due.length, total });
}
