import { NextRequest, NextResponse } from "next/server";
import { randomBytes } from "crypto";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { CONFIG } from "@/lib/config";
import { sendPasswordResetEmail, isMailConfigured } from "@/lib/mailer";

export const runtime = "nodejs";

const schema = z.object({ email: z.string().email() });

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Please enter a valid email." }, { status: 400 });
  }
  const email = parsed.data.email.toLowerCase();

  // Always return the same generic response to avoid leaking which emails exist.
  const generic = NextResponse.json({ ok: true });

  const user = await prisma.user.findFirst({ where: { email } });
  if (!user) return generic;

  const resetToken = randomBytes(32).toString("hex");
  const resetTokenExpires = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

  await prisma.user.update({
    where: { id: user.id },
    data: { resetToken, resetTokenExpires },
  });

  let emailSent = false;
  let devResetUrl: string | undefined;
  try {
    emailSent = await sendPasswordResetEmail(user.email, user.name, resetToken);
  } catch (err) {
    if (isMailConfigured()) console.error("[mailer] reset email failed:", (err as Error)?.message);
  }
  if (!emailSent && process.env.NODE_ENV !== "production") {
    devResetUrl = `${CONFIG.appUrl}/reset-password?token=${resetToken}`;
  }

  const data: Record<string, unknown> = { ok: true };
  if (devResetUrl) data.devResetUrl = devResetUrl;
  return NextResponse.json(data);
}
