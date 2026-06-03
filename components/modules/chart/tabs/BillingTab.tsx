"use client";

import type { ReactNode } from "react";

import { Pill } from "@/components/ui/Pill";
import { toast } from "@/lib/hooks/useToast";
import { SectionCard } from "@/components/modules/chart/SectionCard";
import type { Patient, PatientExtra } from "@/lib/types";

const STATUS_INTENT: Record<string, "green" | "amber" | "red" | "muted"> = {
  paid: "green",
  pending: "amber",
  failed: "red",
  refunded: "muted",
};

export function BillingTab({ patient, extra }: { patient: Patient; extra: PatientExtra }) {
  const noSub = patient.sub === "—" || patient.status !== "active";

  return (
    <div className="grid grid-cols-[1fr_1fr] gap-4 max-[1100px]:grid-cols-1">
      {/* LEFT — Subscription + payment method */}
      <div>
        <SectionCard
          title="Subscription"
          icon="💳"
          iconBg="var(--color-green-soft)"
          iconColor="var(--color-green)"
          action={
            <>
              <button className="btn btn-ghost btn-sm" onClick={() => toast("⏸ Pause flow opened")}>Pause</button>
              <button
                className="btn btn-sm ml-1 text-red border border-red-soft bg-transparent hover:bg-red-soft transition-colors"
                onClick={() => toast("Cancel confirmation flow…")}
              >
                Cancel
              </button>
            </>
          }
        >
          {noSub ? (
            <div className="py-6 text-center text-ink-muted">
              <div className="text-[32px] opacity-40 mb-2">💳</div>
              <div className="text-[13px] font-bold text-ink mb-1">No active subscription</div>
              <div className="text-[11.5px]">{patient.first} is not currently enrolled in a recurring plan</div>
            </div>
          ) : (
            <>
              <div
                className="rounded-md px-4 py-3.5 mb-3.5 border"
                style={{ background: "var(--color-green-soft)", borderColor: "rgba(31,138,112,.2)" }}
              >
                <div className="text-[10.5px] font-semibold uppercase tracking-widest text-ink-muted mb-0.5">
                  Active Subscription
                </div>
                <div className="text-[16px] font-bold text-ink mb-0.5">{patient.plan}</div>
                <div className="text-[22px] font-extrabold tracking-tight text-green">{patient.sub}</div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Status" value={<Pill intent="green" dot>Active</Pill>} />
                <Field label="Next Charge" value={patient.nextRefill} mono />
                <Field label="Payment Method" value="Visa ···· 4242" />
                <Field label="Member Since" value={patient.since} />
              </div>
            </>
          )}
        </SectionCard>

        <SectionCard
          title="Payment Methods"
          icon="🏦"
          iconBg="var(--color-blue-soft)"
          iconColor="var(--color-blue)"
          action={<button className="btn btn-ghost btn-sm" onClick={() => toast("💳 Add card flow opened")}>+ Add Card</button>}
        >
          <div className="flex items-center gap-3 py-2 px-3 bg-surface-2 border border-border rounded-md">
            <div className="w-10 h-7 bg-blue rounded text-white text-[10px] font-bold flex items-center justify-center">
              VISA
            </div>
            <div className="flex-1">
              <div className="text-[12.5px] font-semibold text-ink">Visa ending in 4242</div>
              <div className="text-[10.5px] text-ink-muted">Expires 12/2027</div>
            </div>
            <Pill intent="green">Default</Pill>
          </div>
        </SectionCard>
      </div>

      {/* RIGHT — Invoice history */}
      <SectionCard
        title="Invoice History"
        icon="🧾"
        iconBg="var(--color-blue-soft)"
        iconColor="var(--color-blue)"
        action={
          <button className="btn btn-ghost btn-sm" onClick={() => toast("📥 Exporting full statement…")}>
            📥 Export All
          </button>
        }
      >
        {extra.invoices.length === 0 ? (
          <div className="py-8 text-center text-ink-muted">
            <div className="text-[32px] opacity-40 mb-2">🧾</div>
            <div className="text-[13px] font-bold text-ink mb-1">No invoices yet</div>
            <div className="text-[11.5px]">Invoices will appear here after the first charge</div>
          </div>
        ) : (
          <div className="overflow-x-auto -mx-5">
            <table className="w-full border-collapse text-[12.5px]">
              <thead className="bg-surface-2">
                <tr>
                  <Th>Invoice</Th>
                  <Th>Date</Th>
                  <Th>Amount</Th>
                  <Th>Plan</Th>
                  <Th>Status</Th>
                  <Th>{""}</Th>
                </tr>
              </thead>
              <tbody>
                {extra.invoices.map((inv) => (
                  <tr key={inv.id} className="hover:bg-surface-2 transition-colors">
                    <Td><span className="font-mono text-[11px] text-brand-dk font-semibold">{inv.id}</span></Td>
                    <Td><span className="font-mono text-[11px] text-ink-muted">{inv.date}</span></Td>
                    <Td><span className="font-bold text-green">{inv.amount}</span></Td>
                    <Td><span className="text-[12px]">{inv.plan}</span></Td>
                    <Td>
                      <Pill intent={STATUS_INTENT[inv.status]} dot>
                        {inv.status[0].toUpperCase() + inv.status.slice(1)}
                      </Pill>
                    </Td>
                    <Td>
                      <button
                        className="w-7 h-7 rounded-md bg-surface-2 border border-border flex items-center justify-center text-[12px] hover:bg-brand-soft hover:border-brand hover:text-brand-dk transition-colors"
                        onClick={() => toast(`📥 Invoice ${inv.id} downloaded`)}
                        title="Download invoice"
                      >
                        📥
                      </button>
                    </Td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </SectionCard>
    </div>
  );
}

function Field({ label, value, mono }: { label: string; value: ReactNode; mono?: boolean }) {
  return (
    <div className="bg-surface-2 border border-border rounded-[10px] px-4 py-3">
      <div className="text-[10.5px] font-bold uppercase tracking-widest text-ink-muted mb-1.5">{label}</div>
      <div className={`text-[13px] font-semibold text-ink leading-snug ${mono ? "font-mono" : ""}`}>
        {value}
      </div>
    </div>
  );
}

function Th({ children }: { children: ReactNode }) {
  return (
    <th className="py-2.5 px-3.5 text-left text-[10px] font-bold uppercase tracking-wider text-ink-muted border-b border-border whitespace-nowrap">
      {children}
    </th>
  );
}

function Td({ children }: { children: ReactNode }) {
  return <td className="py-2.5 px-3.5 border-b border-border align-middle">{children}</td>;
}
