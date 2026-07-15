"use client";

import { useState } from "react";
import Link from "next/link";
import { AuthProvider, useAuth } from "@/components/AuthProvider";
import Logo from "@/components/Logo";

function LoginForm() {
  const { login } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [showResend, setShowResend] = useState(false);
  const [resendEmail, setResendEmail] = useState("");
  const [resendMsg, setResendMsg] = useState("");
  const [resendBusy, setResendBusy] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setBusy(true);
    try {
      await login(email, password);
      window.location.assign("/dashboard");
    } catch (err: any) {
      setError(err.message || "Login failed");
    } finally {
      setBusy(false);
    }
  }

  async function onResend(e: React.FormEvent) {
    e.preventDefault();
    setResendMsg("");
    setResendBusy(true);
    try {
      await fetch("/api/auth/resend-verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: resendEmail }),
      });
      setResendMsg("If that email exists and is unverified, a new link is on its way.");
    } catch {
      setResendMsg("Something went wrong. Please try again.");
    } finally {
      setResendBusy(false);
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
          <h1 className="text-xl font-semibold text-slate-800">Welcome back</h1>
          <p className="mt-1 text-sm text-slate-500">Log in to continue learning.</p>
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
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">Password</label>
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="input"
                placeholder="••••••••"
              />
            </div>
            {error && <p className="text-sm text-red-600">{error}</p>}
            <button type="submit" disabled={busy} className="btn-primary w-full">
              {busy ? "Logging in…" : "Log in"}
            </button>
          </form>

          {!showResend ? (
            <button
              type="button"
              onClick={() => {
                setShowResend(true);
                setResendEmail(email);
              }}
              className="mt-3 w-full text-center text-xs text-slate-500 hover:text-brand-600"
            >
              Didn’t get a verification email? Resend it
            </button>
          ) : (
            <form onSubmit={onResend} className="mt-3 space-y-2 rounded-lg border border-slate-200 p-3">
              <p className="text-xs text-slate-500">Resend verification email</p>
              <input
                type="email"
                required
                value={resendEmail}
                onChange={(e) => setResendEmail(e.target.value)}
                className="input py-1.5 text-sm"
                placeholder="you@bmu.edu.ng"
              />
              <button type="submit" disabled={resendBusy} className="btn-outline w-full py-1.5 text-sm">
                {resendBusy ? "Sending…" : "Resend link"}
              </button>
              {resendMsg && <p className="text-xs text-green-600">{resendMsg}</p>}
            </form>
          )}

          <p className="mt-4 text-center text-sm text-slate-500">
            New here?{" "}
            <Link href="/register" className="font-medium text-brand-600 hover:underline">
              Create an account
            </Link>
          </p>
          <p className="mt-1 text-center text-sm text-slate-500">
            <Link href="/forgot-password" className="font-medium text-brand-600 hover:underline">
              Forgot your password?
            </Link>
          </p>
        </div>
      </div>
    </main>
  );
}

export default function LoginPage() {
  return (
    <AuthProvider initialUser={null}>
      <LoginForm />
    </AuthProvider>
  );
}
