"use client";

import type { ReactNode } from "react";

interface SectionCardProps {
  title: string;
  icon?: string;
  iconBg?: string;
  iconColor?: string;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
}

export function SectionCard({ title, icon, iconBg, iconColor, action, children, className = "" }: SectionCardProps) {
  return (
    <div className={`bg-surface border border-border rounded-lg overflow-hidden mb-4 transition-colors hover:border-border-2 ${className}`}>
      <div className="flex items-center gap-2.5 py-3 px-5 bg-surface-2 border-b border-border">
        {icon && (
          <div
            className="w-7 h-7 rounded-md flex items-center justify-center text-[13px] flex-shrink-0 border border-border bg-surface"
            style={{ background: iconBg, color: iconColor }}
          >
            {icon}
          </div>
        )}
        <div className="text-[13px] font-bold uppercase tracking-wider text-ink-2 flex-1">{title}</div>
        {action}
      </div>
      <div className="px-5 py-[18px]">{children}</div>
    </div>
  );
}

interface DataFieldProps {
  label: string;
  value: ReactNode;
  mono?: boolean;
}

export function DataField({ label, value, mono }: DataFieldProps) {
  return (
    <div className="bg-surface-2 border border-border rounded-[10px] px-4 py-3">
      <div className="text-[10.5px] font-bold uppercase tracking-widest text-ink-muted mb-1.5">{label}</div>
      <div className={`text-[14px] font-semibold text-ink leading-snug ${mono ? "font-mono" : ""}`}>
        {value || "—"}
      </div>
    </div>
  );
}

export function DataGrid({ children, cols = 2 }: { children: ReactNode; cols?: number }) {
  return (
    <div className="grid gap-3" style={{ gridTemplateColumns: `repeat(${cols}, 1fr)` }}>
      {children}
    </div>
  );
}
