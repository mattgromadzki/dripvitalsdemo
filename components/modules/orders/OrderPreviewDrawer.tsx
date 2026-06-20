"use client";

import { useState } from "react";
import Link from "next/link";
import { usePatients } from "@/lib/hooks/usePatients";
import { getPatientExtra } from "@/lib/data/patientExtras";
import { heightForPatient, type FulfillmentOrder } from "@/lib/data/fulfillmentOrders";
import { usePayments } from "@/lib/hooks/usePayments";
import { PaymentModal } from "@/components/modules/PaymentModal";
import { StatusBadge } from "./StatusBadge";
import { toast } from "@/lib/hooks/useToast";
import { PatientPharmacyTracking } from "@/components/modules/pharmacy/PatientPharmacyTracking";

export function OrderPreviewDrawer({ order, onClose }: { order: FulfillmentOrder; onClose: () => void }) {
  const patient = usePatients((s) => s.patients.find((p) => p.id === order.patientId));
  const paid = usePayments((s) => s.byRef[order.id]);
  const setPaid = usePayments((s) => s.setPaid);
  const [payOpen, setPayOpen] = useState(false);
  if (!patient) return null;
  const amountCents = Math.round((parseFloat((order.total || "0").replace(/[^0-9.]/g, "")) || 0) * 100);

  const extra = getPatientExtra(patient);
  const lost = Math.max(0, patient.wtStart - patient.wt);
  const goal = extra.goalWt ?? Math.round(patient.wt * 0.85);
  const denom = patient.wtStart - goal;
  const pct = denom > 0 ? Math.min(100, Math.max(0, Math.round((lost / denom) * 100))) : 0;

  return (
    <>
      <div className="fixed inset-0 z-[60] bg-[rgba(28,40,60,.16)]" onClick={onClose} />
      <aside className="fixed top-0 right-0 z-[61] h-screen w-[376px] max-w-full bg-surface border-l border-border shadow-2xl flex flex-col overflow-y-auto">
        <div className="flex items-center gap-2.5 px-[18px] py-[14px] border-b border-border">
          <span className="font-mono text-[12px] font-bold text-ink-2">{order.id}</span>
          <StatusBadge status={order.status} />
          <button onClick={onClose} className="ml-auto text-[18px] text-ink-muted hover:text-ink leading-none">✕</button>
        </div>

        <div className="flex items-center gap-3 px-[18px] py-[14px] border-b border-border">
          <div className="w-[46px] h-[46px] rounded-full flex items-center justify-center text-white font-bold text-[17px]" style={{ background: patient.color }}>
            {(patient.first[0] || "") + (patient.last[0] || "")}
          </div>
          <div>
            <div className="text-[15px] font-bold tracking-tight">{patient.name}</div>
            <div className="text-[11.5px] text-ink-muted">{patient.id} · {extra.gender} · {patient.age}</div>
          </div>
        </div>

        <Section title="Patient Snapshot">
          <Row k="Name" v={patient.name} />
          <Row k="Age" v={String(patient.age)} />
          <Row k="State" v={patient.state} />
          <Row k="Height" v={heightForPatient(patient.id)} />
          <Row k="Weight" v={`${patient.wt} lbs`} />
          <Row k="BMI" v={String(patient.bmi)} />
          <Row k="Current Medication" v={patient.plan} />
        </Section>

        <Section title="Treatment">
          <Row k="Medication" v={order.medication} />
          <Row k="Dose" v={patient.dose} />
          <Row k="Weeks on Program" v={`${patient.week} weeks`} />
          <Row k="Last Refill Date" v={patient.lastOrder || "—"} />
        </Section>

        <Section title="Weight Progress">
          <div className="grid grid-cols-3 text-center gap-2 mb-3">
            <Stat v={`${patient.wtStart}`} l="Starting" />
            <Stat v={`${patient.wt}`} l="Current" />
            <Stat v={`−${lost}`} l="Total Lost" green />
          </div>
          <div className="h-[7px] rounded-pill bg-surface-3 overflow-hidden mb-1.5">
            <div className="h-full rounded-pill bg-green" style={{ width: `${pct}%` }} />
          </div>
          <div className="text-[11px] text-green font-semibold text-center">↓ {lost} lbs lost · {pct}% to goal ({goal})</div>
        </Section>

        <Section title="Payment">
          {paid ? (
            <div className="flex items-center justify-between text-[12.5px]">
              <span className="text-green font-semibold">✓ Paid · {paid.brand || "Card"} •••• {paid.last4}</span>
              <span className="font-mono text-ink-muted">{paid.paymentId.slice(0, 16)}</span>
            </div>
          ) : (
            <>
              <div className="flex items-center justify-between mb-2.5">
                <span className="text-[12px] text-ink-muted">Order total</span>
                <span className="text-[15px] font-extrabold">{order.total}</span>
              </div>
              <button className="btn btn-primary w-full" onClick={() => setPayOpen(true)} disabled={amountCents <= 0}>💳 Collect payment</button>
            </>
          )}
        </Section>

        <div className="px-[18px] pt-[14px]">
          <PatientPharmacyTracking patientId={order.patientId} defaultAddress={extra.address} />
        </div>

        <div className="mt-auto px-[18px] py-[14px] border-t border-border flex gap-2">
          <button className="btn btn-ghost flex-1" onClick={() => toast("⚡ Quick actions")}>Quick actions</button>
          <Link href={`/patients/${patient.id}`} className="btn btn-primary flex-1 text-center">Open full chart →</Link>
        </div>
      </aside>
      <PaymentModal open={payOpen} onClose={() => setPayOpen(false)} amountCents={amountCents} referenceId={order.id} note={`DripVitals ${order.id} · ${patient.name}`} onPaid={(r) => setPaid(order.id, { paymentId: r.paymentId || "", last4: r.last4, brand: r.cardBrand, amountCents: r.amountCents || amountCents, provider: r.provider, at: new Date().toISOString() })} />
    </>
  );
}

function Section({ title, children, last }: { title: string; children: React.ReactNode; last?: boolean }) {
  return (
    <div className={`px-[18px] py-[14px] ${last ? "" : "border-b border-border"}`}>
      <h4 className="text-[10px] uppercase tracking-wider text-ink-muted-2 font-bold mb-2.5">{title}</h4>
      {children}
    </div>
  );
}
function Row({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex justify-between py-[5px] text-[12.5px] border-b border-surface-3 last:border-none">
      <span className="text-ink-muted">{k}</span>
      <span className="font-semibold text-ink">{v}</span>
    </div>
  );
}
function Stat({ v, l, green }: { v: string; l: string; green?: boolean }) {
  return (
    <div>
      <div className={`text-[18px] font-extrabold tracking-tight ${green ? "text-green" : "text-ink"}`}>{v}</div>
      <div className="text-[9px] uppercase tracking-wide text-ink-muted mt-0.5">{l}</div>
    </div>
  );
}
