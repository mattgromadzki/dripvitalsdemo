"use client";

import { useMemo, useState } from "react";
import { Pill } from "@/components/ui/Pill";
import { Modal } from "@/components/ui/Modal";
import { Toast } from "@/components/ui/Toast";
import { toast } from "@/lib/hooks/useToast";
import { usePatients } from "@/lib/hooks/usePatients";
import { useTitration } from "@/lib/hooks/useTitration";
import { PROTOCOLS, getProtocol, stepDue, weekOf } from "@/lib/titration/protocols";
import type { PatientTitration, TitrationStatus } from "@/lib/titration/types";

const STATUS_INTENT: Record<TitrationStatus, "blue" | "green" | "amber"> = { titrating: "blue", maintenance: "green", hold: "amber" };
const fmt = (iso: string) => new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });

export default function TitrationPage() {
  const patients = usePatients((s) => s.patients);
  const plans = useTitration((s) => s.plans);
  const advance = useTitration((s) => s.advance);
  const hold = useTitration((s) => s.hold);
  const resume = useTitration((s) => s.resume);
  const assign = useTitration((s) => s.assign);

  const [tab, setTab] = useState<"patients" | "protocols">("patients");
  const [openId, setOpenId] = useState<string | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  const [npPatient, setNpPatient] = useState(""); const [npProto, setNpProto] = useState(PROTOCOLS[0].id);

  function due(p: PatientTitration) {
    const proto = getProtocol(p.protocolId); if (!proto) return false;
    if (p.status !== "titrating") return false;
    return new Date(stepDue(p.currentStepStart, proto.steps[p.stepIndex])) <= new Date();
  }
  const counts = useMemo(() => ({
    titrating: plans.filter((p) => p.status === "titrating").length,
    maintenance: plans.filter((p) => p.status === "maintenance").length,
    due: plans.filter(due).length,
    hold: plans.filter((p) => p.status === "hold").length,
  }), [plans]);

  const sel = openId ? plans.find((p) => p.id === openId) || null : null;
  const selProto = sel ? getProtocol(sel.protocolId) : undefined;

  function createPlan() { const p = patients.find((x) => x.id === npPatient); if (!p) { toast("Choose a patient"); return; } assign(p.name, npProto, p.id); setAddOpen(false); setNpPatient(""); toast("Titration plan started"); }

  const KPI = ({ label, value, intent }: { label: string; value: string; intent?: string }) => <div className="bg-surface border border-border rounded-2xl px-4 py-3 min-w-[140px]"><div className={`text-[22px] font-extrabold leading-none ${intent || ""}`}>{value}</div><div className="text-[11px] text-ink-muted mt-1.5">{label}</div></div>;

  return (
    <div className="px-7 py-6 text-[14px]">
      <div className="flex items-center gap-3 mb-4 flex-wrap">
        <div><h1 className="text-[21px] font-extrabold tracking-tight">Dose Titration</h1><div className="text-[12px] text-ink-muted mt-0.5">GLP-1 ramp schedules · auto-plans each refill's dose</div></div>
        <div className="flex gap-2">{(["patients", "protocols"] as const).map((t) => <button key={t} onClick={() => setTab(t)} className={`text-[12.5px] font-semibold px-3.5 py-1.5 rounded-full capitalize ${tab === t ? "bg-brand text-white" : "bg-surface-3 text-ink-muted"}`}>{t}</button>)}</div>
        <div className="flex-1" />{tab === "patients" && <button className="btn btn-primary btn-sm" onClick={() => setAddOpen(true)}>＋ New titration</button>}
      </div>

      <div className="flex flex-wrap gap-2.5 mb-4">
        <KPI label="On titration" value={String(counts.titrating)} intent="text-blue" />
        <KPI label="At maintenance" value={String(counts.maintenance)} intent="text-green" />
        <KPI label="Due to advance" value={String(counts.due)} intent={counts.due ? "text-amber" : ""} />
        <KPI label="On hold" value={String(counts.hold)} />
      </div>

      {tab === "patients" ? (
        <div className="bg-surface border border-border rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full border-collapse min-w-[860px]">
              <thead><tr className="bg-surface-2">{["Patient", "Medication", "Current dose", "Next dose", "Next step due", "Status"].map((h) => <th key={h} className="text-left text-[10px] uppercase tracking-wide text-ink-muted font-bold px-3 py-2.5 border-b border-border">{h}</th>)}</tr></thead>
              <tbody>
                {plans.map((p) => {
                  const proto = getProtocol(p.protocolId)!; const step = proto.steps[p.stepIndex]; const next = proto.steps[p.stepIndex + 1];
                  const isDue = due(p);
                  return (
                    <tr key={p.id} className="border-b border-border last:border-none hover:bg-surface-2 cursor-pointer" onClick={() => setOpenId(p.id)}>
                      <td className="px-3 py-2.5 font-semibold">{p.patientName}</td>
                      <td className="px-3 py-2.5">{p.med}</td>
                      <td className="px-3 py-2.5"><b>{step.dose}</b> <span className="text-ink-muted text-[12px]">· wk {weekOf(p.currentStepStart, step)}/{step.weeks}</span></td>
                      <td className="px-3 py-2.5">{next ? next.dose : <span className="text-green">Maintenance</span>}</td>
                      <td className="px-3 py-2.5 text-[12px] whitespace-nowrap">{p.status === "maintenance" ? "—" : <span className={isDue ? "text-amber font-semibold" : "text-ink-muted"}>{fmt(stepDue(p.currentStepStart, step))}{isDue ? " · due" : ""}</span>}</td>
                      <td className="px-3 py-2.5"><Pill intent={STATUS_INTENT[p.status]} dot>{p.status}</Pill></td>
                    </tr>
                  );
                })}
                {plans.length === 0 && <tr><td colSpan={6} className="px-3 py-10 text-center text-ink-muted text-[12px]">No titration plans.</td></tr>}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3">
          {PROTOCOLS.map((proto) => (
            <div key={proto.id} className="bg-surface border border-border rounded-xl p-4">
              <div className="font-bold text-[14px] mb-2">{proto.label}</div>
              <div className="space-y-1">
                {proto.steps.map((st, i) => (
                  <div key={i} className="flex items-center gap-2 text-[12.5px]">
                    <span className="text-ink-muted w-5">{i + 1}.</span>
                    <span className="font-semibold w-[70px]">{st.dose}</span>
                    <span className="text-ink-muted">{st.maintenance ? "maintenance" : `${st.weeks} weeks`}</span>
                    {st.maintenance && <Pill intent="green">target</Pill>}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {sel && selProto && (() => {
        const step = selProto.steps[sel.stepIndex]; const next = selProto.steps[sel.stepIndex + 1];
        return (
          <Modal open={!!sel} onClose={() => setOpenId(null)} title={`Titration — ${sel.patientName}`} icon="💉" width={560}
            footer={<div className="flex items-center gap-2 w-full">
              {sel.status !== "hold" && next && <button className="btn btn-primary" onClick={() => { advance(sel.id); toast(`Advanced to ${next.dose}`); }}>Advance to {next.dose}</button>}
              {sel.status !== "hold" ? <button className="btn btn-ghost" onClick={() => { hold(sel.id); toast("Held at current dose"); }}>Hold dose</button> : <button className="btn btn-primary" onClick={() => { resume(sel.id); toast("Resumed"); }}>Resume</button>}
              <div className="flex-1" /><button className="btn btn-ghost" onClick={() => setOpenId(null)}>Close</button>
            </div>}>
            <div className="flex items-center gap-2 mb-3"><Pill intent={STATUS_INTENT[sel.status]} dot>{sel.status}</Pill><span className="text-[13px] font-semibold">{selProto.label}</span></div>
            <div className="grid grid-cols-3 gap-2 mb-3 text-center">
              <div className="bg-surface-2 rounded-lg py-2"><div className="text-[16px] font-extrabold">{step.dose}</div><div className="text-[10px] text-ink-muted">Current dose</div></div>
              <div className="bg-surface-2 rounded-lg py-2"><div className="text-[16px] font-extrabold">{weekOf(sel.currentStepStart, step)}/{step.weeks}</div><div className="text-[10px] text-ink-muted">Week of step</div></div>
              <div className="bg-surface-2 rounded-lg py-2"><div className="text-[16px] font-extrabold">{next ? next.dose : "—"}</div><div className="text-[10px] text-ink-muted">Next dose</div></div>
            </div>
            <div className="text-[10px] uppercase tracking-wide text-ink-muted font-bold mb-1.5">Ladder</div>
            <div className="space-y-1">
              {selProto.steps.map((st, i) => (
                <div key={i} className={`flex items-center gap-2 text-[12.5px] px-2 py-1 rounded-md ${i === sel.stepIndex ? "bg-brand-soft font-semibold" : ""}`}>
                  <span className="text-ink-muted w-5">{i + 1}.</span><span className="w-[70px]">{st.dose}</span><span className="text-ink-muted">{st.maintenance ? "maintenance" : `${st.weeks} wks`}</span>
                  {i < sel.stepIndex && <span className="text-green">✓</span>}{i === sel.stepIndex && <span className="text-brand-dk">● current</span>}
                </div>
              ))}
            </div>
            <div className="mt-3 text-[11px] text-ink-muted-2">Next refill will be filled at the current dose; advancing updates the dose used for the next order.</div>
          </Modal>
        );
      })()}

      <Modal open={addOpen} onClose={() => setAddOpen(false)} title="New titration plan" icon="💉" width={440}
        footer={<><button className="btn btn-ghost" onClick={() => setAddOpen(false)}>Cancel</button><button className="btn btn-primary" onClick={createPlan}>Start</button></>}>
        <label className="fl">Patient</label>
        <select className="fsel w-full mb-2.5" value={npPatient} onChange={(e) => setNpPatient(e.target.value)}><option value="">— choose —</option>{patients.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</select>
        <label className="fl">Protocol</label>
        <select className="fsel w-full" value={npProto} onChange={(e) => setNpProto(e.target.value)}>{PROTOCOLS.map((p) => <option key={p.id} value={p.id}>{p.label}</option>)}</select>
      </Modal>
      <Toast />
    </div>
  );
}
