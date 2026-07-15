"use client";

import { useEffect, useState } from "react";
import { apiGet } from "@/lib/api";

export default function AnnouncementsPage() {
  const [announcements, setAnnouncements] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    try {
      const d = await apiGet("/api/announcements").catch(() => ({ announcements: [] }));
      setAnnouncements(d.announcements || []);
    } catch {
      setAnnouncements([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="mx-auto max-w-5xl px-6 py-8">
      <h1 className="text-2xl font-bold text-slate-800">Announcements</h1>
      <p className="mt-1 text-sm text-slate-500">
        Notices and updates from BMU staff.
      </p>

      {loading ? (
        <p className="mt-6 text-sm text-slate-400">Loading announcements…</p>
      ) : announcements.length === 0 ? (
        <p className="mt-6 rounded-xl border border-dashed border-slate-200 p-6 text-center text-sm text-slate-400">
          No announcements yet.
        </p>
      ) : (
        <div className="mt-6 grid gap-4">
          {announcements.map((a) => (
            <div key={a.id} className="card p-5">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-2">
                  <h2 className="font-semibold text-slate-800">{a.title}</h2>
                  {a.pinned && (
                    <span className="rounded-full bg-brand-50 px-2 py-0.5 text-xs font-medium text-brand-700">
                      📌 Pinned
                    </span>
                  )}
                </div>
                <span className="shrink-0 text-xs text-slate-400">
                  {new Date(a.createdAt).toLocaleDateString()}
                </span>
              </div>
              <p className="mt-1 text-xs text-slate-400">by {a.author?.name}</p>
              <p className="mt-2 whitespace-pre-wrap text-sm text-slate-600">{a.body}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
