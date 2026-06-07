"use client";

import { useMemo, useState } from "react";
import { Pill } from "@/components/ui/Pill";
import { toast } from "@/lib/hooks/useToast";
import { SectionCard } from "@/components/modules/chart/SectionCard";
import { useLabs } from "@/lib/hooks/useLabs";
import { PANELS } from "@/lib/labs/panels";
import { pushLabToFlowsheet, hasFlowsheetData, alreadyInFlowsheet, a1cFromOrder } from "@/lib/labs/flowsheet";
import type { LabOrder } from "@/lib/labs/types";
import type { Patient, PatientExtra } from "@/lib/types";

const ST: Record<string, "muted" | "blue" | "amber" | "green"> = { ordered: "muted", collected: "blue", resulted: "amber", reviewed: "green" };
const fmt = (iso?: string) => (iso ? new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : "—");
const abnormal = (o: LabOrder) => (o.results || []).filter((r) => r.flag !== "normal").length;

export function LabsTab({ patient }: { patient: Patient; extra: PatientExtra }) {
  const allOrders = useLabs((s) => s.orders);
  const order = useLabs((s) => s.order);
  const enterResults = useLabs((s) => s.enterResults);
  const markReviewed = useLabs((s) => s.markReviewed);

  const orders = useMemo(
    () => allOrders.filter((o) => o.patientId === patient.id).sort((a, b) => (a.orderedAt < b.orderedAt ? 1 : -1)),
    [allOrders, patient.id]
  );
  const pending = orders.filter((o) => o.status === "ordered" || o.status === "collected");

  const [ordering, setOrdering] = useState(false);
  const [panelId, setPanelId] = useState(PANELS[0].id);

  function placeOrder() {
    order(patient.name, patient.id, panelId, patient.provider || "Dr. Rivera");
    setOrdering(false);
    toast("🧪 Lab ordered");
  }
  function doEnterResults(id: string) {
    enterResults(id);
    const o = useLabs.getState().orders.find((x) => x.id === id);
    const added = o ? pushLabToFlowsheet(patient, o) : false;
    toast(added ? "✓ Results entered · A1C → flowsheet" : "✓ Results entered");
  }
  function doReview(id: string) {
    markReviewed(id);
    toast("✓ Marked reviewed");
  }
  function pushNow(o: LabOrder) {
    const added = pushLabToFlowsheet(patient, o);
    toast(added ? "📈 A1C added to flowsheet" : "Already in flowsheet");
  }

  return (
    <div>
      <div className="flex items-center gap-3 mb-4 flex-wrap">
        <div>
          <div className="text-[16px] font-bold tracking-tight text-ink">Labs</div>
          <div className="text-[12px] text-ink-muted">{orders.length} order{orders.length === 1 ? "" : "s"} · {pending.length} pending</div>
        </div>
        <div className="flex-1" />
        <button className="btn btn-primary btn-sm" onClick={() => setOrdering((v) => !v)}>🧪 Order Labs</button>
      </div>

      {ordering && (
        <div className="mb-4 flex items-end gap-2 flex-wrap bg-surface-2 border border-border rounded-lg px-3.5 py-3">
          <div className="flex-1 min-w-[200px]">
            <label className="text-[11px] font-bold uppercase tracking-wide text-ink-muted">Panel</label>
            <select className="fsel w-full mt-1" value={panelId} onChange={(e) => setPanelId(e.target.value)}>
              {PANELS.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </div>
          <button className="btn btn-primary btn-sm" onClick={placeOrder}>Order</button>
          <button className="btn btn-ghost btn-sm" onClick={() => setOrdering(false)}>Cancel</button>
        </div>
      )}

      <SectionCard title="Lab Orders & Results" icon="🧪" iconBg="var(--color-teal-soft)" iconColor="var(--color-teal)">
        {orders.length === 0 ? (
          <div className="py-8 text-center text-ink-muted">
            <div className="text-[36px] opacity-40 mb-2">🧪</div>
            <div className="text-[13.5px] font-bold mb-1 text-ink">No labs on file yet</div>
            <div className="text-[12px]">Click &ldquo;Order Labs&rdquo; to send a new order — results feed the vitals flowsheet</div>
          </div>
        ) : (
          <div className="-mx-5 divide-y divide-border">
            {orders.map((o) => {
              const ab = abnormal(o);
              const a1c = a1cFromOrder(o);
              const inFlow = alreadyInFlowsheet(patient.id, o);
              return (
                <div key={o.id} className="px-5 py-3">
                  <div className="flex items-center gap-2.5 flex-wrap">
                    <span className="text-[13.5px] font-semibold text-ink">{o.panelName}</span>
                    <Pill intent={ST[o.status]} dot>{o.status}</Pill>
                    {ab > 0 && o.results && <span className="text-[11px] font-semibold text-red bg-red-soft rounded-pill px-2 py-0.5">{ab} abnormal</span>}
                    {a1c != null && inFlow && <span className="text-[11px] font-semibold text-green bg-green-soft rounded-pill px-2 py-0.5">📈 in flowsheet</span>}
                    <div className="flex-1" />
                    <span className="text-[11px] font-mono text-ink-muted">Ordered {fmt(o.orderedAt)}{o.resultedAt ? ` · resulted ${fmt(o.resultedAt)}` : ""}</span>
                  </div>

                  {o.results && o.results.length > 0 && (
                    <div className="mt-2 overflow-x-auto">
                      <table className="w-full border-collapse text-[12.5px]">
                        <tbody>
                          {o.results.map((r, i) => (
                            <tr key={i} className="border-b border-border last:border-none">
                              <td className="py-1 pr-3 text-ink-2">{r.analyte}</td>
                              <td className={`py-1 pr-3 font-mono font-semibold ${r.flag === "high" ? "text-red" : r.flag === "low" ? "text-amber" : "text-ink"}`}>{r.value} {r.unit}</td>
                              <td className="py-1 pr-3 text-ink-muted text-[11.5px]">{r.range}</td>
                              <td className="py-1"><Pill intent={r.flag === "high" ? "red" : r.flag === "low" ? "amber" : "green"}>{r.flag[0].toUpperCase() + r.flag.slice(1)}</Pill></td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}

                  {o.note && <div className="mt-2 text-[12px] text-ink-2 bg-surface-2 border border-border rounded px-2.5 py-1.5">📝 {o.note}</div>}

                  <div className="mt-2.5 flex items-center gap-2 flex-wrap">
                    {(o.status === "ordered" || o.status === "collected") && (
                      <button className="btn btn-primary btn-sm" onClick={() => doEnterResults(o.id)}>Enter results</button>
                    )}
                    {o.status === "resulted" && (
                      <button className="btn btn-primary btn-sm" onClick={() => doReview(o.id)}>Mark reviewed</button>
                    )}
                    {hasFlowsheetData(o) && !inFlow && (
                      <button className="btn btn-ghost btn-sm" onClick={() => pushNow(o)}>📈 Send A1C to flowsheet</button>
                    )}
                    <span className="text-[11px] text-ink-muted">Ordered by {o.provider}</span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </SectionCard>

      {pending.length > 0 && (
        <SectionCard title="Pending Orders" icon="⏳" iconBg="var(--color-amber-soft)" iconColor="var(--color-amber)">
          <div className="-mx-5 divide-y divide-border">
            {pending.map((o) => (
              <div key={o.id} className="px-5 py-2.5 flex items-center gap-2.5">
                <span className="text-[13px] font-semibold text-ink flex-1">{o.panelName}</span>
                <Pill intent={ST[o.status]} dot>{o.status}</Pill>
                <button className="btn btn-ghost btn-sm" onClick={() => doEnterResults(o.id)}>Enter results</button>
              </div>
            ))}
          </div>
        </SectionCard>
      )}
    </div>
  );
}
