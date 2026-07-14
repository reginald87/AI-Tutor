"use client";

import { createContext, useContext, useEffect, useState, useCallback } from "react";

export interface PromptState {
  promptsPerDay: number;
  promptsPerWeek: number;
  dailyUsed: number;
  weeklyUsed: number;
  dailyRemaining: number;
  weeklyRemaining: number;
  dailyResetsAt: string;
  weeklyResetsAt: string;
  exhausted: boolean;
  reason?: "daily" | "weekly";
}

export interface AuthUser {
  id: string;
  email: string;
  name: string;
  role: string;
  matricNumber: string | null;
  department: string | null;
  faculty: string | null;
  program: string | null;
  level: string | null;
  verified: boolean;
  mustChangePassword: boolean;
  rewardPoints: number;
  promptsPerDay: number;
  promptsPerWeek: number;
  dailyUsed: number;
  weeklyUsed: number;
  dailyResetAt: string;
  weeklyResetAt: string;
}

interface AuthContextValue {
  user: AuthUser | null;
  prompts: PromptState | null;
  loading: boolean;
  refresh: () => Promise<void>;
  login: (email: string, password: string) => Promise<void>;
  register: (data: Record<string, unknown>) => Promise<{ ok: boolean; emailSent: boolean; email: string }>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({
  initialUser,
  children,
}: {
  initialUser: AuthUser | null;
  children: React.ReactNode;
}) {
  const [user, setUser] = useState<AuthUser | null>(initialUser);
  const [prompts, setPrompts] = useState<PromptState | null>(null);
  const [loading, setLoading] = useState(false);

  const [cpCurrent, setCpCurrent] = useState("");
  const [cpNew, setCpNew] = useState("");
  const [cpError, setCpError] = useState<string | null>(null);
  const [cpSaving, setCpSaving] = useState(false);

  const changePassword = async () => {
    setCpError(null);
    setCpSaving(true);
    try {
      const res = await fetch("/api/auth/change-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword: cpCurrent, newPassword: cpNew }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Could not change password.");
      setCpCurrent("");
      setCpNew("");
      await refresh();
    } catch (e) {
      setCpError((e as Error).message);
    } finally {
      setCpSaving(false);
    }
  };

  const refresh = useCallback(async () => {
    try {
      const res = await fetch("/api/auth/me", { cache: "no-store" });
      const data = await res.json();
      if (res.ok && data.user) {
        setUser(data.user);
        setPrompts(data.prompts);
      } else {
        setUser(null);
        setPrompts(null);
      }
    } catch {
      setUser(null);
      setPrompts(null);
    }
  }, []);

  useEffect(() => {
    if (initialUser) refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const login = async (email: string, password: string) => {
    const res = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data?.error || "Login failed");
    setUser(data.user);
    await refresh();
  };

  const register = async (form: Record<string, unknown>) => {
    const res = await fetch("/api/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data?.error || "Registration failed");
    // No auto-login: new accounts must verify their email before use.
    return data as { ok: boolean; emailSent: boolean; email: string };
  };

  const logout = async () => {
    await fetch("/api/auth/logout", { method: "POST" });
    setUser(null);
    setPrompts(null);
  };

  const forcingPasswordChange = user?.mustChangePassword === true;

  return (
    <AuthContext.Provider value={{ user, prompts, loading, refresh, login, register, logout }}>
      {children}
      {forcingPasswordChange && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/70 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
            <h2 className="text-lg font-semibold text-slate-900">Set a new password</h2>
            <p className="mt-1 text-sm text-slate-500">
              For security, you must change your password before continuing.
            </p>
            <div className="mt-4 space-y-3">
              <input
                type="password"
                placeholder="Current password"
                value={cpCurrent}
                onChange={(e) => setCpCurrent(e.target.value)}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/30"
              />
              <input
                type="password"
                placeholder="New password (min 6 characters)"
                value={cpNew}
                onChange={(e) => setCpNew(e.target.value)}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/30"
              />
              {cpError && <p className="text-sm text-red-600">{cpError}</p>}
              <button
                onClick={changePassword}
                disabled={cpSaving || !cpCurrent || !cpNew}
                className="w-full rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white transition hover:opacity-90 disabled:opacity-50"
              >
                {cpSaving ? "Saving…" : "Change password & continue"}
              </button>
            </div>
          </div>
        </div>
      )}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
