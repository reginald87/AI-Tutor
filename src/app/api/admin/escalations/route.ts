import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth";

export const runtime = "nodejs";

export async function GET(req: Request) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const status = new URL(req.url).searchParams.get("status");
  const tickets = await prisma.escalation.findMany({
    where: status ? { status } : {},
    orderBy: [{ status: "asc" }, { createdAt: "desc" }],
    select: {
      id: true,
      subject: true,
      message: true,
      status: true,
      answer: true,
      chatId: true,
      createdAt: true,
      updatedAt: true,
      user: { select: { id: true, name: true, email: true, faculty: true, department: true, level: true } },
    },
  });
  return NextResponse.json({ tickets });
}
