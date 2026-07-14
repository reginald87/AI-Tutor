import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getCurrentUser, requireVerifiedUser } from "@/lib/auth";
import { consumePrompt, getPromptState } from "@/lib/prompts";
import { generate, ollamaHealthy, parseJsonBlock } from "@/lib/ollama";
import { buildQuizPrompt } from "@/lib/llm";
import { sanitizeQuiz } from "@/lib/quiz";

export const runtime = "nodejs";
export const maxDuration = 60;

const generateSchema = z.object({
  title: z.string().max(160).optional(),
  description: z.string().max(500).optional(),
  count: z.number().int().min(1).max(20).optional(),
  fromDoc: z.string().optional(),
  topic: z.string().max(300).optional(),
});

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const own = await prisma.quiz.findMany({
    where: { creatorId: user.id, isAdminQuiz: false },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      title: true,
      description: true,
      createdAt: true,
      generatedFrom: true,
      _count: { select: { questions: true } },
      attempts: {
        where: { userId: user.id },
        select: { percentage: true, completedAt: true },
        orderBy: { completedAt: "desc" },
        take: 1,
      },
    },
  });

  const available = await prisma.quiz.findMany({
    where: {
      isAdminQuiz: true,
      status: "PUBLISHED",
      AND: [
        { OR: [{ faculty: null }, { faculty: "" }, { faculty: user.faculty }] },
        { OR: [{ department: null }, { department: "" }, { department: user.department }] },
        { OR: [{ program: null }, { program: "" }, { program: user.program }] },
        { OR: [{ level: null }, { level: "" }, { level: user.level }] },
      ],
    },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      title: true,
      description: true,
      faculty: true,
      department: true,
      program: true,
      level: true,
      createdAt: true,
      _count: { select: { questions: true } },
      creator: { select: { name: true } },
      attempts: {
        where: { userId: user.id },
        select: { percentage: true, completedAt: true },
        orderBy: { completedAt: "desc" },
        take: 1,
      },
    },
  });

  return NextResponse.json({ own, available });
}

export async function POST(req: NextRequest) {
  const user = await requireVerifiedUser();
  if (!user) {
    return NextResponse.json(
      { error: "Please verify your email to generate quizzes." },
      { status: 403 }
    );
  }

  const body = await req.json().catch(() => null);
  const parsed = generateSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Invalid input." }, { status: 400 });
  const { title, description, count, fromDoc, topic } = parsed.data;

  let docText: string | null = null;
  if (fromDoc) {
    const doc = await prisma.document.findFirst({ where: { id: fromDoc, userId: user.id } });
    docText = doc?.text || null;
  }

  if (!docText && !topic?.trim()) {
    return NextResponse.json(
      { error: "Upload a document or provide a topic to generate a quiz." },
      { status: 400 }
    );
  }

  if (!(await ollamaHealthy())) {
    return NextResponse.json(
      { error: "The AI service is unavailable. Please try again later." },
      { status: 503 }
    );
  }

  try {
    await consumePrompt(user.id);
  } catch {
    const state = await getPromptState(user.id);
    return NextResponse.json(
      { error: "You have used all your prompts for now.", state },
      { status: 429 }
    );
  }

  const spec = {
    title: title || (topic ? `Quiz: ${topic}` : "Generated Quiz"),
    description,
    count: count ?? 5,
    level: user.level,
    department: user.department,
    faculty: user.faculty,
    docText,
  };
  const { system, user: userPrompt } = buildQuizPrompt(spec);

  let raw: string;
  try {
    raw = await generate(userPrompt, { system });
  } catch (err) {
    return NextResponse.json(
      { error: "Quiz generation failed: " + ((err as Error)?.message || "unknown error") },
      { status: 502 }
    );
  }

  let cleaned: any;
  try {
    cleaned = parseJsonBlock(raw);
  } catch {
    return NextResponse.json(
      { error: "The model returned an invalid quiz. Please retry." },
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
      creatorId: user.id,
      isAdminQuiz: false,
      sourceDocId: fromDoc || null,
      generatedFrom: docText ? "document" : "topic",
      status: "PUBLISHED",
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
