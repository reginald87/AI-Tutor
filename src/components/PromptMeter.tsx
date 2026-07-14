"use client";

import { useAuth } from "@/components/AuthProvider";

function fmtTime(iso: string) {
  try {
    return new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  } catch {
    return "";
  }
}

export default function PromptMeter() {
  const { prompts } = useAuth();
  if (!prompts) return null;

  const dailyPct = Math.round((prompts.dailyRemaining / prompts.promptsPerDay) * 100);
  const weeklyPct = Math.round((prompts.weeklyRemaining / prompts.promptsPerWeek) * 100);
  const low = prompts.dailyRemaining <= 1;

  const nextRefill = new Date(
    new Date(prompts.dailyResetsAt).getTime() + 24 * 60 * 60 * 1000
  ).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

  return (
    <div
      className={`rounded-xl border p-3 ${
        prompts.exhausted ? "border-red-200 bg-red-50" : "border-slate-200 bg-slate-50"
      }`}
    >
      <div className="mb-2 flex items-center justify-between">
        <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
          Your prompts
        </span>
        {prompts.exhausted && <span className="text-xs font-semibold text-red-600">Empty</span>}
      </div>

      <div className="mb-2">
        <div className="mb-1 flex items-center justify-between text-xs text-slate-600">
          <span>Today</span>
          <span className="font-medium">
            {prompts.dailyRemaining}/{prompts.promptsPerDay}
          </span>
        </div>
        <div className="h-2 overflow-hidden rounded-full bg-slate-200">
          <div
            className={`h-full rounded-full transition-all ${
              dailyPct <= 20 ? "bg-red-500" : "bg-brand-500"
            }`}
            style={{ width: `${dailyPct}%` }}
          />
        </div>
      </div>

      <div>
        <div className="mb-1 flex items-center justify-between text-xs text-slate-600">
          <span>This week</span>
          <span className="font-medium">
            {prompts.weeklyRemaining}/{prompts.promptsPerWeek}
          </span>
        </div>
        <div className="h-2 overflow-hidden rounded-full bg-slate-200">
          <div
            className={`h-full rounded-full transition-all ${
              weeklyPct <= 20 ? "bg-amber-500" : "bg-accent-500"
            }`}
            style={{ width: `${weeklyPct}%` }}
          />
        </div>
      </div>

      <p className={`mt-2 text-[11px] ${low ? "text-red-600" : "text-slate-400"}`}>
        {prompts.exhausted
          ? `Refills at ${nextRefill}.`
          : low
          ? `Only ${prompts.dailyRemaining} prompt left today — use it wisely.`
          : `Daily prompts refill at ${nextRefill}.`}
      </p>
    </div>
  );
}
