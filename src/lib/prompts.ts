import { prisma } from "./prisma";

function addDays(d: Date, n: number): Date {
  return new Date(d.getTime() + n * 86_400_000);
}

export interface PromptState {
  promptsPerDay: number;
  promptsPerWeek: number;
  dailyUsed: number;
  weeklyUsed: number;
  dailyRemaining: number;
  weeklyRemaining: number;
  dailyResetsAt: Date;
  weeklyResetsAt: Date;
  exhausted: boolean;
  reason?: "daily" | "weekly";
}

/**
 * Reads the user, rolls over the daily/weekly counters if their window has
 * elapsed, persists the rollover, and returns the current prompt state.
 */
export async function getPromptState(userId: string): Promise<PromptState> {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) throw new Error("User not found");

  const now = new Date();
  let { dailyUsed, weeklyUsed, dailyResetAt, weeklyResetAt } = user;
  let changed = false;

  if (now >= addDays(dailyResetAt, 1)) {
    dailyUsed = 0;
    dailyResetAt = now;
    changed = true;
  }
  if (now >= addDays(weeklyResetAt, 7)) {
    weeklyUsed = 0;
    weeklyResetAt = now;
    changed = true;
  }

  if (changed) {
    const updated = await prisma.user.update({
      where: { id: userId },
      data: { dailyUsed, weeklyUsed, dailyResetAt, weeklyResetAt },
    });
    dailyUsed = updated.dailyUsed;
    weeklyUsed = updated.weeklyUsed;
  }

  const dailyRemaining = Math.max(0, user.promptsPerDay - dailyUsed);
  const weeklyRemaining = Math.max(0, user.promptsPerWeek - weeklyUsed);
  const exhausted = dailyRemaining <= 0 || weeklyRemaining <= 0;

  return {
    promptsPerDay: user.promptsPerDay,
    promptsPerWeek: user.promptsPerWeek,
    dailyUsed,
    weeklyUsed,
    dailyRemaining,
    weeklyRemaining,
    dailyResetsAt: dailyResetAt,
    weeklyResetsAt: weeklyResetAt,
    exhausted,
    reason: dailyRemaining <= 0 ? "daily" : weeklyRemaining <= 0 ? "weekly" : undefined,
  };
}

/**
 * Consumes a single prompt for an AI generation request. Returns the updated
 * state, or throws if the user is out of prompts.
 */
export async function consumePrompt(userId: string): Promise<PromptState> {
  const state = await getPromptState(userId);
  if (state.exhausted) {
    const err = new Error("Out of prompts") as Error & { code?: string };
    err.code = "NO_PROMPTS";
    throw err;
  }

  await prisma.user.update({
    where: { id: userId },
    data: { dailyUsed: { increment: 1 }, weeklyUsed: { increment: 1 } },
  });

  const next = await getPromptState(userId);
  return next;
}
