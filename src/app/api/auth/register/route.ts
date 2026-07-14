import { NextRequest, NextResponse } from "next/server";
import { randomBytes } from "crypto";
import { z } from "zod";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { serializeUser } from "@/lib/serialize";
import { CONFIG } from "@/lib/config";
import { sendVerificationEmail, isMailConfigured } from "@/lib/mailer";

export const runtime = "nodejs";

const schema = z.object({
  name: z.string().min(2).max(100),
  email: z.string().email(),
  password: z.string().min(6).max(100),
  matricNumber: z.string().max(30).optional().nullable(),
  department: z.string().max(100).optional().nullable(),
  faculty: z.string().max(100).optional().nullable(),
  program: z.string().max(100).optional().nullable(),
  level: z.string().max(20).optional().nullable(),
});

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid input." }, { status: 400 });
  }
  const d = parsed.data;

  const email = d.email.toLowerCase();
  if (!email.endsWith("@" + CONFIG.allowedEmailDomain)) {
    return NextResponse.json(
      { error: `Only @${CONFIG.allowedEmailDomain} email addresses are allowed to register.` },
      { status: 403 }
    );
  }

  const existing = await prisma.user.findFirst({ where: { email } });
  if (existing) {
    return NextResponse.json({ error: "Email already registered." }, { status: 409 });
  }
  if (d.matricNumber) {
    const byMatric = await prisma.user.findFirst({ where: { matricNumber: d.matricNumber } });
    if (byMatric) {
      return NextResponse.json({ error: "Matric number already in use." }, { status: 409 });
    }
  }

  const setting = await prisma.setting.findUnique({ where: { id: "global" } });
  const passwordHash = await bcrypt.hash(d.password, 10);
  const verifyToken = randomBytes(32).toString("hex");
  const verifyTokenExpires = new Date(Date.now() + 24 * 60 * 60 * 1000);

  const user = await prisma.user.create({
    data: {
      name: d.name,
      email,
      passwordHash,
      matricNumber: d.matricNumber || null,
      department: d.department || null,
      faculty: d.faculty || null,
      program: d.program || null,
      level: d.level || null,
      verified: false,
      verifyToken,
      verifyTokenExpires,
      promptsPerDay: setting?.defaultPromptsPerDay ?? 5,
      promptsPerWeek: setting?.defaultPromptsPerWeek ?? 35,
    },
  });

  // Send the verification email. If SMTP is configured but the send fails we
  // surface the error; if it is simply not configured yet, we still let the
  // account be created (an admin can verify it manually).
  let emailSent = false;
  try {
    emailSent = await sendVerificationEmail(user.email, user.name, verifyToken);
  } catch (err) {
    const message = (err as Error)?.message || "unknown error";
    if (isMailConfigured()) {
      console.error("[mailer] SMTP configured but send failed:", message);
      return NextResponse.json(
        { error: "Could not send the verification email. Please contact an administrator." },
        { status: 502 }
      );
    }
    console.error("[mailer] SMTP not configured — skipping verification email:", message);
  }

  const response: Record<string, unknown> = { ok: true, emailSent, email: user.email };
  // In development only, hand back the link so manual verification is easy.
  if (!emailSent && process.env.NODE_ENV !== "production") {
    response.devVerifyUrl = `${CONFIG.appUrl}/verify-email?token=${verifyToken}`;
  }

  return NextResponse.json(response);
}
