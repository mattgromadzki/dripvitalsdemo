import type { ReactNode } from "react";
interface KpiCardProps {
  label: string;
  value: string | number;
  icon: string;
  iconBg?: string;
  iconColor?: string;
  trend?: string;
  trendColor?: string;
}

export function KpiCard({
  label,
  value,
  icon,
  iconBg = "var(--color-brand-soft)",
  iconColor = "var(--color-brand)",
  trend,
  trendColor,
}: KpiCardProps) {
  return (
    <div className="group bg-surface border border-border rounded-2xl px-4 py-3.5 min-h-[92px] shadow-xs hover:shadow-sm hover:border-border-2 transition-all">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-[23px] font-extrabold tracking-tight leading-none text-ink mb-1">{value}</div>
          <div className="text-[11.5px] text-ink-muted font-semibold uppercase tracking-[.06em]">{label}</div>
        </div>
        <div
          className="w-9 h-9 rounded-[13px] flex items-center justify-center text-[15px] shrink-0"
          style={{ background: iconBg, color: iconColor }}
        >
          {icon}
        </div>
      </div>
      {trend && (
        <div className="text-[11px] font-semibold mt-2" style={{ color: trendColor || "var(--color-ink-muted)" }}>
          {trend}
        </div>
      )}
    </div>
  );
}

export function KpiGrid({ children, cols = 4 }: { children: ReactNode; cols?: number }) {
  return (
    <div
      className="grid gap-3 mb-[18px]"
      style={{ gridTemplateColumns: `repeat(auto-fit, minmax(${cols >= 5 ? 150 : 180}px, 1fr))` }}
    >
      {children}
    </div>
  );
}
