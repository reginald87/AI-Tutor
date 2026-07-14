import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { signSession, setSessionCookie } from "@/lib/auth";
import { sendVerificationEmail, isMailConfigured } from "@/lib/mailer";

export const runtime = "nodejs";

const schema = z.object({ token: z.string().min(10) });

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid verification link." }, { status: 400 });
  }

  const user = await prisma.user.findFirst({
    where: { verifyToken: parsed.data.token, verifyTokenExpires: { gt: new Date() } },
  });
  if (!user) {
    return NextResponse.json(
      { error: "This verification link is invalid or has expired. Request a new one." },
      { status: 400 }
    );
  }

  await prisma.user.update({
    where: { id: user.id },
    data: { verified: true, verifyToken: null, verifyTokenExpires: null },
  });

  const token = await signSession({
    userId: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
  });
  setSessionCookie(token);

  return NextResponse.json({ ok: true });
}
