import { NextRequest, NextResponse } from "next/server";
import { randomBytes } from "crypto";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { sendVerificationEmail, isMailConfigured } from "@/lib/mailer";

export const runtime = "nodejs";

const schema = z.object({ email: z.string().email() });

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid input." }, { status: 400 });
  }
  const email = parsed.data.email.toLowerCase();

  // Always respond ok to avoid revealing which emails exist.
  const user = await prisma.user.findFirst({ where: { email } });
  if (user && !user.verified) {
    const verifyToken = randomBytes(32).toString("hex");
    const verifyTokenExpires = new Date(Date.now() + 24 * 60 * 60 * 1000);
    await prisma.user.update({
      where: { id: user.id },
      data: { verifyToken, verifyTokenExpires },
    });
    try {
      await sendVerificationEmail(user.email, user.name, verifyToken);
    } catch (err) {
      if (isMailConfigured()) {
        return NextResponse.json({ error: "Could not send the email. Please contact an administrator." }, { status: 502 });
      }
      console.error("[mailer] SMTP not configured — skipping verification email:", (err as Error)?.message);
    }
  }

  return NextResponse.json({ ok: true });
}
