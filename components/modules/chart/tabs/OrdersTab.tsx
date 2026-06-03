"use client";

import Link from "next/link";
import { toast } from "@/lib/hooks/useToast";
import type { Patient, PatientExtra } from "@/lib/types";

type Order = PatientExtra["orders"][number];
type OrderState = "unpaid" | "awaiting_rx" | "prescribed";

function orderState(o: Order): OrderState {
  if (!o.paid) return "unpaid";
  if (!o.approved) return "awaiting_rx";
  return "prescribed";
}

export function OrdersTab({ patient, extra }: { patient: Patient; extra: PatientExtra }) {
  const orders = extra.orders;

  return (
    <div className="card animate-fadeUp">
      <div className="card-head">
        <div className="ch-icon">🧾</div>
        <div className="ct">Orders</div>
        <div className="flex-1" />
        <button className="btn btn-ghost btn-xs" onClick={() => toast("➕ New order")}>+ New order</button>
      </div>

      <div>
        {orders.length === 0 && (
          <div className="py-8 text-center text-ink-muted text-[12px]">
            <div className="text-[28px] opacity-40 mb-1.5">🧾</div>
            No orders yet
          </div>
        )}

        {orders.map((o) => {
          const state = orderState(o);
          const highlight = state === "awaiting_rx";
          return (
            <div
              key={o.id}
              className={`flex items-center gap-3.5 px-4 py-3.5 border-b border-border last:border-none ${highlight ? "bg-brand-soft border-l-[3px] border-l-brand" : ""}`}
            >
              <div className={`w-9 h-9 rounded-[10px] flex items-center justify-center text-[16px] flex-shrink-0 ${
                state === "unpaid" ? "bg-amber-soft" : "bg-green-soft"}`}>💉</div>

              <div className="flex-1 min-w-0">
                <div className="text-[13.5px] font-semibold text-ink">{o.treatmentName}</div>
                <div className="text-[11.5px] text-ink-muted">
                  {o.medSub ? `${o.medSub} · ` : ""}{o.placedAt}{o.price ? ` · ${o.price}` : ""} · {o.id}
                </div>
              </div>

              <div className="flex flex-col items-end gap-2">
                <div className="flex items-center gap-1.5">
                  {state === "unpaid" && <Badge tone="amber">Unpaid</Badge>}
                  {state === "awaiting_rx" && (<><Badge tone="green">Paid</Badge><Badge tone="amber">Awaiting Rx</Badge></>)}
                  {state === "prescribed" && (<><Badge tone="green">Paid</Badge><Badge tone="green">Prescribed</Badge></>)}
                </div>

                {state === "unpaid" && (
                  <button className="btn btn-ghost btn-xs" onClick={() => toast("💳 Payment link sent")}>Send payment link</button>
                )}
                {state === "awaiting_rx" && (
                  <Link href={`/patients/${patient.id}/prescribe?order=${o.id}`} className="btn btn-primary btn-xs">💊 Prescribe →</Link>
                )}
                {state === "prescribed" && (
                  <button className="btn btn-ghost btn-xs" onClick={() => toast("℞ Opening prescription")}>View Rx</button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function Badge({ tone, children }: { tone: "amber" | "green"; children: React.ReactNode }) {
  const cls = tone === "amber" ? "bg-amber-soft text-amber" : "bg-green-soft text-green";
  return <span className={`text-[10.5px] font-semibold px-2.5 py-0.5 rounded-pill ${cls}`}>{children}</span>;
}
