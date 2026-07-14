import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireVerifiedUser } from "@/lib/auth";

export const runtime = "nodejs";

const PASS_MARK = 60;
const POINTS_PER_CORRECT = 5;

const submitSchema = z.object({
  answers: z
    .array(
      z.object({
        questionId: z.string(),
        selectedIndex: z.number().int().min(0),
      })
    )
    .min(1),
});

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const user = await requireVerifiedUser();
  if (!user) {
    return NextResponse.json(
      { error: "Verify your email to take quizzes." },
      { status: 403 }
    );
  }

  const quiz = await prisma.quiz.findFirst({
    where: {
      id: params.id,
      OR: [{ creatorId: user.id }, { isAdminQuiz: true, status: "PUBLISHED" }],
    },
    include: { questions: { orderBy: { order: "asc" } } },
  });
  if (!quiz) return NextResponse.json({ error: "Quiz not found." }, { status: 404 });

  const body = await req.json().catch(() => null);
  const parsed = submitSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Invalid submission." }, { status: 400 });

  const answerMap = new Map(parsed.data.answers.map((a) => [a.questionId, a.selectedIndex]));
  let score = 0;
  const results = quiz.questions.map((q) => {
    const selected = answerMap.get(q.id);
    const correct = selected === q.correctIndex;
    if (correct) score += 1;
    return {
      questionId: q.id,
      prompt: q.prompt,
      options: JSON.parse(q.options as string),
      selectedIndex: selected ?? null,
      correctIndex: q.correctIndex,
      correct,
      explanation: q.explanation,
    };
  });

  const total = quiz.questions.length;
  const percentage = total > 0 ? Math.round((score / total) * 100) : 0;
  const passed = percentage >= PASS_MARK;

  // Check for a prior passing attempt BEFORE inserting this one, so we only
  // award the first-time bonus (prevents farming by retaking).
  let pointsEarned = 0;
  if (passed) {
    const priorPass = await prisma.attempt.findFirst({
      where: { userId: user.id, quizId: quiz.id, percentage: { gte: PASS_MARK } },
    });
    if (!priorPass) {
      pointsEarned = score * POINTS_PER_CORRECT;
      await prisma.user.update({
        where: { id: user.id },
        data: { rewardPoints: { increment: pointsEarned } },
      });
    }
  }

  await prisma.attempt.create({
    data: {
      userId: user.id,
      quizId: quiz.id,
      score,
      total,
      percentage,
      answers: JSON.stringify(results),
    },
  });

  const updated = await prisma.user.findUnique({ where: { id: user.id }, select: { rewardPoints: true } });

  return NextResponse.json({
    score,
    total,
    percentage,
    passed,
    pointsEarned,
    rewardPoints: updated?.rewardPoints ?? user.rewardPoints,
    results,
  });
}
