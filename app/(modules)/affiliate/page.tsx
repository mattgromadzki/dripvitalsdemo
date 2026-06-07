"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import type { Key, ReactNode } from "react";
import { Pill } from "@/components/ui/Pill";
import { Toast } from "@/components/ui/Toast";
import { KpiCard, KpiGrid } from "@/components/ui/Kpi";
import { ConfirmModal } from "@/components/ui/ConfirmModal";
import { NewAffiliateModal } from "@/components/modules/NewAffiliateModal";
import { PayCommissionModal } from "@/components/modules/PayCommissionModal";
import { toast } from "@/lib/hooks/useToast";
import { useAffiliates } from "@/lib/hooks/useAffiliates";
import type { Affiliate, AffiliateStatus, AffiliateType, AffiliatePayout } from "@/lib/types";

const STATUS_LABEL: Record<AffiliateStatus, string> = {
  active:     "Active",
  paused:     "⏸ Paused",
  pending:    "⏳ Pending",
  terminated: "Terminated",
};

const STATUS_INTENT: Record<AffiliateStatus, "green" | "amber" | "blue" | "muted"> = {
  active:     "green",
  paused:     "amber",
  pending:    "blue",
  terminated: "muted",
};

const TYPE_INTENT: Record<AffiliateType, "pink" | "brand" | "green" | "purple" | "blue" | "teal" | "muted"> = {
  "Influencer":         "pink",
  "Doctor":             "brand",
  "Health Coach":       "green",
  "Podcast":            "purple",
  "Press":              "blue",
  "Affiliate Network":  "teal",
  "Other":              "muted",
};

const TYPE_ICON: Record<AffiliateType, string> = {
  "Influencer":         "✨",
  "Doctor":             "👨‍⚕️",
  "Health Coach":       "💪",
  "Podcast":            "🎙",
  "Press":              "📰",
  "Affiliate Network":  "🌐",
  "Other":              "🏆",
};

export default function AffiliatesPage() {
  const affiliates = useAffiliates((s) => s.affiliates);
  const addAff     = useAffiliates((s) => s.add);
  const setStatus  = useAffiliates((s) => s.setStatus);
  const updateRate = useAffiliates((s) => s.updateCommissionRate);
  const payCommission = useAffiliates((s) => s.payCommission);
  const remove     = useAffiliates((s) => s.remove);

  const [typeFilter, setTypeFilter]     = useState<"all" | AffiliateType>("all");
  const [statusFilter, setStatusFilter] = useState<"all" | AffiliateStatus>("all");
  const [search, setSearch]             = useState("");
  const [expandedId, setExpandedId]     = useState<string | null>(null);
  const [newOpen, setNewOpen]           = useState(false);
  const [payTarget, setPayTarget]       = useState<Affiliate | null>(null);
  const [removeTarget, setRemoveTarget] = useState<Affiliate | null>(null);

  // KPIs
  const metrics = useMemo(() => {
    const active = affiliates.filter((a) => a.status === "active");
    const conv30d = affiliates.reduce((sum, a) => sum + a.conversions30d, 0);
    const rev30d = affiliates.reduce((sum, a) => sum + a.revenue30d, 0);
    const commPaid = affiliates.reduce((sum, a) => sum + a.commissionPaidAllTime, 0);
    const commPending = affiliates.reduce((sum, a) => sum + a.commissionPending, 0);
    const totalClicks = affiliates.reduce((sum, a) => sum + (a.clickThroughs30d || 0), 0);
    const convRate = totalClicks > 0 ? (conv30d / totalClicks) * 100 : 0;

    return {
      total: affiliates.length,
      active: active.length,
      paused: affiliates.filter((a) => a.status === "paused").length,
      pending: affiliates.filter((a) => a.status === "pending").length,
      conv30d,
      rev30d,
      commPaid,
      commPending,
      convRate,
      totalClicks,
    };
  }, [affiliates]);

  // Top performers leaderboard
  const topPerformers = useMemo(() => {
    return [...affiliates]
      .filter((a) => a.status === "active" && a.revenue30d > 0)
      .sort((a, b) => b.revenue30d - a.revenue30d)
      .slice(0, 3);
  }, [affiliates]);

  // Type counts for filter chips
  const typeCounts = useMemo(() => {
    const map: Record<string, number> = {};
    for (const a of affiliates) map[a.type] = (map[a.type] || 0) + 1;
    return map;
  }, [affiliates]);

  // Filtered list
  const filtered = useMemo(() => {
    let list = affiliates;
    if (typeFilter !== "all")   list = list.filter((a) => a.type === typeFilter);
    if (statusFilter !== "all") list = list.filter((a) => a.status === statusFilter);
    if (search) {
      const q = search.toLowerCase();
      list = list.filter((a) =>
        a.name.toLowerCase().includes(q) ||
        a.handle.toLowerCase().includes(q) ||
        a.code.toLowerCase().includes(q) ||
        a.type.toLowerCase().includes(q)
      );
    }
    return [...list].sort((a, b) => b.revenue30d - a.revenue30d);
  }, [affiliates, typeFilter, statusFilter, search]);

  function handleCopy(code: string) {
    if (typeof navigator !== "undefined" && navigator.clipboard) {
      navigator.clipboard.writeText(code).catch(() => {});
    }
    toast(`📋 Code copied: ${code}`);
  }

  function handlePay(method: AffiliatePayout["method"], period: string) {
    if (!payTarget) return;
    const payout = payCommission(payTarget.id, method, period);
    if (payout) {
      toast(`💸 Paid $${payout.amount.toLocaleString()} to ${payTarget.name} · ${method}`);
    }
    setPayTarget(null);
  }

  function exportCsv() {
    const header = ["Affiliate ID", "Name", "Handle", "Type", "Code", "Status", "Commission Rate", "Joined", "Conv 30d", "Conv All-time", "Rev 30d", "Rev All-time", "Comm Pending", "Comm Paid All-time"];
    const rows = filtered.map((a) => [
      a.id,
      `"${a.name.replace(/"/g, '""')}"`,
      `"${a.handle.replace(/"/g, '""')}"`,
      a.type, a.code, a.status,
      `${a.commissionRate}%`,
      a.joinedDate,
      a.conversions30d, a.conversionsAllTime,
      a.revenue30d, a.revenueAllTime,
      a.commissionPending, a.commissionPaidAllTime,
    ].join(","));
    const csv = [header.join(","), ...rows].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `dripvitals_affiliates_${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    toast(`📥 Exported ${filtered.length} affiliates to CSV`);
  }

  return (
    <div className="px-7 py-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 mb-5 flex-wrap">
        <div>
          <div className="text-[22px] font-bold tracking-tight text-ink mb-1">Affiliate Program</div>
          <div className="text-[13px] text-ink-muted">
            {metrics.active} active affiliates · Conversion tracking · Commission payouts
          </div>
        </div>
        <div className="flex gap-2">
          <button className="btn btn-ghost btn-sm" onClick={exportCsv}>📥 Export CSV</button>
          <button className="btn btn-ghost btn-sm" onClick={() => toast("🔗 Affiliate program landing page link copied")}>
            🔗 Share Program Link
          </button>
          <button className="btn btn-primary btn-sm" onClick={() => setNewOpen(true)}>+ Add Affiliate</button>
        </div>
      </div>

      {/* KPI strip */}
      <KpiGrid cols={5}>
        <KpiCard
          label="Active Affiliates"
          value={metrics.active}
          icon="👥"
          iconBg="var(--color-brand-soft)"
          iconColor="var(--color-brand)"
          trend={`${metrics.pending} pending · ${metrics.paused} paused`}
          trendColor="var(--color-brand)"
        />
        <KpiCard
          label="Conversions (30d)"
          value={metrics.conv30d}
          icon="🎯"
          iconBg="var(--color-green-soft)"
          iconColor="var(--color-green)"
          trend={`${metrics.totalClicks.toLocaleString()} clicks`}
          trendColor="var(--color-green)"
        />
        <KpiCard
          label="Revenue Attributed"
          value={`$${(metrics.rev30d / 1000).toFixed(1)}K`}
          icon="💰"
          iconBg="var(--color-amber-soft)"
          iconColor="var(--color-amber)"
          trend="Last 30 days"
          trendColor="var(--color-amber)"
        />
        <KpiCard
          label="Pending Payouts"
          value={`$${(metrics.commPending / 1000).toFixed(1)}K`}
          icon="💸"
          iconBg="var(--color-violet-soft)"
          iconColor="var(--color-violet)"
          trend={`$${(metrics.commPaid / 1000).toFixed(1)}K paid LTD`}
          trendColor="var(--color-violet)"
        />
        <KpiCard
          label="Conversion Rate"
          value={`${metrics.convRate.toFixed(1)}%`}
          icon="📈"
          iconBg="var(--color-teal-soft)"
          iconColor="var(--color-teal)"
          trend="Click → enrollment"
          trendColor="var(--color-teal)"
        />
      </KpiGrid>

      {/* Top performers */}
      {topPerformers.length > 0 && (
        <div className="bg-surface border border-border rounded-lg p-4 mb-4">
          <div className="text-[10.5px] font-bold uppercase tracking-widest text-ink-muted mb-3">🏆 Top Performers · Last 30 Days</div>
          <div className="grid grid-cols-3 gap-3 max-[700px]:grid-cols-1">
            {topPerformers.map((a, i) => (
              <div key={a.id} className="flex items-center gap-3 bg-surface-2 border border-border rounded-md p-3">
                <div className="flex-shrink-0 text-[20px]">
                  {i === 0 ? "🥇" : i === 1 ? "🥈" : "🥉"}
                </div>
                <div
                  className="w-10 h-10 rounded-full flex items-center justify-center text-[11px] font-bold text-white flex-shrink-0"
                  style={{ background: a.color }}
                >
                  {a.name.split(" ").map((s) => s[0]).join("").slice(0, 2)}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-[13px] font-bold truncate">{a.name}</div>
                  <div className="text-[11px] text-ink-muted truncate">{a.handle}</div>
                </div>
                <div className="text-right flex-shrink-0">
                  <div className="text-[14px] font-extrabold text-green leading-none">${(a.revenue30d / 1000).toFixed(1)}K</div>
                  <div className="text-[10.5px] text-ink-muted mt-0.5">{a.conversions30d} conv.</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Type filter chips + status + search */}
      <div className="flex items-center gap-2 mb-4 flex-wrap">
        <button
          onClick={() => setTypeFilter("all")}
          className={[
            "py-1.5 px-3 rounded-pill text-[11.5px] font-semibold border transition-colors",
            typeFilter === "all" ? "bg-brand text-white border-brand" : "bg-surface border-border text-ink-2 hover:border-border-2",
          ].join(" ")}
        >
          All Types ({affiliates.length})
        </button>
        {(Object.keys(typeCounts) as AffiliateType[]).map((t) => (
          <button
            key={t}
            onClick={() => setTypeFilter(typeFilter === t ? "all" : t)}
            className={[
              "py-1.5 px-3 rounded-pill text-[11.5px] font-semibold border transition-colors flex items-center gap-1.5",
              typeFilter === t ? "bg-brand text-white border-brand" : "bg-surface border-border text-ink-2 hover:border-border-2",
            ].join(" ")}
          >
            <span>{TYPE_ICON[t]}</span>
            <span>{t}</span>
            <span
              className={[
                "inline-flex items-center justify-center min-w-[18px] h-[17px] px-1 rounded-pill text-[10px] font-bold",
                typeFilter === t ? "bg-white/20 text-white" : "bg-surface-3 text-ink-muted",
              ].join(" ")}
            >
              {typeCounts[t]}
            </span>
          </button>
        ))}
        <div className="w-px h-5 bg-border mx-1" />
        <select
          className="fsel"
          style={{ width: 130, padding: "6px 26px 6px 12px", fontSize: 12 }}
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as typeof statusFilter)}
        >
          <option value="all">All Statuses</option>
          <option value="active">Active</option>
          <option value="paused">Paused</option>
          <option value="pending">Pending</option>
          <option value="terminated">Terminated</option>
        </select>
        <div className="flex items-center gap-1.5 bg-surface border border-border rounded-pill py-1 px-3.5 ml-auto min-w-[240px] focus-within:border-brand focus-within:shadow-[0_0_0_3px_rgba(31,138,112,.18)]">
          <span className="text-ink-muted text-[13px]">🔍</span>
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search affiliate, code, handle…"
            className="flex-1 bg-transparent border-none outline-none text-[12px] text-ink placeholder:text-ink-muted"
          />
        </div>
      </div>

      {/* Table */}
      <div className="bg-surface border border-border rounded-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-[13px]">
            <thead className="bg-surface-2">
              <tr>
                <Th>Affiliate</Th>
                <Th>Code</Th>
                <Th>Type</Th>
                <Th>Conv (30d)</Th>
                <Th>Revenue (30d)</Th>
                <Th>Rate</Th>
                <Th>Commission</Th>
                <Th>Status</Th>
                <Th>{""}</Th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-12 text-center text-ink-muted">
                    <div className="text-[36px] opacity-40 mb-2">🏆</div>
                    <div className="text-[13px] font-bold text-ink mb-0.5">No affiliates match</div>
                    <div className="text-[11.5px]">Try a different filter or search term</div>
                  </td>
                </tr>
              ) : (
                filtered.map((a, i) => (
                  <AffiliateRow
                    key={a.id}
                    affiliate={a}
                    expanded={expandedId === a.id}
                    onToggle={() => setExpandedId(expandedId === a.id ? null : a.id)}
                    onCopyCode={() => handleCopy(a.code)}
                    onPay={() => setPayTarget(a)}
                    onPause={() => {
                      setStatus(a.id, "paused");
                      toast(`⏸ ${a.name} paused — promo code disabled`);
                    }}
                    onResume={() => {
                      setStatus(a.id, "active");
                      toast(`▶ ${a.name} resumed — promo code active`);
                    }}
                    onActivate={() => {
                      setStatus(a.id, "active");
                      toast(`✓ ${a.name} activated`);
                    }}
                    onUpdateRate={(rate) => {
                      updateRate(a.id, rate);
                      toast(`⚙ ${a.name} commission rate updated to ${rate}%`);
                    }}
                    onRemove={() => setRemoveTarget(a)}
                    delay={i * 20}
                  />
                ))
              )}
            </tbody>
          </table>
        </div>
        <div className="py-2.5 px-[18px] border-t border-border bg-surface-2 flex items-center justify-between text-[11.5px] text-ink-muted">
          <span>Showing {filtered.length} of {affiliates.length} affiliates</span>
          <span>Pending payouts: <strong className="text-violet">${metrics.commPending.toLocaleString()}</strong></span>
        </div>
      </div>

      <NewAffiliateModal
        open={newOpen}
        onClose={() => setNewOpen(false)}
        onCreate={(a) => {
          const created = addAff(a);
          toast(`✓ Affiliate created · ${created.name} · code ${created.code}`);
        }}
      />
      <PayCommissionModal
        affiliate={payTarget}
        onClose={() => setPayTarget(null)}
        onPay={handlePay}
      />
      <ConfirmModal
        open={!!removeTarget}
        onClose={() => setRemoveTarget(null)}
        onConfirm={() => {
          if (removeTarget) {
            remove(removeTarget.id);
            toast(`🗑 ${removeTarget.name} removed from program`);
          }
        }}
        icon="🗑"
        title="Remove affiliate?"
        message={removeTarget ? `${removeTarget.name} will be removed from the program. Their promo code ${removeTarget.code} will be deactivated. Existing attributed conversions remain in your reports.` : ""}
        confirmLabel="Remove affiliate"
      />
      <Toast />
    </div>
  );
}

// ─── Affiliate row ────────────────────────────────────────────────────────
interface AffiliateRowProps {
  key?: Key;
  affiliate: Affiliate;
  expanded: boolean;
  onToggle: () => void;
  onCopyCode: () => void;
  onPay: () => void;
  onPause: () => void;
  onResume: () => void;
  onActivate: () => void;
  onUpdateRate: (rate: number) => void;
  onRemove: () => void;
  delay: number;
}

function AffiliateRow({ affiliate: a, expanded, onToggle, onCopyCode, onPay, onPause, onResume, onActivate, onUpdateRate, onRemove, delay }: AffiliateRowProps) {
  const initials = a.name.split(" ").map((s) => s[0]).join("").slice(0, 2);
  const isPending = a.status === "pending";

  return (
    <>
      <tr
        onClick={onToggle}
        className="cursor-pointer hover:bg-surface-2 transition-colors animate-fadeUp"
        style={{ animationDelay: `${delay}ms`, opacity: a.status === "terminated" ? 0.6 : 1 }}
      >
        <Td>
          <div className="flex items-center gap-2.5">
            <div
              className="w-8 h-8 rounded-full flex items-center justify-center text-[10px] font-bold text-white flex-shrink-0"
              style={{ background: a.color }}
            >
              {initials}
            </div>
            <div className="min-w-0">
              <Link
                href={`/affiliate/${a.id}`}
                onClick={(e) => e.stopPropagation()}
                className="block text-[12.5px] font-bold truncate hover:text-brand hover:underline"
              >
                {a.name}
              </Link>
              <div className="text-[10.5px] text-ink-muted truncate">{a.handle}</div>
            </div>
          </div>
        </Td>
        <Td>
          <button
            onClick={(e) => { e.stopPropagation(); onCopyCode(); }}
            className="font-mono text-[11.5px] font-bold py-1 px-2.5 rounded-md border border-brand-soft text-brand-dk hover:bg-brand-soft transition-colors"
            style={{ background: "rgba(31,138,112,.06)" }}
            title="Click to copy"
          >
            {a.code}
          </button>
        </Td>
        <Td>
          <Pill intent={TYPE_INTENT[a.type]}>
            <span className="mr-1">{TYPE_ICON[a.type]}</span> {a.type}
          </Pill>
        </Td>
        <Td>
          <div>
            <span className="font-mono text-[12.5px] font-bold">{a.conversions30d}</span>
            <span className="text-[10.5px] text-ink-muted ml-1">/ {a.conversionsAllTime} LTD</span>
          </div>
        </Td>
        <Td>
          <span className="font-mono text-[12.5px] font-bold text-green">${a.revenue30d.toLocaleString()}</span>
        </Td>
        <Td>
          <span className="font-mono text-[12px] text-ink">{a.commissionRate}%</span>
        </Td>
        <Td>
          <div>
            <span className="font-mono text-[12.5px] font-bold text-violet">${a.commissionPending.toLocaleString()}</span>
            <div className="text-[10px] text-ink-muted">pending</div>
          </div>
        </Td>
        <Td><Pill intent={STATUS_INTENT[a.status]} dot>{STATUS_LABEL[a.status]}</Pill></Td>
        <Td>
          <div className="flex gap-1">
            {a.commissionPending > 0 && a.status === "active" && (
              <button
                className="px-2.5 py-1 rounded-md bg-brand text-white text-[11px] font-bold hover:bg-brand-dk transition-colors"
                onClick={(e) => { e.stopPropagation(); onPay(); }}
              >
                💸 Pay
              </button>
            )}
            {isPending && (
              <button
                className="px-2.5 py-1 rounded-md bg-surface-2 border border-border text-[11px] font-semibold text-ink-2 hover:bg-brand-soft hover:border-brand hover:text-brand-dk transition-colors"
                onClick={(e) => { e.stopPropagation(); onActivate(); }}
              >
                ✓ Activate
              </button>
            )}
            <button
              className="px-2.5 py-1 rounded-md bg-surface-2 border border-border text-[11px] font-semibold text-ink-2 hover:bg-brand-soft hover:border-brand hover:text-brand-dk transition-colors"
              onClick={(e) => { e.stopPropagation(); onToggle(); }}
            >
              {expanded ? "Hide" : "View"}
            </button>
          </div>
        </Td>
      </tr>

      {expanded && (
        <tr>
          <td colSpan={9} className="py-[18px] px-[22px] border-b border-border-2" style={{ background: "#f8faff" }}>
            <div className="grid grid-cols-2 gap-4 mb-4 max-[900px]:grid-cols-1">
              {/* Stats card */}
              <div className="bg-surface border border-border rounded-md p-4">
                <div className="text-[10.5px] font-bold uppercase tracking-widest text-ink-muted mb-3">Performance · Lifetime</div>
                <div className="grid grid-cols-3 gap-2">
                  <StatBox label="Conversions"      value={a.conversionsAllTime.toString()} color="var(--color-green)" />
                  <StatBox label="Revenue"          value={`$${(a.revenueAllTime / 1000).toFixed(1)}K`} color="var(--color-brand)" />
                  <StatBox label="Commissions Paid" value={`$${a.commissionPaidAllTime.toLocaleString()}`} color="var(--color-violet)" />
                </div>
                <div className="grid grid-cols-3 gap-2 mt-2">
                  <StatBox label="Conv 30d"       value={a.conversions30d.toString()} color="var(--color-green)" small />
                  <StatBox label="Clicks 30d"     value={(a.clickThroughs30d || 0).toLocaleString()} color="var(--color-blue)" small />
                  <StatBox label="Cookie Window"  value={`${a.cookieWindow || 30}d`} color="var(--color-ink)" small />
                </div>
              </div>

              {/* Profile + settings */}
              <div className="bg-surface border border-border rounded-md p-4">
                <div className="text-[10.5px] font-bold uppercase tracking-widest text-ink-muted mb-3">Profile &amp; Settings</div>
                <div className="grid grid-cols-2 gap-2.5 mb-3">
                  <Field label="Joined"          value={a.joinedDate} mono />
                  <Field label="Promo Code"      value={a.code} mono />
                  <Field label="Status"          value={STATUS_LABEL[a.status]} />
                  <Field label="Type"            value={a.type} />
                  {a.contactEmail && <Field label="Contact" value={a.contactEmail} />}
                  <Field label="Affiliate ID"    value={a.id} mono />
                </div>

                <div className="border-t border-border pt-3">
                  <div className="text-[10.5px] font-bold uppercase tracking-widest text-ink-muted mb-2">Commission Rate</div>
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      min={1}
                      max={100}
                      defaultValue={a.commissionRate}
                      onBlur={(e) => {
                        const v = parseInt(e.target.value, 10);
                        if (v > 0 && v <= 100 && v !== a.commissionRate) onUpdateRate(v);
                      }}
                      className="w-20 fi text-center"
                    />
                    <span className="text-[12px] text-ink-muted">% of revenue</span>
                  </div>
                </div>

                {a.notes && (
                  <div className="border-t border-border pt-3 mt-3">
                    <div className="text-[10.5px] font-bold uppercase tracking-widest text-ink-muted mb-1">Notes</div>
                    <div className="text-[11.5px] text-ink-2">{a.notes}</div>
                  </div>
                )}
              </div>
            </div>

            {/* Payout history */}
            {a.payouts.length > 0 && (
              <div className="bg-surface border border-border rounded-md overflow-hidden mb-3">
                <div className="bg-surface-2 py-2 px-4 border-b border-border flex items-center gap-2">
                  <div className="text-[10.5px] font-bold uppercase tracking-widest text-ink-2 flex-1">Payout History</div>
                  <div className="text-[10.5px] text-ink-muted">{a.payouts.length} payout{a.payouts.length === 1 ? "" : "s"}</div>
                </div>
                <table className="w-full text-[12.5px]">
                  <thead>
                    <tr className="bg-surface-2">
                      <Th>Payout ID</Th>
                      <Th>Date</Th>
                      <Th>Period</Th>
                      <Th>Method</Th>
                      <Th>Reference</Th>
                      <Th>Amount</Th>
                    </tr>
                  </thead>
                  <tbody>
                    {a.payouts.map((p) => (
                      <tr key={p.id} className="hover:bg-surface-2 transition-colors">
                        <Td><span className="font-mono text-[11px] text-brand-dk font-semibold">{p.id}</span></Td>
                        <Td><span className="font-mono text-[11px]">{p.date}</span></Td>
                        <Td><span className="text-[12px]">{p.period}</span></Td>
                        <Td><Pill intent="blue">{p.method}</Pill></Td>
                        <Td><span className="font-mono text-[10.5px] text-ink-muted">{p.reference}</span></Td>
                        <Td><span className="font-mono text-[12.5px] font-bold text-green">${p.amount.toLocaleString()}</span></Td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* Action footer */}
            <div className="flex gap-2 mt-3 flex-wrap">
              {a.commissionPending > 0 && a.status === "active" && (
                <button className="btn btn-primary btn-sm" onClick={onPay}>
                  💸 Pay ${a.commissionPending.toLocaleString()}
                </button>
              )}
              {isPending && (
                <button className="btn btn-primary btn-sm" onClick={onActivate}>
                  ✓ Activate
                </button>
              )}
              <button className="btn btn-ghost btn-sm" onClick={onCopyCode}>
                📋 Copy Code
              </button>
              <Link href={`/affiliate/${a.id}`} className="btn btn-ghost btn-sm">
                📊 View Details
              </Link>
              <button className="btn btn-ghost btn-sm" onClick={() => toast(`📧 Sent welcome kit to ${a.name}`)}>
                📧 Resend Welcome Kit
              </button>
              {a.status === "active" && (
                <button className="btn btn-ghost btn-sm" onClick={onPause}>
                  ⏸ Pause
                </button>
              )}
              {a.status === "paused" && (
                <button className="btn btn-primary btn-sm" onClick={onResume}>
                  ▶ Resume
                </button>
              )}
              <button
                className="btn btn-sm text-red border border-red-soft bg-transparent hover:bg-red-soft transition-colors ml-auto"
                onClick={onRemove}
              >
                🗑 Remove
              </button>
            </div>
          </td>
        </tr>
      )}
    </>
  );
}

// ─── Helpers ──────────────────────────────────────────────────────────────
function StatBox({ label, value, color, small }: { label: string; value: string; color: string; small?: boolean }) {
  return (
    <div className="bg-surface-2 border border-border rounded p-2 text-center">
      <div className={`font-extrabold leading-none ${small ? "text-[13px]" : "text-[15px]"}`} style={{ color }}>{value}</div>
      <div className="text-[9.5px] font-bold uppercase tracking-widest text-ink-muted mt-1">{label}</div>
    </div>
  );
}

function Field({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div>
      <div className="text-[10px] uppercase tracking-widest text-ink-muted font-bold mb-1">{label}</div>
      <div className={`text-[12px] font-semibold text-ink truncate ${mono ? "font-mono" : ""}`} title={value}>{value}</div>
    </div>
  );
}

function Th({ children }: { children: ReactNode }) {
  return (
    <th className="py-2.5 px-3.5 text-left text-[10px] font-bold uppercase tracking-wider text-ink-muted border-b border-border whitespace-nowrap">
      {children}
    </th>
  );
}

function Td({ children }: { children: ReactNode }) {
  return <td className="py-2.5 px-3.5 border-b border-border align-middle">{children}</td>;
}
