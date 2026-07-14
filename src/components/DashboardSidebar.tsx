"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "@/components/AuthProvider";
import Logo from "@/components/Logo";
import PromptMeter from "@/components/PromptMeter";

const NAV = [
  { href: "/dashboard", label: "Dashboard", icon: "🏠" },
  { href: "/dashboard/chat", label: "AI Chat", icon: "💬" },
  { href: "/dashboard/quizzes", label: "Quizzes", icon: "📝" },
];

export default function DashboardSidebar() {
  const { user, logout } = useAuth();
  const pathname = usePathname();

  async function onLogout() {
    await logout();
    window.location.assign("/login");
  }

  return (
    <aside className="flex w-64 flex-col border-r border-slate-200 bg-white">
      <Link href="/dashboard" className="flex items-center gap-2 px-5 py-4">
        <Logo className="h-9 w-9" />
        <div className="leading-tight">
          <div className="text-sm font-semibold text-slate-800">BMU AI Tutor</div>
          <div className="text-[11px] text-slate-400">Learning companion</div>
        </div>
      </Link>

      <nav className="flex-1 space-y-1 px-3 py-2">
        {NAV.map((item) => {
          const active =
            item.href === "/dashboard"
              ? pathname === "/dashboard"
              : pathname.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition ${
                active ? "bg-accent-50 text-accent-700" : "text-slate-600 hover:bg-slate-100"
              }`}
            >
              <span className="text-base">{item.icon}</span>
              {item.label}
            </Link>
          );
        })}
        {user?.role === "ADMIN" && (
          <Link
            href="/admin"
              className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition ${
                pathname.startsWith("/admin")
                  ? "bg-accent-50 text-accent-700"
                  : "text-slate-600 hover:bg-slate-100"
              }`}
          >
            <span className="text-base">🛡️</span>
            Admin
          </Link>
        )}
      </nav>

      <div className="px-3 pb-3">
        <PromptMeter />
      </div>

      <div className="border-t border-slate-200 p-3">
        <div className="flex items-center gap-3 px-2">
          <div className="grid h-9 w-9 place-items-center rounded-full bg-slate-200 text-sm font-semibold text-slate-600">
            {user?.name?.charAt(0)?.toUpperCase() || "U"}
          </div>
          <div className="min-w-0 flex-1">
            <div className="truncate text-sm font-medium text-slate-800">{user?.name}</div>
            <div className="truncate text-xs text-slate-400">
              {user?.verified ? "✓ Verified" : "Pending verification"}
            </div>
          </div>
          <button
            onClick={onLogout}
            title="Log out"
            className="rounded-md p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
          >
            ⏻
          </button>
        </div>
      </div>
    </aside>
  );
}
