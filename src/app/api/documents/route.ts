import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireVerifiedUser } from "@/lib/auth";
import { extractDocumentText } from "@/lib/docparse";
import { CONFIG } from "@/lib/config";

export const runtime = "nodejs";

export async function GET() {
  const user = await requireVerifiedUser();
  if (!user) return NextResponse.json({ error: "Please verify your email to continue." }, { status: 403 });

  const docs = await prisma.document.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: "desc" },
    select: { id: true, filename: true, size: true, createdAt: true },
  });

  const withLength = docs.map((d) => ({ ...d }));
  return NextResponse.json({ documents: withLength });
}

export async function POST(req: NextRequest) {
  const user = await requireVerifiedUser();
  if (!user) return NextResponse.json({ error: "Please verify your email to upload notes." }, { status: 403 });

  const form = await req.formData().catch(() => null);
  const file = form?.get("file") as File | null;
  if (!file) return NextResponse.json({ error: "No file provided." }, { status: 400 });

  if (file.size > CONFIG.maxUploadBytes) {
    return NextResponse.json(
      { error: `File too large (max ${CONFIG.maxUploadBytes / 1024 / 1024}MB).` },
      { status: 413 }
    );
  }

  const name = file.name.toLowerCase();
  const okType =
    file.type === "application/pdf" ||
    file.type.includes("word") ||
    file.type.includes("officedocument") ||
    file.type === "text/plain" ||
    name.endsWith(".pdf") ||
    name.endsWith(".docx") ||
    name.endsWith(".txt") ||
    name.endsWith(".md");
  if (!okType) {
    return NextResponse.json(
      { error: "Unsupported file. Upload PDF, DOCX, TXT or MD." },
      { status: 415 }
    );
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  let text: string;
  try {
    text = await extractDocumentText(buffer, file.type, file.name);
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 422 });
  }

  if (!text.trim()) {
    return NextResponse.json(
      { error: "No readable text found in this file." },
      { status: 422 }
    );
  }

  const doc = await prisma.document.create({
    data: {
      userId: user.id,
      filename: file.name,
      mimeType: file.type || "application/octet-stream",
      size: file.size,
      text,
    },
  });

  return NextResponse.json({
    document: { id: doc.id, filename: doc.filename, size: doc.size, createdAt: doc.createdAt },
    chars: text.length,
  });
}
