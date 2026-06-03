"use client";

import { useMemo } from "react";
import { usePatients } from "@/lib/hooks/usePatients";
import { useLeads } from "@/lib/hooks/useLeads";
import { useSubscriptions } from "@/lib/hooks/useSubscriptions";
import { useIntake } from "@/lib/hooks/useIntake";
import { monthlyValue } from "@/lib/subscriptions/util";
import { MONTHS, MRR_SERIES, NEW_SUBS, CHURNED_SUBS, SPEND, money, pct } from "@/lib/analytics/data";

export default function AnalyticsPage() {
  const patients = usePatients((s) => s.patients);
  const leads = useLeads((s) => s.leads);
  const subs = useSubscriptions((s) => s.subscriptions);
  const intakes = useIntake((s) => s.submissions);

  const m = useMemo(() => {
    const mrr = subs.reduce((a, s) => a + monthlyValue(s), 0) / 100;
    const active = subs.filter((s) => s.status === "active" || s.status === "trialing").length;
    const canceled = subs.filter((s) => s.status === "canceled").length;
    const churn = subs.length ? canceled / subs.length : 0;
    const arpu = active ? mrr / active : 0;
    const ltv = churn > 0 ? arpu / churn : arpu * 24;
    const newThisMonth = NEW_SUBS[NEW_SUBS.length - 1];
    const cac = newThisMonth ? SPEND[SPEND.length - 1] / newThisMonth : 0;
    const conversion = (patients.length + leads.length) ? patients.length / (patients.length + leads.length) : 0;
    return { mrr, active, churn, arpu, ltv, cac, conversion };
  }, [subs, patients, leads]);

  // revenue by medication (live)
  const byMed = useMemo(() => {
    const map: Record<string, number> = {};
    subs.forEach((s) => { const v = monthlyValue(s) / 100; if (v) map[s.med] = (map[s.med] || 0) + v; });
    const total = Object.values(map).reduce((a, b) => a + b, 0) || 1;
    return Object.entries(map).map(([med, v]) => ({ med, v, share: v / total })).sort((a, b) => b.v - a.v);
  }, [subs]);

  // funnel (live counts)
  const funnel = useMemo(() => {
    const approved = intakes.filter((i) => i.status === "approved").length;
    const activeSubs = subs.filter((s) => s.status === "active" || s.status === "trialing").length;
    return [
      { label: "Leads", value: leads.length + patients.length },
      { label: "Intakes submitted", value: intakes.length },
      { label: "Approved", value: Math.max(approved, 1) },
      { label: "Active subscribers", value: activeSubs },
    ];
  }, [leads, patients, intakes, subs]);

  const KPI = ({ label, value, sub, intent }: { label: string; value: string; sub?: string; intent?: string }) => (
    <div className="bg-surface border border-border rounded-2xl px-4 py-3.5 min-w-[150px] flex-1">
      <div className="text-[11px] text-ink-muted mb-1">{label}</div>
      <div className={`text-[23px] font-extrabold tracking-tight leading-none ${intent || ""}`}>{value}</div>
      {sub && <div className="text-[11px] text-ink-muted mt-1">{sub}</div>}
    </div>
  );

  const PALETTE = ["#2f6df6", "#0e9f6e", "#7c3aed", "#f59e0b", "#0ea5e9"];
  const maxMrr = Math.max(...MRR_SERIES);
  const maxBars = Math.max(...NEW_SUBS, ...CHURNED_SUBS);
  const funnelMax = Math.max(...funnel.map((f) => f.value), 1);

  // line chart points for MRR
  const W = 520, H = 150, pad = 8;
  const pts = MRR_SERIES.map((v, i) => {
    const x = pad + (i * (W - pad * 2)) / (MRR_SERIES.length - 1);
    const y = H - pad - (v / maxMrr) * (H - pad * 2);
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  }).join(" ");

  return (
    <div className="px-7 py-6 text-[14px]">
      <h1 className="text-[21px] font-extrabold tracking-tight">Analytics</h1>
      <div className="text-[12px] text-ink-muted mt-0.5 mb-4">Revenue, retention, and funnel performance</div>

      <div className="flex flex-wrap gap-2.5 mb-3">
        <KPI label="MRR" value={money(m.mrr)} sub="current monthly recurring" intent="text-green" />
        <KPI label="Active subscribers" value={String(m.active)} />
        <KPI label="ARPU" value={money(m.arpu)} sub="avg revenue / user" />
        <KPI label="Churn rate" value={pct(m.churn)} intent={m.churn > 0.1 ? "text-red" : ""} />
      </div>
      <div className="flex flex-wrap gap-2.5 mb-5">
        <KPI label="LTV" value={money(m.ltv)} sub="ARPU ÷ churn" />
        <KPI label="CAC" value={money(m.cac)} sub="last month" />
        <KPI label="LTV : CAC" value={(m.cac ? m.ltv / m.cac : 0).toFixed(1) + "x"} intent="text-green" />
        <KPI label="Lead → patient" value={pct(m.conversion)} />
      </div>

      <div className="grid grid-cols-2 gap-3 mb-3">
        {/* MRR trend line */}
        <div className="bg-surface border border-border rounded-xl p-4">
          <div className="font-bold text-[13px] mb-3">MRR trend</div>
          <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-[150px]">
            <polyline fill="none" stroke="#2f6df6" strokeWidth="2.5" points={pts} />
            {MRR_SERIES.map((v, i) => { const x = pad + (i * (W - pad * 2)) / (MRR_SERIES.length - 1); const y = H - pad - (v / maxMrr) * (H - pad * 2); return <circle key={i} cx={x} cy={y} r="3" fill="#2f6df6" />; })}
          </svg>
          <div className="flex justify-between text-[10px] text-ink-muted mt-1">{MONTHS.map((mo) => <span key={mo}>{mo}</span>)}</div>
        </div>

        {/* New vs churned */}
        <div className="bg-surface border border-border rounded-xl p-4">
          <div className="font-bold text-[13px] mb-3">New vs. churned subscribers</div>
          <div className="flex items-end justify-between gap-2 h-[150px]">
            {MONTHS.map((mo, i) => (
              <div key={mo} className="flex-1 flex flex-col items-center justify-end gap-1 h-full">
                <div className="flex items-end gap-0.5 h-full w-full justify-center">
                  <div className="w-3 rounded-t bg-brand" style={{ height: `${(NEW_SUBS[i] / maxBars) * 100}%` }} title={`New ${NEW_SUBS[i]}`} />
                  <div className="w-3 rounded-t bg-red/70" style={{ height: `${(CHURNED_SUBS[i] / maxBars) * 100}%` }} title={`Churned ${CHURNED_SUBS[i]}`} />
                </div>
                <span className="text-[10px] text-ink-muted">{mo}</span>
              </div>
            ))}
          </div>
          <div className="flex gap-4 text-[11px] text-ink-muted mt-2"><span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-sm bg-brand inline-block" /> New</span><span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-sm bg-red/70 inline-block" /> Churned</span></div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        {/* Revenue by medication */}
        <div className="bg-surface border border-border rounded-xl p-4">
          <div className="font-bold text-[13px] mb-3">Recurring revenue by medication</div>
          {byMed.length === 0 ? <div className="text-[12px] text-ink-muted">No active subscriptions.</div> : byMed.map((b, i) => (
            <div key={b.med} className="mb-2.5">
              <div className="flex justify-between text-[12px] mb-1"><span>{b.med}</span><span className="font-semibold">{money(b.v)}/mo · {pct(b.share)}</span></div>
              <div className="h-2.5 rounded-full bg-surface-3 overflow-hidden"><div className="h-full rounded-full" style={{ width: `${b.share * 100}%`, background: PALETTE[i % PALETTE.length] }} /></div>
            </div>
          ))}
        </div>

        {/* Funnel */}
        <div className="bg-surface border border-border rounded-xl p-4">
          <div className="font-bold text-[13px] mb-3">Acquisition funnel</div>
          {funnel.map((f, i) => (
            <div key={f.label} className="mb-2.5">
              <div className="flex justify-between text-[12px] mb-1"><span>{f.label}</span><span className="font-semibold">{f.value}{i > 0 && funnel[0].value ? ` · ${pct(f.value / funnel[0].value)}` : ""}</span></div>
              <div className="h-6 rounded-md bg-surface-3 overflow-hidden"><div className="h-full rounded-md flex items-center" style={{ width: `${Math.max(6, (f.value / funnelMax) * 100)}%`, background: PALETTE[i % PALETTE.length] }} /></div>
            </div>
          ))}
        </div>
      </div>
      <div className="text-[11px] text-ink-muted-2 mt-3">MRR, ARPU, churn, revenue mix, and the funnel are computed live from the Subscriptions, Patients, Leads, and Intake data; the trend series are seeded for the prototype.</div>
    </div>
  );
}
