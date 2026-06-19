"use client";

import { useCallback, useEffect, useState } from "react";
import { Pill } from "@/components/ui/Pill";
import type { PharmacyEvent } from "@/lib/pharmacy/events";

const STAGE: Record<string, { label: string; intent: "muted" | "amber" | "green" | "red" }> = {
  requested: { label: "Order received",    intent: "muted" },
  filling:   { label: "Being filled",      intent: "amber" },
  ready:     { label: "Packed & shipped",  intent: "amber" },
  shipped:   { label: "In transit",        intent: "amber" },
  delivered: { label: "Delivered",         intent: "green" },
  issue:     { label: "Shipping issue",    intent: "red"   },
};

function stageOf(e: PharmacyEvent): { label: string; intent: "muted" | "amber" | "green" | "red" } {
  return STAGE[(e.stage || "").toLowerCase()] || { label: e.status || e.event || "Update", intent: "muted" };
}

export function PatientPharmacyTracking({ patientId }: { patientId: string }) {
  const [events, setEvents] = useState<PharmacyEvent[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await fetch("/api/store/pharmacy-events", { cache: "no-store" });
      const j = await r.json();
      const all: PharmacyEvent[] = Array.isArray(j?.data) ? j.data : [];
      const mine = all.filter(
        (e) => e?.patientId === patientId || (e?.internalOrderId || "").startsWith(`DV-${patientId}-`),
      );
      setEvents(mine);
    } catch { /* ignore */ }
    setLoading(false);
  }, [patientId]);

  useEffect(() => { load(); }, [load]);

  if (loading) {
    return <div className="bg-surface border border-border rounded-2xl p-4 mb-4 text-[12.5px] text-ink-muted">Loading pharmacy status…</div>;
  }
  if (events.length === 0) return null; // nothing to show — don't clutter the chart

  const latest = events[0];
  const latestStage = stageOf(latest);
  const gsOrderId = events.find((e) => e.orderId != null && String(e.orderId).length > 0)?.orderId;
  const tracking = events.find((e) => e.trackingNumber)?.trackingNumber;
  const trackingUrl = events.find((e) => e.trackingUrl)?.trackingUrl;

  return (
    <div className="bg-surface border border-border rounded-2xl p-5 mb-4">
      <div className="flex items-center justify-between gap-3 mb-3">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-[16px]">💊</span>
          <span className="font-semibold text-ink">Pharmacy fulfillment</span>
          {gsOrderId ? <span className="text-[12px] text-ink-muted font-mono">GreenstoneRX #{gsOrderId}</span> : null}
          <Pill intent={latestStage.intent} dot>{latestStage.label}</Pill>
        </div>
        <button className="btn btn-ghost text-[12px]" onClick={load}>Refresh</button>
      </div>

      {tracking && (
        <div className="text-[12.5px] mb-3">
          Tracking: <span className="font-mono">{tracking}</span>
          {trackingUrl && (
            <>{" · "}<a href={trackingUrl} target="_blank" rel="noreferrer" className="text-brand underline">Track package →</a></>
          )}
        </div>
      )}

      <div className="text-[11px] uppercase tracking-wide text-ink-muted mb-1.5">Status history</div>
      <div className="divide-y divide-border border border-border rounded-xl overflow-hidden">
        {events.map((e) => {
          const st = stageOf(e);
          return (
            <div key={e.id} className="flex items-center justify-between gap-3 px-3 py-2 text-[12.5px]">
              <div className="flex items-center gap-2 min-w-0">
                <Pill intent={st.intent}>{st.label}</Pill>
                <span className="text-ink-muted truncate">
                  {e.status || e.event}
                  {e.trackingNumber ? <> · {e.trackingNumber}</> : null}
                  {e.comment ? <> · {e.comment}</> : null}
                </span>
              </div>
              <span className="text-ink-muted whitespace-nowrap">{new Date(e.at).toLocaleString()}</span>
            </div>
          );
        })}
      </div>
      <div className="text-[11px] text-ink-muted mt-2">Patients are texted and emailed automatically when their order ships or is delivered.</div>
    </div>
  );
}
