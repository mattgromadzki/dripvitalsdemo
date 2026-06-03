"use client";

import type { ReactNode } from "react";

import { Pill } from "@/components/ui/Pill";
import { toast } from "@/lib/hooks/useToast";
import { SectionCard } from "@/components/modules/chart/SectionCard";
import type { Patient, PatientExtra } from "@/lib/types";

const FLAG_INTENT: Record<string, "green" | "amber" | "red" | "muted"> = {
  normal: "green",
  high: "amber",
  low: "amber",
  critical: "red",
};

export function LabsTab({ patient, extra }: { patient: Patient; extra: PatientExtra }) {
  const labs = extra.labs;

  return (
    <div>
      <div className="flex items-center gap-3 mb-4 flex-wrap">
        <div>
          <div className="text-[16px] font-bold tracking-tight text-ink">Lab Results</div>
          <div className="text-[12px] text-ink-muted">{labs.length} result{labs.length === 1 ? "" : "s"} on file</div>
        </div>
        <div className="flex-1" />
        <button className="btn btn-ghost btn-sm" onClick={() => toast("📥 Exporting lab history…")}>📥 Export</button>
        <button className="btn btn-primary btn-sm" onClick={() => toast("🧪 Order labs flow opened")}>🧪 Order Labs</button>
      </div>

      <SectionCard title="All Results" icon="🧪" iconBg="var(--color-teal-soft)" iconColor="var(--color-teal)">
        {labs.length === 0 ? (
          <div className="py-8 text-center text-ink-muted">
            <div className="text-[36px] opacity-40 mb-2">🧪</div>
            <div className="text-[13.5px] font-bold mb-1 text-ink">No labs on file yet</div>
            <div className="text-[12px]">Click &ldquo;Order Labs&rdquo; to send a new order</div>
          </div>
        ) : (
          <div className="overflow-x-auto -mx-5">
            <table className="w-full border-collapse text-[13px]">
              <thead className="bg-surface-2">
                <tr>
                  <Th>Date</Th>
                  <Th>Test</Th>
                  <Th>Value</Th>
                  <Th>Flag</Th>
                  <Th>Ordered By</Th>
                </tr>
              </thead>
              <tbody>
                {labs.map((l, i) => (
                  <tr key={i} className="hover:bg-surface-2 transition-colors">
                    <Td><span className="font-mono text-[11.5px] text-ink-muted">{l.date}</span></Td>
                    <Td><span className="font-semibold">{l.name}</span></Td>
                    <Td>
                      <span className={`font-mono text-[13px] font-semibold ${
                        l.flag === "critical" ? "text-red" :
                        l.flag === "high" || l.flag === "low" ? "text-amber" :
                        "text-ink"
                      }`}>
                        {l.value}
                      </span>
                    </Td>
                    <Td><Pill intent={FLAG_INTENT[l.flag]}>{l.flag[0].toUpperCase() + l.flag.slice(1)}</Pill></Td>
                    <Td><span className="text-[12px]">{l.ordered_by}</span></Td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </SectionCard>

      <SectionCard title="Pending Orders" icon="⏳" iconBg="var(--color-amber-soft)" iconColor="var(--color-amber)">
        <div className="py-6 text-center text-[12.5px] text-ink-muted">
          No pending lab orders for {patient.first}
        </div>
      </SectionCard>
    </div>
  );
}

function Th({ children }: { children: ReactNode }) {
  return (
    <th className="py-2.5 px-5 text-left text-[10px] font-bold uppercase tracking-wider text-ink-muted border-b border-border whitespace-nowrap">
      {children}
    </th>
  );
}

function Td({ children }: { children: ReactNode }) {
  return <td className="py-2.5 px-5 border-b border-border align-middle">{children}</td>;
}
