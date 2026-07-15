"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/components/AuthProvider";
import { apiGet, apiPost } from "@/lib/api";

interface ReviewItem {
  id: string;
  quizId: string;
  questionId: string;
  prompt: string;
  options: string;
  correctIndex: number;
  explanation: string | null;
  dueAt: string;
  interval: number;
  repetitions: number;
}

interface ReviewResponse {
  due: ReviewItem[];
  dueCount: number;
  total: number;
}

export default function ReviewPage() {
  const { refresh } = useAuth();

  const [loading, setLoading] = useState(true);
  const [due, setDue] = useState<ReviewItem[]>([]);
  const [dueCount, setDueCount] = useState(0);
  const [total, setTotal] = useState(0);
  const [error, setError] = useState("");

  const [current, setCurrent] = useState<ReviewItem | null>(null);
  const [selected, setSelected] = useState<number | null>(null);
  const [revealed, setRevealed] = useState(false);
  const [busy, setBusy] = useState(false);

  async function load() {
    setLoading(true);
    setError("");
    try {
      const res = await apiGet<ReviewResponse>("/api/review").catch(() => ({
        due: [],
        dueCount: 0,
        total: 0,
      }));
      setDue(res.due || []);
      setDueCount(res.dueCount ?? 0);
      setTotal(res.total ?? 0);
      setCurrent((res.due && res.due[0]) || null);
      setSelected(null);
      setRevealed(false);
    } catch (err: any) {
      setError(err.message || "Could not load review queue.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function rate(rating: number) {
    if (!current) return;
    setBusy(true);
    try {
      await apiPost(`/api/review/${current.id}`, { rating });
      await refresh();
      await load();
    } catch (err: any) {
      setError(err.message || "Could not save rating.");
    } finally {
      setBusy(false);
    }
  }

  function parseOptions(item: ReviewItem): string[] {
    try {
      const parsed = JSON.parse(item.options);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }

  if (loading) {
    return (
      <div className="mx-auto max-w-5xl px-6 py-8">
        <h1 className="text-2xl font-bold text-slate-800">Review mistakes</h1>
        <p className="mt-4 text-sm text-slate-500">Loading your review queue…</p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl px-6 py-8">
      <h1 className="text-2xl font-bold text-slate-800">Review mistakes</h1>
      <p className="mt-1 text-sm text-slate-500">
        Spaced repetition for questions you got wrong.
      </p>

      <div className="mt-4 flex gap-2 text-sm">
        <span className="rounded-full bg-slate-100 px-3 py-1 font-medium text-slate-600">
          {dueCount} due
        </span>
        <span className="rounded-full bg-slate-100 px-3 py-1 text-slate-500">
          {total} tracked
        </span>
      </div>

      {error && (
        <div className="mt-4 rounded-lg border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-700">
          {error}
        </div>
      )}

      {current ? (
        <div className="card mt-6 p-6">
          <div className="text-xs font-medium text-slate-400">
            {dueCount} due · question from quiz
          </div>

          <h2 className="mt-2 text-lg font-semibold text-slate-800">{current.prompt}</h2>

          <div className="mt-4 space-y-2">
            {parseOptions(current).map((opt, i) => {
              const isCorrect = i === current.correctIndex;
              const isChosen = selected === i;
              let cls =
                "flex items-center gap-3 rounded-lg border px-4 py-3 text-sm transition";
              if (revealed && isCorrect) {
                cls += " border-green-400 bg-green-50 text-green-800";
              } else if (revealed && isChosen) {
                cls += " border-red-400 bg-red-50 text-red-800";
              } else {
                cls += " border-slate-200 bg-white text-slate-700 hover:border-brand-300";
              }
              return (
                <label key={i} className={cls}>
                  <input
                    type="radio"
                    name="option"
                    checked={isChosen}
                    disabled={revealed}
                    onChange={() => setSelected(i)}
                    className="accent-brand-600"
                  />
                  <span>{opt}</span>
                </label>
              );
            })}
          </div>

          {revealed && current.explanation && (
            <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-4">
              <p className="text-xs uppercase tracking-wide text-slate-400">Explanation</p>
              <p className="mt-1 text-sm text-slate-700">{current.explanation}</p>
            </div>
          )}

          {!revealed ? (
            <div className="mt-5 flex gap-2">
              <button
                onClick={() => setRevealed(true)}
                disabled={selected === null}
                className="btn-outline flex-1"
              >
                {selected === null ? "Select an answer" : "Reveal answer"}
              </button>
            </div>
          ) : (
            <div className="mt-5 grid grid-cols-3 gap-2">
              <button onClick={() => rate(1)} disabled={busy} className="btn-outline">
                Again
              </button>
              <button onClick={() => rate(3)} disabled={busy} className="btn">
                Good
              </button>
              <button onClick={() => rate(5)} disabled={busy} className="btn-primary">
                Easy
              </button>
            </div>
          )}
        </div>
      ) : (
        <div className="mt-6 rounded-xl border border-dashed border-slate-200 p-10 text-center">
          <div className="text-4xl">✅</div>
          <h2 className="mt-3 text-lg font-semibold text-slate-800">
            Nothing due right now
          </h2>
          <p className="mt-1 text-sm text-slate-500">
            Great work! Come back when your next review items are scheduled.
          </p>
        </div>
      )}
    </div>
  );
}
