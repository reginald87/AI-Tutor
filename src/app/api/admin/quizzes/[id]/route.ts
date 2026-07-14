import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth";

export const runtime = "nodejs";

const patchSchema = z.object({
  status: z.enum(["DRAFT", "PUBLISHED"]).optional(),
});

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await req.json().catch(() => null);
  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Invalid input." }, { status: 400 });

  const quiz = await prisma.quiz.findFirst({ where: { id: params.id, isAdminQuiz: true } });
  if (!quiz) return NextResponse.json({ error: "Not found." }, { status: 404 });

  const updated = await prisma.quiz.update({
    where: { id: params.id },
    data: { status: parsed.data.status ?? quiz.status },
  });

  return NextResponse.json({ ok: true, status: updated.status });
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const quiz = await prisma.quiz.findFirst({ where: { id: params.id, isAdminQuiz: true } });
  if (!quiz) return NextResponse.json({ error: "Not found." }, { status: 404 });

  await prisma.quiz.delete({ where: { id: params.id } });
  return NextResponse.json({ ok: true });
}
