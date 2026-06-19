"use client";

import { useState, type ReactNode } from "react";
import type { Key } from "react";
import Link from "next/link";
import { Pill } from "@/components/ui/Pill";
import { toast } from "@/lib/hooks/useToast";
import { usePrescriptions } from "@/lib/hooks/usePrescriptions";
import { useOrders } from "@/lib/hooks/useOrders";
import { usePermission } from "@/lib/rbac/usePermission";
import { NewPrescriptionModal } from "@/components/modules/chart/NewPrescriptionModal";
import { NewOrderModal } from "@/components/modules/chart/NewOrderModal";
import type { Patient, PatientExtra, PaymentOverride, OrderRow } from "@/lib/types";

type RxView = { id: string; med: string; dose: string; refills: number; prescribed: string; status: string; prescribedBy: string; paymentOverride?: PaymentOverride };

type InnerTab = "current" | "past" | "rx";

const SHIPMENT_TO_STEP: Record<string, number> = {
  placed: 0,
  paid: 1,
  approved: 2,
  processing: 3,
  shipped: 4,
  in_transit: 4,
  delivered: 5,
};

const STEP_LABELS_FULL    = ["Order Placed", "Payment Confirmed", "Provider Approved", "Compounding / Filling", "Dispatched", "Delivered"];
const STEP_LABELS_UNPAID  = ["Order Placed", "Payment", "Provider Approval", "Fill / Compound", "Dispatched", "Delivered"];
const STEP_LABELS_MINI    = ["Placed", "Paid", "Approved", "Filling", "Shipped", "Delivered"];
const STEP_LABELS_MINI_UP = ["Placed", "Payment", "Approval", "Fill", "Shipped", "Delivered"];

export function OrdersRxTab({ patient, extra }: { patient: Patient; extra: PatientExtra }) {
  const [innerTab, setInnerTab] = useState<InnerTab>("current");
  const [rxOpen, setRxOpen] = useState(false);
  const [ordOpen, setOrdOpen] = useState(false);
  const canRx = usePermission("rx.prescribe");
  const createdOrders = useOrders((s) => s.orders).filter((o) => o.patientId === patient.id);
  const allOrders = extra.orders;
  // Heuristic — first order treated as "current", rest as past
  const currentList = allOrders.length > 0 ? [allOrders[0]] : [];
  const pastList    = allOrders.slice(1);

  // Merge manually-created prescriptions (store, filtered to this patient) with the chart's seeded ones
  const storeRx = usePrescriptions((s) => s.prescriptions);
  const rxItems: RxView[] = [
    ...storeRx.filter((r) => r.patientId === patient.id).map((r) => ({
      id: r.id, med: r.medication, dose: r.dose, refills: r.refillsRemaining,
      prescribed: r.prescribedDate, status: r.status, prescribedBy: r.prescriber, paymentOverride: r.paymentOverride,
    })),
    ...extra.prescriptions.map((rx) => ({
      id: rx.id, med: rx.med, dose: rx.dose, refills: rx.refills,
      prescribed: rx.prescribed, status: rx.status, prescribedBy: rx.prescribedBy,
    })),
  ];

  return (
    <div>
      <div className="flex items-center gap-2 mb-3.5 border-b border-border">
        <InnerTabBtn active={innerTab === "current"} count={currentList.length} onClick={() => setInnerTab("current")}>
          Current Orders
        </InnerTabBtn>
        <InnerTabBtn active={innerTab === "past"} count={pastList.length} onClick={() => setInnerTab("past")}>
          Past Orders
        </InnerTabBtn>
        <InnerTabBtn active={innerTab === "rx"} count={rxItems.length} onClick={() => setInnerTab("rx")}>
          Prescriptions
        </InnerTabBtn>
        <div className="flex-1" />
        <div className="flex gap-2 pb-2">
          {canRx && <button className="btn btn-ghost btn-sm" onClick={() => setRxOpen(true)}>+ Prescribe</button>}
          <button className="btn btn-primary btn-sm" onClick={() => setOrdOpen(true)}>+ New Order</button>
        </div>
      </div>

      {innerTab === "current" && (
        <div className="flex flex-col gap-4">
          {createdOrders.length > 0 && <CreatedOrders orders={createdOrders} />}
          <CurrentOrders orders={currentList} patient={patient} />
        </div>
      )}
      {innerTab === "past"    && <PastOrders    orders={pastList}    />}
      {innerTab === "rx"      && <Prescriptions items={rxItems} patient={patient} onPrescribe={() => setRxOpen(true)} />}

      <NewPrescriptionModal patient={patient} open={rxOpen} onClose={() => setRxOpen(false)} />
      <NewOrderModal patient={patient} open={ordOpen} onClose={() => setOrdOpen(false)} />
    </div>
  );
}

function InnerTabBtn({ active, count, onClick, children }: { active: boolean; count: number; onClick: () => void; children: ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={[
        "py-2.5 px-4 text-[13px] font-semibold cursor-pointer whitespace-nowrap transition-colors -mb-px border-b-[2px]",
        active ? "text-brand border-brand" : "text-ink-muted border-transparent hover:text-ink",
      ].join(" ")}
    >
      {children}
      {count > 0 && (
        <span className={[
          "inline-flex items-center justify-center min-w-[18px] h-[17px] px-1.5 ml-1.5 rounded-pill text-[10.5px] font-bold",
          active ? "bg-brand-soft text-brand" : "bg-surface-3 text-ink-muted",
        ].join(" ")}>
          {count}
        </span>
      )}
    </button>
  );
}

function CurrentOrders({ orders, patient }: { orders: PatientExtra["orders"]; patient: Patient }) {
  const [expandedId, setExpandedId] = useState<string | null>(null);

  if (orders.length === 0) {
    return (
      <div className="bg-surface border border-border rounded-lg p-12 text-center">
        <div className="text-[36px] opacity-40 mb-2">📦</div>
        <div className="text-[14px] font-bold mb-1 text-ink">No active orders</div>
        <div className="text-[12.5px] text-ink-muted">Click &ldquo;+ New Order&rdquo; to create one</div>
      </div>
    );
  }

  return (
    <div className="bg-surface border border-border rounded-lg overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-[13px]">
          <thead className="bg-surface-2">
            <tr>
              <Th>Order #</Th>
              <Th>Medication</Th>
              <Th>Placed</Th>
              <Th>Qty</Th>
              <Th>Price</Th>
              <Th>Status</Th>
              <Th>Action</Th>
            </tr>
          </thead>
          <tbody>
            {orders.map((o) => {
              const expanded = expandedId === o.id;
              const needsApproval = !o.approved;
              const isUnpaid = !o.paid;
              let stepIdx: number;
              if (isUnpaid) stepIdx = 0;
              else if (needsApproval) stepIdx = 1;
              else stepIdx = SHIPMENT_TO_STEP[o.shipmentStatus] ?? 2;

              const miniSteps = (needsApproval || isUnpaid) ? STEP_LABELS_MINI_UP : STEP_LABELS_MINI;
              const fullSteps = (needsApproval || isUnpaid) ? STEP_LABELS_UNPAID : STEP_LABELS_FULL;

              return (
                <ChartRows
                  key={o.id}
                  order={o}
                  patient={patient}
                  expanded={expanded}
                  onToggle={() => setExpandedId(expanded ? null : o.id)}
                  stepIdx={stepIdx}
                  miniSteps={miniSteps}
                  fullSteps={fullSteps}
                  isUnpaid={isUnpaid}
                  needsApproval={needsApproval}
                />
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

interface ChartRowsProps {
  key?: Key;
  order: PatientExtra["orders"][number];
  patient: Patient;
  expanded: boolean;
  onToggle: () => void;
  stepIdx: number;
  miniSteps: string[];
  fullSteps: string[];
  isUnpaid: boolean;
  needsApproval: boolean;
}

function ChartRows({ order: o, patient, expanded, onToggle, stepIdx, miniSteps, fullSteps, isUnpaid, needsApproval }: ChartRowsProps) {
  // Status pill rendering
  let statusPill;
  if (isUnpaid) statusPill = <Pill intent="amber" dot>Unpaid</Pill>;
  else if (needsApproval) statusPill = <Pill intent="amber" dot>Awaiting Approval</Pill>;
  else if (o.shipmentStatus === "delivered") statusPill = <Pill intent="green" dot>Delivered</Pill>;
  else if (o.shipmentStatus === "in_transit" || o.shipmentStatus === "shipped") statusPill = <Pill intent="blue" dot>Shipped</Pill>;
  else if (o.shipmentStatus === "processing") statusPill = <Pill intent="purple" dot>Filling</Pill>;
  else statusPill = <Pill intent="muted" dot>{o.shipmentStatus}</Pill>;

  // Action cell
  let actionCell;
  if (isUnpaid) actionCell = <button className="text-[11px] font-semibold py-1.5 px-3 rounded-md bg-brand text-white hover:bg-brand-dk" onClick={(e) => { e.stopPropagation(); toast("💳 Send payment link"); }}>💳 Send Link</button>;
  else if (needsApproval) actionCell = <button className="text-[11px] font-semibold py-1.5 px-3 rounded-md bg-brand text-white hover:bg-brand-dk" onClick={(e) => { e.stopPropagation(); toast(`✓ Order ${o.id} approved`); }}>✓ Approve</button>;
  else if (o.tracking) actionCell = <code className="font-mono text-[10.5px] text-brand">{o.tracking}</code>;
  else actionCell = <span className="text-[11px] text-ink-muted-2">—</span>;

  return (
    <>
      <tr onClick={onToggle} className="cursor-pointer hover:bg-surface-2 transition-colors">
        <Td><span className="font-mono text-[11.5px] text-brand-dk font-semibold">{o.id}</span></Td>
        <Td>
          <div className="font-semibold text-[13px]">{o.treatmentName}</div>
          {o.medSub && <div className="text-[11px] text-ink-muted">{o.medSub}</div>}
        </Td>
        <Td><span className="text-[11.5px] text-ink-muted">{o.placedAt || "—"}</span></Td>
        <Td><span className="text-ink-muted">{o.qty || "—"}</span></Td>
        <Td><span className="font-bold">{o.price || "—"}</span></Td>
        <Td>{statusPill}</Td>
        <Td>{actionCell}</Td>
      </tr>

      {/* Always-visible mini tracker row */}
      <tr onClick={onToggle} className="cursor-pointer">
        <td colSpan={7} className="py-2.5 px-3.5 bg-surface-2 border-b border-border">
          <div className="flex items-center gap-2.5">
            <MiniTracker steps={miniSteps} stepIdx={stepIdx} />
            <span className="text-[9.5px] italic text-ink-muted ml-3 whitespace-nowrap">
              {expanded ? "Click for less ↑" : "Click for details ↓"}
            </span>
          </div>
        </td>
      </tr>

      {/* Expandable detail row */}
      {expanded && (
        <tr>
          <td colSpan={7} className="py-[18px] px-[22px] bg-blue-soft border-b border-border-2" style={{ background: "#f8faff" }}>
            <FullTracker steps={fullSteps} stepIdx={stepIdx} />

            <div className="grid grid-cols-4 gap-3 mt-5 max-[800px]:grid-cols-2">
              <DetailField label="Pharmacy"      value={o.pharmacy} />
              <DetailField label="Tracking"      value={o.tracking || "—"} mono />
              <DetailField label="ETA"           value={o.eta || "—"} />
              <DetailField label="Order Date"    value={o.placedAt || "—"} mono />
            </div>

            {o.address && (
              <div className="mt-3 bg-surface border border-border rounded-md px-4 py-3">
                <div className="text-[10px] uppercase tracking-widest text-ink-muted font-bold mb-1">Ships To</div>
                <div className="text-[12.5px] text-ink">{o.address}</div>
              </div>
            )}

            <div className="flex gap-2 mt-3 flex-wrap">
              {needsApproval && (
                <button className="btn btn-primary btn-sm" onClick={() => toast(`✓ Order ${o.id} approved`)}>✓ Approve & Send to Pharmacy</button>
              )}
              {o.tracking && o.tracking !== "—" && (
                <button className="btn btn-ghost btn-sm" onClick={() => toast(`📦 Tracking ${o.tracking}`)}>📦 Track Package</button>
              )}
              <button className="btn btn-ghost btn-sm" onClick={() => toast("📋 Order details copied")}>📋 Copy Details</button>
              <button className="btn btn-ghost btn-sm" onClick={() => toast("📞 Contacting pharmacy…")}>📞 Contact Pharmacy</button>
            </div>
          </td>
        </tr>
      )}
    </>
  );
}

function MiniTracker({ steps, stepIdx }: { steps: string[]; stepIdx: number }) {
  return (
    <div className="flex items-start gap-0 max-w-[680px] flex-1">
      {steps.map((label, i) => {
        const done = i < stepIdx;
        const active = i === stepIdx;
        const isLast = i === steps.length - 1;
        return (
          <div key={label} className="flex flex-col items-center flex-1 relative">
            {!isLast && (
              <div
                className="absolute top-[6px] left-1/2 right-[-50%] h-0.5 z-0"
                style={{ background: done ? "var(--color-green)" : "var(--color-border-2)" }}
              />
            )}
            <div
              className="w-[14px] h-[14px] rounded-full border-[2px] z-[1] mb-1.5 transition-all"
              style={{
                borderColor: done ? "var(--color-green)" : active ? "var(--color-brand)" : "var(--color-border-2)",
                background: done ? "var(--color-green)" : active ? "var(--color-brand)" : "var(--color-surface)",
                boxShadow: active ? "0 0 0 3px rgba(31,138,112,.18)" : undefined,
              }}
            />
            <div
              className="text-[9px] font-semibold leading-tight whitespace-nowrap"
              style={{
                color: done ? "var(--color-green)" : active ? "var(--color-brand)" : "var(--color-ink-muted)",
              }}
            >
              {label}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function FullTracker({ steps, stepIdx }: { steps: string[]; stepIdx: number }) {
  return (
    <>
      <div className="text-[11px] font-bold uppercase tracking-wider text-ink-2 mb-3.5">Order Progress</div>
      <div className="flex items-start">
        {steps.map((label, i) => {
          const done = i < stepIdx;
          const active = i === stepIdx;
          const isLast = i === steps.length - 1;
          const mark = done ? "✓" : active ? "●" : (i + 1);
          return (
            <div key={label} className="flex flex-col items-center flex-1 relative">
              {!isLast && (
                <div
                  className="absolute top-[11px] left-1/2 right-[-50%] h-0.5 z-0"
                  style={{ background: done ? "var(--color-green)" : "var(--color-border-2)" }}
                />
              )}
              <div
                className="w-[22px] h-[22px] rounded-full border-[2px] flex items-center justify-center text-[10px] font-bold z-[1] mb-1.5"
                style={{
                  borderColor: done ? "var(--color-green)" : active ? "var(--color-brand)" : "var(--color-border-2)",
                  background: done ? "rgba(31,138,112,.12)" : active ? "var(--color-brand-soft)" : "var(--color-surface)",
                  color: done ? "var(--color-green)" : active ? "var(--color-brand)" : "var(--color-ink-muted)",
                  boxShadow: active ? "0 0 0 3px rgba(31,138,112,.18)" : undefined,
                }}
              >
                {mark}
              </div>
              <div
                className="text-[9.5px] text-center font-semibold leading-tight max-w-[80px]"
                style={{
                  color: done ? "var(--color-green)" : active ? "var(--color-brand)" : "var(--color-ink-muted)",
                }}
              >
                {label}
              </div>
            </div>
          );
        })}
      </div>
    </>
  );
}

function DetailField({ label, value, mono }: { label: string; value: ReactNode; mono?: boolean }) {
  return (
    <div>
      <div className="text-[10px] uppercase tracking-widest text-ink-muted font-bold mb-1">{label}</div>
      <div className={`text-[12.5px] font-semibold text-ink ${mono ? "font-mono" : ""}`}>{value}</div>
    </div>
  );
}

function PastOrders({ orders }: { orders: PatientExtra["orders"] }) {
  if (orders.length === 0) {
    return (
      <div className="bg-surface border border-border rounded-lg p-10 text-center">
        <div className="text-[32px] opacity-40 mb-2">📦</div>
        <div className="text-[13px] font-bold text-ink">No past orders</div>
      </div>
    );
  }
  return (
    <div className="bg-surface border border-border rounded-lg overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-[13px]">
          <thead className="bg-surface-2">
            <tr>
              <Th>Order #</Th>
              <Th>Medication</Th>
              <Th>Placed</Th>
              <Th>Delivered</Th>
              <Th>Pharmacy</Th>
              <Th>Price</Th>
            </tr>
          </thead>
          <tbody>
            {orders.map((o) => (
              <tr key={o.id} className="hover:bg-surface-2 transition-colors">
                <Td><span className="font-mono text-[11.5px] text-brand-dk font-semibold">{o.id}</span></Td>
                <Td><span className="font-semibold">{o.treatmentName}</span></Td>
                <Td><span className="text-ink-muted">{o.placedAt}</span></Td>
                <Td><span className="text-ink-muted">{o.eta || "—"}</span></Td>
                <Td>{o.pharmacy}</Td>
                <Td><span className="font-bold">{o.price}</span></Td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Prescriptions({ items, patient, onPrescribe }: { items: RxView[]; patient: Patient; onPrescribe: () => void }) {
  if (items.length === 0) {
    return (
      <div className="bg-surface border border-border rounded-lg p-10 text-center">
        <div className="text-[32px] opacity-40 mb-2">💊</div>
        <div className="text-[13px] font-bold text-ink mb-1">No active prescriptions</div>
        <div className="text-[12px] text-ink-muted">Click &ldquo;+ Prescribe&rdquo; to add one</div>
      </div>
    );
  }
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
      {items.map((rx) => (
        <div key={rx.id} className="bg-surface border border-border rounded-lg px-4 py-3.5">
          <div className="flex items-center gap-2 mb-2">
            <Pill intent={rx.status === "active" ? "green" : "muted"} dot>{rx.status[0].toUpperCase() + rx.status.slice(1)}</Pill>
            {rx.paymentOverride && (
              <Pill intent={rx.paymentOverride.mode === "waived" ? "amber" : "blue"} dot>
                {rx.paymentOverride.mode === "waived" ? "Comped" : "Paid (override)"}
              </Pill>
            )}
            <span className="font-mono text-[10.5px] text-ink-muted ml-auto">{rx.id}</span>
          </div>
          <div className="text-[15px] font-bold text-ink">{rx.med}</div>
          <div className="font-mono text-[12px] text-brand-dk font-semibold mt-1">{rx.dose}</div>
          <div className="grid grid-cols-2 gap-2.5 mt-3">
            <DetailField label="Refills Left" value={String(rx.refills)} />
            <DetailField label="Prescribed By" value={rx.prescribedBy} />
            <DetailField label="Date" value={rx.prescribed} mono />
            <DetailField label="Patient" value={patient.first} />
          </div>
          {rx.paymentOverride && (
            <div className="mt-2.5 text-[11px] text-ink-muted bg-surface-2 border border-border rounded-md px-2.5 py-1.5">
              💳 Payment {rx.paymentOverride.mode === "waived" ? "waived" : "marked paid"} — {rx.paymentOverride.reason} · {rx.paymentOverride.by}
            </div>
          )}
          <div className="flex gap-2 mt-3 pt-3 border-t border-border">
            <button className="btn btn-ghost btn-xs" onClick={() => toast("📦 Refill sent")}>📦 Send Refill</button>
            <button className="btn btn-ghost btn-xs" onClick={() => toast("↻ Renewal flow opened")}>↻ Renew</button>
          </div>
        </div>
      ))}
    </div>
  );
}

const ORDER_STATUS_INTENT: Record<string, "green" | "amber" | "blue" | "red" | "muted"> = {
  active: "green", filled: "green", resulted: "green",
  pending: "amber", in_lab: "amber",
  refill: "blue", ordered: "blue",
  denied: "red", critical: "red",
};

function CreatedOrders({ orders }: { orders: OrderRow[] }) {
  return (
    <div className="bg-surface border border-border rounded-lg overflow-hidden">
      <div className="px-4 py-2.5 border-b border-border bg-surface-2 text-[11px] font-bold uppercase tracking-wider text-ink-muted">Created orders</div>
      <div className="divide-y divide-border">
        {orders.map((o) => (
          <div key={o.id} className="flex items-center gap-3 px-4 py-3">
            <span className="text-[18px]">{o.kind === "lab" ? "🧪" : "💊"}</span>
            <div className="flex-1 min-w-0">
              <div className="text-[13px] font-semibold text-ink truncate">{o.item}</div>
              <div className="text-[11px] text-ink-muted mt-0.5">{o.destination} · {o.orderedBy} · {o.orderedDate}{o.kind === "rx" && o.refills != null ? ` · ${o.refills} refills` : ""}</div>
            </div>
            <span className="font-mono text-[10.5px] text-ink-muted">{o.id}</span>
            {o.kind === "rx" && o.patientId && (
              <Link
                href={`/patients/${o.patientId}/prescribe?tx=${encodeURIComponent(o.item)}`}
                className="text-[11px] font-semibold py-1.5 px-3 rounded-md bg-brand-soft text-brand-dk hover:bg-brand hover:text-white transition-colors whitespace-nowrap"
              >
                ⚡ e-Prescribe
              </Link>
            )}
            <Pill intent={ORDER_STATUS_INTENT[o.status] || "muted"} dot>{o.status.replace("_", " ")}</Pill>
          </div>
        ))}
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
