"use client";

import { useEffect, useState } from "react";
import { apiGet, apiPost, apiPatch, apiDelete } from "@/lib/api";

type Tab =
  | "overview"
  | "students"
  | "quizzes"
  | "settings"
  | "announcements"
  | "escalations"
  | "assignments";

export default function AdminPage() {
  const [tab, setTab] = useState<Tab>("overview");

  return (
    <div>
      <h1 className="text-2xl font-bold text-slate-800">Administration</h1>
      <p className="mt-1 text-sm text-slate-500">
        Verify students, manage prompt allowances, publish quizzes and configure the AI service.
      </p>

      <div className="mt-5 flex flex-wrap gap-2 border-b border-slate-200 pb-3">
        {(
          [
            "overview",
            "students",
            "quizzes",
            "settings",
            "announcements",
            "escalations",
            "assignments",
          ] as Tab[]
        ).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`btn ${tab === t ? "bg-brand-600 text-white" : "btn-outline"} capitalize`}
          >
            {t}
          </button>
        ))}
      </div>

      <div className="mt-6">
        {tab === "overview" && <OverviewTab />}
        {tab === "students" && <StudentsTab />}
        {tab === "quizzes" && <QuizzesTab />}
        {tab === "settings" && <SettingsTab />}
        {tab === "announcements" && <AnnouncementsTab />}
        {tab === "escalations" && <EscalationsTab />}
        {tab === "assignments" && <AssignmentsTab />}
      </div>
    </div>
  );
}

function OverviewTab() {
  const [stats, setStats] = useState<any>(null);
  useEffect(() => {
    apiGet("/api/admin/stats")
      .then(setStats)
      .catch(() => {});
  }, []);

  if (!stats) return <p className="text-sm text-slate-400">Loading…</p>;

  const cards = [
    { label: "Students", value: stats.students },
    { label: "Verified", value: stats.verified },
    { label: "Pending", value: stats.unverified },
    { label: "Admin quizzes", value: stats.quizzes },
    { label: "Attempts", value: stats.attempts },
  ];

  return (
    <div>
      <div className="grid gap-4 sm:grid-cols-3 lg:grid-cols-5">
        {cards.map((c) => (
          <div key={c.label} className="card p-4">
            <div className="text-xs uppercase tracking-wide text-slate-400">{c.label}</div>
            <div className="mt-1 text-3xl font-bold text-slate-800">{c.value}</div>
          </div>
        ))}
      </div>

      <div
        className={`mt-5 rounded-xl border p-4 text-sm ${
          stats.ollamaHealthy
            ? "border-green-200 bg-green-50 text-green-700"
            : "border-red-200 bg-red-50 text-red-700"
        }`}
      >
        {stats.ollamaHealthy ? (
          <>✓ Ollama is running · model: <code>{stats.model}</code></>
        ) : (
          <>⚠ Ollama is not reachable. Start Ollama and load <code>{stats.model}</code> so students
          can use the AI features.</>
        )}
      </div>
    </div>
  );
}

function StudentsTab() {
  const [students, setStudents] = useState<any[]>([]);
  const [q, setQ] = useState("");
  const [verifiedFilter, setVerifiedFilter] = useState("all");
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState("");

  // Reset-password modal
  const [resetTarget, setResetTarget] = useState<any | null>(null);
  const [resetPw, setResetPw] = useState("");
  const [resetResult, setResetResult] = useState<string | null>(null);
  const [resetBusy, setResetBusy] = useState(false);

  // View-conversations drawer
  const [viewTarget, setViewTarget] = useState<any | null>(null);
  const [viewChats, setViewChats] = useState<any[]>([]);
  const [viewChat, setViewChat] = useState<any | null>(null);
  const [viewMessages, setViewMessages] = useState<any[]>([]);
  const [viewLoading, setViewLoading] = useState(false);

  async function load() {
    setLoading(true);
    const params = new URLSearchParams();
    if (q) params.set("q", q);
    if (verifiedFilter !== "all") params.set("verified", verifiedFilter);
    const d = await apiGet(`/api/admin/students?${params.toString()}`).catch(() => ({ students: [] }));
    setStudents(d.students || []);
    setLoading(false);
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function patch(id: string, data: any) {
    setMsg("");
    try {
      await apiPatch(`/api/admin/students/${id}`, data);
      setMsg("Saved.");
      load();
    } catch (e: any) {
      setMsg(e.message || "Update failed.");
    }
  }

  async function remove(id: string) {
    if (!confirm("Delete this student? This cannot be undone.")) return;
    await apiDelete(`/api/admin/students/${id}`).catch(() => {});
    load();
  }

  async function doReset() {
    if (!resetTarget) return;
    setResetBusy(true);
    setResetResult(null);
    try {
      const body: any = {};
      if (resetPw.trim()) body.newPassword = resetPw.trim();
      const d = await apiPost(`/api/admin/students/${resetTarget.id}/reset-password`, body);
      setResetResult(d.password);
      setMsg("");
    } catch (e: any) {
      setResetResult("ERROR: " + (e.message || "Reset failed"));
    } finally {
      setResetBusy(false);
    }
  }

  function openViewer(s: any) {
    setViewTarget(s);
    setViewChat(null);
    setViewMessages([]);
    setViewLoading(true);
    apiGet(`/api/admin/students/${s.id}/chats`)
      .then((d) => setViewChats(d.chats || []))
      .catch(() => setViewChats([]))
      .finally(() => setViewLoading(false));
  }

  async function openChat(chatId: string) {
    setViewLoading(true);
    try {
      const d = await apiGet(`/api/admin/chats/${chatId}`);
      setViewChat(d.chat);
      setViewMessages(d.chat.messages || []);
    } catch {
      setViewMessages([]);
    } finally {
      setViewLoading(false);
    }
  }

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search name, email, matric…"
          className="input max-w-xs"
        />
        <button onClick={load} className="btn-outline">
          Search
        </button>
        <select
          value={verifiedFilter}
          onChange={(e) => {
            setVerifiedFilter(e.target.value);
            setTimeout(load, 0);
          }}
          className="input max-w-[160px]"
        >
          <option value="all">All students</option>
          <option value="false">Pending</option>
          <option value="true">Verified</option>
        </select>
      </div>

      {msg && <p className="mb-2 text-sm text-brand-600">{msg}</p>}

      <div className="hidden overflow-x-auto rounded-xl border border-slate-200 bg-white sm:block">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left text-xs uppercase text-slate-400">
            <tr>
              <th className="px-3 py-2">Student</th>
              <th className="px-3 py-2">Matric</th>
              <th className="px-3 py-2">Faculty / Dept</th>
              <th className="px-3 py-2">Prompts/day</th>
              <th className="px-3 py-2">Status</th>
              <th className="px-3 py-2">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {students.map((s) => (
              <tr key={s.id}>
                <td className="px-3 py-2">
                  <div className="font-medium text-slate-800">{s.name}</div>
                  <div className="text-xs text-slate-400">{s.email}</div>
                </td>
                <td className="px-3 py-2 text-slate-600">{s.matricNumber || "—"}</td>
                <td className="px-3 py-2 text-slate-600">
                  {[s.faculty, s.department].filter(Boolean).join(" / ") || "—"}
                </td>
                <td className="px-3 py-2">
                  <input
                    type="number"
                    min={1}
                    defaultValue={s.promptsPerDay}
                    onBlur={(e) => {
                      const v = Number(e.target.value);
                      if (v && v !== s.promptsPerDay) patch(s.id, { promptsPerDay: v });
                    }}
                    className="input w-20 py-1"
                  />
                </td>
                <td className="px-3 py-2">
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                      s.verified ? "bg-green-100 text-green-700" : "bg-amber-100 text-amber-700"
                    }`}
                  >
                    {s.verified ? "Verified" : "Pending"}
                  </span>
                </td>
                <td className="px-3 py-2">
                  <div className="flex flex-wrap gap-1">
                    <button
                      onClick={() => patch(s.id, { verified: !s.verified })}
                      className="btn-outline px-2 py-1 text-xs"
                    >
                      {s.verified ? "Unverify" : "Verify"}
                    </button>
                    <button
                      onClick={() => {
                        setResetTarget(s);
                        setResetPw("");
                        setResetResult(null);
                      }}
                      className="btn-outline px-2 py-1 text-xs"
                      title="Reset this student's password"
                    >
                      Reset PW
                    </button>
                    <button
                      onClick={() => openViewer(s)}
                      className="btn-outline px-2 py-1 text-xs"
                      title="View what this student has been asking"
                    >
                      View chats
                    </button>
                    <button
                      onClick={() => remove(s.id)}
                      className="btn px-2 py-1 text-xs text-red-600 hover:bg-red-50"
                    >
                      Delete
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {students.length === 0 && (
              <tr>
                <td colSpan={6} className="px-3 py-6 text-center text-slate-400">
                  {loading ? "Loading…" : "No students found."}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Mobile card layout */}
      <div className="space-y-3 sm:hidden">
        {students.map((s) => (
          <div key={s.id} className="rounded-xl border border-slate-200 bg-white p-4">
            <div className="flex items-start justify-between gap-2">
              <div>
                <div className="font-medium text-slate-800">{s.name}</div>
                <div className="text-xs text-slate-400">{s.email}</div>
              </div>
              <span
                className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${
                  s.verified ? "bg-green-100 text-green-700" : "bg-amber-100 text-amber-700"
                }`}
              >
                {s.verified ? "Verified" : "Pending"}
              </span>
            </div>
            <div className="mt-2 grid grid-cols-2 gap-y-1 text-sm text-slate-600">
              <span className="text-slate-400">Matric</span>
              <span>{s.matricNumber || "—"}</span>
              <span className="text-slate-400">Faculty / Dept</span>
              <span>{[s.faculty, s.department].filter(Boolean).join(" / ") || "—"}</span>
              <span className="text-slate-400">Prompts/day</span>
              <span>
                <input
                  type="number"
                  min={1}
                  defaultValue={s.promptsPerDay}
                  onBlur={(e) => {
                    const v = Number(e.target.value);
                    if (v && v !== s.promptsPerDay) patch(s.id, { promptsPerDay: v });
                  }}
                  className="input w-20 py-1"
                />
              </span>
            </div>
            <div className="mt-3 flex flex-wrap gap-1">
              <button
                onClick={() => patch(s.id, { verified: !s.verified })}
                className="btn-outline px-2 py-1 text-xs"
              >
                {s.verified ? "Unverify" : "Verify"}
              </button>
              <button
                onClick={() => {
                  setResetTarget(s);
                  setResetPw("");
                  setResetResult(null);
                }}
                className="btn-outline px-2 py-1 text-xs"
                title="Reset this student's password"
              >
                Reset PW
              </button>
              <button
                onClick={() => openViewer(s)}
                className="btn-outline px-2 py-1 text-xs"
                title="View what this student has been asking"
              >
                View chats
              </button>
              <button
                onClick={() => remove(s.id)}
                className="btn px-2 py-1 text-xs text-red-600 hover:bg-red-50"
              >
                Delete
              </button>
            </div>
          </div>
        ))}
        {students.length === 0 && (
          <p className="rounded-xl border border-dashed border-slate-200 p-6 text-center text-sm text-slate-400">
            {loading ? "Loading…" : "No students found."}
          </p>
        )}
      </div>

      {/* Reset password modal */}
      {resetTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
            <h3 className="text-lg font-semibold text-slate-800">Reset password</h3>
            <p className="mt-1 text-sm text-slate-500">
              For <span className="font-medium">{resetTarget.name}</span> ({resetTarget.email}). Leave
              blank to generate a temporary password (student must change it on next login).
            </p>
            <input
              type="text"
              value={resetPw}
              onChange={(e) => setResetPw(e.target.value)}
              placeholder="New password (optional, min 6)"
              className="input mt-3"
            />
            {resetResult && !resetResult.startsWith("ERROR") && (
              <div className="mt-3 rounded-lg border border-green-200 bg-green-50 p-3 text-sm text-green-800">
                <div>Temporary password (also emailed if SMTP is set):</div>
                <div className="mt-1 break-all rounded bg-white px-2 py-1 font-mono text-green-900">
                  {resetResult}
                </div>
              </div>
            )}
            {resetResult && resetResult.startsWith("ERROR") && (
              <p className="mt-3 text-sm text-red-600">{resetResult}</p>
            )}
            <div className="mt-4 flex justify-end gap-2">
              <button
                onClick={() => {
                  setResetTarget(null);
                  setResetResult(null);
                  setResetPw("");
                }}
                className="btn-outline"
              >
                Close
              </button>
              <button onClick={doReset} disabled={resetBusy} className="btn-primary">
                {resetBusy ? "Resetting…" : "Reset password"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* View student conversations drawer */}
      {viewTarget && (
        <div className="fixed inset-0 z-50 flex">
          <div className="flex-1 bg-slate-900/40" onClick={() => setViewTarget(null)} />
          <div className="flex h-full w-full max-w-2xl flex-col bg-white shadow-xl">
            <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
              <div>
                <div className="font-semibold text-slate-800">{viewTarget.name}'s conversations</div>
                <div className="text-xs text-slate-400">{viewTarget.email}</div>
              </div>
              <button
                onClick={() => setViewTarget(null)}
                className="grid h-8 w-8 place-items-center rounded-md text-slate-400 hover:bg-slate-100"
              >
                ✕
              </button>
            </div>
            <div className="flex flex-1 flex-col overflow-hidden sm:flex-row">
              <div className="max-h-40 shrink-0 overflow-y-auto border-b border-slate-200 bg-slate-50 p-2 sm:max-h-none sm:w-56 sm:border-b-0 sm:border-r">
                {viewLoading && <p className="p-2 text-sm text-slate-400">Loading…</p>}
                {!viewLoading && viewChats.length === 0 && (
                  <p className="p-2 text-sm text-slate-400">No conversations yet.</p>
                )}
                {viewChats.map((c: any) => (
                  <button
                    key={c.id}
                    onClick={() => openChat(c.id)}
                    className={`mb-1 block w-full truncate rounded-lg px-3 py-2 text-left text-sm hover:bg-white ${
                      viewChat?.id === c.id ? "bg-white text-brand-700" : "text-slate-700"
                    }`}
                  >
                    {c.title}
                    <span className="block text-xs text-slate-400">
                      {new Date(c.updatedAt).toLocaleDateString()}
                    </span>
                  </button>
                ))}
              </div>
              <div className="scroll-thin flex-1 space-y-3 overflow-y-auto bg-slate-50 p-4">
                {viewLoading && <p className="text-sm text-slate-400">Loading…</p>}
                {!viewLoading && viewMessages.length === 0 && (
                  <p className="text-sm text-slate-400">Select a conversation.</p>
                )}
                {viewMessages.map((m: any, i: number) => (
                  <div
                    key={i}
                    className={`rounded-xl p-3 text-sm ${
                      m.role === "user"
                        ? "ml-auto max-w-[85%] bg-brand-600 text-white"
                        : "mr-auto max-w-[85%] border border-slate-200 bg-white text-slate-800"
                    }`}
                  >
                    {m.content}
                    {m.role === "assistant" && m.sources?.length > 0 && (
                      <div className="mt-2 text-xs text-slate-400">
                        📚 {m.sources.length} source(s)
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function QuizzesTab() {
  const [quizzes, setQuizzes] = useState<any[]>([]);
  const [form, setForm] = useState({
    title: "",
    topic: "",
    count: 5,
    faculty: "",
    department: "",
    program: "",
    level: "",
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function load() {
    const d = await apiGet("/api/admin/quizzes").catch(() => ({ quizzes: [] }));
    setQuizzes(d.quizzes || []);
  }
  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function create() {
    setError("");
    if (!form.title.trim() || !form.topic.trim()) {
      setError("Title and topic are required.");
      return;
    }
    setBusy(true);
    try {
      await apiPost("/api/admin/quizzes", form);
      setForm({ title: "", topic: "", count: 5, faculty: "", department: "", program: "", level: "" });
      load();
    } catch (e: any) {
      setError(e.message || "Failed to create quiz.");
    } finally {
      setBusy(false);
    }
  }

  async function toggle(id: string, status: string) {
    await apiPatch(`/api/admin/quizzes/${id}`, {
      status: status === "PUBLISHED" ? "DRAFT" : "PUBLISHED",
    }).catch(() => {});
    load();
  }
  async function remove(id: string) {
    if (!confirm("Delete this quiz?")) return;
    await apiDelete(`/api/admin/quizzes/${id}`).catch(() => {});
    load();
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[380px_1fr]">
      <div className="card h-fit p-5">
        <h2 className="font-semibold text-slate-800">Publish a quiz</h2>
        <p className="mt-1 text-xs text-slate-400">
          Generated by the AI and shown to matching students. Leave targeting blank for everyone.
        </p>
        <div className="mt-4 space-y-3">
          <input
            value={form.title}
            onChange={(e) => setForm({ ...form, title: e.target.value })}
            placeholder="Quiz title"
            className="input"
          />
          <input
            value={form.topic}
            onChange={(e) => setForm({ ...form, topic: e.target.value })}
            placeholder="Topic (e.g. Hypertension management)"
            className="input"
          />
          <div className="grid grid-cols-2 gap-2">
            <input
              value={form.faculty}
              onChange={(e) => setForm({ ...form, faculty: e.target.value })}
              placeholder="Faculty"
              className="input"
            />
            <input
              value={form.department}
              onChange={(e) => setForm({ ...form, department: e.target.value })}
              placeholder="Department"
              className="input"
            />
            <input
              value={form.program}
              onChange={(e) => setForm({ ...form, program: e.target.value })}
              placeholder="Program"
              className="input"
            />
            <input
              value={form.level}
              onChange={(e) => setForm({ ...form, level: e.target.value })}
              placeholder="Level"
              className="input"
            />
          </div>
          <div>
            <label className="text-sm text-slate-600">Questions: {form.count}</label>
            <input
              type="range"
              min={3}
              max={15}
              value={form.count}
              onChange={(e) => setForm({ ...form, count: Number(e.target.value) })}
              className="w-full accent-brand-600"
            />
          </div>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <button onClick={create} disabled={busy} className="btn-primary w-full">
            {busy ? "Generating…" : "Generate & publish"}
          </button>
        </div>
      </div>

      <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left text-xs uppercase text-slate-400">
            <tr>
              <th className="px-3 py-2">Title</th>
              <th className="px-3 py-2">Target</th>
              <th className="px-3 py-2">Q</th>
              <th className="px-3 py-2">Status</th>
              <th className="px-3 py-2">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {quizzes.map((q) => (
              <tr key={q.id}>
                <td className="px-3 py-2 font-medium text-slate-800">{q.title}</td>
                <td className="px-3 py-2 text-slate-500">
                  {[q.faculty, q.department, q.level].filter(Boolean).join(" · ") || "Everyone"}
                </td>
                <td className="px-3 py-2 text-slate-600">{q._count?.questions ?? 0}</td>
                <td className="px-3 py-2">
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                      q.status === "PUBLISHED"
                        ? "bg-green-100 text-green-700"
                        : "bg-slate-100 text-slate-500"
                    }`}
                  >
                    {q.status}
                  </span>
                </td>
                <td className="px-3 py-2">
                  <div className="flex gap-1">
                    <button
                      onClick={() => toggle(q.id, q.status)}
                      className="btn-outline px-2 py-1 text-xs"
                    >
                      {q.status === "PUBLISHED" ? "Unpublish" : "Publish"}
                    </button>
                    <button
                      onClick={() => remove(q.id)}
                      className="btn px-2 py-1 text-xs text-red-600 hover:bg-red-50"
                    >
                      Delete
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {quizzes.length === 0 && (
              <tr>
                <td colSpan={5} className="px-3 py-6 text-center text-slate-400">
                  No admin quizzes yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function SettingsTab() {
  const [settings, setSettings] = useState<any>(null);
  const [form, setForm] = useState({ defaultPromptsPerDay: 5, defaultPromptsPerWeek: 35, defaultModel: "" });
  const [msg, setMsg] = useState("");

  useEffect(() => {
    apiGet("/api/admin/settings")
      .then((d) => {
        setSettings(d.setting);
        setForm({
          defaultPromptsPerDay: d.setting?.defaultPromptsPerDay ?? 5,
          defaultPromptsPerWeek: d.setting?.defaultPromptsPerWeek ?? 35,
          defaultModel: d.model ?? "",
        });
      })
      .catch(() => {});
  }, []);

  async function save() {
    setMsg("");
    try {
      await apiPut("/api/admin/settings", form);
      setMsg("Settings saved. New defaults apply to newly registered students.");
    } catch (e: any) {
      setMsg(e.message || "Save failed.");
    }
  }

  if (!settings) return <p className="text-sm text-slate-400">Loading…</p>;

  return (
    <div className="max-w-lg card p-5">
      <h2 className="font-semibold text-slate-800">Global settings</h2>
      <p className="mt-1 text-xs text-slate-400">
        These defaults apply to students when they register. You can also override per student.
      </p>
      <div className="mt-4 space-y-3">
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700">Prompts per day</label>
          <input
            type="number"
            min={1}
            value={form.defaultPromptsPerDay}
            onChange={(e) => setForm({ ...form, defaultPromptsPerDay: Number(e.target.value) })}
            className="input"
          />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700">Prompts per week</label>
          <input
            type="number"
            min={1}
            value={form.defaultPromptsPerWeek}
            onChange={(e) => setForm({ ...form, defaultPromptsPerWeek: Number(e.target.value) })}
            className="input"
          />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700">Ollama model</label>
          <input
            value={form.defaultModel}
            onChange={(e) => setForm({ ...form, defaultModel: e.target.value })}
            className="input"
            placeholder="llama3.2:latest"
          />
          <p className="mt-1 text-xs text-slate-400">
            Must be pulled on the VPS (e.g. <code>ollama pull llama3.2</code>).
          </p>
        </div>
        {msg && <p className="text-sm text-brand-600">{msg}</p>}
        <button onClick={save} className="btn-primary">
          Save settings
        </button>
      </div>
    </div>
  );
}

function AnnouncementsTab() {
  const [announcements, setAnnouncements] = useState<any[]>([]);
  const [form, setForm] = useState({
    title: "",
    body: "",
    faculty: "",
    department: "",
    program: "",
    level: "",
    pinned: false,
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function load() {
    const d = await apiGet("/api/admin/announcements").catch(() => ({ announcements: [] }));
    setAnnouncements(d.announcements || []);
  }
  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function create() {
    setError("");
    if (!form.title.trim() || !form.body.trim()) {
      setError("Title and body are required.");
      return;
    }
    setBusy(true);
    try {
      await apiPost("/api/admin/announcements", {
        title: form.title,
        body: form.body,
        faculty: form.faculty || undefined,
        department: form.department || undefined,
        program: form.program || undefined,
        level: form.level || undefined,
        pinned: form.pinned,
      });
      setForm({
        title: "",
        body: "",
        faculty: "",
        department: "",
        program: "",
        level: "",
        pinned: false,
      });
      load();
    } catch (e: any) {
      setError(e.message || "Failed to create announcement.");
    } finally {
      setBusy(false);
    }
  }

  async function remove(id: string) {
    if (!confirm("Delete this announcement?")) return;
    await apiDelete(`/api/admin/announcements?id=${id}`).catch(() => {});
    load();
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[380px_1fr]">
      <div className="card h-fit p-5">
        <h2 className="font-semibold text-slate-800">New announcement</h2>
        <p className="mt-1 text-xs text-slate-400">
          Broadcast a message to students. Leave targeting blank for everyone.
        </p>
        <div className="mt-4 space-y-3">
          <input
            value={form.title}
            onChange={(e) => setForm({ ...form, title: e.target.value })}
            placeholder="Announcement title"
            className="input"
          />
          <textarea
            value={form.body}
            onChange={(e) => setForm({ ...form, body: e.target.value })}
            placeholder="Message body"
            rows={4}
            className="input"
          />
          <div className="grid grid-cols-2 gap-2">
            <input
              value={form.faculty}
              onChange={(e) => setForm({ ...form, faculty: e.target.value })}
              placeholder="Faculty"
              className="input"
            />
            <input
              value={form.department}
              onChange={(e) => setForm({ ...form, department: e.target.value })}
              placeholder="Department"
              className="input"
            />
            <input
              value={form.program}
              onChange={(e) => setForm({ ...form, program: e.target.value })}
              placeholder="Program"
              className="input"
            />
            <input
              value={form.level}
              onChange={(e) => setForm({ ...form, level: e.target.value })}
              placeholder="Level"
              className="input"
            />
          </div>
          <label className="flex items-center gap-2 text-sm text-slate-600">
            <input
              type="checkbox"
              checked={form.pinned}
              onChange={(e) => setForm({ ...form, pinned: e.target.checked })}
              className="accent-brand-600"
            />
            Pin this announcement
          </label>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <button onClick={create} disabled={busy} className="btn-primary w-full">
            {busy ? "Posting…" : "Post announcement"}
          </button>
        </div>
      </div>

      <div className="space-y-3">
        {announcements.length === 0 && (
          <p className="rounded-xl border border-dashed border-slate-200 p-6 text-center text-sm text-slate-400">
            No announcements yet.
          </p>
        )}
        {announcements.map((a) => (
          <div key={a.id} className="card p-4">
            <div className="flex items-start justify-between gap-2">
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="font-semibold text-slate-800">{a.title}</h3>
                  {a.pinned && (
                    <span className="rounded-full bg-brand-100 px-2 py-0.5 text-xs font-medium text-brand-700">
                      Pinned
                    </span>
                  )}
                </div>
                <p className="mt-1 whitespace-pre-wrap text-sm text-slate-600">{a.body}</p>
              </div>
              <button
                onClick={() => remove(a.id)}
                className="btn px-2 py-1 text-xs text-red-600 hover:bg-red-50"
              >
                Delete
              </button>
            </div>
            <p className="mt-2 text-xs text-slate-400">
              {[a.faculty, a.department, a.program, a.level].filter(Boolean).join(" · ") || "Everyone"}
              {a.author?.name ? ` · by ${a.author.name}` : ""}
              {a.createdAt ? ` · ${new Date(a.createdAt).toLocaleDateString()}` : ""}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}

function EscalationsTab() {
  const [tickets, setTickets] = useState<any[]>([]);
  const [openOnly, setOpenOnly] = useState(false);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState<Record<string, boolean>>({});
  const [msg, setMsg] = useState("");

  async function load() {
    const url = openOnly ? "/api/admin/escalations?status=OPEN" : "/api/admin/escalations";
    const d = await apiGet(url).catch(() => ({ tickets: [] }));
    setTickets(d.tickets || []);
  }
  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function sendAnswer(id: string) {
    const answer = answers[id]?.trim();
    if (!answer) {
      setMsg("Write an answer before sending.");
      return;
    }
    setBusy((b) => ({ ...b, [id]: true }));
    setMsg("");
    try {
      await apiPatch(`/api/admin/escalations/${id}`, { answer, status: "ANSWERED" });
      setAnswers((a) => ({ ...a, [id]: "" }));
      setMsg("Answer sent.");
      load();
    } catch (e: any) {
      setMsg(e.message || "Failed to send answer.");
    } finally {
      setBusy((b) => ({ ...b, [id]: false }));
    }
  }

  const statusClass: Record<string, string> = {
    OPEN: "bg-amber-100 text-amber-700",
    ANSWERED: "bg-green-100 text-green-700",
    CLOSED: "bg-slate-100 text-slate-500",
  };

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <label className="flex items-center gap-2 text-sm text-slate-600">
          <input
            type="checkbox"
            checked={openOnly}
            onChange={(e) => {
              setOpenOnly(e.target.checked);
              setTimeout(load, 0);
            }}
            className="accent-brand-600"
          />
          Open only
        </label>
      </div>

      {msg && <p className="mb-2 text-sm text-brand-600">{msg}</p>}

      {tickets.length === 0 && (
        <p className="rounded-xl border border-dashed border-slate-200 p-6 text-center text-sm text-slate-400">
          {openOnly ? "No open tickets." : "No escalations yet."}
        </p>
      )}

      <div className="space-y-3">
        {tickets.map((t) => (
          <div key={t.id} className="card p-4">
            <div className="flex items-start justify-between gap-2">
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="font-semibold text-slate-800">{t.subject}</h3>
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                      statusClass[t.status] || "bg-slate-100 text-slate-500"
                    }`}
                  >
                    {t.status}
                  </span>
                </div>
                <p className="mt-1 text-sm text-slate-500">
                  {t.user?.name || "Unknown"} · {t.user?.email || "—"}
                  {[t.user?.faculty, t.user?.department, t.user?.level].filter(Boolean).join(" / ")}
                </p>
              </div>
              {t.createdAt && (
                <span className="shrink-0 text-xs text-slate-400">
                  {new Date(t.createdAt).toLocaleDateString()}
                </span>
              )}
            </div>

            <p className="mt-2 whitespace-pre-wrap text-sm text-slate-700">{t.message}</p>

            {t.answer && (
              <div className="mt-2 rounded-lg bg-slate-50 p-3 text-sm text-slate-600">
                <div className="text-xs font-medium text-slate-400">Answer</div>
                <div className="mt-1 whitespace-pre-wrap">{t.answer}</div>
              </div>
            )}

            {(t.status === "OPEN" || t.status === "ANSWERED") && (
              <div className="mt-3 space-y-2">
                <textarea
                  value={answers[t.id] || ""}
                  onChange={(e) => setAnswers((a) => ({ ...a, [t.id]: e.target.value }))}
                  placeholder="Write an answer…"
                  rows={3}
                  className="input"
                />
                <button
                  onClick={() => sendAnswer(t.id)}
                  disabled={busy[t.id]}
                  className="btn-primary"
                >
                  {busy[t.id] ? "Sending…" : "Send answer"}
                </button>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

function AssignmentsTab() {
  const [assignments, setAssignments] = useState<any[]>([]);
  const [quizzes, setQuizzes] = useState<any[]>([]);
  const [form, setForm] = useState({
    quizId: "",
    title: "",
    faculty: "",
    department: "",
    program: "",
    level: "",
    dueAt: "",
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function load() {
    const [a, q] = await Promise.all([
      apiGet("/api/admin/assignments").catch(() => ({ assignments: [] })),
      apiGet("/api/quizzes").catch(() => ({ own: [], available: [] })),
    ]);
    setAssignments(a.assignments || []);
    setQuizzes([...(q.own || []), ...(q.available || [])]);
  }
  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function create() {
    setError("");
    if (!form.quizId || !form.title.trim()) {
      setError("Title and a quiz are required.");
      return;
    }
    setBusy(true);
    try {
      await apiPost("/api/admin/assignments", {
        quizId: form.quizId,
        title: form.title,
        faculty: form.faculty || undefined,
        department: form.department || undefined,
        program: form.program || undefined,
        level: form.level || undefined,
        dueAt: form.dueAt ? new Date(form.dueAt).toISOString() : undefined,
      });
      setForm({
        quizId: "",
        title: "",
        faculty: "",
        department: "",
        program: "",
        level: "",
        dueAt: "",
      });
      load();
    } catch (e: any) {
      setError(e.message || "Failed to create assignment.");
    } finally {
      setBusy(false);
    }
  }

  async function remove(id: string) {
    if (!confirm("Delete this assignment?")) return;
    await apiDelete(`/api/admin/assignments?id=${id}`).catch(() => {});
    load();
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[380px_1fr]">
      <div className="card h-fit p-5">
        <h2 className="font-semibold text-slate-800">Assign a quiz</h2>
        <p className="mt-1 text-xs text-slate-400">
          Assign a quiz to a cohort. Leave targeting blank for everyone.
        </p>
        <div className="mt-4 space-y-3">
          <input
            value={form.title}
            onChange={(e) => setForm({ ...form, title: e.target.value })}
            placeholder="Assignment title"
            className="input"
          />
          <select
            value={form.quizId}
            onChange={(e) => setForm({ ...form, quizId: e.target.value })}
            className="input"
          >
            <option value="">— Select a quiz —</option>
            {quizzes.map((q) => (
              <option key={q.id} value={q.id}>
                {q.title}
              </option>
            ))}
          </select>
          <div className="grid grid-cols-2 gap-2">
            <input
              value={form.faculty}
              onChange={(e) => setForm({ ...form, faculty: e.target.value })}
              placeholder="Faculty"
              className="input"
            />
            <input
              value={form.department}
              onChange={(e) => setForm({ ...form, department: e.target.value })}
              placeholder="Department"
              className="input"
            />
            <input
              value={form.program}
              onChange={(e) => setForm({ ...form, program: e.target.value })}
              placeholder="Program"
              className="input"
            />
            <input
              value={form.level}
              onChange={(e) => setForm({ ...form, level: e.target.value })}
              placeholder="Level"
              className="input"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Due (optional)</label>
            <input
              type="datetime-local"
              value={form.dueAt}
              onChange={(e) => setForm({ ...form, dueAt: e.target.value })}
              className="input"
            />
          </div>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <button onClick={create} disabled={busy} className="btn-primary w-full">
            {busy ? "Assigning…" : "Create assignment"}
          </button>
        </div>
      </div>

      <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left text-xs uppercase text-slate-400">
            <tr>
              <th className="px-3 py-2">Title</th>
              <th className="px-3 py-2">Quiz</th>
              <th className="px-3 py-2">Target</th>
              <th className="px-3 py-2">Due</th>
              <th className="px-3 py-2">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {assignments.map((a) => (
              <tr key={a.id}>
                <td className="px-3 py-2 font-medium text-slate-800">{a.title}</td>
                <td className="px-3 py-2 text-slate-600">
                  {a.quiz?.title || "—"}
                  {a.quiz?._count?.questions != null ? ` (${a.quiz._count.questions} Q)` : ""}
                </td>
                <td className="px-3 py-2 text-slate-500">
                  {[a.faculty, a.department, a.program, a.level].filter(Boolean).join(" · ") ||
                    "Everyone"}
                </td>
                <td className="px-3 py-2 text-slate-600">
                  {a.dueAt ? new Date(a.dueAt).toLocaleString() : "—"}
                </td>
                <td className="px-3 py-2">
                  <button
                    onClick={() => remove(a.id)}
                    className="btn px-2 py-1 text-xs text-red-600 hover:bg-red-50"
                  >
                    Delete
                  </button>
                </td>
              </tr>
            ))}
            {assignments.length === 0 && (
              <tr>
                <td colSpan={5} className="px-3 py-6 text-center text-slate-400">
                  No assignments yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

async function apiPut(url: string, body: unknown) {
  const res = await fetch(url, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.error || "Request failed");
  return data;
}
