import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth";

export const runtime = "nodejs";

const patchSchema = z.object({
  verified: z.boolean().optional(),
  role: z.enum(["STUDENT", "ADMIN"]).optional(),
  promptsPerDay: z.number().int().min(1).max(500).optional(),
  promptsPerWeek: z.number().int().min(1).max(5000).optional(),
  department: z.string().max(100).nullable().optional(),
  faculty: z.string().max(100).nullable().optional(),
  program: z.string().max(100).nullable().optional(),
  level: z.string().max(20).nullable().optional(),
});

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await req.json().catch(() => null);
  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Invalid input." }, { status: 400 });

  const data: any = { ...parsed.data };
  if (data.promptsPerWeek === undefined && data.promptsPerDay !== undefined) {
    data.promptsPerWeek = data.promptsPerDay * 7;
  }

  const student = await prisma.user.update({ where: { id: params.id }, data });
  return NextResponse.json({ ok: true, student });
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  await prisma.user.delete({ where: { id: params.id } }).catch(() => null);
  return NextResponse.json({ ok: true });
}
