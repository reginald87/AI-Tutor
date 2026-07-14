"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { apiGet, apiPost } from "@/lib/api";

export default function TakeQuizPage() {
  const { id } = useParams<{ id: string }>();
  const [quiz, setQuiz] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [answers, setAnswers] = useState<Record<string, number>>({});
  const [results, setResults] = useState<any>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    apiGet(`/api/quizzes/${id}`)
      .then((d) => setQuiz(d.quiz))
      .catch(() => setError("Quiz not found."))
      .finally(() => setLoading(false));
  }, [id]);

  function choose(qid: string, index: number) {
    setAnswers((prev) => ({ ...prev, [qid]: index }));
  }

  async function submit() {
    if (Object.keys(answers).length < (quiz?.questions?.length || 0)) {
      setError("Please answer all questions before submitting.");
      return;
    }
    setError("");
    setSubmitting(true);
    try {
      const res = await apiPost(`/api/quizzes/${id}/submit`, {
        answers: Object.entries(answers).map(([questionId, selectedIndex]) => ({
          questionId,
          selectedIndex,
        })),
      });
      setResults(res);
    } catch (err: any) {
      setError(err.message || "Submission failed.");
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return <div className="p-10 text-center text-slate-400">Loading quiz…</div>;
  }
  if (error && !quiz) {
    return (
      <div className="p-10 text-center">
        <p className="text-red-600">{error}</p>
        <Link href="/dashboard/quizzes" className="mt-3 inline-block text-brand-600 hover:underline">
          ← Back to quizzes
        </Link>
      </div>
    );
  }

  const best = quiz?.attempts?.[0];

  return (
    <div className="mx-auto max-w-3xl px-6 py-8">
      <Link href="/dashboard/quizzes" className="text-sm text-brand-600 hover:underline">
        ← All quizzes
      </Link>
      <h1 className="mt-2 text-2xl font-bold text-slate-800">{quiz.title}</h1>
      {quiz.description && <p className="mt-1 text-sm text-slate-500">{quiz.description}</p>}
      {best && !results && (
        <p className="mt-2 text-xs text-slate-400">
          Your best score so far: {best.percentage}% ({best.score}/{best.total})
        </p>
      )}

      {!results ? (
        <>
          {error && <p className="mt-4 text-sm text-red-600">{error}</p>}
          <div className="mt-6 space-y-5">
            {quiz.questions.map((q: any, i: number) => (
              <div key={q.id} className="card p-5">
                <p className="font-medium text-slate-800">
                  {i + 1}. {q.prompt}
                </p>
                <div className="mt-3 space-y-2">
                  {q.options.map((opt: string, oi: number) => (
                    <label
                      key={oi}
                      className={`flex cursor-pointer items-center gap-3 rounded-lg border px-3 py-2 text-sm transition ${
                        answers[q.id] === oi
                          ? "border-brand-400 bg-brand-50"
                          : "border-slate-200 hover:bg-slate-50"
                      }`}
                    >
                      <input
                        type="radio"
                        name={q.id}
                        checked={answers[q.id] === oi}
                        onChange={() => choose(q.id, oi)}
                        className="accent-brand-600"
                      />
                      <span className="text-slate-700">{opt}</span>
                    </label>
                  ))}
                </div>
              </div>
            ))}
          </div>
          <button
            onClick={submit}
            disabled={submitting}
            className="btn-primary mt-6 w-full py-3 text-base"
          >
            {submitting ? "Grading…" : "Submit answers"}
          </button>
        </>
      ) : (
        <div className="mt-6">
          <div className="card mb-6 p-6 text-center">
            <div
              className={`text-4xl font-bold ${
                results.passed ? "text-green-600" : "text-red-600"
              }`}
            >
              {results.percentage}%
            </div>
            <p className="mt-1 text-sm text-slate-500">
              You scored {results.score} out of {results.total} ·{" "}
              {results.passed ? "Passed" : "Not passed (60% to pass)"}
            </p>
            {results.passed && results.pointsEarned > 0 && (
              <p className="mt-2 inline-block rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-700">
                🎉 +{results.pointsEarned} reward points (total {results.rewardPoints})
              </p>
            )}
            {results.passed && results.pointsEarned === 0 && (
              <p className="mt-2 text-xs text-slate-400">Quiz passed — points already awarded.</p>
            )}
          </div>

          <div className="space-y-4">
            {results.results.map((r: any, i: number) => (
              <div key={r.questionId} className="card p-5">
                <div className="flex items-start gap-2">
                  <span
                    className={`mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-full text-xs font-bold ${
                      r.correct ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"
                    }`}
                  >
                    {r.correct ? "✓" : "✕"}
                  </span>
                  <div className="flex-1">
                    <p className="font-medium text-slate-800">
                      {i + 1}. {r.prompt}
                    </p>
                    <div className="mt-2 space-y-1 text-sm">
                      {r.options.map((opt: string, oi: number) => {
                        const isCorrect = oi === r.correctIndex;
                        const isSelected = oi === r.selectedIndex;
                        return (
                          <div
                            key={oi}
                            className={`rounded px-2 py-1 ${
                              isCorrect
                                ? "bg-green-50 text-green-800"
                                : isSelected
                                ? "bg-red-50 text-red-800"
                                : "text-slate-600"
                            }`}
                          >
                            {opt}
                            {isCorrect && " ✓ correct"}
                            {isSelected && !isCorrect && " — your answer"}
                          </div>
                        );
                      })}
                    </div>
                    {r.explanation && (
                      <p className="mt-2 text-xs text-slate-500">
                        <span className="font-semibold">Explanation:</span> {r.explanation}
                      </p>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="mt-6 flex gap-3">
            <Link href="/dashboard/quizzes" className="btn-outline flex-1">
              Back to quizzes
            </Link>
            <button onClick={() => setResults(null)} className="btn-primary flex-1">
              Retake quiz
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
