import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth";

export const runtime = "nodejs";

const schema = z.object({
  answer: z.string().min(1).max(4000),
  status: z.enum(["OPEN", "ANSWERED", "CLOSED"]).optional(),
});

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Invalid input." }, { status: 400 });

  const ticket = await prisma.escalation.update({
    where: { id: params.id },
    data: {
      answer: parsed.data.answer,
      status: parsed.data.status ?? "ANSWERED",
      answeredById: admin.id,
    },
  });
  return NextResponse.json({ ticket });
}
