"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { Pill } from "@/components/ui/Pill";
import { Toast } from "@/components/ui/Toast";
import { toast } from "@/lib/hooks/useToast";
import { useAffiliates } from "@/lib/hooks/useAffiliates";
import { usePatients } from "@/lib/hooks/usePatients";
import { EditAffiliateModal } from "@/components/modules/EditAffiliateModal";
import { attributedPatients, referralLink, campaignLink, recentVisits } from "@/lib/data/affiliateAttribution";
import type { AffiliateStatus } from "@/lib/types";

const STATUS_INTENT: Record<AffiliateStatus, "green" | "amber" | "blue" | "muted"> = { active: "green", paused: "amber", pending: "blue", terminated: "muted" };

function copy(text: string, label: string) {
  navigator.clipboard?.writeText(text).then(() => toast(`📋 ${label} copied`)).catch(() => toast("Copy failed"));
}

export default function AffiliateDetailPage() {
  const params = useParams();
  const id = String(params.id);
  const affiliates = useAffiliates((s) => s.affiliates);
  const update = useAffiliates((s) => s.update);
  const payCommission = useAffiliates((s) => s.payCommission);
  const patients = usePatients((s) => s.patients);

  const affiliate = affiliates.find((a) => a.id === id);
  const [editOpen, setEditOpen] = useState(false);
  const [cookieDraft, setCookieDraft] = useState<number | null>(null);

  const refPatients = useMemo(() => (affiliate ? attributedPatients(affiliate, affiliates, patients) : []), [affiliate, affiliates, patients]);
  const visits = useMemo(() => (affiliate ? recentVisits(affiliate) : []), [affiliate]);

  if (!affiliate) {
    return (
      <div className="px-7 py-6">
        <Link href="/affiliate" className="text-[13px] text-brand font-semibold">← Back to affiliates</Link>
        <div className="mt-8 text-center text-ink-muted">Affiliate <span className="font-mono">{id}</span> not found.</div>
      </div>
    );
  }

  const a = affiliate;
  const clicks = a.clickThroughs30d ?? 0;
  const convRate = clicks > 0 ? ((a.conversions30d / clicks) * 100).toFixed(1) : "—";
  const link = referralLink(a);
  const cookie = cookieDraft ?? a.cookieWindow ?? 30;

  function saveCookie() {
    update(a.id, { cookieWindow: cookie });
    setCookieDraft(null);
    toast(`🍪 Cookie window set to ${cookie} days`);
  }
  function pay() {
    const p = payCommission(a.id, "Stripe Transfer", "Current period");
    toast(p ? `💸 Paid $${p.amount.toLocaleString()} to ${a.name}` : "No pending commission");
  }

  return (
    <div className="px-7 py-6 text-[14px]">
      <Link href="/affiliate" className="text-[13px] text-brand font-semibold">← Back to affiliates</Link>

      {/* Header */}
      <div className="flex items-center gap-3.5 mt-3 mb-5 flex-wrap">
        <div className="w-12 h-12 rounded-2xl flex items-center justify-center text-[18px] font-extrabold text-white flex-shrink-0" style={{ background: a.color }}>
          {a.name.slice(0, 1)}
        </div>
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="text-[21px] font-extrabold tracking-tight">{a.name}</h1>
            <Pill intent={STATUS_INTENT[a.status]} dot>{a.status}</Pill>
          </div>
          <div className="text-[12.5px] text-ink-muted">{a.handle} · {a.type} · joined {a.joinedDate}</div>
        </div>
        <div className="flex-1" />
        {a.commissionPending > 0 && a.status === "active" && <button className="btn btn-primary btn-sm" onClick={pay}>💸 Pay ${a.commissionPending.toLocaleString()}</button>}
        <button className="btn btn-ghost btn-sm" onClick={() => setEditOpen(true)}>✏️ Edit Affiliate</button>
      </div>

      {/* KPI row */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-2.5 mb-5">
        <Kpi label="Commission set" value={`${a.commissionRate}%`} />
        <Kpi label="Commission pending" value={`$${a.commissionPending.toLocaleString()}`} color="text-violet" />
        <Kpi label="Commission paid (all-time)" value={`$${a.commissionPaidAllTime.toLocaleString()}`} color="text-green" />
        <Kpi label="Patients brought in" value={a.conversionsAllTime.toLocaleString()} sub={`${a.conversions30d} in 30d`} />
        <Kpi label="Visits (30d)" value={clicks.toLocaleString()} color="text-blue" />
        <Kpi label="Conversion rate" value={convRate === "—" ? "—" : `${convRate}%`} sub="30d clicks → signups" />
      </div>

      <div className="grid lg:grid-cols-2 gap-4 mb-4">
        {/* Tracking & promo */}
        <div className="card p-4">
          <div className="text-[13px] font-bold text-ink mb-3">🔗 Tracking & Promo</div>

          <label className="fl">Referral link</label>
          <div className="flex gap-2 mb-3">
            <input className="fi font-mono text-[12px] flex-1" readOnly value={link} onFocus={(e) => e.currentTarget.select()} />
            <button className="btn btn-ghost btn-sm" onClick={() => copy(link, "Referral link")}>Copy</button>
          </div>

          <label className="fl">Promo code</label>
          <div className="flex gap-2 mb-3">
            <div className="fi flex-1 font-mono font-bold text-[14px] tracking-wide flex items-center" style={{ color: a.color }}>{a.code}</div>
            <button className="btn btn-ghost btn-sm" onClick={() => copy(a.code, "Promo code")}>Copy</button>
          </div>

          <label className="fl">UTM campaign link</label>
          <div className="flex gap-2 mb-3">
            <input className="fi font-mono text-[11px] flex-1" readOnly value={campaignLink(a)} onFocus={(e) => e.currentTarget.select()} />
            <button className="btn btn-ghost btn-sm" onClick={() => copy(campaignLink(a), "Campaign link")}>Copy</button>
          </div>

          <label className="fl">Cookie attribution window</label>
          <div className="flex items-center gap-2">
            <input className="fi w-24" type="number" min={1} max={365} value={cookie} onChange={(e) => setCookieDraft(parseInt(e.target.value, 10) || 0)} />
            <span className="text-[12px] text-ink-muted">days</span>
            <div className="flex-1" />
            {cookieDraft != null && cookieDraft !== (a.cookieWindow ?? 30) && <button className="btn btn-primary btn-sm" onClick={saveCookie}>Save</button>}
          </div>
          <div className="text-[11px] text-ink-muted mt-1.5">Visits from this link/code are credited to {a.name} for {cookie} days after the click.</div>
        </div>

        {/* Patients brought in */}
        <div className="card p-4">
          <div className="flex items-center gap-2 mb-3">
            <div className="text-[13px] font-bold text-ink">👥 Patients Referred</div>
            <Pill intent="muted">{refPatients.length} in system</Pill>
          </div>
          {refPatients.length === 0 ? (
            <div className="py-6 text-center text-[12.5px] text-ink-muted">No patient records attributed to this code yet.</div>
          ) : (
            <div className="-mx-1">
              {refPatients.map((p) => (
                <Link key={p.id} href={`/patients/${p.id}`} className="flex items-center gap-2.5 px-1 py-2 border-b border-border last:border-none hover:bg-surface-2 rounded transition-colors">
                  <div className="w-7 h-7 rounded-full bg-surface-3 flex items-center justify-center text-[11px] font-bold text-ink-2 flex-shrink-0">{p.first.slice(0, 1)}{p.last.slice(0, 1)}</div>
                  <div className="flex-1 min-w-0">
                    <div className="text-[13px] font-semibold text-ink truncate">{p.name}</div>
                    <div className="text-[11px] text-ink-muted">{p.plan} · {p.state}</div>
                  </div>
                  <Pill intent={p.status === "active" ? "green" : "muted"}>{p.status}</Pill>
                </Link>
              ))}
            </div>
          )}
          <div className="text-[11px] text-ink-muted mt-2">Lifetime conversions ({a.conversionsAllTime.toLocaleString()}) include historical signups not retained as active records.</div>
        </div>
      </div>

      {/* Visit / cookie tracking feed */}
      <div className="card p-4 mb-4">
        <div className="text-[13px] font-bold text-ink mb-3">📊 Recent Tracked Visits</div>
        <div className="overflow-x-auto -mx-4">
          <table className="w-full border-collapse min-w-[560px] text-[12.5px]">
            <thead><tr className="bg-surface-2">{["When", "Source", "Landing page", "Device", "Result"].map((h) => <th key={h} className="text-left text-[10px] uppercase tracking-wide text-ink-muted font-bold px-4 py-2 border-b border-border">{h}</th>)}</tr></thead>
            <tbody>
              {visits.map((v) => (
                <tr key={v.id} className="border-b border-border last:border-none">
                  <td className="px-4 py-2 font-mono text-[11.5px] text-ink-muted">{v.whenLabel}</td>
                  <td className="px-4 py-2">{v.source}</td>
                  <td className="px-4 py-2 font-mono text-[11.5px]">{v.landing}</td>
                  <td className="px-4 py-2 text-ink-2">{v.device}</td>
                  <td className="px-4 py-2">{v.converted ? <Pill intent="green" dot>Converted</Pill> : <Pill intent="muted">Click</Pill>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Payout history */}
      <div className="card p-4">
        <div className="text-[13px] font-bold text-ink mb-3">💸 Payout History</div>
        {a.payouts.length === 0 ? (
          <div className="py-6 text-center text-[12.5px] text-ink-muted">No payouts yet.</div>
        ) : (
          <div className="overflow-x-auto -mx-4">
            <table className="w-full border-collapse min-w-[560px] text-[12.5px]">
              <thead><tr className="bg-surface-2">{["Date", "Period", "Amount", "Method", "Reference"].map((h) => <th key={h} className="text-left text-[10px] uppercase tracking-wide text-ink-muted font-bold px-4 py-2 border-b border-border">{h}</th>)}</tr></thead>
              <tbody>
                {a.payouts.map((p) => (
                  <tr key={p.id} className="border-b border-border last:border-none">
                    <td className="px-4 py-2 text-ink-muted">{p.date}</td>
                    <td className="px-4 py-2">{p.period}</td>
                    <td className="px-4 py-2 font-mono font-semibold text-green">${p.amount.toLocaleString()}</td>
                    <td className="px-4 py-2">{p.method}</td>
                    <td className="px-4 py-2 font-mono text-[11px] text-ink-muted">{p.reference}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <EditAffiliateModal affiliate={a} open={editOpen} onClose={() => setEditOpen(false)} />
      <Toast />
    </div>
  );
}

function Kpi({ label, value, sub, color }: { label: string; value: string; sub?: string; color?: string }) {
  return (
    <div className="bg-surface border border-border rounded-2xl px-3.5 py-3">
      <div className={`text-[19px] font-extrabold leading-none ${color || "text-ink"}`}>{value}</div>
      <div className="text-[11px] text-ink-muted mt-1.5">{label}</div>
      {sub && <div className="text-[10.5px] text-ink-muted-2 mt-0.5">{sub}</div>}
    </div>
  );
}
