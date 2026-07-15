import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth";

export const runtime = "nodejs";

const schema = z.object({
  quizId: z.string().min(1),
  title: z.string().min(1).max(160),
  faculty: z.string().max(80).optional(),
  department: z.string().max(80).optional(),
  program: z.string().max(80).optional(),
  level: z.string().max(40).optional(),
  dueAt: z.string().datetime().optional(),
});

export async function GET() {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const assignments = await prisma.assignment.findMany({
    orderBy: { createdAt: "desc" },
    include: { quiz: { select: { id: true, title: true, _count: { select: { questions: true } } } } },
  });
  return NextResponse.json({ assignments });
}

export async function POST(req: NextRequest) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Invalid input." }, { status: 400 });
  const { quizId, title, faculty, department, program, level, dueAt } = parsed.data;

  const quiz = await prisma.quiz.findUnique({ where: { id: quizId } });
  if (!quiz) return NextResponse.json({ error: "Quiz not found." }, { status: 404 });

  const assignment = await prisma.assignment.create({
    data: {
      quizId,
      assignedById: admin.id,
      title,
      faculty: faculty || null,
      department: department || null,
      program: program || null,
      level: level || null,
      dueAt: dueAt ? new Date(dueAt) : null,
    },
  });
  return NextResponse.json({ assignment });
}

export async function DELETE(req: NextRequest) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const id = new URL(req.url).searchParams.get("id");
  if (!id) return NextResponse.json({ error: "Missing id." }, { status: 400 });
  await prisma.assignment.delete({ where: { id } }).catch(() => {});
  return NextResponse.json({ ok: true });
}
