"use client";

import { useMemo, useState } from "react";
import { Pill } from "@/components/ui/Pill";
import { Modal } from "@/components/ui/Modal";
import { Toast } from "@/components/ui/Toast";
import { toast } from "@/lib/hooks/useToast";
import { usePatients } from "@/lib/hooks/usePatients";
import { useLabs } from "@/lib/hooks/useLabs";
import { PANELS } from "@/lib/labs/panels";
import { pushLabToFlowsheet, hasFlowsheetData } from "@/lib/labs/flowsheet";
import type { LabOrder, LabStatus } from "@/lib/labs/types";

const ST: Record<LabStatus, "muted" | "blue" | "amber" | "green"> = { ordered: "muted", collected: "blue", resulted: "amber", reviewed: "green" };
const fmt = (iso?: string) => (iso ? new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric" }) : "—");
const abnormal = (o: LabOrder) => (o.results || []).filter((r) => r.flag !== "normal").length;

export default function LabsPage() {
  const patients = usePatients((s) => s.patients);
  const orders = useLabs((s) => s.orders);
  const order = useLabs((s) => s.order);
  const enterResults = useLabs((s) => s.enterResults);
  const markReviewed = useLabs((s) => s.markReviewed);

  const [filter, setFilter] = useState<LabStatus | "all">("all");
  const [openId, setOpenId] = useState<string | null>(null);
  const [note, setNote] = useState("");
  const [addOpen, setAddOpen] = useState(false);
  const [npPatient, setNpPatient] = useState(""); const [npPanel, setNpPanel] = useState(PANELS[0].id);

  const counts = useMemo(() => ({
    pending: orders.filter((o) => o.status === "ordered" || o.status === "collected").length,
    review: orders.filter((o) => o.status === "resulted").length,
    abnormal: orders.filter((o) => abnormal(o) > 0 && o.status !== "reviewed").length,
    reviewed: orders.filter((o) => o.status === "reviewed").length,
  }), [orders]);

  const list = useMemo(() => orders.filter((o) => filter === "all" || o.status === filter), [orders, filter]);
  const sel = openId ? orders.find((o) => o.id === openId) || null : null;

  function placeOrder() { const p = patients.find((x) => x.id === npPatient); if (!p) { toast("Choose a patient"); return; } order(p.name, p.id, npPanel, p.provider || "Dr. Rivera"); setAddOpen(false); setNpPatient(""); toast("Lab ordered"); }

  const KPI = ({ label, value, intent }: { label: string; value: string; intent?: string }) => <div className="bg-surface border border-border rounded-2xl px-4 py-3 min-w-[140px]"><div className={`text-[22px] font-extrabold leading-none ${intent || ""}`}>{value}</div><div className="text-[11px] text-ink-muted mt-1.5">{label}</div></div>;
  const flagPill = (f: string) => f === "high" ? <Pill intent="red">High</Pill> : f === "low" ? <Pill intent="amber">Low</Pill> : <Pill intent="green">Normal</Pill>;

  return (
    <div className="px-7 py-6 text-[14px]">
      <div className="flex items-center gap-3 mb-4 flex-wrap">
        <div><h1 className="text-[21px] font-extrabold tracking-tight">Lab Orders</h1><div className="text-[12px] text-ink-muted mt-0.5">Order & review labs — A1C, CMP, lipid, lipase, TSH</div></div>
        <div className="flex-1" /><button className="btn btn-primary btn-sm" onClick={() => setAddOpen(true)}>＋ Order lab</button>
      </div>

      <div className="flex flex-wrap gap-2.5 mb-4">
        <KPI label="Pending collection" value={String(counts.pending)} />
        <KPI label="Needs review" value={String(counts.review)} intent="text-amber" />
        <KPI label="Abnormal" value={String(counts.abnormal)} intent={counts.abnormal ? "text-red" : ""} />
        <KPI label="Reviewed" value={String(counts.reviewed)} intent="text-green" />
      </div>

      <div className="flex gap-2 mb-3 flex-wrap">{(["all", "ordered", "resulted", "reviewed"] as const).map((f) => <button key={f} onClick={() => setFilter(f)} className={`text-[12px] font-semibold px-3 py-1.5 rounded-full capitalize ${filter === f ? "bg-brand text-white" : "bg-surface-3 text-ink-muted"}`}>{f}</button>)}</div>

      <div className="bg-surface border border-border rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full border-collapse min-w-[760px]">
            <thead><tr className="bg-surface-2">{["Patient", "Panel", "Ordered", "Result", "Status", "Provider"].map((h) => <th key={h} className="text-left text-[10px] uppercase tracking-wide text-ink-muted font-bold px-3 py-2.5 border-b border-border">{h}</th>)}</tr></thead>
            <tbody>
              {list.map((o) => {
                const ab = abnormal(o);
                return (
                  <tr key={o.id} className={`border-b border-border last:border-none hover:bg-surface-2 cursor-pointer ${ab > 0 && o.status !== "reviewed" ? "bg-red-soft/30" : ""}`} onClick={() => { setOpenId(o.id); setNote(o.note || ""); }}>
                    <td className="px-3 py-2.5 font-semibold">{o.patientName}</td>
                    <td className="px-3 py-2.5">{o.panelName}</td>
                    <td className="px-3 py-2.5 text-ink-muted text-[12px]">{fmt(o.orderedAt)}</td>
                    <td className="px-3 py-2.5">{o.results ? (ab > 0 ? <span className="text-red font-semibold">{ab} abnormal</span> : <span className="text-green">Normal</span>) : <span className="text-ink-muted">—</span>}</td>
                    <td className="px-3 py-2.5"><Pill intent={ST[o.status]} dot>{o.status}</Pill></td>
                    <td className="px-3 py-2.5 text-ink-muted text-[12px]">{o.provider}</td>
                  </tr>
                );
              })}
              {list.length === 0 && <tr><td colSpan={6} className="px-3 py-10 text-center text-ink-muted text-[12px]">No lab orders.</td></tr>}
            </tbody>
          </table>
        </div>
      </div>

      {sel && (
        <Modal open={!!sel} onClose={() => setOpenId(null)} title={`${sel.patientName} — ${sel.panelName}`} icon="🧪" width={580}
          footer={<div className="flex items-center gap-2 w-full">
            {(sel.status === "ordered" || sel.status === "collected") && <button className="btn btn-primary" onClick={() => { enterResults(sel.id); const o = useLabs.getState().orders.find((x) => x.id === sel.id); const added = o ? pushLabToFlowsheet(patients.find((p) => p.id === o.patientId), o) : false; toast(added ? "Results entered · A1C → flowsheet" : "Results entered"); }}>Enter results</button>}
            {sel.status === "resulted" && <button className="btn btn-primary" onClick={() => { markReviewed(sel.id, note); toast("Marked reviewed"); }}>Mark reviewed</button>}
            <div className="flex-1" /><button className="btn btn-ghost" onClick={() => setOpenId(null)}>Close</button>
          </div>}>
          <div className="flex items-center gap-2 mb-3"><Pill intent={ST[sel.status]} dot>{sel.status}</Pill><span className="text-[12px] text-ink-muted">Ordered {fmt(sel.orderedAt)}{sel.resultedAt ? ` · resulted ${fmt(sel.resultedAt)}` : ""} · {sel.provider}</span></div>
          {sel.results ? (
            <table className="w-full border-collapse">
              <thead><tr className="bg-surface-2">{["Analyte", "Value", "Reference", "Flag"].map((h) => <th key={h} className="text-left text-[10px] uppercase tracking-wide text-ink-muted font-bold px-2.5 py-2 border-b border-border">{h}</th>)}</tr></thead>
              <tbody>
                {sel.results.map((r, i) => (
                  <tr key={i} className="border-b border-border last:border-none">
                    <td className="px-2.5 py-1.5 font-medium">{r.analyte}</td>
                    <td className={`px-2.5 py-1.5 font-semibold ${r.flag === "high" ? "text-red" : r.flag === "low" ? "text-amber" : ""}`}>{r.value} {r.unit}</td>
                    <td className="px-2.5 py-1.5 text-ink-muted text-[12px]">{r.range}</td>
                    <td className="px-2.5 py-1.5">{flagPill(r.flag)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : <div className="text-[12.5px] text-ink-muted py-4 text-center">Awaiting collection & results. Use “Enter results” to record them.</div>}
          {(sel.status === "resulted" || sel.status === "reviewed") && <><label className="fl mt-3">Provider note</label><textarea className="fi min-h-[60px] resize-y" value={note} onChange={(e) => setNote(e.target.value)} placeholder="Interpretation / plan…" disabled={sel.status === "reviewed"} /></>}
        </Modal>
      )}

      <Modal open={addOpen} onClose={() => setAddOpen(false)} title="Order lab" icon="🧪" width={420}
        footer={<><button className="btn btn-ghost" onClick={() => setAddOpen(false)}>Cancel</button><button className="btn btn-primary" onClick={placeOrder}>Order</button></>}>
        <label className="fl">Patient</label>
        <select className="fsel w-full mb-2.5" value={npPatient} onChange={(e) => setNpPatient(e.target.value)}><option value="">— choose —</option>{patients.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</select>
        <label className="fl">Panel</label>
        <select className="fsel w-full" value={npPanel} onChange={(e) => setNpPanel(e.target.value)}>{PANELS.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</select>
      </Modal>
      <Toast />
    </div>
  );
}
