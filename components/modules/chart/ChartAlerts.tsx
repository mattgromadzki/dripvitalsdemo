"use client";

import { toast } from "@/lib/hooks/useToast";
import type { Patient, PatientExtra } from "@/lib/types";

interface Alert {
  color: "red" | "amber";
  icon: string;
  msg: string;
  action: string;
  onAction: () => void;
}

export function ChartAlerts({ patient, extra }: { patient: Patient; extra: PatientExtra }) {
  const alerts: Alert[] = [];

  if (patient._refillDays < 0) {
    alerts.push({
      color: "red",
      icon: "🔴",
      msg: `Refill overdue by ${Math.abs(patient._refillDays)} days. Patient may be without medication.`,
      action: "Order Refill",
      onAction: () => toast("💊 Refill order flow opened"),
    });
  } else if (patient._refillDays >= 0 && patient._refillDays <= 7) {
    alerts.push({
      color: "amber",
      icon: "⏰",
      msg: `Refill due in ${patient._refillDays} days (${patient.nextRefill}). Schedule reorder.`,
      action: "Order Now",
      onAction: () => toast("💊 Refill order flow opened"),
    });
  }

  const moderate = extra.sideEffects.find((s) => !s.resolved && s.severity === "moderate");
  if (moderate) {
    alerts.push({
      color: "amber",
      icon: "⚠️",
      msg: `Unresolved moderate side effect on file: ${moderate.sx}`,
      action: "Review",
      onAction: () => toast("📋 Opening Progress tab to review"),
    });
  }

  if (alerts.length === 0) return null;

  return (
    <div className="mb-3.5">
      {alerts.map((a, i) => (
        <div
          key={i}
          className="border border-border rounded-md py-3 px-4 mb-2.5 last:mb-0 flex items-center gap-3"
          style={{
            borderLeft: `3px solid ${a.color === "red" ? "var(--color-red)" : "var(--color-amber)"}`,
            background: a.color === "red" ? "rgba(192,57,43,.04)" : "rgba(184,110,30,.04)",
          }}
        >
          <span className="text-[18px] flex-shrink-0">{a.icon}</span>
          <span className="flex-1 text-[13.5px] text-ink-2">{a.msg}</span>
          <button className="btn btn-ghost btn-sm" onClick={a.onAction}>{a.action}</button>
        </div>
      ))}
    </div>
  );
}
