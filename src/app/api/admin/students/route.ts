import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { searchParams } = new URL(req.url);
  const q = searchParams.get("q")?.toLowerCase();
  const verified = searchParams.get("verified");

  const where: any = { role: "STUDENT" };
  if (q) {
    where.OR = [
      { name: { contains: q } },
      { email: { contains: q } },
      { matricNumber: { contains: q } },
    ];
  }
  if (verified === "true") where.verified = true;
  if (verified === "false") where.verified = false;

  const students = await prisma.user.findMany({
    where,
    orderBy: [{ verified: "asc" }, { createdAt: "desc" }],
    select: {
      id: true,
      name: true,
      email: true,
      matricNumber: true,
      department: true,
      faculty: true,
      program: true,
      level: true,
      verified: true,
      promptsPerDay: true,
      promptsPerWeek: true,
      dailyUsed: true,
      weeklyUsed: true,
      createdAt: true,
      _count: { select: { attempts: true, quizzes: true } },
    },
  });

  return NextResponse.json({ students });
}
