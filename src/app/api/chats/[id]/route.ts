import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";

export const runtime = "nodejs";

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const chat = await prisma.chat.findFirst({
    where: { id: params.id, userId: user.id },
    include: {
      messages: { orderBy: { createdAt: "asc" } },
    },
  });
  if (!chat) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const doc = chat.docId
    ? await prisma.document.findFirst({
        where: { id: chat.docId, userId: user.id },
        select: { id: true, filename: true },
      })
    : null;

  return NextResponse.json({ chat: { ...chat, activeDoc: doc } });
}
