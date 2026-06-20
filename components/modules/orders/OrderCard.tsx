"use client";

import { useState } from "react";
import Link from "next/link";
import { Pill } from "@/components/ui/Pill";
import type { FulfillmentOrder } from "@/lib/data/fulfillmentOrders";
import type { Patient } from "@/lib/types";
import { WORKFLOW_META } from "@/lib/data/orderWorkflow";
import { StatusBadge } from "@/components/modules/orders/StatusBadge";
import { derive, timelineStates, TL_LABELS, initials, medAbbr, carrierFor, methodFor } from "@/lib/data/orderDerive";

/**
 * The All-Orders dashboard order card, extracted so the patient chart can render
 * the exact same card (1:1). Self-contained expand state. `onOpen` wires the
 * "Open" button to a drawer when one is available (dashboard); omit it and the
 * Open button is hidden (patient chart).
 */
export function OrderCard({ order: o, patient: p, onOpen }: { order: FulfillmentOrder; patient?: Patient; onOpen?: () => void }) {
  const [open, setOpen] = useState(false);
  const d = derive(o);
  const tl = timelineStates(d);
  const demo = `${p ? `${p.age}${p.gender === "Other" ? "" : p.gender} · ` : ""}${o.state} · ${o.id}`;
  const invoice = `INV-${o.id.replace(/[^0-9]/g, "")} · ${d.isPaid ? "Paid" : "Unpaid"}`;
  const eta = d.isDelivered ? "Delivered" : d.isShipping ? "In transit" : d.atPharmacy ? "After pharmacy" : "Pending";

  return (
    <article className="bg-surface border border-border rounded-2xl overflow-hidden hover:border-border-2 transition-colors">
      <div className="grid items-center gap-4 px-4 py-3.5 cursor-pointer" style={{ gridTemplateColumns: "minmax(140px,152px) 1.25fr 1.45fr 1.2fr 1.05fr auto" }} onClick={() => setOpen((v) => !v)}>
        <div>
          <div className="font-mono text-[12.5px] font-bold text-ink-2">{o.id}</div>
          <div className="text-[11px] text-ink-muted my-1">{o.created} · {o.updated}</div>
          <StatusBadge status={o.status} />
        </div>
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-[38px] h-[38px] rounded-[11px] flex items-center justify-center text-white font-extrabold text-[13px] shrink-0" style={{ background: "linear-gradient(135deg,var(--color-brand),var(--color-brand-dk))" }}>{initials(o.patientName)}</div>
          <div className="min-w-0" onClick={(e) => e.stopPropagation()}>
            <Link href={`/patients/${o.patientId}`} className="text-[13px] font-bold text-ink hover:text-brand-dk hover:underline block truncate">{o.patientName}</Link>
            <div className="text-[11px] text-ink-muted truncate">{demo}</div>
          </div>
        </div>
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-[38px] h-[38px] rounded-[11px] bg-brand-soft text-brand-dk flex items-center justify-center font-extrabold text-[12px] shrink-0">{medAbbr(o.medication)}</div>
          <div className="min-w-0">
            <div className="text-[13px] font-semibold truncate">{o.medication}</div>
            <div className="text-[11px] text-ink-muted truncate">{o.dose} · {o.qty}</div>
          </div>
        </div>
        <div className="flex flex-col gap-1 items-start">
          <Pill intent={o.programIntent}>{o.program}</Pill>
          {d.rxSent ? <Pill intent="green">Rx signed</Pill> : d.rxNeeded ? <Pill intent="amber">Rx needed</Pill> : null}
          {d.isPaid ? <Pill intent="green">Paid {o.total}</Pill> : (d.awaitingPay || d.payFailed) ? <Pill intent="amber">Unpaid {o.total}</Pill> : <span className="text-[12px] font-bold">{o.total}</span>}
        </div>
        <div className="min-w-0">
          <div className="text-[12px] font-semibold truncate">{o.tracking && o.tracking !== "—" ? o.tracking : "Tracking pending"}</div>
          <div className="text-[11px] text-ink-muted truncate">{o.pharmacy}</div>
        </div>
        <div className="flex gap-1.5 items-center" onClick={(e) => e.stopPropagation()}>
          {onOpen && <button className="btn btn-ghost btn-xs" onClick={onOpen}>Open</button>}
          {d.preRx
            ? <Link href={`/patients/${o.patientId}/prescribe?tx=${encodeURIComponent(o.medication)}`} className="btn btn-primary btn-xs">⚡ Create Rx</Link>
            : <Link href={`/patients/${o.patientId}`} className="btn btn-ghost btn-xs">Chart →</Link>}
        </div>
      </div>

      {open && (
        <div className="border-t border-border px-4 py-4 grid gap-4" style={{ gridTemplateColumns: "1fr 1.3fr 1fr" }}>
          <DetailBox title="Patient / order">
            <DRow k="Email" v={p?.email || "—"} />
            <DRow k="Phone" v={p?.phone || "—"} />
            <DRow k="Provider" v={o.provider} />
            <DRow k="Invoice" v={invoice} />
          </DetailBox>
          <DetailBox title="Fulfillment timeline">
            <div className="flex items-start justify-between gap-1 mt-1">
              {TL_LABELS.map((lbl, i) => {
                const st = d.isException ? "" : tl[i];
                const dotCls = st === "done" ? "bg-green text-white border-green" : st === "current" ? "bg-brand text-white border-brand" : st === "need" ? "bg-amber text-white border-amber" : "bg-surface-3 text-ink-muted border-border";
                const content = st === "done" ? "✓" : st === "need" ? "!" : i + 1;
                return (
                  <div key={lbl} className="flex-1 text-center relative">
                    {i < TL_LABELS.length - 1 && <div className={`absolute top-[11px] left-1/2 w-full h-0.5 ${!d.isException && tl[i] === "done" ? "bg-green" : "bg-border"}`} />}
                    <div className={`w-[22px] h-[22px] rounded-full mx-auto mb-1.5 flex items-center justify-center text-[10px] font-bold border-2 relative z-[1] ${dotCls}`}>{content}</div>
                    <div className="text-[9.5px] text-ink-muted font-semibold">{lbl}</div>
                  </div>
                );
              })}
            </div>
            {d.isException && <div className="text-[11.5px] text-red font-semibold mt-3">⚠ Exception · {WORKFLOW_META[o.status].label} — needs attention</div>}
          </DetailBox>
          <DetailBox title="Shipping">
            <DRow k="Ship to" v={`${o.state}`} />
            <DRow k="Carrier" v={carrierFor(o)} />
            <DRow k="Method" v={methodFor(o)} />
            <DRow k="ETA" v={eta} />
          </DetailBox>
        </div>
      )}
    </article>
  );
}

function DetailBox({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="text-[10px] uppercase tracking-wider text-ink-muted-2 font-bold mb-2">{title}</div>
      {children}
    </div>
  );
}
function DRow({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex justify-between py-[5px] text-[12.5px] border-b border-surface-3 last:border-none">
      <span className="text-ink-muted">{k}</span>
      <span className="font-semibold text-ink text-right">{v}</span>
    </div>
  );
}
