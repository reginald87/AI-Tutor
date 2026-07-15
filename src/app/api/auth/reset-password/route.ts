import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { signSession, setSessionCookie } from "@/lib/auth";
import { serializeUser } from "@/lib/serialize";

export const runtime = "nodejs";

const schema = z.object({
  token: z.string().min(10),
  newPassword: z.string().min(6).max(100),
});

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }
  const { token, newPassword } = parsed.data;

  const user = await prisma.user.findFirst({
    where: { resetToken: token, resetTokenExpires: { gt: new Date() } },
  });
  if (!user) {
    return NextResponse.json(
      { error: "This reset link is invalid or has expired. Request a new one." },
      { status: 400 }
    );
  }

  const passwordHash = await bcrypt.hash(newPassword, 10);
  await prisma.user.update({
    where: { id: user.id },
    data: { passwordHash, resetToken: null, resetTokenExpires: null, mustChangePassword: false },
  });

  // Auto-login after a successful reset for convenience.
  const sessionToken = await signSession({
    userId: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
  });
  setSessionCookie(sessionToken);

  return NextResponse.json({ ok: true, user: serializeUser(user) });
}
