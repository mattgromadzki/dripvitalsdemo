"use client";

import { toast } from "@/lib/hooks/useToast";
import type { Patient, PatientExtra } from "@/lib/types";

export function ChartSummaryPanel({ patient, extra }: { patient: Patient; extra: PatientExtra }) {
  const activeRx = extra.prescriptions.filter((rx) => rx.status === "active");
  const openSx = extra.sideEffects.filter((s) => !s.resolved);

  const vitals: { k: string; v: string }[] = [
    { k: "Weight", v: `${patient.wt} lbs · BMI ${patient.bmi}` },
    { k: "Blood pressure", v: patient.bp },
    { k: "Heart rate", v: `${patient.hr} bpm` },
    { k: "Current dose", v: patient.dose },
    { k: "Next refill", v: patient.nextRefill },
    { k: "Risk score", v: `${extra.riskScore} / 100 · ${extra.riskLabel}` },
  ];

  return (
    <div className="flex flex-col gap-3">
      <div className="card">
        <div className="card-head"><div className="ch-icon">❤</div><div className="ct">Vitals</div></div>
        <div className="px-4 py-1.5">
          {vitals.map((row) => (
            <div key={row.k} className="flex justify-between py-1.5 border-b border-border last:border-none text-[12.5px]">
              <span className="text-ink-muted">{row.k}</span>
              <span className="font-semibold text-ink">{row.v}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="card">
        <div className="card-head"><div className="ch-icon">💊</div><div className="ct">Medications</div></div>
        <div className="p-1">
          {activeRx.length === 0 && <div className="px-3 py-4 text-center text-[12px] text-ink-muted">No active medications</div>}
          {activeRx.map((rx) => (
            <div key={rx.id} className="flex items-center gap-2.5 px-3 py-2 border-b border-border last:border-none">
              <div className="w-7 h-7 rounded-lg bg-brand-soft text-brand-dk flex items-center justify-center text-[13px] flex-shrink-0">💉</div>
              <div className="flex-1 min-w-0">
                <div className="text-[12.5px] font-semibold text-ink">{rx.med}</div>
                <div className="text-[11px] text-ink-muted">{rx.dose}</div>
              </div>
              <span className="text-[10.5px] font-semibold px-2 py-0.5 rounded-pill bg-green-soft text-green">Active</span>
            </div>
          ))}
        </div>
      </div>

      <div className="card">
        <div className="card-head"><div className="ch-icon">⚠</div><div className="ct">Alerts</div></div>
        <div className="p-1">
          {openSx.length === 0 && <div className="px-3 py-4 text-center text-[12px] text-ink-muted">No open alerts</div>}
          {openSx.map((s, i) => (
            <div key={i} className="flex items-center gap-2.5 px-3 py-2 border-b border-border last:border-none">
              <div className="w-7 h-7 rounded-lg bg-amber-soft text-amber flex items-center justify-center text-[13px] flex-shrink-0">⚠</div>
              <div className="flex-1 min-w-0">
                <div className="text-[12.5px] font-semibold text-ink">{s.sx}</div>
                <div className="text-[11px] text-ink-muted capitalize">{s.severity} · {s.date}</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      <button className="w-full bg-brand-soft text-brand-dk font-semibold rounded-[10px] py-2.5 text-[12.5px] hover:bg-brand-softer transition-colors" onClick={() => toast("⚡ Quick actions")}>⚡ Quick actions</button>
    </div>
  );
}
