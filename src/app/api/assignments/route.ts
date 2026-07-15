import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";

export const runtime = "nodejs";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const assignments = await prisma.assignment.findMany({
    where: {
      AND: [
        { OR: [{ faculty: null }, { faculty: "" }, { faculty: user.faculty }] },
        { OR: [{ department: null }, { department: "" }, { department: user.department }] },
        { OR: [{ program: null }, { program: "" }, { program: user.program }] },
        { OR: [{ level: null }, { level: "" }, { level: user.level }] },
      ],
    },
    orderBy: { createdAt: "desc" },
    include: {
      quiz: {
        select: {
          id: true,
          title: true,
          description: true,
          _count: { select: { questions: true } },
          attempts: {
            where: { userId: user.id },
            select: { percentage: true, completedAt: true },
            orderBy: { completedAt: "desc" },
            take: 1,
          },
        },
      },
    },
  });

  const mapped = assignments.map((a) => ({
    id: a.id,
    title: a.title,
    dueAt: a.dueAt,
    createdAt: a.createdAt,
    quiz: {
      id: a.quiz.id,
      title: a.quiz.title,
      description: a.quiz.description,
      questionCount: a.quiz._count.questions,
      best: a.quiz.attempts[0]?.percentage ?? null,
    },
  }));

  return NextResponse.json({ assignments: mapped });
}
