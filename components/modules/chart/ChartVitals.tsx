"use client";

import type { Patient, PatientExtra } from "@/lib/types";

interface ChartVitalsProps {
  patient: Patient;
  extra: PatientExtra;
}

export function ChartVitals({ patient, extra }: ChartVitalsProps) {
  const refillVal = patient._refillDays < 0
    ? "Overdue"
    : patient._refillDays >= 999
    ? "—"
    : `${patient._refillDays}d`;
  const refillColor = patient._refillDays < 0
    ? "var(--color-red)"
    : patient._refillDays <= 7
    ? "var(--color-amber)"
    : "var(--color-brand)";
  const riskColor = extra.riskScore >= 80
    ? "var(--color-green)"
    : extra.riskScore >= 60
    ? "var(--color-amber)"
    : "var(--color-red)";

  const vitals: { lbl: string; val: string | number; unit: string; sub: string; color: string }[] = [
    { lbl: "Weight",         val: patient.wt,   unit: "lbs",  sub: `BMI ${patient.bmi}`,    color: "var(--color-green)" },
    { lbl: "Blood Pressure", val: patient.bp,   unit: "mmHg", sub: "Latest reading",         color: "var(--color-brand)" },
    { lbl: "Heart Rate",     val: patient.hr,   unit: "bpm",  sub: "Resting",                color: "var(--color-teal)"  },
    { lbl: "Current Dose",   val: patient.dose, unit: "",     sub: "Weekly injection",       color: "var(--color-violet)"},
    { lbl: "Next Refill",    val: refillVal,    unit: "",     sub: patient.nextRefill,       color: refillColor          },
    { lbl: "Risk Score",     val: extra.riskScore, unit: "/100", sub: `${extra.riskLabel} risk`, color: riskColor          },
  ];

  return (
    <div className="bg-surface border border-border rounded-lg flex mb-3.5 shadow-xs overflow-hidden">
      {vitals.map((v) => (
        <div key={v.lbl} className="flex-1 px-[18px] py-4 border-r border-border last:border-r-0 min-w-0">
          <div className="text-[10.5px] font-bold uppercase tracking-widest text-ink-muted mb-2">{v.lbl}</div>
          <div className="text-[22px] font-bold leading-tight tracking-tight" style={{ color: v.color }}>
            {v.val}
            {v.unit && <span className="text-[13px] font-semibold text-ink-muted ml-1">{v.unit}</span>}
          </div>
          <div className="text-[11.5px] text-ink-muted mt-1">{v.sub}</div>
        </div>
      ))}
    </div>
  );
}
