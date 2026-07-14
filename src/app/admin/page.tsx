"use client";

import { useEffect, useState } from "react";
import { apiGet, apiPost, apiPatch, apiDelete } from "@/lib/api";

type Tab = "overview" | "students" | "quizzes" | "settings";

export default function AdminPage() {
  const [tab, setTab] = useState<Tab>("overview");

  return (
    <div>
      <h1 className="text-2xl font-bold text-slate-800">Administration</h1>
      <p className="mt-1 text-sm text-slate-500">
        Verify students, manage prompt allowances, publish quizzes and configure the AI service.
      </p>

      <div className="mt-5 flex flex-wrap gap-2 border-b border-slate-200 pb-3">
        {(["overview", "students", "quizzes", "settings"] as Tab[]).map((t) => (
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

      <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
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
                  <div className="flex gap-1">
                    <button
                      onClick={() => patch(s.id, { verified: !s.verified })}
                      className="btn-outline px-2 py-1 text-xs"
                    >
                      {s.verified ? "Unverify" : "Verify"}
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
