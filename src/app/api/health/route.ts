import { NextResponse } from "next/server";
import { ollamaHealthy, getActiveModel } from "@/lib/ollama";

export const runtime = "nodejs";

export async function GET() {
  return NextResponse.json({
    ollamaHealthy: await ollamaHealthy(),
    model: await getActiveModel(),
  });
}
