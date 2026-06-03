"use client";

import { useMemo, useState } from "react";
import { Pill } from "@/components/ui/Pill";
import { Modal } from "@/components/ui/Modal";
import { Toast } from "@/components/ui/Toast";
import { toast } from "@/lib/hooks/useToast";
import { usePatients } from "@/lib/hooks/usePatients";
import { useSubscriptions } from "@/lib/hooks/useSubscriptions";
import { PLANS } from "@/lib/data/subscriptionPlans";
import { money, monthlyValue, advance } from "@/lib/subscriptions/util";
import { charge } from "@/lib/payments/client";
import type { SubStatus, Subscription } from "@/lib/subscriptions/types";

const STATUS_INTENT: Record<SubStatus, "green" | "amber" | "red" | "muted" | "blue"> = { active: "green", trialing: "blue", past_due: "red", paused: "amber", canceled: "muted" };
const fmt = (iso: string) => new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
const label = (s: SubStatus) => (s === "past_due" ? "Past due" : s[0].toUpperCase() + s.slice(1));

export default function SubscriptionsPage() {
  const patients = usePatients((s) => s.patients);
  const subs = useSubscriptions((s) => s.subscriptions);
  const setStatus = useSubscriptions((s) => s.setStatus);
  const recordCycle = useSubscriptions((s) => s.recordCycle);
  const updateCard = useSubscriptions((s) => s.updateCard);
  const add = useSubscriptions((s) => s.add);

  const [filter, setFilter] = useState<SubStatus | "all">("all");
  const [openId, setOpenId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [newOpen, setNewOpen] = useState(false);
  const [npPatient, setNpPatient] = useState(""); const [npPlan, setNpPlan] = useState(PLANS[0].id);

  const mrr = useMemo(() => subs.reduce((a, s) => a + monthlyValue(s), 0), [subs]);
  const counts = useMemo(() => ({
    active: subs.filter((s) => s.status === "active" || s.status === "trialing").length,
    past_due: subs.filter((s) => s.status === "past_due").length,
    inactive: subs.filter((s) => s.status === "paused" || s.status === "canceled").length,
  }), [subs]);

  const list = useMemo(() => subs.filter((s) => filter === "all" || s.status === filter), [subs, filter]);
  const sel = openId ? subs.find((s) => s.id === openId) || null : null;

  async function runCharge(s: Subscription) {
    setBusy(true);
    const res = await charge({ sourceId: s.paymentToken, amountCents: s.amountCents, referenceId: s.id, note: `${s.planName} · ${s.patientName}` });
    const cycle = { id: "cy" + Date.now().toString(36), date: new Date().toISOString(), amountCents: s.amountCents, status: (res.ok ? "paid" : "failed") as "paid" | "failed", paymentId: res.paymentId };
    recordCycle(s.id, cycle, { advance: res.ok, failed: !res.ok });
    setBusy(false);
    toast(res.ok ? `✓ Charged ${money(s.amountCents)} · refill queued` : `✕ Payment failed — ${res.error || "declined"}`);
  }
  function fixCard(s: Subscription) { updateCard(s.id, "4242", "mock-card-ok"); toast("Card updated — retry the payment"); }
  function createSub() {
    const p = patients.find((x) => x.id === npPatient); const plan = PLANS.find((x) => x.id === npPlan)!;
    if (!p) { toast("Choose a patient"); return; }
    add({ patientId: p.id, patientName: p.name, planId: plan.id, planName: plan.name, med: plan.med, interval: plan.interval, amountCents: plan.amountCents, status: "active", startedAt: new Date().toISOString(), nextBillingDate: advance(new Date().toISOString(), plan.interval), cardLast4: "4242", paymentToken: "mock-card-ok" });
    setNewOpen(false); setNpPatient(""); toast("Subscription created");
  }

  const KPI = ({ label, value, intent }: { label: string; value: string; intent?: string }) => (
    <div className="bg-surface border border-border rounded-2xl px-4 py-3 min-w-[140px]"><div className={`text-[22px] font-extrabold leading-none ${intent || ""}`}>{value}</div><div className="text-[11px] text-ink-muted mt-1.5">{label}</div></div>
  );

  return (
    <div className="px-7 py-6 text-[14px]">
      <div className="flex items-center gap-3 mb-4 flex-wrap">
        <div><h1 className="text-[21px] font-extrabold tracking-tight">Subscriptions</h1><div className="text-[12px] text-ink-muted mt-0.5">Recurring billing & auto-refills</div></div>
        <div className="flex-1" /><button className="btn btn-primary btn-sm" onClick={() => setNewOpen(true)}>＋ New subscription</button>
      </div>

      <div className="flex flex-wrap gap-2.5 mb-4">
        <KPI label="MRR" value={money(mrr)} intent="text-green" />
        <KPI label="Active / Trialing" value={String(counts.active)} />
        <KPI label="Past due" value={String(counts.past_due)} intent={counts.past_due ? "text-red" : ""} />
        <KPI label="Paused / Canceled" value={String(counts.inactive)} />
      </div>

      <div className="flex gap-2 mb-3 flex-wrap">
        {(["all", "active", "past_due", "paused", "canceled", "trialing"] as const).map((f) => (
          <button key={f} onClick={() => setFilter(f)} className={`text-[12px] font-semibold px-3 py-1.5 rounded-full ${filter === f ? "bg-brand text-white" : "bg-surface-3 text-ink-muted"}`}>{f === "past_due" ? "Past due" : f[0].toUpperCase() + f.slice(1)}</button>
        ))}
      </div>

      <div className="bg-surface border border-border rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full border-collapse min-w-[820px]">
            <thead><tr className="bg-surface-2">{["Patient", "Plan", "Amount", "Status", "Next billing", "Card"].map((h) => <th key={h} className="text-left text-[10px] uppercase tracking-wide text-ink-muted font-bold px-3 py-2.5 border-b border-border">{h}</th>)}</tr></thead>
            <tbody>
              {list.map((s) => (
                <tr key={s.id} className="border-b border-border last:border-none hover:bg-surface-2 cursor-pointer" onClick={() => setOpenId(s.id)}>
                  <td className="px-3 py-2.5 font-semibold">{s.patientName}</td>
                  <td className="px-3 py-2.5">{s.planName}</td>
                  <td className="px-3 py-2.5">{money(s.amountCents)}<span className="text-ink-muted">/{s.interval === "quarterly" ? "qtr" : "mo"}</span></td>
                  <td className="px-3 py-2.5"><Pill intent={STATUS_INTENT[s.status]} dot>{label(s.status)}</Pill>{s.failedAttempts > 0 && <span className="ml-1.5 text-[11px] text-red">·{s.failedAttempts} fail</span>}</td>
                  <td className="px-3 py-2.5 text-ink-muted text-[12px] whitespace-nowrap">{fmt(s.nextBillingDate)}</td>
                  <td className="px-3 py-2.5 text-ink-muted">•••• {s.cardLast4}</td>
                </tr>
              ))}
              {list.length === 0 && <tr><td colSpan={6} className="px-3 py-10 text-center text-ink-muted text-[12px]">No subscriptions.</td></tr>}
            </tbody>
          </table>
        </div>
      </div>

      {sel && (
        <Modal open={!!sel} onClose={() => setOpenId(null)} title={sel.patientName} icon="🔁" width={580}
          footer={<div className="flex items-center gap-2 w-full flex-wrap">
            {sel.status === "past_due" && <><button className="btn btn-ghost" onClick={() => fixCard(sel)}>Update card</button><button className="btn btn-primary" onClick={() => runCharge(sel)} disabled={busy}>{busy ? "…" : "Retry payment"}</button></>}
            {sel.status === "active" && <button className="btn btn-primary" onClick={() => runCharge(sel)} disabled={busy}>{busy ? "…" : "Charge now"}</button>}
            {(sel.status === "active" || sel.status === "trialing") && <button className="btn btn-ghost" onClick={() => { setStatus(sel.id, "paused"); toast("Paused"); }}>Pause</button>}
            {sel.status === "paused" && <button className="btn btn-primary" onClick={() => { setStatus(sel.id, "active"); toast("Resumed"); }}>Resume</button>}
            <div className="flex-1" />
            {sel.status !== "canceled" && <button className="btn btn-ghost text-red" onClick={() => { setStatus(sel.id, "canceled"); toast("Canceled"); }}>Cancel</button>}
          </div>}>
          <div className="flex items-center gap-2 mb-3"><Pill intent={STATUS_INTENT[sel.status]} dot>{label(sel.status)}</Pill><span className="text-[13px] font-semibold">{sel.planName}</span><span className="text-ink-muted">· {money(sel.amountCents)}/{sel.interval === "quarterly" ? "qtr" : "mo"}</span></div>
          {sel.status === "past_due" && <div className="mb-3 px-3 py-2 rounded-md bg-red-soft text-red text-[12px] font-medium">⚠ Payment failed {sel.failedAttempts}× — update the card and retry, or the subscription will keep dunning.</div>}
          <div className="grid grid-cols-2 gap-x-6 gap-y-1 text-[12.5px] mb-3">
            <div className="flex justify-between border-b border-surface-3 py-1"><span className="text-ink-muted">Medication</span><span>{sel.med}</span></div>
            <div className="flex justify-between border-b border-surface-3 py-1"><span className="text-ink-muted">Card</span><span>•••• {sel.cardLast4}</span></div>
            <div className="flex justify-between border-b border-surface-3 py-1"><span className="text-ink-muted">Started</span><span>{fmt(sel.startedAt)}</span></div>
            <div className="flex justify-between border-b border-surface-3 py-1"><span className="text-ink-muted">Next billing</span><span>{fmt(sel.nextBillingDate)}</span></div>
          </div>
          <div className="text-[10px] uppercase tracking-wide text-ink-muted font-bold mb-1.5">Billing history</div>
          {sel.cycles.length === 0 ? <div className="text-[12px] text-ink-muted">No charges yet.</div> : (
            <div className="space-y-1">
              {sel.cycles.map((c) => (
                <div key={c.id} className="flex items-center justify-between text-[12.5px] border-b border-surface-3 py-1">
                  <span>{fmt(c.date)}</span><span className="font-mono text-ink-muted">{c.paymentId || "—"}</span>
                  <span className="font-semibold">{money(c.amountCents)}</span>
                  <Pill intent={c.status === "paid" ? "green" : c.status === "failed" ? "red" : "muted"}>{c.status}</Pill>
                </div>
              ))}
            </div>
          )}
          <div className="mt-3 text-[11px] text-ink-muted-2">A successful charge advances the next billing date and queues an auto-refill.</div>
        </Modal>
      )}

      <Modal open={newOpen} onClose={() => setNewOpen(false)} title="New subscription" icon="🔁" width={440}
        footer={<><button className="btn btn-ghost" onClick={() => setNewOpen(false)}>Cancel</button><button className="btn btn-primary" onClick={createSub}>Create</button></>}>
        <label className="fl">Patient</label>
        <select className="fsel w-full mb-2.5" value={npPatient} onChange={(e) => setNpPatient(e.target.value)}><option value="">— choose —</option>{patients.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</select>
        <label className="fl">Plan</label>
        <select className="fsel w-full" value={npPlan} onChange={(e) => setNpPlan(e.target.value)}>{PLANS.map((p) => <option key={p.id} value={p.id}>{p.name} — {money(p.amountCents)}</option>)}</select>
      </Modal>
      <Toast />
    </div>
  );
}
