"use client";

import { useEffect, useState } from "react";
import { apiGet, apiPost } from "@/lib/api";

type Status = "OPEN" | "ANSWERED" | "CLOSED";

const STATUS_STYLES: Record<Status, string> = {
  OPEN: "bg-amber-100 text-amber-700",
  ANSWERED: "bg-green-100 text-green-700",
  CLOSED: "bg-slate-100 text-slate-600",
};

export default function HelpPage() {
  const [tickets, setTickets] = useState<any[]>([]);
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function load() {
    try {
      const d = await apiGet("/api/escalations").catch(() => ({ tickets: [] }));
      setTickets(d.tickets || []);
    } catch {
      setTickets([]);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (!subject.trim() || !message.trim()) {
      setError("Please enter both a subject and a message.");
      return;
    }
    setBusy(true);
    try {
      await apiPost("/api/escalations", {
        subject: subject.trim(),
        message: message.trim(),
      });
      setSubject("");
      setMessage("");
      await load();
    } catch (err: any) {
      setError(err.message || "Could not submit your request.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto max-w-5xl px-6 py-8">
      <h1 className="text-2xl font-bold text-slate-800">Ask a human</h1>
      <p className="mt-1 text-sm text-slate-500">
        Need help from BMU staff? Open a ticket and they'll reply here.
      </p>

      <div className="mt-6 grid gap-6 lg:grid-cols-[360px_1fr]">
        {/* New ticket form */}
        <form onSubmit={submit} className="card h-fit p-5">
          <h2 className="font-semibold text-slate-800">New request</h2>
          <p className="mt-1 text-xs text-slate-400">A staff member will respond.</p>
          <div className="mt-4 space-y-3">
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">Subject</label>
              <input
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                className="input"
                placeholder="Question about my account"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">Message</label>
              <textarea
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                className="input min-h-[120px] resize-y"
                placeholder="Describe what you need help with…"
              />
            </div>
            {error && <p className="text-sm text-red-600">{error}</p>}
            <button type="submit" disabled={busy} className="btn-primary w-full">
              {busy ? "Submitting…" : "Submit request"}
            </button>
          </div>
        </form>

        {/* Existing tickets */}
        <div>
          <h2 className="mb-3 text-sm font-medium text-slate-700">
            Your requests ({tickets.length})
          </h2>
          <div className="grid gap-3">
            {tickets.map((t) => (
              <div key={t.id} className="card p-4">
                <div className="flex items-start justify-between gap-3">
                  <h3 className="font-semibold text-slate-800">{t.subject}</h3>
                  <span
                    className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${
                      STATUS_STYLES[t.status as Status] || STATUS_STYLES.CLOSED
                    }`}
                  >
                    {t.status}
                  </span>
                </div>
                <p className="mt-1 text-xs text-slate-400">
                  {new Date(t.createdAt).toLocaleDateString()}
                  {t.updatedAt && t.updatedAt !== t.createdAt
                    ? ` · updated ${new Date(t.updatedAt).toLocaleDateString()}`
                    : ""}
                </p>
                {t.answer && (
                  <div className="mt-3 rounded-lg border border-green-200 bg-green-50 p-3 text-sm text-green-800">
                    <span className="font-medium">Reply: </span>
                    <span className="whitespace-pre-wrap">{t.answer}</span>
                  </div>
                )}
              </div>
            ))}
            {tickets.length === 0 && (
              <p className="rounded-xl border border-dashed border-slate-200 p-6 text-center text-sm text-slate-400">
                No requests yet. Open one with the form on the left.
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
