import { NextRequest, NextResponse } from "next/server";
import { randomBytes } from "crypto";
import { z } from "zod";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth";
import { sendAdminPasswordResetEmail, isMailConfigured } from "@/lib/mailer";

export const runtime = "nodejs";

const schema = z.object({ newPassword: z.string().min(6).max(100).optional() });

function generatePassword(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789";
  let out = "";
  const bytes = randomBytes(12);
  for (let i = 0; i < 12; i++) out += chars[bytes[i] % chars.length];
  return out;
}

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Invalid input." }, { status: 400 });

  const student = await prisma.user.findUnique({ where: { id: params.id } });
  if (!student) return NextResponse.json({ error: "Student not found." }, { status: 404 });

  const newPassword = parsed.data.newPassword || generatePassword();
  const passwordHash = await bcrypt.hash(newPassword, 10);

  await prisma.user.update({
    where: { id: student.id },
    data: {
      passwordHash,
      mustChangePassword: true,
      resetToken: null,
      resetTokenExpires: null,
    },
  });

  let emailSent = false;
  try {
    emailSent = await sendAdminPasswordResetEmail(student.email, student.name, newPassword);
  } catch (err) {
    if (isMailConfigured()) console.error("[mailer] admin reset email failed:", (err as Error)?.message);
  }

  return NextResponse.json({ ok: true, password: newPassword, emailSent });
}
