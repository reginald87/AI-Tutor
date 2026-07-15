"use client";

import { useState } from "react";
import DashboardSidebar from "@/components/DashboardSidebar";

export default function DashboardShell({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false);

  return (
    <div className="flex min-h-screen bg-slate-50">
      {/* Mobile top bar */}
      <div className="fixed inset-x-0 top-0 z-30 flex h-14 items-center gap-2 border-b border-slate-200 bg-white px-3 md:hidden">
        <button
          onClick={() => setOpen(true)}
          aria-label="Open menu"
          className="grid h-9 w-9 place-items-center rounded-md text-slate-600 hover:bg-slate-100"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <path d="M4 6h16M4 12h16M4 18h16" />
          </svg>
        </button>
        <span className="font-semibold text-slate-800">BMU AI Tutor</span>
      </div>

      <DashboardSidebar mobileOpen={open} onClose={() => setOpen(false)} />

      <main className="flex-1 overflow-x-hidden pt-14 md:pt-0">{children}</main>
    </div>
  );
}
