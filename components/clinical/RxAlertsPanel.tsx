"use client";

import type { ScreenResult, AlertLevel } from "@/lib/clinical/interactions";

const LEVEL_STYLE: Record<AlertLevel, { box: string; chip: string; icon: string; label: string }> = {
  danger:  { box: "border-red/50 bg-red-soft",       chip: "bg-red text-white",         icon: "⛔", label: "Contraindicated" },
  warning: { box: "border-amber/50 bg-amber-soft",   chip: "bg-amber text-white",       icon: "⚠️", label: "Warning" },
  info:    { box: "border-border bg-surface-2",      chip: "bg-surface-3 text-ink-2",   icon: "ℹ️", label: "Note" },
};

/**
 * Renders drug–allergy + curated drug–drug screening results at prescribe time.
 * Shows nothing when there are no alerts. Always carries the scope disclaimer so
 * the absence of warnings is never read as a clean comprehensive screen.
 */
export function RxAlertsPanel({ result, className = "" }: { result: ScreenResult; className?: string }) {
  if (!result.hasAny) return null;
  return (
    <div className={`rounded-lg border border-border overflow-hidden ${className}`}>
      <div className="px-3.5 py-2 bg-surface-2 border-b border-border flex items-center gap-2">
        <span className="text-[13px]">🛡️</span>
        <span className="text-[11px] font-bold uppercase tracking-wide text-ink-2">Prescribing checks</span>
        <span className="text-[10.5px] text-ink-muted">· {result.alerts.length} alert{result.alerts.length === 1 ? "" : "s"}</span>
      </div>
      <div className="p-2 flex flex-col gap-2">
        {result.alerts.map((a) => {
          const s = LEVEL_STYLE[a.level];
          return (
            <div key={a.id} className={`rounded-md border px-3 py-2 ${s.box}`}>
              <div className="flex items-center gap-2 mb-0.5">
                <span className="text-[12px]">{s.icon}</span>
                <span className={`text-[9.5px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded ${s.chip}`}>{s.label}</span>
                <span className="text-[12.5px] font-semibold text-ink">{a.title}</span>
              </div>
              <div className="text-[11.5px] text-ink-2 leading-snug pl-[26px]">{a.detail}</div>
            </div>
          );
        })}
      </div>
      <div className="px-3.5 py-2 bg-surface border-t border-border text-[10.5px] text-ink-muted leading-snug">
        Drug–allergy screening checks the structured allergy list. Drug–drug checks use a <strong className="text-ink-2">limited curated set</strong> scoped to the GLP-1 formulary — not a comprehensive interaction database. No alert here does not guarantee a combination is safe.
      </div>
    </div>
  );
}
