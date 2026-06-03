"use client";

import type { ReactNode } from "react";

export function AuthShell({ title, subtitle, children }: { title: string; subtitle?: string; children: ReactNode }) {
  return (
    <div style={{ minHeight: "100vh", background: "var(--color-bg, #f5f7fb)" }} className="flex flex-col items-center justify-center py-10 px-4">
      <div className="flex items-center mb-5">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/logo.png" alt="DripVitals" style={{ height: 42, width: "auto", objectFit: "contain" }} />
      </div>
      <div className="w-full max-w-[400px] bg-surface border border-border rounded-2xl shadow-sm p-7">
        <h1 className="text-[20px] font-extrabold tracking-tight mb-1">{title}</h1>
        {subtitle && <p className="text-[12.5px] text-ink-muted mb-5">{subtitle}</p>}
        {children}
      </div>
      <div className="text-[11px] text-ink-muted-2 mt-5">🔒 DripVitals · Provider Console</div>
    </div>
  );
}
