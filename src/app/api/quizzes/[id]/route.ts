import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";

export const runtime = "nodejs";

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const quiz = await prisma.quiz.findFirst({
    where: {
      id: params.id,
      OR: [{ creatorId: user.id }, { isAdminQuiz: true, status: "PUBLISHED" }],
    },
    include: {
      questions: { orderBy: { order: "asc" }, select: { id: true, prompt: true, options: true } },
      attempts: {
        where: { userId: user.id },
        select: { percentage: true, score: true, total: true, completedAt: true },
        orderBy: { completedAt: "desc" },
        take: 1,
      },
    },
  });
  if (!quiz) return NextResponse.json({ error: "Quiz not found." }, { status: 404 });

  const parsedQuiz = {
    ...quiz,
    questions: quiz.questions.map((q) => ({ ...q, options: JSON.parse(q.options as string) })),
  };

  return NextResponse.json({ quiz: parsedQuiz });
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const quiz = await prisma.quiz.findFirst({ where: { id: params.id, creatorId: user.id } });
  if (!quiz) return NextResponse.json({ error: "Not found." }, { status: 404 });

  await prisma.quiz.delete({ where: { id: params.id } });
  return NextResponse.json({ ok: true });
}
