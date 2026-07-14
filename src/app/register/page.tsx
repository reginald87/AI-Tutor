"use client";

import { useState } from "react";
import Link from "next/link";
import { AuthProvider, useAuth } from "@/components/AuthProvider";
import Logo from "@/components/Logo";

function RegisterForm() {
  const { register } = useAuth();
  const [form, setForm] = useState({
    name: "",
    email: "",
    password: "",
    matricNumber: "",
    faculty: "",
    department: "",
    program: "",
    level: "",
  });
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<{ email: string; emailSent: boolean } | null>(null);

  function update(k: keyof typeof form, v: string) {
    setForm((f) => ({ ...f, [k]: v }));
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setBusy(true);
    try {
      const data = await register({
        ...form,
        matricNumber: form.matricNumber || null,
        faculty: form.faculty || null,
        department: form.department || null,
        program: form.program || null,
        level: form.level || null,
      });
      setDone({ email: data.email, emailSent: data.emailSent });
    } catch (err: any) {
      setError(err.message || "Registration failed");
    } finally {
      setBusy(false);
    }
  }

  if (done) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-100 px-4 py-10">
        <div className="w-full max-w-md">
          <Link href="/" className="mb-6 flex items-center justify-center gap-2">
            <Logo className="h-9 w-9" />
            <span className="text-lg font-semibold text-slate-800">BMU AI Tutor</span>
          </Link>
          <div className="card p-7 text-center">
            <div className="text-4xl">📧</div>
            <h1 className="mt-3 text-xl font-semibold text-slate-800">Check your inbox</h1>
            <p className="mt-2 text-sm text-slate-500">
              We sent a verification link to <span className="font-medium text-slate-700">{done.email}</span>.
              Click it to activate your account.
            </p>
            {!done.emailSent && (
              <p className="mt-3 rounded-lg bg-amber-50 p-3 text-left text-xs text-amber-700">
                The verification email could not be sent automatically. Please ask an administrator to
                activate your account, or use the resend option after logging in.
              </p>
            )}
            <Link href="/login" className="btn-primary mt-5 w-full">
              Back to login
            </Link>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-100 px-4 py-10">
      <div className="w-full max-w-lg">
        <Link href="/" className="mb-6 flex items-center justify-center gap-2">
          <Logo className="h-9 w-9" />
          <span className="text-lg font-semibold text-slate-800">BMU AI Tutor</span>
        </Link>
        <div className="card p-7">
          <h1 className="text-xl font-semibold text-slate-800">Create your account</h1>
          <p className="mt-1 text-sm text-slate-500">
            Only <span className="font-medium text-slate-700">@bmu.edu.ng</span> email addresses are
            accepted. We’ll email you a link to activate your account.
          </p>
          <form onSubmit={onSubmit} className="mt-5 space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">Full name</label>
                <input
                  required
                  value={form.name}
                  onChange={(e) => update("name", e.target.value)}
                  className="input"
                  placeholder="Ada Okafor"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">Matric no.</label>
                <input
                  value={form.matricNumber}
                  onChange={(e) => update("matricNumber", e.target.value)}
                  className="input"
                  placeholder="BMU/21/1234"
                />
              </div>
              <div className="sm:col-span-2">
                <label className="mb-1 block text-sm font-medium text-slate-700">Email</label>
                <input
                  type="email"
                  required
                  value={form.email}
                  onChange={(e) => update("email", e.target.value)}
                  className="input"
                  placeholder="you@student.bmu.edu.ng"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">Password</label>
                <input
                  type="password"
                  required
                  minLength={6}
                  value={form.password}
                  onChange={(e) => update("password", e.target.value)}
                  className="input"
                  placeholder="At least 6 characters"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">Level</label>
                <input
                  value={form.level}
                  onChange={(e) => update("level", e.target.value)}
                  className="input"
                  placeholder="100, 200, 300…"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">Faculty</label>
                <input
                  value={form.faculty}
                  onChange={(e) => update("faculty", e.target.value)}
                  className="input"
                  placeholder="Basic Medical Sciences"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">Department</label>
                <input
                  value={form.department}
                  onChange={(e) => update("department", e.target.value)}
                  className="input"
                  placeholder="Anatomy"
                />
              </div>
              <div className="sm:col-span-2">
                <label className="mb-1 block text-sm font-medium text-slate-700">Program</label>
                <input
                  value={form.program}
                  onChange={(e) => update("program", e.target.value)}
                  className="input"
                  placeholder="MBBS, Nursing, etc."
                />
              </div>
            </div>
            {error && <p className="text-sm text-red-600">{error}</p>}
            <button type="submit" disabled={busy} className="btn-primary w-full">
              {busy ? "Creating account…" : "Create account"}
            </button>
          </form>
          <p className="mt-4 text-center text-sm text-slate-500">
            Already have an account?{" "}
            <Link href="/login" className="font-medium text-brand-600 hover:underline">
              Log in
            </Link>
          </p>
        </div>
      </div>
    </main>
  );
}

export default function RegisterPage() {
  return (
    <AuthProvider initialUser={null}>
      <RegisterForm />
    </AuthProvider>
  );
}
