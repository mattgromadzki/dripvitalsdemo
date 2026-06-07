"use client";

import { useEffect, useMemo } from "react";
import { toast } from "@/lib/hooks/useToast";
import { useClinical } from "@/lib/hooks/useClinical";
import { seedChart } from "@/lib/clinical/chartTypes";
import type { Patient, PatientExtra } from "@/lib/types";

export function ChartSummaryPanel({ patient, extra }: { patient: Patient; extra: PatientExtra }) {
  const openSx = extra.sideEffects.filter((s) => !s.resolved);

  const stored = useClinical((s) => s.charts[patient.id]);
  const ensureSeeded = useClinical((s) => s.ensureSeeded);
  useEffect(() => { ensureSeeded(patient.id, patient); }, [patient.id, patient, ensureSeeded]);
  const chart = useMemo(() => stored ?? seedChart(patient), [stored, patient]);
  const allergies = chart.allergies.filter((a) => a.status === "active");
  const problems = chart.problems.filter((p) => p.status === "active");
  const activeMeds = chart.meds.filter((m) => m.status === "active");

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
        <div className="card-head"><div className="ch-icon">⚠</div><div className="ct">Allergies</div></div>
        <div className="px-4 py-2.5">
          {allergies.length > 0 ? (
            <div className="flex flex-col gap-1.5">
              {allergies.map((a) => (
                <div key={a.id} className="flex items-center justify-between gap-2 text-[12.5px]">
                  <span className="font-semibold text-ink">{a.allergen}{a.reaction && <span className="text-ink-muted font-normal"> · {a.reaction}</span>}</span>
                  <span className={`text-[10.5px] font-semibold px-2 py-0.5 rounded-pill ${a.severity === "severe" || a.severity === "anaphylaxis" ? "bg-red-soft text-red" : a.severity === "moderate" ? "bg-amber-soft text-amber" : "bg-green-soft text-green"}`}>{a.severity}</span>
                </div>
              ))}
            </div>
          ) : chart.nkda ? (
            <div className="text-[12px] text-green font-semibold">No known drug allergies</div>
          ) : (
            <div className="text-[12px] text-ink-muted">No allergies recorded</div>
          )}
        </div>
      </div>

      <div className="card">
        <div className="card-head"><div className="ch-icon">🩺</div><div className="ct">Problem List</div></div>
        <div className="px-4 py-2.5">
          {problems.length > 0 ? (
            <div className="flex flex-col gap-1.5">
              {problems.map((p) => (
                <div key={p.id} className="flex items-center gap-2 text-[12.5px]">
                  <span className="font-mono text-[11px] text-ink-muted bg-surface-2 px-1.5 py-0.5 rounded border border-border">{p.code}</span>
                  <span className="text-ink">{p.label}</span>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-[12px] text-ink-muted">No active problems</div>
          )}
        </div>
      </div>

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
          {activeMeds.length === 0 && <div className="px-3 py-4 text-center text-[12px] text-ink-muted">No active medications</div>}
          {activeMeds.map((m) => (
            <div key={m.id} className="flex items-center gap-2.5 px-3 py-2 border-b border-border last:border-none">
              <div className="w-7 h-7 rounded-lg bg-brand-soft text-brand-dk flex items-center justify-center text-[13px] flex-shrink-0">💊</div>
              <div className="flex-1 min-w-0">
                <div className="text-[12.5px] font-semibold text-ink">{m.name}</div>
                <div className="text-[11px] text-ink-muted">{[m.dose, m.route, m.frequency].filter(Boolean).join(" · ") || "—"}</div>
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
