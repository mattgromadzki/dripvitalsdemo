"use client";

import { useEffect, useMemo, useState } from "react";
import { SectionCard } from "@/components/modules/chart/SectionCard";
import { usePermission } from "@/lib/rbac/usePermission";
import { useClinical } from "@/lib/hooks/useClinical";
import {
  ICD10_COMMON, COMMON_MEDS, ROUTES, FREQUENCIES, clinId, EMPTY_CHART,
} from "@/lib/clinical/chartTypes";
import type { AllergySeverity } from "@/lib/clinical/chartTypes";
import type { Patient as PatientT, PatientExtra } from "@/lib/types";

const SEV_CLASS: Record<AllergySeverity, string> = {
  mild: "bg-green-soft text-green",
  moderate: "bg-amber-soft text-amber",
  severe: "bg-red-soft text-red",
  anaphylaxis: "bg-red-soft text-red",
};
function Pillish({ children, cls }: { children: React.ReactNode; cls: string }) {
  return <span className={`inline-block px-2 py-0.5 rounded-full text-[11px] font-semibold ${cls}`}>{children}</span>;
}
function Trash({ onClick }: { onClick: () => void }) {
  return <button onClick={onClick} className="text-ink-muted hover:text-red text-[12px] px-1.5 py-0.5 rounded hover:bg-red-soft" title="Remove">✕</button>;
}
const AddBtn = ({ open, onClick }: { open: boolean; onClick: () => void }) =>
  <button onClick={onClick} className="btn btn-ghost btn-sm">{open ? "Cancel" : "+ Add"}</button>;

export function ClinicalTab({ patient }: { patient: PatientT; extra: PatientExtra }) {
  const pid = patient.id;
  const canEdit = usePermission("patients.edit");
  const chart = useClinical((s) => s.charts[pid]) ?? EMPTY_CHART;
  const ensureSeeded = useClinical((s) => s.ensureSeeded);
  useEffect(() => { ensureSeeded(pid, patient); }, [pid, patient, ensureSeeded]);

  return (
    <div>
      <ProblemList pid={pid} canEdit={canEdit} />
      <Allergies pid={pid} canEdit={canEdit} />
      <Medications pid={pid} canEdit={canEdit} />
      <Vitals pid={pid} canEdit={canEdit} />
      <div className="text-[11px] text-ink-muted-2 px-1">
        Coded clinical data (ICD-10 problems, structured allergies, medication list, vitals flowsheet). This is the source for interaction checks, trending, and record export.
      </div>
    </div>
  );
}

/* ── Problem list (ICD-10) ─────────────────────────────────────────────── */
function ProblemList({ pid, canEdit }: { pid: string; canEdit: boolean }) {
  const chart = useClinical((s) => s.charts[pid]) ?? EMPTY_CHART;
  const add = useClinical((s) => s.addProblem);
  const upd = useClinical((s) => s.updateProblem);
  const del = useClinical((s) => s.removeProblem);
  const [open, setOpen] = useState(false);
  const [pick, setPick] = useState(ICD10_COMMON[0].code);
  const [customCode, setCustomCode] = useState("");
  const [customLabel, setCustomLabel] = useState("");
  const [onset, setOnset] = useState("");

  function submit() {
    let code = pick, label = ICD10_COMMON.find((x) => x.code === pick)?.label || "";
    if (pick === "__custom") { code = customCode.trim(); label = customLabel.trim(); }
    if (!code || !label) return;
    add(pid, { id: clinId("prob_"), code, label, status: "active", onset: onset || undefined });
    setOpen(false); setCustomCode(""); setCustomLabel(""); setOnset(""); setPick(ICD10_COMMON[0].code);
  }

  return (
    <SectionCard title="Problem List" icon="🩺" action={canEdit ? <AddBtn open={open} onClick={() => setOpen(!open)} /> : undefined}>
      {open && (
        <div className="mb-3 p-3 rounded-lg bg-surface-2 border border-border grid gap-2">
          <select className="fsel" value={pick} onChange={(e) => setPick(e.target.value)}>
            {ICD10_COMMON.map((x) => <option key={x.code} value={x.code}>{x.code} — {x.label}</option>)}
            <option value="__custom">Other (enter code)…</option>
          </select>
          {pick === "__custom" && (
            <div className="grid grid-cols-[120px_1fr] gap-2">
              <input className="fi font-mono" value={customCode} onChange={(e) => setCustomCode(e.target.value)} placeholder="ICD-10" />
              <input className="fi" value={customLabel} onChange={(e) => setCustomLabel(e.target.value)} placeholder="Description" />
            </div>
          )}
          <div className="flex gap-2 items-center">
            <input className="fi" type="date" value={onset} onChange={(e) => setOnset(e.target.value)} style={{ maxWidth: 180 }} />
            <span className="text-[11.5px] text-ink-muted">Onset (optional)</span>
            <button className="btn btn-primary btn-sm ml-auto" onClick={submit}>Add problem</button>
          </div>
        </div>
      )}
      {chart.problems.length === 0 ? (
        <Empty>No active problems recorded.</Empty>
      ) : (
        <div className="divide-y divide-border">
          {chart.problems.map((p) => (
            <div key={p.id} className="flex items-center gap-3 py-2">
              <span className="font-mono text-[12px] text-ink-2 bg-surface-2 px-1.5 py-0.5 rounded border border-border">{p.code}</span>
              <span className="text-[13.5px] text-ink flex-1">{p.label}{p.onset && <span className="text-ink-muted-2 text-[11.5px]"> · onset {p.onset}</span>}</span>
              <Pillish cls={p.status === "active" ? "bg-brand/10 text-brand" : "bg-surface-3 text-ink-muted"}>{p.status}</Pillish>
              {canEdit && p.status === "active" && <button className="text-[11px] text-ink-muted hover:text-brand" onClick={() => upd(pid, p.id, { status: "resolved" })}>resolve</button>}
              {canEdit && <Trash onClick={() => del(pid, p.id)} />}
            </div>
          ))}
        </div>
      )}
    </SectionCard>
  );
}

/* ── Allergies ─────────────────────────────────────────────────────────── */
function Allergies({ pid, canEdit }: { pid: string; canEdit: boolean }) {
  const chart = useClinical((s) => s.charts[pid]) ?? EMPTY_CHART;
  const add = useClinical((s) => s.addAllergy);
  const del = useClinical((s) => s.removeAllergy);
  const setNkda = useClinical((s) => s.setNkda);
  const [open, setOpen] = useState(false);
  const [allergen, setAllergen] = useState("");
  const [reaction, setReaction] = useState("");
  const [severity, setSeverity] = useState<AllergySeverity>("moderate");

  function submit() {
    if (!allergen.trim()) return;
    add(pid, { id: clinId("alg_"), allergen: allergen.trim(), reaction: reaction.trim() || undefined, severity, status: "active" });
    setOpen(false); setAllergen(""); setReaction(""); setSeverity("moderate");
  }

  return (
    <SectionCard title="Allergies" icon="⚠️" action={canEdit ? <AddBtn open={open} onClick={() => setOpen(!open)} /> : undefined}>
      {open && (
        <div className="mb-3 p-3 rounded-lg bg-surface-2 border border-border grid gap-2">
          <div className="grid grid-cols-2 gap-2">
            <input className="fi" value={allergen} onChange={(e) => setAllergen(e.target.value)} placeholder="Allergen (e.g. Penicillin)" />
            <input className="fi" value={reaction} onChange={(e) => setReaction(e.target.value)} placeholder="Reaction (e.g. hives)" />
          </div>
          <div className="flex gap-2 items-center">
            <select className="fsel" value={severity} onChange={(e) => setSeverity(e.target.value as AllergySeverity)} style={{ maxWidth: 200 }}>
              <option value="mild">Mild</option><option value="moderate">Moderate</option><option value="severe">Severe</option><option value="anaphylaxis">Anaphylaxis</option>
            </select>
            <button className="btn btn-primary btn-sm ml-auto" onClick={submit}>Add allergy</button>
          </div>
        </div>
      )}
      {chart.allergies.length === 0 ? (
        <div className="flex items-center justify-between gap-3">
          <Pillish cls={chart.nkda ? "bg-green-soft text-green" : "bg-surface-3 text-ink-muted"}>
            {chart.nkda ? "No known drug allergies (NKDA)" : "No allergies recorded"}
          </Pillish>
          {canEdit && !chart.nkda && <button className="text-[11.5px] text-brand font-medium" onClick={() => setNkda(pid, true)}>Mark NKDA</button>}
          {canEdit && chart.nkda && <button className="text-[11.5px] text-ink-muted" onClick={() => setNkda(pid, false)}>Clear NKDA</button>}
        </div>
      ) : (
        <div className="divide-y divide-border">
          {chart.allergies.map((a) => (
            <div key={a.id} className="flex items-center gap-3 py-2">
              <span className="text-[13.5px] font-semibold text-ink">{a.allergen}</span>
              {a.reaction && <span className="text-[12px] text-ink-muted flex-1">{a.reaction}</span>}
              {!a.reaction && <span className="flex-1" />}
              <Pillish cls={SEV_CLASS[a.severity]}>{a.severity}</Pillish>
              {canEdit && <Trash onClick={() => del(pid, a.id)} />}
            </div>
          ))}
        </div>
      )}
    </SectionCard>
  );
}

/* ── Medications ───────────────────────────────────────────────────────── */
function Medications({ pid, canEdit }: { pid: string; canEdit: boolean }) {
  const chart = useClinical((s) => s.charts[pid]) ?? EMPTY_CHART;
  const add = useClinical((s) => s.addMed);
  const upd = useClinical((s) => s.updateMed);
  const del = useClinical((s) => s.removeMed);
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [dose, setDose] = useState("");
  const [route, setRoute] = useState(ROUTES[0]);
  const [freq, setFreq] = useState(FREQUENCIES[0]);

  function submit() {
    if (!name.trim()) return;
    add(pid, { id: clinId("med_"), name: name.trim(), dose: dose.trim() || undefined, route, frequency: freq, status: "active" });
    setOpen(false); setName(""); setDose(""); setRoute(ROUTES[0]); setFreq(FREQUENCIES[0]);
  }

  const active = chart.meds.filter((m) => m.status === "active");
  const stopped = chart.meds.filter((m) => m.status !== "active");

  return (
    <SectionCard title="Medications" icon="💊" action={canEdit ? <AddBtn open={open} onClick={() => setOpen(!open)} /> : undefined}>
      {open && (
        <div className="mb-3 p-3 rounded-lg bg-surface-2 border border-border grid gap-2">
          <input className="fi" list="med-suggestions" value={name} onChange={(e) => setName(e.target.value)} placeholder="Medication name" />
          <datalist id="med-suggestions">{COMMON_MEDS.map((m) => <option key={m} value={m} />)}</datalist>
          <div className="grid grid-cols-3 gap-2">
            <input className="fi" value={dose} onChange={(e) => setDose(e.target.value)} placeholder="Dose (e.g. 0.5mg)" />
            <select className="fsel" value={route} onChange={(e) => setRoute(e.target.value)}>{ROUTES.map((r) => <option key={r}>{r}</option>)}</select>
            <select className="fsel" value={freq} onChange={(e) => setFreq(e.target.value)}>{FREQUENCIES.map((f) => <option key={f}>{f}</option>)}</select>
          </div>
          <button className="btn btn-primary btn-sm justify-self-end" onClick={submit}>Add medication</button>
        </div>
      )}
      {chart.meds.length === 0 ? (
        <Empty>No medications on file.</Empty>
      ) : (
        <div className="divide-y divide-border">
          {[...active, ...stopped].map((m) => (
            <div key={m.id} className="flex items-center gap-3 py-2">
              <span className={`text-[13.5px] font-semibold ${m.status === "active" ? "text-ink" : "text-ink-muted line-through"}`}>{m.name}</span>
              <span className="text-[12px] text-ink-muted flex-1">{[m.dose, m.route, m.frequency].filter(Boolean).join(" · ")}</span>
              <Pillish cls={m.status === "active" ? "bg-green-soft text-green" : "bg-surface-3 text-ink-muted"}>{m.status}</Pillish>
              {canEdit && m.status === "active" && <button className="text-[11px] text-ink-muted hover:text-red" onClick={() => upd(pid, m.id, { status: "discontinued" })}>stop</button>}
              {canEdit && <Trash onClick={() => del(pid, m.id)} />}
            </div>
          ))}
        </div>
      )}
    </SectionCard>
  );
}

/* ── Vitals flowsheet ──────────────────────────────────────────────────── */
function Vitals({ pid, canEdit }: { pid: string; canEdit: boolean }) {
  const chart = useClinical((s) => s.charts[pid]) ?? EMPTY_CHART;
  const add = useClinical((s) => s.addVital);
  const del = useClinical((s) => s.removeVital);
  const [open, setOpen] = useState(false);
  const today = new Date().toISOString().slice(0, 10);
  const [v, setV] = useState({ date: today, weightLb: "", systolic: "", diastolic: "", hr: "", a1c: "" });
  const set = (k: keyof typeof v, val: string) => setV((s) => ({ ...s, [k]: val }));

  function submit() {
    const num = (x: string) => { const n = parseFloat(x); return Number.isFinite(n) ? n : undefined; };
    const wt = num(v.weightLb);
    add(pid, {
      id: clinId("vit_"), date: v.date || today,
      weightLb: wt, systolic: num(v.systolic), diastolic: num(v.diastolic), hr: num(v.hr), a1c: num(v.a1c),
    });
    setOpen(false); setV({ date: today, weightLb: "", systolic: "", diastolic: "", hr: "", a1c: "" });
  }

  // Weight trend (entries with a weight, oldest→newest for the delta read-out)
  const weights = useMemo(() => chart.vitals.filter((x) => typeof x.weightLb === "number").map((x) => x.weightLb as number), [chart.vitals]);
  const latest = weights[0];
  const earliest = weights[weights.length - 1];
  const delta = latest != null && earliest != null ? latest - earliest : null;

  return (
    <SectionCard title="Vitals flowsheet" icon="📈" action={canEdit ? <AddBtn open={open} onClick={() => setOpen(!open)} /> : undefined}>
      {delta != null && weights.length > 1 && (
        <div className="mb-3 text-[12.5px] text-ink-2">
          Weight change since first record: <b className={delta <= 0 ? "text-green" : "text-amber"}>{delta > 0 ? "+" : ""}{delta.toFixed(1)} lb</b>
          <span className="text-ink-muted"> ({earliest} → {latest} lb over {weights.length} readings)</span>
        </div>
      )}
      {open && (
        <div className="mb-3 p-3 rounded-lg bg-surface-2 border border-border grid gap-2">
          <div className="grid grid-cols-3 gap-2">
            <label className="text-[11px] text-ink-muted">Date<input className="fi mt-0.5" type="date" value={v.date} onChange={(e) => set("date", e.target.value)} /></label>
            <label className="text-[11px] text-ink-muted">Weight (lb)<input className="fi mt-0.5" inputMode="decimal" value={v.weightLb} onChange={(e) => set("weightLb", e.target.value)} /></label>
            <label className="text-[11px] text-ink-muted">A1C (%)<input className="fi mt-0.5" inputMode="decimal" value={v.a1c} onChange={(e) => set("a1c", e.target.value)} /></label>
            <label className="text-[11px] text-ink-muted">Systolic<input className="fi mt-0.5" inputMode="numeric" value={v.systolic} onChange={(e) => set("systolic", e.target.value)} /></label>
            <label className="text-[11px] text-ink-muted">Diastolic<input className="fi mt-0.5" inputMode="numeric" value={v.diastolic} onChange={(e) => set("diastolic", e.target.value)} /></label>
            <label className="text-[11px] text-ink-muted">Heart rate<input className="fi mt-0.5" inputMode="numeric" value={v.hr} onChange={(e) => set("hr", e.target.value)} /></label>
          </div>
          <button className="btn btn-primary btn-sm justify-self-end" onClick={submit}>Add reading</button>
        </div>
      )}
      {chart.vitals.length === 0 ? (
        <Empty>No vitals recorded.</Empty>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-[12.5px] border-collapse">
            <thead>
              <tr className="text-left text-ink-muted text-[10.5px] uppercase tracking-wide">
                <th className="py-1.5 pr-3 font-bold">Date</th>
                <th className="py-1.5 pr-3 font-bold">Weight</th>
                <th className="py-1.5 pr-3 font-bold">BMI</th>
                <th className="py-1.5 pr-3 font-bold">BP</th>
                <th className="py-1.5 pr-3 font-bold">HR</th>
                <th className="py-1.5 pr-3 font-bold">A1C</th>
                {canEdit && <th />}
              </tr>
            </thead>
            <tbody>
              {chart.vitals.map((x) => (
                <tr key={x.id} className="border-t border-border text-ink-2">
                  <td className="py-1.5 pr-3 whitespace-nowrap">{x.date || "—"}</td>
                  <td className="py-1.5 pr-3">{x.weightLb != null ? `${x.weightLb} lb` : "—"}</td>
                  <td className="py-1.5 pr-3">{x.bmi != null ? x.bmi : "—"}</td>
                  <td className="py-1.5 pr-3">{x.systolic != null && x.diastolic != null ? `${x.systolic}/${x.diastolic}` : "—"}</td>
                  <td className="py-1.5 pr-3">{x.hr != null ? x.hr : "—"}</td>
                  <td className="py-1.5 pr-3">{x.a1c != null ? `${x.a1c}%` : "—"}</td>
                  {canEdit && <td className="py-1.5 text-right"><Trash onClick={() => del(pid, x.id)} /></td>}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </SectionCard>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return <div className="text-[12.5px] text-ink-muted py-1">{children}</div>;
}
