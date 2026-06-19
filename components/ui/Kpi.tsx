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

export function KpiCard({ label, value, icon, iconBg = "var(--color-brand-soft)", iconColor = "var(--color-brand)", trend, trendColor }: KpiCardProps) {
  return (
    <div className="card relative px-[18px] py-4 hover:shadow-sm hover:border-border-2 transition-all">
      <div
        className="absolute top-3.5 right-4 w-8 h-8 rounded-[9px] flex items-center justify-center text-[15px]"
        style={{ background: iconBg, color: iconColor }}
      >
        {icon}
      </div>
      <div className="text-[24px] font-bold tracking-tight leading-tight text-ink mb-0.5">{value}</div>
      <div className="text-[11.5px] text-ink-muted font-medium">{label}</div>
      {trend && (
        <div className="text-[10.5px] font-semibold mt-2" style={{ color: trendColor }}>
          {trend}
        </div>
      )}
    </div>
  );
}

export function KpiGrid({ children, cols = 4 }: { children: ReactNode; cols?: number }) {
  return <div className="grid gap-3 mb-[18px]" style={{ gridTemplateColumns: `repeat(${cols}, 1fr)` }}>{children}</div>;
}
