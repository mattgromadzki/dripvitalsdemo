"use client";

import { useEffect, useMemo } from "react";
import { useClinical } from "@/lib/hooks/useClinical";
import { seedChart } from "@/lib/clinical/chartTypes";
import type { Patient } from "@/lib/types";

/**
 * Compact allergy + active-problem banner for prescribe surfaces. Reads the
 * structured clinical chart (store:clinical), seeding from the patient's fields
 * if it hasn't been opened yet. Allergies are emphasized in red; severe /
 * anaphylaxis entries are called out. This is the surface a future drug–allergy
 * interaction check plugs into.
 */
export function ClinicalSafetyStrip({ patient, className = "" }: { patient: Patient; className?: string }) {
  const stored = useClinical((s) => s.charts[patient.id]);
  const ensureSeeded = useClinical((s) => s.ensureSeeded);
  useEffect(() => { ensureSeeded(patient.id, patient); }, [patient.id, patient, ensureSeeded]);

  const chart = useMemo(() => stored ?? seedChart(patient), [stored, patient]);
  const allergies = chart.allergies.filter((a) => a.status === "active");
  const problems = chart.problems.filter((p) => p.status === "active");
  const meds = chart.meds.filter((m) => m.status === "active");
  const hasSevere = allergies.some((a) => a.severity === "severe" || a.severity === "anaphylaxis");

  return (
    <div className={`rounded-lg border overflow-hidden ${allergies.length ? "border-red/40" : "border-border"} ${className}`}>
      <div className={`px-3.5 py-2.5 ${allergies.length ? "bg-red-soft" : "bg-surface-2"}`}>
        <div className="flex items-start gap-2">
          <span className="text-[13px] mt-0.5">{allergies.length ? "⚠️" : "🧪"}</span>
          <div className="min-w-0">
            <div className={`text-[11px] font-bold uppercase tracking-wide ${allergies.length ? "text-red" : "text-ink-muted"}`}>
              Allergies{hasSevere ? " — severe" : ""}
            </div>
            {allergies.length > 0 ? (
              <div className="text-[12.5px] text-ink-2 mt-0.5 leading-snug">
                {allergies.map((a, i) => (
                  <span key={a.id}>
                    {i > 0 && <span className="text-ink-muted-2">, </span>}
                    <span className="font-semibold text-ink">{a.allergen}</span>
                    {a.reaction ? <span className="text-ink-muted"> ({a.reaction})</span> : null}
                    {(a.severity === "severe" || a.severity === "anaphylaxis") && <span className="text-red font-semibold"> · {a.severity}</span>}
                  </span>
                ))}
              </div>
            ) : chart.nkda ? (
              <div className="text-[12.5px] text-green font-semibold mt-0.5">No known drug allergies (NKDA)</div>
            ) : (
              <div className="text-[12.5px] text-ink-muted mt-0.5">No allergies recorded — confirm with patient before prescribing.</div>
            )}
          </div>
        </div>
      </div>
      {problems.length > 0 && (
        <div className="px-3.5 py-2 bg-surface flex flex-wrap items-center gap-1.5 border-t border-border">
          <span className="text-[10.5px] font-bold uppercase tracking-wide text-ink-muted mr-1">Problems</span>
          {problems.map((p) => (
            <span key={p.id} className="inline-flex items-center gap-1 text-[11.5px] bg-surface-2 border border-border rounded-full px-2 py-0.5">
              <span className="font-mono text-ink-muted">{p.code}</span>
              <span className="text-ink-2">{p.label}</span>
            </span>
          ))}
        </div>
      )}
      {meds.length > 0 && (
        <div className="px-3.5 py-2 bg-surface flex flex-wrap items-center gap-1.5 border-t border-border">
          <span className="text-[10.5px] font-bold uppercase tracking-wide text-ink-muted mr-1">Current meds</span>
          {meds.map((m) => (
            <span key={m.id} className="inline-flex items-center gap-1 text-[11.5px] bg-surface-2 border border-border rounded-full px-2 py-0.5">
              <span className="text-ink-2 font-semibold">{m.name}</span>
              {m.dose ? <span className="text-ink-muted">{m.dose}</span> : null}
              {m.frequency ? <span className="text-ink-muted-2">· {m.frequency}</span> : null}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
