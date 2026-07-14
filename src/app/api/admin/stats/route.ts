import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth";
import { ollamaHealthy, getActiveModel } from "@/lib/ollama";

export const runtime = "nodejs";

export async function GET() {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const [students, verified, quizzes, attempts] = await Promise.all([
    prisma.user.count({ where: { role: "STUDENT" } }),
    prisma.user.count({ where: { role: "STUDENT", verified: true } }),
    prisma.quiz.count({ where: { isAdminQuiz: true } }),
    prisma.attempt.count(),
  ]);

  return NextResponse.json({
    students,
    verified,
    unverified: students - verified,
    quizzes,
    attempts,
    ollamaHealthy: await ollamaHealthy(),
    model: await getActiveModel(),
  });
}
