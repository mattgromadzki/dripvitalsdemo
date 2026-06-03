"use client";

import { useMemo, useState } from "react";
import { Pill } from "@/components/ui/Pill";
import { Modal } from "@/components/ui/Modal";
import { Toast } from "@/components/ui/Toast";
import { toast } from "@/lib/hooks/useToast";
import { usePatients } from "@/lib/hooks/usePatients";
import { useAdverse } from "@/lib/hooks/useAdverse";
import { COMMON_SYMPTOMS, escalationReason, type Severity } from "@/lib/adverse/symptoms";
import type { SideEffectReport, ReportStatus } from "@/lib/adverse/types";

const SEV: Record<Severity, "muted" | "amber" | "red"> = { mild: "muted", moderate: "amber", severe: "red" };
const ST: Record<ReportStatus, "amber" | "blue" | "green"> = { open: "amber", reviewing: "blue", resolved: "green" };
const ago = (iso: string) => { const h = Math.round((Date.now() - new Date(iso).getTime()) / 36e5); return h < 1 ? "just now" : h < 24 ? `${h}h ago` : `${Math.round(h / 24)}d ago`; };

export default function SideEffectsPage() {
  const patients = usePatients((s) => s.patients);
  const reports = useAdverse((s) => s.reports);
  const add = useAdverse((s) => s.add);
  const setStatus = useAdverse((s) => s.setStatus);
  const toggleEscalate = useAdverse((s) => s.toggleEscalate);

  const [filter, setFilter] = useState<"open" | "escalated" | "resolved" | "all">("open");
  const [openId, setOpenId] = useState<string | null>(null);
  const [note, setNote] = useState("");
  const [addOpen, setAddOpen] = useState(false);
  const [f, setF] = useState({ patientId: "", symptom: COMMON_SYMPTOMS[0], severity: "mild" as Severity, onset: "Today", note: "" });

  const counts = useMemo(() => ({
    open: reports.filter((r) => r.status === "open").length,
    escalated: reports.filter((r) => r.escalated && r.status !== "resolved").length,
    resolved: reports.filter((r) => r.status === "resolved").length,
  }), [reports]);
  const list = useMemo(() => reports.filter((r) => filter === "all" ? true : filter === "escalated" ? (r.escalated && r.status !== "resolved") : r.status === filter), [reports, filter]);
  const sel = openId ? reports.find((r) => r.id === openId) || null : null;
  const selReason = sel ? escalationReason(sel.symptom, sel.severity) : null;

  function openReport(r: SideEffectReport) { setOpenId(r.id); setNote(r.providerNote || ""); }
  function logReport() { const p = patients.find((x) => x.id === f.patientId); if (!p) { toast("Choose a patient"); return; } add({ patientName: p.name, patientId: p.id, med: p.plan || "GLP-1", symptom: f.symptom, severity: f.severity, onset: f.onset, note: f.note }); setAddOpen(false); setF({ patientId: "", symptom: COMMON_SYMPTOMS[0], severity: "mild", onset: "Today", note: "" }); toast("Report logged"); }

  const KPI = ({ label, value, intent }: { label: string; value: string; intent?: string }) => <div className="bg-surface border border-border rounded-2xl px-4 py-3 min-w-[130px]"><div className={`text-[22px] font-extrabold leading-none ${intent || ""}`}>{value}</div><div className="text-[11px] text-ink-muted mt-1.5">{label}</div></div>;

  return (
    <div className="px-7 py-6 text-[14px]">
      <div className="flex items-center gap-3 mb-4 flex-wrap">
        <div><h1 className="text-[21px] font-extrabold tracking-tight">Side Effects & Adverse Events</h1><div className="text-[12px] text-ink-muted mt-0.5">Patient-reported symptoms with automatic red-flag escalation</div></div>
        <div className="flex-1" /><button className="btn btn-primary btn-sm" onClick={() => setAddOpen(true)}>＋ Log report</button>
      </div>

      <div className="flex flex-wrap gap-2.5 mb-4">
        <KPI label="Open" value={String(counts.open)} intent="text-amber" />
        <KPI label="Escalated" value={String(counts.escalated)} intent={counts.escalated ? "text-red" : ""} />
        <KPI label="Resolved" value={String(counts.resolved)} intent="text-green" />
      </div>

      <div className="flex gap-2 mb-3">
        {(["open", "escalated", "resolved", "all"] as const).map((x) => <button key={x} onClick={() => setFilter(x)} className={`text-[12.5px] font-semibold px-3.5 py-1.5 rounded-full capitalize ${filter === x ? "bg-brand text-white" : "bg-surface-3 text-ink-muted"}`}>{x}</button>)}
      </div>

      <div className="bg-surface border border-border rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full border-collapse min-w-[800px]">
            <thead><tr className="bg-surface-2">{["Patient", "Symptom", "Severity", "Onset", "Reported", "Status"].map((h) => <th key={h} className="text-left text-[10px] uppercase tracking-wide text-ink-muted font-bold px-3 py-2.5 border-b border-border">{h}</th>)}</tr></thead>
            <tbody>
              {list.map((r) => (
                <tr key={r.id} className={`border-b border-border last:border-none hover:bg-surface-2 cursor-pointer ${r.escalated && r.status !== "resolved" ? "bg-red-soft/40" : ""}`} onClick={() => openReport(r)}>
                  <td className="px-3 py-2.5"><div className="font-semibold">{r.patientName}</div><div className="text-[11px] text-ink-muted">{r.med}</div></td>
                  <td className="px-3 py-2.5">{r.escalated && <span className="text-red mr-1">🚩</span>}{r.symptom}</td>
                  <td className="px-3 py-2.5"><Pill intent={SEV[r.severity]}>{r.severity}</Pill></td>
                  <td className="px-3 py-2.5 text-ink-muted text-[12px]">{r.onset}</td>
                  <td className="px-3 py-2.5 text-ink-muted text-[12px] whitespace-nowrap">{ago(r.reportedAt)}</td>
                  <td className="px-3 py-2.5"><Pill intent={ST[r.status]} dot>{r.status}</Pill></td>
                </tr>
              ))}
              {list.length === 0 && <tr><td colSpan={6} className="px-3 py-10 text-center text-ink-muted text-[12px]">Nothing here.</td></tr>}
            </tbody>
          </table>
        </div>
      </div>

      {sel && (
        <Modal open={!!sel} onClose={() => setOpenId(null)} title={`${sel.patientName} — ${sel.symptom}`} icon="🩹" width={560}
          footer={<div className="flex items-center gap-2 w-full flex-wrap">
            {sel.status === "open" && <button className="btn btn-primary" onClick={() => { setStatus(sel.id, "reviewing", note); toast("Marked reviewing"); }}>Start review</button>}
            {sel.status !== "resolved" && <button className="btn btn-ghost" onClick={() => { setStatus(sel.id, "resolved", note); toast("Resolved"); }}>Resolve</button>}
            <button className="btn btn-ghost" onClick={() => { toggleEscalate(sel.id); toast(sel.escalated ? "De-escalated" : "Escalated"); }}>{sel.escalated ? "De-escalate" : "Escalate"}</button>
            <div className="flex-1" /><button className="btn btn-ghost" onClick={() => setOpenId(null)}>Close</button>
          </div>}>
          {selReason && <div className="mb-3 px-3 py-2.5 rounded-md bg-red-soft text-red text-[12.5px] font-semibold">🚩 {selReason}</div>}
          <div className="flex items-center gap-2 mb-3"><Pill intent={SEV[sel.severity]}>{sel.severity}</Pill><Pill intent={ST[sel.status]} dot>{sel.status}</Pill><span className="text-[12px] text-ink-muted">Reported {ago(sel.reportedAt)} · onset {sel.onset}</span></div>
          <div className="text-[12.5px] mb-1"><span className="text-ink-muted">Medication:</span> {sel.med}</div>
          <div className="text-[12.5px] mb-3"><span className="text-ink-muted">Patient note:</span> {sel.note || "—"}</div>
          <label className="fl">Provider note</label>
          <textarea className="fi min-h-[70px] resize-y" value={note} onChange={(e) => setNote(e.target.value)} placeholder="Assessment / plan…" />
          {sel.decidedBy && <div className="mt-2 text-[11.5px] text-ink-muted">Last updated by {sel.decidedBy}{sel.decidedAt ? ` · ${ago(sel.decidedAt)}` : ""}</div>}
        </Modal>
      )}

      <Modal open={addOpen} onClose={() => setAddOpen(false)} title="Log side-effect report" icon="🩹" width={460}
        footer={<><button className="btn btn-ghost" onClick={() => setAddOpen(false)}>Cancel</button><button className="btn btn-primary" onClick={logReport}>Log report</button></>}>
        <label className="fl">Patient</label>
        <select className="fsel w-full mb-2.5" value={f.patientId} onChange={(e) => setF({ ...f, patientId: e.target.value })}><option value="">— choose —</option>{patients.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</select>
        <div className="grid grid-cols-2 gap-3 mb-2.5">
          <div><label className="fl">Symptom</label><select className="fsel w-full" value={f.symptom} onChange={(e) => setF({ ...f, symptom: e.target.value })}>{COMMON_SYMPTOMS.map((s) => <option key={s}>{s}</option>)}</select></div>
          <div><label className="fl">Severity</label><select className="fsel w-full" value={f.severity} onChange={(e) => setF({ ...f, severity: e.target.value as Severity })}><option value="mild">Mild</option><option value="moderate">Moderate</option><option value="severe">Severe</option></select></div>
        </div>
        <label className="fl">Onset</label><input className="fi mb-2.5" value={f.onset} onChange={(e) => setF({ ...f, onset: e.target.value })} placeholder="e.g. 2 days ago" />
        <label className="fl">Note</label><textarea className="fi min-h-[60px] resize-y" value={f.note} onChange={(e) => setF({ ...f, note: e.target.value })} placeholder="Description…" />
        {escalationReason(f.symptom, f.severity) && <div className="mt-2 px-3 py-2 rounded-md bg-red-soft text-red text-[12px] font-medium">🚩 This will auto-escalate: {escalationReason(f.symptom, f.severity)}</div>}
      </Modal>
      <Toast />
    </div>
  );
}
