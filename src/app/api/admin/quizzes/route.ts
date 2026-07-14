import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth";
import { generate, ollamaHealthy, parseJsonBlock } from "@/lib/ollama";
import { buildQuizPrompt } from "@/lib/llm";
import { sanitizeQuiz } from "@/lib/quiz";

export const runtime = "nodejs";
export const maxDuration = 60;

const createSchema = z.object({
  title: z.string().min(2).max(160),
  description: z.string().max(500).optional(),
  count: z.number().int().min(1).max(20).optional(),
  topic: z.string().max(300),
  faculty: z.string().max(100).nullable().optional(),
  department: z.string().max(100).nullable().optional(),
  program: z.string().max(100).nullable().optional(),
  level: z.string().max(20).nullable().optional(),
});

export async function GET() {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const quizzes = await prisma.quiz.findMany({
    where: { isAdminQuiz: true },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      title: true,
      description: true,
      status: true,
      faculty: true,
      department: true,
      program: true,
      level: true,
      createdAt: true,
      _count: { select: { questions: true, attempts: true } },
      creator: { select: { name: true } },
    },
  });

  return NextResponse.json({ quizzes });
}

export async function POST(req: NextRequest) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await req.json().catch(() => null);
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Invalid input." }, { status: 400 });
  const d = parsed.data;

  if (!(await ollamaHealthy())) {
    return NextResponse.json({ error: "The AI service is unavailable." }, { status: 503 });
  }

  const spec = {
    title: d.title,
    description: d.description,
    count: d.count ?? 5,
    level: d.level,
    department: d.department,
    faculty: d.faculty,
    docText: null,
  };
  const { system, user: userPrompt } = buildQuizPrompt(spec);

  let cleaned: any;
  try {
    const raw = await generate(userPrompt, { system });
    cleaned = parseJsonBlock(raw);
  } catch (err) {
    return NextResponse.json(
      { error: "Quiz generation failed: " + ((err as Error)?.message || "unknown") },
      { status: 502 }
    );
  }

  const quiz = sanitizeQuiz(cleaned);
  if (quiz.questions.length === 0) {
    return NextResponse.json({ error: "No valid questions were generated." }, { status: 502 });
  }

  const created = await prisma.quiz.create({
    data: {
      title: quiz.title,
      description: quiz.description || null,
      creatorId: admin.id,
      isAdminQuiz: true,
      status: "PUBLISHED",
      faculty: d.faculty?.trim() || null,
      department: d.department?.trim() || null,
      program: d.program?.trim() || null,
      level: d.level?.trim() || null,
      generatedFrom: "topic",
      questions: {
        create: quiz.questions.map((q, i) => ({
          prompt: q.prompt,
          options: JSON.stringify(q.options),
          correctIndex: q.correctIndex,
          explanation: q.explanation,
          order: i,
        })),
      },
    },
  });

  return NextResponse.json({ quizId: created.id, questionCount: quiz.questions.length });
}
