"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import Logo from "@/components/Logo";

function VerifyEmailInner() {
  const params = useSearchParams();
  const token = params.get("token") || "";
  const [state, setState] = useState<"loading" | "success" | "error">("loading");
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (!token) {
      setState("error");
      setMessage("This verification link is missing its token.");
      return;
    }
    fetch("/api/auth/verify-email", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token }),
    })
      .then(async (res) => {
        const data = await res.json().catch(() => ({}));
        if (res.ok) {
          setState("success");
        } else {
          setState("error");
          setMessage(data.error || "Verification failed.");
        }
      })
      .catch(() => {
        setState("error");
        setMessage("Something went wrong. Please try again.");
      });
  }, [token]);

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-100 px-4">
      <div className="w-full max-w-md">
        <Link href="/" className="mb-6 flex items-center justify-center gap-2">
          <Logo className="h-9 w-9" />
          <span className="text-lg font-semibold text-slate-800">BMU AI Tutor</span>
        </Link>
        <div className="card p-7 text-center">
          {state === "loading" && (
            <>
              <div className="text-4xl">⏳</div>
              <h1 className="mt-3 text-xl font-semibold text-slate-800">Verifying your email…</h1>
              <p className="mt-2 text-sm text-slate-500">Just a moment.</p>
            </>
          )}
          {state === "success" && (
            <>
              <div className="text-4xl">✅</div>
              <h1 className="mt-3 text-xl font-semibold text-slate-800">Email verified!</h1>
              <p className="mt-2 text-sm text-slate-500">
                Your account is now active. You can start using BMU AI Tutor.
              </p>
              <Link href="/dashboard" className="btn-primary mt-5 w-full">
                Go to dashboard
              </Link>
            </>
          )}
          {state === "error" && (
            <>
              <div className="text-4xl">⚠️</div>
              <h1 className="mt-3 text-xl font-semibold text-slate-800">Verification failed</h1>
              <p className="mt-2 text-sm text-red-600">{message}</p>
              <Link href="/login" className="btn-primary mt-5 w-full">
                Back to login
              </Link>
            </>
          )}
        </div>
      </div>
    </main>
  );
}

export default function VerifyEmailPage() {
  return (
    <Suspense fallback={<div className="p-10 text-center text-slate-400">Loading…</div>}>
      <VerifyEmailInner />
    </Suspense>
  );
}
