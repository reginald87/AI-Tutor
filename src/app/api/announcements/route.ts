import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";

export const runtime = "nodejs";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const announcements = await prisma.announcement.findMany({
    where: {
      AND: [
        { OR: [{ faculty: null }, { faculty: "" }, { faculty: user.faculty }] },
        { OR: [{ department: null }, { department: "" }, { department: user.department }] },
        { OR: [{ program: null }, { program: "" }, { program: user.program }] },
        { OR: [{ level: null }, { level: "" }, { level: user.level }] },
      ],
    },
    orderBy: [{ pinned: "desc" }, { createdAt: "desc" }],
    select: {
      id: true,
      title: true,
      body: true,
      pinned: true,
      createdAt: true,
      author: { select: { name: true } },
    },
  });

  return NextResponse.json({ announcements });
}
