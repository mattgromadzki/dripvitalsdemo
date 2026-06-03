"use client";

import { useMemo, useState } from "react";
import { Pill } from "@/components/ui/Pill";
import { Modal } from "@/components/ui/Modal";
import { Toast } from "@/components/ui/Toast";
import { toast } from "@/lib/hooks/useToast";
import { usePatients } from "@/lib/hooks/usePatients";
import { useShipments } from "@/lib/hooks/useShipments";
import { STATUS_LABEL, trackingUrl, type ShipStatus } from "@/lib/shipments/types";
import { sendSms } from "@/lib/sms/client";

const ST: Record<ShipStatus, "muted" | "blue" | "amber" | "green" | "red"> = { label_created: "muted", in_transit: "blue", out_for_delivery: "amber", delivered: "green", exception: "red" };
const fmt = (iso: string) => new Date(iso).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
const fmtD = (iso: string) => new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric" });

export default function ShipmentsPage() {
  const patients = usePatients((s) => s.patients);
  const shipments = useShipments((s) => s.shipments);
  const advance = useShipments((s) => s.advance);
  const markNotified = useShipments((s) => s.markNotified);

  const [filter, setFilter] = useState<ShipStatus | "all" | "active">("active");
  const [openId, setOpenId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const counts = useMemo(() => ({
    in_transit: shipments.filter((s) => s.status === "in_transit").length,
    out: shipments.filter((s) => s.status === "out_for_delivery").length,
    delivered: shipments.filter((s) => s.status === "delivered").length,
    exception: shipments.filter((s) => s.status === "exception").length,
  }), [shipments]);

  const list = useMemo(() => shipments.filter((s) => filter === "all" ? true : filter === "active" ? (s.status !== "delivered") : s.status === filter), [shipments, filter]);
  const sel = openId ? shipments.find((s) => s.id === openId) || null : null;

  async function notify(id: string) {
    const sh = shipments.find((x) => x.id === id); if (!sh) return;
    const p = patients.find((x) => x.id === sh.patientId);
    setBusy(true);
    if (p?.phone) await sendSms({ to: p.phone, body: `DripVitals: your ${sh.pharmacy} order is ${STATUS_LABEL[sh.status].toLowerCase()}. Track ${sh.carrier}: ${sh.trackingNumber}` });
    markNotified(id); setBusy(false);
    toast(p?.phone ? "📲 Patient notified by SMS" : "Marked notified (no phone on file)");
  }

  const KPI = ({ label, value, intent }: { label: string; value: string; intent?: string }) => <div className="bg-surface border border-border rounded-2xl px-4 py-3 min-w-[130px]"><div className={`text-[22px] font-extrabold leading-none ${intent || ""}`}>{value}</div><div className="text-[11px] text-ink-muted mt-1.5">{label}</div></div>;

  return (
    <div className="px-7 py-6 text-[14px]">
      <h1 className="text-[21px] font-extrabold tracking-tight">Shipments</h1>
      <div className="text-[12px] text-ink-muted mt-0.5 mb-4">Pharmacy & carrier tracking across all orders</div>

      <div className="flex flex-wrap gap-2.5 mb-4">
        <KPI label="In transit" value={String(counts.in_transit)} intent="text-blue" />
        <KPI label="Out for delivery" value={String(counts.out)} intent="text-amber" />
        <KPI label="Delivered" value={String(counts.delivered)} intent="text-green" />
        <KPI label="Exceptions" value={String(counts.exception)} intent={counts.exception ? "text-red" : ""} />
      </div>

      <div className="flex gap-2 mb-3 flex-wrap">
        {(["active", "in_transit", "out_for_delivery", "delivered", "exception", "all"] as const).map((f) => <button key={f} onClick={() => setFilter(f)} className={`text-[12px] font-semibold px-3 py-1.5 rounded-full ${filter === f ? "bg-brand text-white" : "bg-surface-3 text-ink-muted"}`}>{f === "all" ? "All" : f === "active" ? "Active" : STATUS_LABEL[f as ShipStatus]}</button>)}
      </div>

      <div className="bg-surface border border-border rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full border-collapse min-w-[880px]">
            <thead><tr className="bg-surface-2">{["Patient", "Order", "Pharmacy", "Carrier / Tracking", "Status", "Est. delivery", ""].map((h) => <th key={h} className="text-left text-[10px] uppercase tracking-wide text-ink-muted font-bold px-3 py-2.5 border-b border-border">{h}</th>)}</tr></thead>
            <tbody>
              {list.map((s) => (
                <tr key={s.id} className={`border-b border-border last:border-none hover:bg-surface-2 cursor-pointer ${s.status === "exception" ? "bg-red-soft/40" : ""}`} onClick={() => setOpenId(s.id)}>
                  <td className="px-3 py-2.5 font-semibold">{s.patientName}</td>
                  <td className="px-3 py-2.5 text-ink-muted">{s.orderId}</td>
                  <td className="px-3 py-2.5">{s.pharmacy}</td>
                  <td className="px-3 py-2.5"><div>{s.carrier}</div><div className="font-mono text-[11px] text-ink-muted">{s.trackingNumber}</div></td>
                  <td className="px-3 py-2.5"><Pill intent={ST[s.status]} dot>{STATUS_LABEL[s.status]}</Pill>{!s.notified && s.status !== "label_created" && <span className="ml-1.5 text-[10px] text-amber">• not notified</span>}</td>
                  <td className="px-3 py-2.5 text-ink-muted text-[12px] whitespace-nowrap">{s.status === "delivered" ? "Delivered" : fmtD(s.estDelivery)}</td>
                  <td className="px-3 py-2.5 text-right" onClick={(e) => e.stopPropagation()}>
                    <a href={trackingUrl(s.carrier, s.trackingNumber.replace(/\s/g, ""))} target="_blank" rel="noreferrer" className="text-[11px] font-semibold text-brand-dk hover:underline">Track ↗</a>
                  </td>
                </tr>
              ))}
              {list.length === 0 && <tr><td colSpan={7} className="px-3 py-10 text-center text-ink-muted text-[12px]">No shipments.</td></tr>}
            </tbody>
          </table>
        </div>
      </div>

      {sel && (
        <Modal open={!!sel} onClose={() => setOpenId(null)} title={`${sel.patientName} — ${sel.orderId}`} icon="📦" width={560}
          footer={<div className="flex items-center gap-2 w-full">
            {sel.status !== "delivered" && sel.status !== "exception" && <button className="btn btn-ghost" onClick={() => { advance(sel.id); toast("Status advanced"); }}>Advance status</button>}
            <button className="btn btn-primary" onClick={() => notify(sel.id)} disabled={busy}>{busy ? "…" : "📲 Notify patient"}</button>
            <div className="flex-1" /><a className="btn btn-ghost" href={trackingUrl(sel.carrier, sel.trackingNumber.replace(/\s/g, ""))} target="_blank" rel="noreferrer">Track ↗</a>
          </div>}>
          <div className="flex items-center gap-2 mb-3"><Pill intent={ST[sel.status]} dot>{STATUS_LABEL[sel.status]}</Pill><span className="text-[12.5px]">{sel.pharmacy} · {sel.carrier}</span><span className="font-mono text-[12px] text-ink-muted">{sel.trackingNumber}</span></div>
          {sel.status === "exception" && <div className="mb-3 px-3 py-2 rounded-md bg-red-soft text-red text-[12px] font-medium">⚠ Delivery exception — contact the carrier or reship.</div>}
          <div className="text-[10px] uppercase tracking-wide text-ink-muted font-bold mb-2">Tracking history</div>
          <div className="relative pl-4">
            {[...sel.events].reverse().map((e, i) => (
              <div key={i} className="relative pb-3">
                <span className="absolute -left-4 top-1 w-2.5 h-2.5 rounded-full" style={{ background: i === 0 ? "#2f6df6" : "#cbd5e1" }} />
                {i < sel.events.length - 1 && <span className="absolute -left-[11px] top-3 bottom-0 w-px bg-border" />}
                <div className="text-[12.5px] font-semibold">{STATUS_LABEL[e.status]}</div>
                <div className="text-[11.5px] text-ink-muted">{e.note}{e.location !== "—" ? ` · ${e.location}` : ""} · {fmt(e.ts)}</div>
              </div>
            ))}
          </div>
        </Modal>
      )}
      <Toast />
    </div>
  );
}
