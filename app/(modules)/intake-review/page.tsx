"use client";

import { useMemo, useState } from "react";
import { Pill } from "@/components/ui/Pill";
import { Modal } from "@/components/ui/Modal";
import { Toast } from "@/components/ui/Toast";
import { toast } from "@/lib/hooks/useToast";
import { useIntake } from "@/lib/hooks/useIntake";
import { computeFlags, recommendation, type Severity } from "@/lib/intake/screening";
import type { IntakeSubmission, IntakeStatus } from "@/lib/intake/types";

const SEV_INTENT: Record<Severity, "red" | "amber" | "blue"> = { critical: "red", warning: "amber", info: "blue" };
const STATUS_INTENT: Record<IntakeStatus, "amber" | "green" | "red" | "blue"> = { pending: "amber", approved: "green", denied: "red", info: "blue" };
const fmt = (iso: string) => new Date(iso).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
const flagsFor = (s: IntakeSubmission) => computeFlags(s.answers);

export default function IntakeReviewPage() {
  const submissions = useIntake((s) => s.submissions);
  const decide = useIntake((s) => s.decide);
  const [filter, setFilter] = useState<IntakeStatus | "all">("pending");
  const [openId, setOpenId] = useState<string | null>(null);
  const [note, setNote] = useState("");

  const counts = useMemo(() => ({
    pending: submissions.filter((s) => s.status === "pending").length,
    flagged: submissions.filter((s) => s.status === "pending" && flagsFor(s).length > 0).length,
    approved: submissions.filter((s) => s.status === "approved").length,
    denied: submissions.filter((s) => s.status === "denied").length,
  }), [submissions]);

  const list = useMemo(() => submissions.filter((s) => filter === "all" || s.status === filter), [submissions, filter]);
  const sel = openId ? submissions.find((s) => s.id === openId) || null : null;
  const selFlags = sel ? flagsFor(sel) : [];
  const rec = sel ? recommendation(selFlags) : "approve";

  function openReview(s: IntakeSubmission) { setOpenId(s.id); setNote(s.providerNote || ""); }
  function act(status: IntakeStatus) {
    if (!sel) return;
    if (status === "denied" && !note.trim()) { toast("Add a reason before denying"); return; }
    decide(sel.id, status, note);
    toast(status === "approved" ? "✓ Approved — ready to prescribe" : status === "denied" ? "Denied" : "Info requested");
    setOpenId(null);
  }

  const KPI = ({ label, value, intent }: { label: string; value: number; intent?: string }) => (
    <div className="bg-surface border border-border rounded-2xl px-4 py-3 min-w-[130px]">
      <div className={`text-[22px] font-extrabold leading-none ${intent || ""}`}>{value}</div>
      <div className="text-[11px] text-ink-muted mt-1.5">{label}</div>
    </div>
  );
  const A = ({ label, on }: { label: string; on: boolean }) => (
    <div className="flex items-center justify-between py-1 border-b border-surface-3 text-[12.5px]"><span className="text-ink-muted">{label}</span><span className={on ? "text-red font-bold" : "text-ink-2"}>{on ? "Yes" : "No"}</span></div>
  );

  return (
    <div className="px-7 py-6 text-[14px]">
      <h1 className="text-[21px] font-extrabold tracking-tight">Intake Review</h1>
      <div className="text-[12px] text-ink-muted mt-0.5 mb-4">Async patient intakes awaiting a provider decision · automatic GLP-1 contraindication screening</div>

      <div className="flex flex-wrap gap-2.5 mb-4">
        <KPI label="Pending" value={counts.pending} intent="text-amber" />
        <KPI label="Flagged" value={counts.flagged} intent="text-red" />
        <KPI label="Approved" value={counts.approved} intent="text-green" />
        <KPI label="Denied" value={counts.denied} />
      </div>

      <div className="flex gap-2 mb-3">
        {(["pending", "all", "approved", "denied"] as const).map((f) => (
          <button key={f} onClick={() => setFilter(f)} className={`text-[12.5px] font-semibold px-3.5 py-1.5 rounded-full capitalize ${filter === f ? "bg-brand text-white" : "bg-surface-3 text-ink-muted"}`}>{f}</button>
        ))}
      </div>

      <div className="bg-surface border border-border rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full border-collapse min-w-[760px]">
            <thead><tr className="bg-surface-2">{["Patient", "State", "Program", "Submitted", "Screening", "Status"].map((h) => <th key={h} className="text-left text-[10px] uppercase tracking-wide text-ink-muted font-bold px-3 py-2.5 border-b border-border">{h}</th>)}</tr></thead>
            <tbody>
              {list.map((s) => {
                const flags = flagsFor(s); const crit = flags.filter((f) => f.severity === "critical").length;
                return (
                  <tr key={s.id} className="border-b border-border last:border-none hover:bg-surface-2 cursor-pointer" onClick={() => openReview(s)}>
                    <td className="px-3 py-2.5"><div className="font-semibold">{s.patientName}</div><div className="text-[11px] text-ink-muted">BMI {s.answers.bmi}</div></td>
                    <td className="px-3 py-2.5">{s.state}</td>
                    <td className="px-3 py-2.5">{s.program}</td>
                    <td className="px-3 py-2.5 text-ink-muted text-[12px] whitespace-nowrap">{fmt(s.submittedAt)}</td>
                    <td className="px-3 py-2.5">{flags.length === 0 ? <span className="text-green text-[12px] font-semibold">✓ Clear</span> : <Pill intent={crit ? "red" : "amber"} dot>{crit ? `${crit} critical` : `${flags.length} flag${flags.length > 1 ? "s" : ""}`}</Pill>}</td>
                    <td className="px-3 py-2.5"><Pill intent={STATUS_INTENT[s.status]} dot>{s.status === "info" ? "Info requested" : s.status}</Pill></td>
                  </tr>
                );
              })}
              {list.length === 0 && <tr><td colSpan={6} className="px-3 py-10 text-center text-ink-muted text-[12px]">Nothing here.</td></tr>}
            </tbody>
          </table>
        </div>
      </div>

      {sel && (
        <Modal open={!!sel} onClose={() => setOpenId(null)} title={`Review — ${sel.patientName}`} icon="🧾" width={640}
          footer={sel.status === "pending" ? <>
            <button className="btn btn-ghost text-red" onClick={() => act("denied")}>Deny</button>
            <button className="btn btn-ghost" onClick={() => act("info")}>Request info</button>
            <button className="btn btn-primary" onClick={() => act("approved")}>Approve</button>
          </> : <button className="btn btn-ghost" onClick={() => setOpenId(null)}>Close</button>}>
          <div className={`mb-3 px-3 py-2.5 rounded-md text-[12.5px] font-semibold ${rec === "deny" ? "bg-red-soft text-red" : rec === "review" ? "bg-amber-soft text-amber" : "bg-green-soft text-green"}`}>
            {rec === "deny" ? "⛔ Recommendation: do not prescribe — critical contraindication present." : rec === "review" ? "⚠ Recommendation: provider review — cautions present." : "✓ Recommendation: no contraindications detected."}
          </div>

          <div className="grid grid-cols-3 gap-2 mb-3 text-center">
            <div className="bg-surface-2 rounded-lg py-2"><div className="text-[16px] font-extrabold">{sel.answers.weightLb}</div><div className="text-[10px] text-ink-muted">Weight (lb)</div></div>
            <div className="bg-surface-2 rounded-lg py-2"><div className="text-[16px] font-extrabold">{sel.answers.bmi}</div><div className="text-[10px] text-ink-muted">BMI</div></div>
            <div className="bg-surface-2 rounded-lg py-2"><div className="text-[16px] font-extrabold">{sel.answers.goalLb}</div><div className="text-[10px] text-ink-muted">Goal (lb)</div></div>
          </div>

          {selFlags.length > 0 && (
            <div className="mb-3">
              <div className="text-[10px] uppercase tracking-wide text-ink-muted font-bold mb-1.5">Screening flags</div>
              {selFlags.map((f, i) => (
                <div key={i} className="flex gap-2 mb-1.5"><Pill intent={SEV_INTENT[f.severity]}>{f.severity}</Pill><div className="text-[12px]"><b>{f.label}.</b> <span className="text-ink-2">{f.detail}</span></div></div>
              ))}
            </div>
          )}

          <div className="text-[10px] uppercase tracking-wide text-ink-muted font-bold mb-1.5">Medical history</div>
          <div className="grid grid-cols-2 gap-x-4 mb-3">
            <A label="MTC / MEN2 history" on={sel.answers.mtcOrMen2} />
            <A label="Pregnant / nursing" on={sel.answers.pregnantOrNursing} />
            <A label="Pancreatitis" on={sel.answers.pancreatitis} />
            <A label="Gallbladder disease" on={sel.answers.gallbladder} />
            <A label="Eating disorder" on={sel.answers.eatingDisorder} />
            <A label="Type 2 diabetes" on={sel.answers.type2Diabetes} />
            <A label="Kidney disease" on={sel.answers.kidneyDisease} />
            <A label="Prior GLP-1 use" on={sel.answers.priorGLP1} />
          </div>
          <div className="text-[12.5px] mb-1"><span className="text-ink-muted">Current meds:</span> {sel.answers.currentMeds || "None reported"}</div>
          <div className="text-[12.5px] mb-3"><span className="text-ink-muted">Allergies:</span> {sel.answers.allergies || "None"}</div>

          <label className="fl">Provider note {sel.status === "pending" && "(required to deny)"}</label>
          <textarea className="fi min-h-[70px] resize-y" value={note} onChange={(e) => setNote(e.target.value)} placeholder="Clinical note / reason…" disabled={sel.status !== "pending"} />
          {sel.status !== "pending" && <div className="mt-2 text-[11.5px] text-ink-muted">Decided by {sel.decidedBy} · {sel.decidedAt ? fmt(sel.decidedAt) : ""}</div>}
        </Modal>
      )}
      <Toast />
    </div>
  );
}
