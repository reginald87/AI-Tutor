import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth";
import { ollamaHealthy, getActiveModel } from "@/lib/ollama";

export const runtime = "nodejs";

const schema = z.object({
  defaultPromptsPerDay: z.number().int().min(1).max(500).optional(),
  defaultPromptsPerWeek: z.number().int().min(1).max(5000).optional(),
  defaultModel: z.string().min(1).max(100).optional(),
});

export async function GET() {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const setting = await prisma.setting.findUnique({ where: { id: "global" } });
  const model = await getActiveModel();
  const healthy = await ollamaHealthy();
  return NextResponse.json({ setting, model, ollamaHealthy: healthy });
}

export async function PUT(req: NextRequest) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Invalid input." }, { status: 400 });

  const data: any = { ...parsed.data };
  if (data.defaultPromptsPerWeek === undefined && data.defaultPromptsPerDay !== undefined) {
    data.defaultPromptsPerWeek = data.defaultPromptsPerDay * 7;
  }

  const setting = await prisma.setting.upsert({
    where: { id: "global" },
    update: data,
    create: { id: "global", ...data },
  });

  return NextResponse.json({ setting });
}
