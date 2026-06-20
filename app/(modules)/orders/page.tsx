"use client";

import { useEffect, useMemo, useState, useCallback } from "react";
import Link from "next/link";
import { Pill } from "@/components/ui/Pill";
import type { PharmacyEvent } from "@/lib/pharmacy/events";
import { estDisplay } from "@/lib/time/est";

const STAGE: Record<string, { label: string; intent: "muted" | "amber" | "green" | "red" }> = {
  requested: { label: "Order received",   intent: "muted" },
  filling:   { label: "Being filled",     intent: "amber" },
  ready:     { label: "Packed & shipped", intent: "amber" },
  shipped:   { label: "In transit",       intent: "amber" },
  delivered: { label: "Delivered",        intent: "green" },
  issue:     { label: "Shipping issue",   intent: "red"   },
  held:      { label: "On hold",          intent: "amber" },
  cancelled: { label: "Cancelled",        intent: "red"   },
  voided:    { label: "Voided",           intent: "red"   },
};
const stageMeta = (s?: string) => STAGE[(s || "").toLowerCase()] || { label: s || "Submitted", intent: "muted" as const };

interface OrderRow {
  key: string; orderId: string | number; patientId?: string; patientName: string;
  medication: string; stage?: string; status?: string; tracking?: string; trackingUrl?: string; dateMs: number;
}

export default function OrdersPage() {
  const [events, setEvents] = useState<PharmacyEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  const load = useCallback(async () => {
    try {
      const r = await fetch("/api/store/pharmacy-events", { cache: "no-store" });
      const j = await r.json();
      if (Array.isArray(j?.data)) setEvents(j.data);
    } catch { /* ignore */ }
    setLoading(false);
  }, []);
  useEffect(() => { load(); const t = setInterval(load, 20000); return () => clearInterval(t); }, [load]);

  const orders = useMemo<OrderRow[]>(() => {
    const byOrder = new Map<string, PharmacyEvent[]>();
    for (const e of events) {
      const key = e.orderId != null && String(e.orderId) ? String(e.orderId) : (e.internalOrderId || "");
      if (!key) continue;
      const arr = byOrder.get(key) || [];
      arr.push(e);
      byOrder.set(key, arr);
    }
    const rows: OrderRow[] = [];
    byOrder.forEach((evs, key) => {
      const sorted = evs.slice().sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime());
      const latest = sorted[0];
      const submit = sorted.find((e) => e.event === "order_submitted") || sorted[sorted.length - 1];
      rows.push({
        key,
        orderId: latest.orderId ?? key,
        patientId: sorted.find((e) => e.patientId)?.patientId,
        patientName: sorted.find((e) => e.patientName)?.patientName || "—",
        medication: sorted.find((e) => e.medication)?.medication || "—",
        stage: latest.stage,
        status: latest.status,
        tracking: sorted.find((e) => e.trackingNumber)?.trackingNumber,
        trackingUrl: sorted.find((e) => e.trackingUrl)?.trackingUrl,
        dateMs: new Date(submit.at).getTime(),
      });
    });
    rows.sort((a, b) => b.dateMs - a.dateMs);
    return rows;
  }, [events]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return orders;
    return orders.filter((o) =>
      String(o.orderId).toLowerCase().includes(q) ||
      o.patientName.toLowerCase().includes(q) ||
      o.medication.toLowerCase().includes(q));
  }, [orders, search]);

  const delivered = orders.filter((o) => o.stage === "delivered").length;
  const inTransit = orders.filter((o) => o.stage === "shipped" || o.stage === "ready").length;

  return (
    <div className="px-5 py-5 text-[14px]">
      <div className="flex items-start gap-3.5 mb-4 flex-wrap">
        <div>
          <h1 className="text-[23px] font-extrabold tracking-tight">Orders</h1>
          <div className="text-[12.5px] text-ink-muted mt-1 max-w-[700px]">Pharmacy orders created when a provider submits a prescription to the pharmacy from e-Prescribe. Shipping &amp; tracking status updates automatically from the pharmacy.</div>
        </div>
        <div className="flex-1" />
        <button className="btn btn-ghost btn-sm" onClick={load}>Refresh</button>
      </div>

      <div className="grid grid-cols-3 gap-2.5 mb-4">
        {[
          { label: "Total orders", value: orders.length, color: "text-ink" },
          { label: "In fulfillment", value: inTransit, color: "text-amber" },
          { label: "Delivered", value: delivered, color: "text-green" },
        ].map((k) => (
          <div key={k.label} className="bg-surface border border-border rounded-2xl px-4 py-3">
            <div className="text-[10px] font-bold uppercase tracking-wide text-ink-muted">{k.label}</div>
            <div className={`text-[26px] font-extrabold tracking-tight leading-none mt-1 ${k.color}`}>{k.value}</div>
          </div>
        ))}
      </div>

      <div className="flex items-center gap-2 mb-3 flex-wrap">
        <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search by order #, patient, or medication…" className="bg-surface border border-border rounded-pill px-4 py-2 text-[12.5px] outline-none min-w-[280px] flex-1 max-w-[420px]" />
      </div>

      <div className="bg-surface border border-border rounded-2xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="border-collapse w-full min-w-[900px] text-[12.5px]">
            <thead>
              <tr className="bg-surface-2">
                {["Order ID", "Patient", "Medication prescribed", "Shipping & tracking", "Date completed"].map((h) => (
                  <th key={h} className="text-[10px] uppercase tracking-wide text-ink-muted font-bold text-left px-3 py-2.5 border-b border-border whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((o) => {
                const st = stageMeta(o.stage);
                return (
                  <tr key={o.key} className="border-b border-border last:border-none hover:bg-surface-2">
                    <td className="px-3 py-2.5 font-mono text-[11.5px] whitespace-nowrap">{o.orderId}</td>
                    <td className="px-3 py-2.5">
                      {o.patientId
                        ? <Link href={`/patients/${o.patientId}`} className="font-semibold hover:text-brand-dk hover:underline">{o.patientName}</Link>
                        : <span className="font-semibold">{o.patientName}</span>}
                    </td>
                    <td className="px-3 py-2.5">{o.medication}</td>
                    <td className="px-3 py-2.5">
                      <div className="flex items-center gap-2 flex-wrap">
                        <Pill intent={st.intent} dot>{st.label}</Pill>
                        {o.tracking ? (
                          o.trackingUrl
                            ? <a href={o.trackingUrl} target="_blank" rel="noreferrer" className="text-brand underline font-mono text-[11.5px]">{o.tracking}</a>
                            : <span className="font-mono text-[11.5px] text-ink-muted">{o.tracking}</span>
                        ) : null}
                      </div>
                    </td>
                    <td className="px-3 py-2.5 whitespace-nowrap text-ink-muted">{estDisplay(o.dateMs)}</td>
                  </tr>
                );
              })}
              {filtered.length === 0 && (
                <tr><td colSpan={5} className="px-3 py-12 text-center text-ink-muted">{loading ? "Loading orders…" : "No orders yet. An order appears here when a provider submits a prescription to the pharmacy from e-Prescribe."}</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
