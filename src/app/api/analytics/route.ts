import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";

export const runtime = "nodejs";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const attempts = await prisma.attempt.findMany({
    where: { userId: user.id },
    orderBy: { completedAt: "desc" },
    include: { quiz: { select: { id: true, title: true } } },
  });

  let totalQuestions = 0;
  let totalCorrect = 0;
  const quizPerf = new Map<string, { title: string; best: number; attempts: number }>();
  const questionAgg = new Map<
    string,
    { prompt: string; quizTitle: string; wrong: number; right: number; lastCorrect: boolean }
  >();

  for (const a of attempts) {
    const prev = quizPerf.get(a.quizId);
    quizPerf.set(a.quizId, {
      title: a.quiz.title,
      best: Math.max(prev?.best ?? 0, a.percentage),
      attempts: (prev?.attempts ?? 0) + 1,
    });

    let answers: any[] = [];
    try {
      answers = JSON.parse(a.answers as string);
    } catch {
      answers = [];
    }
    for (const ans of answers) {
      totalQuestions += 1;
      const correct = !!ans.correct;
      if (correct) totalCorrect += 1;
      const key = ans.questionId as string;
      const ex = questionAgg.get(key);
      questionAgg.set(key, {
        prompt: ans.prompt || "Question",
        quizTitle: a.quiz.title,
        wrong: (ex?.wrong ?? 0) + (correct ? 0 : 1),
        right: (ex?.right ?? 0) + (correct ? 1 : 0),
        lastCorrect: correct,
      });
    }
  }

  const quizzesTaken = quizPerf.size;
  const averagePercentage = attempts.length
    ? Math.round(attempts.reduce((s, a) => s + a.percentage, 0) / attempts.length)
    : 0;

  const weakest = [...quizPerf.entries()]
    .map(([quizId, v]) => ({ quizId, title: v.title, best: v.best, attempts: v.attempts }))
    .filter((q) => q.best < 70)
    .sort((a, b) => a.best - b.best)
    .slice(0, 5);

  const missedQuestions = [...questionAgg.values()]
    .filter((q) => q.wrong > 0)
    .sort((a, b) => b.wrong - a.wrong || (a.lastCorrect ? 1 : 0) - (b.lastCorrect ? 1 : 0))
    .slice(0, 8)
    .map((q) => ({
      prompt: q.prompt,
      quizTitle: q.quizTitle,
      wrong: q.wrong,
      right: q.right,
      lastCorrect: q.lastCorrect,
    }));

  // Suggest a topic to focus on: the quiz title of the weakest attempt.
  const focusTopic = weakest[0]?.title || null;

  return NextResponse.json({
    totalAttempts: attempts.length,
    quizzesTaken,
    totalQuestions,
    totalCorrect,
    averagePercentage,
    accuracy: totalQuestions ? Math.round((totalCorrect / totalQuestions) * 100) : 0,
    weakest,
    missedQuestions,
    focusTopic,
  });
}
