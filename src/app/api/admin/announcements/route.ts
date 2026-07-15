import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth";

export const runtime = "nodejs";

const schema = z.object({
  title: z.string().min(1).max(160),
  body: z.string().min(1).max(4000),
  faculty: z.string().max(80).optional(),
  department: z.string().max(80).optional(),
  program: z.string().max(80).optional(),
  level: z.string().max(40).optional(),
  pinned: z.boolean().optional(),
});

export async function GET() {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const announcements = await prisma.announcement.findMany({
    orderBy: [{ pinned: "desc" }, { createdAt: "desc" }],
    select: {
      id: true,
      title: true,
      body: true,
      pinned: true,
      faculty: true,
      department: true,
      program: true,
      level: true,
      createdAt: true,
      author: { select: { name: true } },
    },
  });
  return NextResponse.json({ announcements });
}

export async function POST(req: NextRequest) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Invalid input." }, { status: 400 });
  const { title, body: text, faculty, department, program, level, pinned } = parsed.data;

  const announcement = await prisma.announcement.create({
    data: {
      authorId: admin.id,
      title,
      body: text,
      faculty: faculty || null,
      department: department || null,
      program: program || null,
      level: level || null,
      pinned: pinned ?? false,
    },
  });

  return NextResponse.json({ announcement });
}

export async function DELETE(req: NextRequest) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const id = new URL(req.url).searchParams.get("id");
  if (!id) return NextResponse.json({ error: "Missing id." }, { status: 400 });
  await prisma.announcement.delete({ where: { id } }).catch(() => {});
  return NextResponse.json({ ok: true });
}
