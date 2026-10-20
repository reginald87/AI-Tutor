"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/AuthProvider";
import { apiGet, apiPost, pollUntil } from "@/lib/api";

export default function QuizzesPage() {
  const { prompts, refresh } = useAuth();
  const router = useRouter();

  const [own, setOwn] = useState<any[]>([]);
  const [available, setAvailable] = useState<any[]>([]);
  const [documents, setDocuments] = useState<any[]>([]);
  const [tab, setTab] = useState<"mine" | "available">("mine");

  const [title, setTitle] = useState("");
  const [topic, setTopic] = useState("");
  const [fromDoc, setFromDoc] = useState("");
  const [count, setCount] = useState(5);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function load() {
    const [q, d] = await Promise.all([
      apiGet("/api/quizzes").catch(() => ({ own: [], available: [] })),
      apiGet("/api/documents").catch(() => ({ documents: [] })),
    ]);
    setOwn(q.own || []);
    setAvailable(q.available || []);
    setDocuments(d.documents || []);
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function generate() {
    setError("");
    if (prompts?.exhausted) {
      setError("No prompts left to generate a quiz.");
      return;
    }
    if (!fromDoc && !topic.trim()) {
      setError("Choose a document or enter a topic.");
      return;
    }
    setBusy(true);
    try {
      const res = await apiPost<{ quizId: string }>("/api/quizzes", {
        title: title || undefined,
        topic: topic || undefined,
        fromDoc: fromDoc || undefined,
        count,
      });
      setError("Generating quiz… this can take a few minutes on the server.");
      await pollUntil(async () => {
        const data = await apiGet("/api/quizzes");
        const quiz = (data.own || []).find((q: any) => q.id === res.quizId);
        if (quiz?.status === "FAILED") {
          throw new Error(quiz.error || "Quiz generation failed. Please try again.");
        }
        return quiz?.status === "PUBLISHED";
      });
      setError("");
      await refresh();
      router.push(`/dashboard/quizzes/${res.quizId}`);
    } catch (err: any) {
      setError(err.message || "Generation failed.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto max-w-5xl px-6 py-8">
      <h1 className="text-2xl font-bold text-slate-800">Quizzes</h1>
      <p className="mt-1 text-sm text-slate-500">
        Generate a quiz from your notes or a topic, or take quizzes published by BMU.
      </p>

      {prompts?.exhausted && (
        <div className="mt-5 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          You have used all your prompts. Quiz generation needs a prompt — they refill daily and
          weekly. You can still take existing quizzes.
        </div>
      )}

      <div className="mt-6 grid gap-6 lg:grid-cols-[360px_1fr]">
        {/* Generator */}
        <div className="card h-fit p-5">
          <h2 className="font-semibold text-slate-800">Generate a quiz</h2>
          <p className="mt-1 text-xs text-slate-400">Costs 1 prompt.</p>
          <div className="mt-4 space-y-3">
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">Title (optional)</label>
              <input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="input"
                placeholder="Cardiovascular system"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">
                From a document
              </label>
              <select value={fromDoc} onChange={(e) => setFromDoc(e.target.value)} className="input">
                <option value="">— None (use a topic) —</option>
                {documents.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.filename}
                  </option>
                ))}
              </select>
              {documents.length === 0 && (
                <p className="mt-1 text-xs text-slate-400">
                  No documents yet. Upload notes in the chat first.
                </p>
              )}
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">
                …or a topic
              </label>
              <input
                value={topic}
                onChange={(e) => setTopic(e.target.value)}
                className="input"
                placeholder="Explain the process of glycolysis"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">
                Number of questions: {count}
              </label>
              <input
                type="range"
                min={3}
                max={15}
                value={count}
                onChange={(e) => setCount(Number(e.target.value))}
                className="w-full accent-brand-600"
              />
            </div>
            {error && <p className="text-sm text-red-600">{error}</p>}
            <button
              onClick={generate}
              disabled={busy || !!prompts?.exhausted}
              className="btn-primary w-full"
            >
              {busy ? "Generating…" : "Generate quiz"}
            </button>
          </div>
        </div>

        {/* Lists */}
        <div>
          <div className="mb-3 flex gap-2">
            <button
              onClick={() => setTab("mine")}
              className={`btn ${tab === "mine" ? "bg-brand-600 text-white" : "btn-outline"}`}
            >
              My quizzes ({own.length})
            </button>
            <button
              onClick={() => setTab("available")}
              className={`btn ${tab === "available" ? "bg-brand-600 text-white" : "btn-outline"}`}
            >
              From BMU ({available.length})
            </button>
          </div>

<div className="grid gap-3 sm:grid-cols-2">
            {(tab === "mine" ? own : available).map((q) => {
              const best = q.attempts?.[0];
              const item = (
                <>
                  <div className="flex items-start justify-between gap-2">
                    <h3 className="font-semibold text-slate-800">{q.title}</h3>
                    <div className="flex shrink-0 items-center gap-1">
                      {q.status === "GENERATING" && (
                        <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-700">
                          Generating…
                        </span>
                      )}
                      {q.status === "FAILED" && (
                        <span className="rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-700">
                          Failed
                        </span>
                      )}
                      <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-500">
                        {q._count?.questions ?? 0} Q
                      </span>
                    </div>
                  </div>
                  {q.description && (
                    <p className="mt-1 line-clamp-2 text-sm text-slate-500">{q.description}</p>
                  )}
                  {q.status === "FAILED" && q.error && (
                    <p className="mt-1 text-xs text-red-500">{q.error}</p>
                  )}
                  {tab === "available" && (
                    <p className="mt-1 text-xs text-slate-400">
                      {[q.faculty, q.department, q.level].filter(Boolean).join(" · ") || "General"}
                      {q.creator?.name ? ` · by ${q.creator.name}` : ""}
                    </p>
                  )}
                  <div className="mt-3 text-xs font-medium">
                    {q.status === "PUBLISHED" ? (
                      best ? (
                        <span className="text-brand-600">
                          Best score: {best.percentage}% ·{" "}
                          {new Date(best.completedAt).toLocaleDateString()}
                        </span>
                      ) : (
                        <span className="text-slate-400">Not attempted yet →</span>
                      )
                    ) : (
                      <span className="text-slate-400">…</span>
                    )}
                  </div>
                </>
              );
              const publishable = q.status === "PUBLISHED";
              return publishable ? (
                <Link
                  key={q.id}
                  href={`/dashboard/quizzes/${q.id}`}
                  className="card block p-4 transition hover:border-brand-300 hover:shadow"
                >
                  {item}
                </Link>
              ) : (
                <div key={q.id} className="card block p-4">
                  {item}
                </div>
              );
            })}
            {(tab === "mine" ? own : available).length === 0 && (
              <p className="col-span-2 rounded-xl border border-dashed border-slate-200 p-6 text-center text-sm text-slate-400">
                No quizzes here yet.
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
