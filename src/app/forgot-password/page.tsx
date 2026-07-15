"use client";

import { useState } from "react";
import Link from "next/link";
import Logo from "@/components/Logo";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [devUrl, setDevUrl] = useState("");

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setBusy(true);
    try {
      const res = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Request failed");
      setSent(true);
      if (data.devResetUrl) setDevUrl(data.devResetUrl);
    } catch (err: any) {
      setError(err.message || "Something went wrong.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-100 px-4">
      <div className="w-full max-w-md">
        <Link href="/" className="mb-6 flex items-center justify-center gap-2">
          <Logo className="h-9 w-9" />
          <span className="text-lg font-semibold text-slate-800">BMU AI Tutor</span>
        </Link>
        <div className="card p-7">
          <h1 className="text-xl font-semibold text-slate-800">Reset your password</h1>
          {sent ? (
            <div className="mt-4 space-y-3 text-sm text-slate-600">
              <p className="rounded-lg border border-green-200 bg-green-50 p-3 text-green-700">
                If an account exists for that email, we've sent reset instructions. Check your inbox
                (and spam folder).
              </p>
              {devUrl && (
                <p className="break-all rounded-lg border border-slate-200 bg-slate-50 p-3 text-xs text-slate-500">
                  Dev mode — reset link:{" "}
                  <Link href={devUrl} className="text-brand-600 underline">
                    {devUrl}
                  </Link>
                </p>
              )}
              <Link href="/login" className="block text-center font-medium text-brand-600 hover:underline">
                Back to login
              </Link>
            </div>
          ) : (
            <>
              <p className="mt-1 text-sm text-slate-500">
                Enter your account email and we'll send you a link to choose a new password.
              </p>
              <form onSubmit={onSubmit} className="mt-5 space-y-4">
                <div>
                  <label className="mb-1 block text-sm font-medium text-slate-700">Email</label>
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="input"
                    placeholder="you@student.bmu.edu.ng"
                  />
                </div>
                {error && <p className="text-sm text-red-600">{error}</p>}
                <button type="submit" disabled={busy} className="btn-primary w-full">
                  {busy ? "Sending…" : "Send reset link"}
                </button>
              </form>
              <p className="mt-4 text-center text-sm text-slate-500">
                Remembered it?{" "}
                <Link href="/login" className="font-medium text-brand-600 hover:underline">
                  Log in
                </Link>
              </p>
            </>
          )}
        </div>
      </div>
    </main>
  );
}
