import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { getPromptState } from "@/lib/prompts";

export const runtime = "nodejs";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ user: null }, { status: 401 });
  }
  const prompts = await getPromptState(user.id);
  return NextResponse.json({ user, prompts });
}
