"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useAuth } from "@/components/AuthProvider";
import { apiGet } from "@/lib/api";

export default function DashboardHome() {
  const { user, prompts } = useAuth();
  const [chats, setChats] = useState<any[]>([]);
  const [own, setOwn] = useState<any[]>([]);
  const [available, setAvailable] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [analytics, setAnalytics] = useState<any>(null);

  useEffect(() => {
    Promise.all([
      apiGet("/api/chats").catch(() => ({ chats: [] })),
      apiGet("/api/quizzes").catch(() => ({ own: [], available: [] })),
      apiGet("/api/analytics").catch(() => null),
    ]).then(([c, q, a]) => {
      setChats(c.chats || []);
      setOwn(q.own || []);
      setAvailable(q.available || []);
      setAnalytics(a);
      setLoading(false);
    });
  }, []);

  return (
    <div className="mx-auto max-w-5xl px-6 py-8">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">
            Welcome back, {user?.name?.split(" ")[0] || "student"} 👋
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            {user?.faculty || user?.department
              ? `${user.department || ""} · ${user.faculty || ""}`.replace(/^ · | · $/g, "")
              : "Set your faculty & department in your profile for tailored quizzes."}
          </p>
        </div>
        {!user?.verified && (
          <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-medium text-amber-700">
            Verify your email to activate your account
          </span>
        )}
      </div>

      {prompts?.exhausted && (
        <div className="mt-5 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          You have used all your prompts. They refill automatically — daily prompts reset every 24
          hours and weekly prompts every 7 days. You can still review past chats and quiz results.
        </div>
      )}

      <div className="mt-6 grid gap-4 sm:grid-cols-3">
        <StatCard label="Prompts today" value={`${prompts?.dailyRemaining ?? 0}`} sub={`of ${prompts?.promptsPerDay ?? 0}`} />
        <StatCard label="Prompts this week" value={`${prompts?.weeklyRemaining ?? 0}`} sub={`of ${prompts?.promptsPerWeek ?? 0}`} />
        <StatCard label="Reward points" value={`${user?.rewardPoints ?? 0}`} sub="earned from quizzes" />
      </div>

      <div className="mt-8 grid gap-6 lg:grid-cols-2">
        <section className="card p-5">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="font-semibold text-slate-800">Quick actions</h2>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <Link href="/dashboard/chat" className="btn-primary justify-start">
              💬 New chat
            </Link>
            <Link href="/dashboard/quizzes" className="btn-outline justify-start">
              📝 Make a quiz
            </Link>
          </div>
          <p className="mt-4 text-xs leading-relaxed text-slate-400">
            Each AI response (chat reply or quiz generation) uses one prompt. Upload lecture notes in
            the chat to ask questions about them, or generate a quiz from a document or topic.
          </p>
        </section>

        <section className="card p-5">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="font-semibold text-slate-800">Recent chats</h2>
            <Link href="/dashboard/chat" className="text-xs font-medium text-brand-600 hover:underline">
              Open chat →
            </Link>
          </div>
          {loading ? (
            <p className="text-sm text-slate-400">Loading…</p>
          ) : chats.length === 0 ? (
            <p className="text-sm text-slate-400">No chats yet. Start one to talk with your notes.</p>
          ) : (
            <ul className="space-y-1">
              {chats.slice(0, 5).map((c) => (
                <li key={c.id}>
                  <Link
                    href={`/dashboard/chat?chat=${c.id}`}
                    className="flex items-center justify-between rounded-lg px-2 py-2 text-sm text-slate-700 hover:bg-slate-50"
                  >
                    <span className="truncate">{c.title}</span>
                    <span className="ml-2 shrink-0 text-xs text-slate-400">
                      {new Date(c.updatedAt).toLocaleDateString()}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      {analytics && analytics.totalAttempts > 0 && (
        <div className="mt-8 grid gap-6 lg:grid-cols-2">
          <section className="card p-5">
            <h2 className="font-semibold text-slate-800">Your progress</h2>
            <div className="mt-3 flex gap-6">
              <div>
                <div className="text-xs font-medium uppercase tracking-wide text-slate-400">Accuracy</div>
                <div className="text-3xl font-bold text-slate-800">{analytics.accuracy}%</div>
                <div className="text-xs text-slate-400">
                  {analytics.totalCorrect}/{analytics.totalQuestions} correct
                </div>
              </div>
              <div>
                <div className="text-xs font-medium uppercase tracking-wide text-slate-400">Avg score</div>
                <div className="text-3xl font-bold text-slate-800">{analytics.averagePercentage}%</div>
                <div className="text-xs text-slate-400">{analytics.quizzesTaken} quizzes taken</div>
              </div>
            </div>
            {analytics.focusTopic && (
              <Link
                href="/dashboard/quizzes"
                className="mt-4 inline-block rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800"
              >
                🎯 Focus next on: <span className="font-semibold">{analytics.focusTopic}</span>
              </Link>
            )}
          </section>

          <section className="card p-5">
            <h2 className="font-semibold text-slate-800">Weak areas to review</h2>
            {analytics.weakest.length === 0 ? (
              <p className="mt-3 text-sm text-slate-400">No weak spots yet — nice work! 🎉</p>
            ) : (
              <ul className="mt-3 space-y-1">
                {analytics.weakest.map((w: any) => (
                  <li key={w.quizId}>
                    <Link
                      href={`/dashboard/quizzes/${w.quizId}`}
                      className="flex items-center justify-between rounded-lg px-2 py-2 text-sm text-slate-700 hover:bg-slate-50"
                    >
                      <span className="truncate">{w.title}</span>
                      <span className="ml-2 shrink-0 rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-700">
                        best {w.best}%
                      </span>
                    </Link>
                  </li>
                ))}
                {analytics.missedQuestions?.length > 0 && (
                  <li className="pt-2">
                    <Link href="/dashboard/review" className="text-xs font-medium text-brand-600 hover:underline">
                      🔁 {analytics.missedQuestions.length} questions queued for spaced review →
                    </Link>
                  </li>
                )}
              </ul>
            )}
          </section>
        </div>
      )}
    </div>
  );
}

function StatCard({ label, value, sub }: { label: string; value: string; sub: string }) {
  return (
    <div className="card p-4">
      <div className="text-xs font-medium uppercase tracking-wide text-slate-400">{label}</div>
      <div className="mt-1 text-3xl font-bold text-slate-800">{value}</div>
      <div className="text-xs text-slate-400">{sub}</div>
    </div>
  );
}
