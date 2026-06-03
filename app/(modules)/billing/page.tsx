"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import type { Key, ReactNode } from "react";
import { Pill } from "@/components/ui/Pill";
import { Toast } from "@/components/ui/Toast";
import { KpiCard, KpiGrid } from "@/components/ui/Kpi";
import { ConfirmModal } from "@/components/ui/ConfirmModal";
import { SubmitClaimModal } from "@/components/modules/SubmitClaimModal";
import { toast } from "@/lib/hooks/useToast";
import { useBilling } from "@/lib/hooks/useBilling";
import { usePatients } from "@/lib/hooks/usePatients";
import type { Claim, ClaimStatus, PriorAuth, PriorAuthStatus, Payer } from "@/lib/types";

type Tab = "all" | "pending" | "denied" | "pa";

const PAGE_SIZE = 25;

const CLAIM_STATUS_LABEL: Record<ClaimStatus, string> = {
  draft:     "Draft",
  submitted: "Submitted",
  pending:   "Pending",
  paid:      "✓ Paid",
  denied:    "❌ Denied",
  appealing: "Appealing",
};

const CLAIM_STATUS_INTENT: Record<ClaimStatus, "green" | "amber" | "red" | "blue" | "muted"> = {
  draft:     "muted",
  submitted: "blue",
  pending:   "amber",
  paid:      "green",
  denied:    "red",
  appealing: "amber",
};

const PA_STATUS_LABEL: Record<PriorAuthStatus, string> = {
  submitted: "Submitted",
  pending:   "⏳ In Review",
  approved:  "✓ Approved",
  denied:    "❌ Denied",
};

const PA_STATUS_INTENT: Record<PriorAuthStatus, "green" | "amber" | "red" | "blue"> = {
  submitted: "blue",
  pending:   "amber",
  approved:  "green",
  denied:    "red",
};

export default function BillingPage() {
  const claims        = useBilling((s) => s.claims);
  const priorAuths    = useBilling((s) => s.priorAuths);
  const addClaim      = useBilling((s) => s.addClaim);
  const resubmitClaim = useBilling((s) => s.resubmitClaim);
  const removeClaim   = useBilling((s) => s.removeClaim);
  const setPaStatus   = useBilling((s) => s.setPaStatus);
  const patients      = usePatients((s) => s.patients);

  const [tab, setTab]                 = useState<Tab>("all");
  const [search, setSearch]           = useState("");
  const [page, setPage]               = useState(1);
  const [expandedId, setExpandedId]   = useState<string | null>(null);
  const [submitOpen, setSubmitOpen]   = useState(false);
  const [verifying, setVerifying]     = useState(false);
  const [resubmitTarget, setResubmitTarget] = useState<Claim | null>(null);

  // KPIs
  const counts = useMemo(() => {
    const total      = claims.length;
    const paid       = claims.filter((c) => c.status === "paid");
    const pending    = claims.filter((c) => c.status === "pending" || c.status === "submitted");
    const denied     = claims.filter((c) => c.status === "denied" || c.status === "appealing");
    const cleanCount = paid.length;
    const cleanRate  = total > 0 ? Math.round((cleanCount / (cleanCount + denied.length)) * 100) : 0;
    return {
      total,
      paidCount:    paid.length,
      paidTotal:    paid.reduce((a, c) => a + c.paid, 0),
      pendingCount: pending.length,
      pendingTotal: pending.reduce((a, c) => a + c.billed, 0),
      deniedCount:  denied.length,
      cleanRate,
      paCount:      priorAuths.length,
      paPending:    priorAuths.filter((p) => p.status === "pending" || p.status === "submitted").length,
    };
  }, [claims, priorAuths]);

  // Payer breakdown — for the secondary KPI strip
  const payerBreakdown = useMemo(() => {
    const map = new Map<Payer, { count: number; paid: number; pending: number; denied: number; billed: number }>();
    for (const c of claims) {
      const existing = map.get(c.payer) || { count: 0, paid: 0, pending: 0, denied: 0, billed: 0 };
      existing.count++;
      existing.billed += c.billed;
      if (c.status === "paid") existing.paid += c.paid;
      else if (c.status === "denied" || c.status === "appealing") existing.denied++;
      else existing.pending++;
      map.set(c.payer, existing);
    }
    return Array.from(map.entries())
      .map(([payer, data]) => ({ payer, ...data, paidPct: Math.round((data.paid / Math.max(1, data.billed)) * 100) }))
      .sort((a, b) => b.billed - a.billed);
  }, [claims]);

  // Filtered claims
  const filteredClaims = useMemo(() => {
    let list = claims;
    if (tab === "pending") list = list.filter((c) => c.status === "pending" || c.status === "submitted");
    else if (tab === "denied") list = list.filter((c) => c.status === "denied" || c.status === "appealing");
    if (search) {
      const q = search.toLowerCase();
      list = list.filter((c) =>
        c.patientName.toLowerCase().includes(q) ||
        c.id.toLowerCase().includes(q) ||
        c.payer.toLowerCase().includes(q) ||
        c.cptCode.includes(q) ||
        c.icd10.toLowerCase().includes(q)
      );
    }
    return [...list].sort((a, b) => b.submittedAt - a.submittedAt);
  }, [claims, tab, search]);

  const totalPages = Math.max(1, Math.ceil(filteredClaims.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const start = (safePage - 1) * PAGE_SIZE;
  const pageRows = filteredClaims.slice(start, start + PAGE_SIZE);

  function handleVerifyInsurance() {
    setVerifying(true);
    toast("🔍 Verifying insurance · 270/271 EDI transaction…");
    setTimeout(() => {
      setVerifying(false);
      toast("✅ Eligible · BCBS · OOP: $1,200 remaining · Deductible met");
    }, 1600);
  }

  function handleResubmit(c: Claim) {
    resubmitClaim(c.id);
    toast(`📤 ${c.id} resubmitted · 837P transmitted to ${c.payer}`);
    setResubmitTarget(null);
  }

  function handleApprovePa(pa: PriorAuth) {
    setPaStatus(pa.id, "approved");
    toast(`✓ PA ${pa.id} approved`);
  }

  function exportCsv() {
    const header = ["Claim ID", "Patient", "Patient ID", "Payer", "CPT", "Service", "ICD-10", "Billed", "Paid", "Patient Resp", "Status", "Submitted", "Provider", "Denial Code", "Denial Reason"];
    const rows = filteredClaims.map((c) => [
      c.id,
      `"${c.patientName.replace(/"/g, '""')}"`,
      c.patientId || "",
      c.payer,
      c.cptCode,
      `"${c.serviceLabel.replace(/"/g, '""')}"`,
      `"${c.icd10}"`,
      c.billed,
      c.paid,
      c.patientResponsibility || 0,
      c.status,
      c.submittedDate,
      c.providerName,
      c.denialCode || "",
      c.denialReason ? `"${c.denialReason.replace(/"/g, '""')}"` : "",
    ].join(","));
    const csv = [header.join(","), ...rows].join("\n");
    const a = document.createElement("a");
    a.href = "data:text/csv;charset=utf-8," + encodeURIComponent(csv);
    a.download = `dripvitals_claims_${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    toast(`📥 Exported ${filteredClaims.length} claims to CSV`);
  }

  return (
    <div className="px-7 py-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 mb-5 flex-wrap">
        <div>
          <div className="text-[22px] font-bold tracking-tight text-ink mb-1">Billing &amp; Insurance</div>
          <div className="text-[13px] text-ink-muted">
            Claims · EOBs · Prior auth · Insurance verification
          </div>
        </div>
        <div className="flex gap-2">
          <button className="btn btn-ghost btn-sm" onClick={exportCsv}>📥 Export CSV</button>
          <button
            className="btn btn-ghost btn-sm disabled:opacity-50"
            onClick={handleVerifyInsurance}
            disabled={verifying}
          >
            {verifying ? "🔍 Verifying…" : "🔍 Verify Insurance"}
          </button>
          <button className="btn btn-primary btn-sm" onClick={() => setSubmitOpen(true)}>+ Submit Claim</button>
        </div>
      </div>

      {/* KPI strip */}
      <KpiGrid cols={5}>
        <KpiCard
          label="Total Claims"
          value={counts.total}
          icon="📋"
          iconBg="var(--color-brand-soft)"
          iconColor="var(--color-brand)"
          trend={`${counts.paidCount + counts.pendingCount + counts.deniedCount} this period`}
          trendColor="var(--color-brand)"
        />
        <KpiCard
          label={`Paid · $${(counts.paidTotal / 1000).toFixed(0)}K`}
          value={counts.paidCount}
          icon="✅"
          iconBg="var(--color-green-soft)"
          iconColor="var(--color-green)"
          trend={`${Math.round((counts.paidCount / Math.max(1, counts.total)) * 100)}% paid rate`}
          trendColor="var(--color-green)"
        />
        <KpiCard
          label={`Pending · $${(counts.pendingTotal / 1000).toFixed(1)}K`}
          value={counts.pendingCount}
          icon="⏳"
          iconBg="var(--color-amber-soft)"
          iconColor="var(--color-amber)"
          trend="Awaiting adjudication"
          trendColor="var(--color-amber)"
        />
        <KpiCard
          label="Denied"
          value={counts.deniedCount}
          icon="❌"
          iconBg="var(--color-red-soft)"
          iconColor="var(--color-red)"
          trend={counts.deniedCount > 0 ? "Resubmit recommended" : "All clean"}
          trendColor={counts.deniedCount > 0 ? "var(--color-red)" : "var(--color-green)"}
        />
        <KpiCard
          label="Clean Rate"
          value={`${counts.cleanRate}%`}
          icon="📊"
          iconBg="var(--color-violet-soft)"
          iconColor="var(--color-violet)"
          trend="Paid ÷ adjudicated"
          trendColor="var(--color-violet)"
        />
      </KpiGrid>

      {/* Payer breakdown */}
      {payerBreakdown.length > 0 && (
        <div className="bg-surface border border-border rounded-lg p-4 mb-4">
          <div className="text-[10.5px] font-bold uppercase tracking-widest text-ink-muted mb-3">Payer Breakdown</div>
          <div className="grid grid-cols-5 gap-2.5 max-[900px]:grid-cols-3 max-[600px]:grid-cols-2">
            {payerBreakdown.map((p) => (
              <div key={p.payer} className="bg-surface-2 border border-border rounded-md p-2.5">
                <div className="text-[11.5px] font-bold text-ink mb-1.5 truncate">{p.payer}</div>
                <div className="flex items-baseline gap-1.5">
                  <span className="text-[16px] font-extrabold text-green leading-none">${(p.paid / 1000).toFixed(1)}K</span>
                  <span className="text-[10px] text-ink-muted">paid</span>
                </div>
                <div className="text-[10.5px] text-ink-muted mt-1">{p.count} claim{p.count === 1 ? "" : "s"} · {p.paidPct}% adj.</div>
                <div className="h-1 bg-surface-3 rounded mt-2 overflow-hidden">
                  <div
                    className="h-full rounded transition-all"
                    style={{ width: `${p.paidPct}%`, background: "var(--color-green)" }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="flex border-b-[1.5px] border-border mb-4 gap-1 overflow-x-auto">
        <TabButton active={tab === "all"}     onClick={() => { setTab("all"); setPage(1); }}>All Claims <CountBadge count={claims.length} /></TabButton>
        <TabButton active={tab === "pending"} onClick={() => { setTab("pending"); setPage(1); }}>Pending <CountBadge count={counts.pendingCount} /></TabButton>
        <TabButton active={tab === "denied"}  onClick={() => { setTab("denied"); setPage(1); }}>Denied <CountBadge count={counts.deniedCount} /></TabButton>
        <TabButton active={tab === "pa"}      onClick={() => setTab("pa")}>Prior Auth <CountBadge count={counts.paCount} /></TabButton>
      </div>

      {/* Tab content */}
      {tab !== "pa" ? (
        <div className="bg-surface border border-border rounded-lg overflow-hidden">
          {/* Search */}
          <div className="flex items-center gap-2 p-3 px-[18px] border-b border-border bg-surface-2 flex-wrap">
            <div className="flex items-center gap-1.5 bg-surface border border-border rounded-pill py-1 px-3.5 ml-auto min-w-[280px] focus-within:border-brand focus-within:shadow-[0_0_0_3px_rgba(31,138,112,.18)]">
              <span className="text-ink-muted text-[13px]">🔍</span>
              <input
                value={search}
                onChange={(e) => { setSearch(e.target.value); setPage(1); }}
                placeholder="Search claim ID, patient, payer, CPT, ICD-10…"
                className="flex-1 bg-transparent border-none outline-none text-[12px] text-ink placeholder:text-ink-muted"
              />
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-[13px]">
              <thead className="bg-surface-2">
                <tr>
                  <Th>Claim ID</Th>
                  <Th>Patient</Th>
                  <Th>Payer</Th>
                  <Th>CPT / Service</Th>
                  <Th>Billed</Th>
                  <Th>Paid</Th>
                  <Th>Status</Th>
                  <Th>Submitted</Th>
                  <Th>{""}</Th>
                </tr>
              </thead>
              <tbody>
                {pageRows.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="py-12 text-center text-ink-muted">
                      <div className="text-[36px] opacity-40 mb-2">📋</div>
                      <div className="text-[13px] font-bold text-ink mb-0.5">No claims match</div>
                      <div className="text-[11.5px]">Try a different filter or search term</div>
                    </td>
                  </tr>
                ) : (
                  pageRows.map((c, i) => (
                    <ClaimRow
                      key={c.id}
                      claim={c}
                      patient={patients.find((p) => p.id === c.patientId)}
                      expanded={expandedId === c.id}
                      onToggle={() => setExpandedId(expandedId === c.id ? null : c.id)}
                      onResubmit={() => setResubmitTarget(c)}
                      delay={i * 20}
                    />
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          <div className="py-2.5 px-[18px] border-t border-border bg-surface-2 flex items-center gap-2.5 text-[11.5px] text-ink-muted">
            <span>
              {filteredClaims.length === 0
                ? "0 claims"
                : `Showing ${start + 1}–${Math.min(start + PAGE_SIZE, filteredClaims.length)} of ${filteredClaims.length}`}
            </span>
            <div className="flex-1" />
            <button className="btn btn-ghost btn-xs disabled:opacity-40" onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={safePage <= 1}>← Prev</button>
            <span className="font-semibold text-ink">Page {safePage} of {totalPages}</span>
            <button className="btn btn-ghost btn-xs disabled:opacity-40" onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={safePage >= totalPages}>Next →</button>
          </div>
        </div>
      ) : (
        // Prior Auth tab
        <div className="bg-surface border border-border rounded-lg overflow-hidden">
          <div className="py-3 px-5 bg-surface-2 border-b border-border flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-md flex items-center justify-center text-[13px] flex-shrink-0 border border-border bg-surface" style={{ background: "var(--color-blue-soft)", color: "var(--color-blue)" }}>
              📋
            </div>
            <div className="text-[13px] font-bold uppercase tracking-wider text-ink-2">Prior Authorizations</div>
            <div className="flex-1" />
            <div className="text-[11px] text-ink-muted">{counts.paPending} awaiting decision</div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-[13px]">
              <thead className="bg-surface-2">
                <tr>
                  <Th>PA ID</Th>
                  <Th>Patient</Th>
                  <Th>Payer</Th>
                  <Th>Medication</Th>
                  <Th>Submitted</Th>
                  <Th>Waiting</Th>
                  <Th>Status</Th>
                  <Th>{""}</Th>
                </tr>
              </thead>
              <tbody>
                {priorAuths.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="py-12 text-center text-ink-muted">
                      <div className="text-[36px] opacity-40 mb-2">📋</div>
                      <div className="text-[13px] font-bold text-ink mb-0.5">No prior auths</div>
                    </td>
                  </tr>
                ) : (
                  priorAuths.map((pa) => {
                    const isUrgent = pa.daysWaiting > 5 && (pa.status === "pending" || pa.status === "submitted");
                    return (
                      <tr
                        key={pa.id}
                        className="hover:bg-surface-2 transition-colors"
                        style={isUrgent ? { borderLeft: "3px solid var(--color-amber)" } : undefined}
                      >
                        <Td><span className="font-mono text-[11.5px] text-brand-dk font-semibold">{pa.id}</span></Td>
                        <Td>
                          {pa.patientId ? (
                            <Link href={`/patients/${pa.patientId}`} className="text-[12.5px] font-semibold hover:text-brand-dk hover:underline">
                              {pa.patientName}
                            </Link>
                          ) : (
                            <span className="text-[12.5px] font-semibold">{pa.patientName}</span>
                          )}
                        </Td>
                        <Td><span className="text-[12px]">{pa.payer}</span></Td>
                        <Td>
                          <div className="text-[12px] font-semibold">{pa.medication}</div>
                          <div className="text-[10.5px] text-ink-muted truncate max-w-[180px]" title={pa.diagnosis}>{pa.diagnosis}</div>
                        </Td>
                        <Td><span className="font-mono text-[11px] text-ink-muted">{pa.submittedDate}</span></Td>
                        <Td>
                          <span className={`font-mono text-[11.5px] font-semibold ${isUrgent ? "text-amber" : "text-ink-muted"}`}>
                            {pa.daysWaiting > 0 ? `${pa.daysWaiting}d` : "—"}
                          </span>
                        </Td>
                        <Td><Pill intent={PA_STATUS_INTENT[pa.status]} dot>{PA_STATUS_LABEL[pa.status]}</Pill></Td>
                        <Td>
                          <div className="flex gap-1">
                            {(pa.status === "pending" || pa.status === "submitted") && (
                              <button
                                className="px-2.5 py-1 rounded-md bg-surface-2 border border-border text-[11px] font-semibold text-ink-2 hover:bg-brand-soft hover:border-brand hover:text-brand-dk transition-colors"
                                onClick={() => handleApprovePa(pa)}
                              >
                                ✓ Approve
                              </button>
                            )}
                            {pa.status === "denied" && (
                              <button
                                className="px-2.5 py-1 rounded-md bg-surface-2 border border-border text-[11px] font-semibold text-ink-2 hover:bg-brand-soft hover:border-brand hover:text-brand-dk transition-colors"
                                onClick={() => toast(`📝 Appeal initiated for ${pa.id}`)}
                              >
                                📝 Appeal
                              </button>
                            )}
                            <button
                              className="px-2.5 py-1 rounded-md bg-surface-2 border border-border text-[11px] font-semibold text-ink-2 hover:bg-brand-soft hover:border-brand hover:text-brand-dk transition-colors"
                              onClick={() => toast(`📋 ${pa.id} detail opened`)}
                            >
                              View
                            </button>
                          </div>
                        </Td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <SubmitClaimModal
        open={submitOpen}
        onClose={() => setSubmitOpen(false)}
        onSubmit={(c) => {
          const created = addClaim(c);
          toast(`📤 ${created.id} submitted to ${created.payer} as 837P`);
        }}
      />
      <ConfirmModal
        open={!!resubmitTarget}
        onClose={() => setResubmitTarget(null)}
        onConfirm={() => resubmitTarget && handleResubmit(resubmitTarget)}
        icon="📤"
        title="Resubmit denied claim?"
        message={
          resubmitTarget
            ? `${resubmitTarget.id} (${resubmitTarget.cptCode}, $${resubmitTarget.billed}) will be resubmitted as 837P. Make sure any corrections to ICD-10 or modifiers are saved. Original denial: ${resubmitTarget.denialCode || "—"} ${resubmitTarget.denialReason ? "· " + resubmitTarget.denialReason : ""}`
            : ""
        }
        confirmLabel="Resubmit claim"
        destructive={false}
      />
      <Toast />
    </div>
  );
}

// ─── Claim row ─────────────────────────────────────────────────────────────
interface ClaimRowProps {
  key?: Key;
  claim: Claim;
  patient?: { color: string };
  expanded: boolean;
  onToggle: () => void;
  onResubmit: () => void;
  delay: number;
}

function ClaimRow({ claim: c, patient, expanded, onToggle, onResubmit, delay }: ClaimRowProps) {
  const initials = c.patientName.split(" ").map((s) => s[0]).join("").slice(0, 2);
  const color = patient?.color || "var(--color-ink-muted)";
  const isDenied = c.status === "denied" || c.status === "appealing";

  return (
    <>
      <tr
        onClick={onToggle}
        className="cursor-pointer hover:bg-surface-2 transition-colors animate-fadeUp"
        style={{
          animationDelay: `${delay}ms`,
          borderLeft: isDenied ? "3px solid var(--color-red)" : undefined,
          background: isDenied ? "rgba(192,57,43,.025)" : undefined,
        }}
      >
        <Td><span className="font-mono text-[11.5px] text-brand-dk font-semibold">{c.id}</span></Td>
        <Td>
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-bold text-white flex-shrink-0" style={{ background: color }}>
              {initials}
            </div>
            <span className="text-[12.5px] font-semibold">{c.patientName}</span>
          </div>
        </Td>
        <Td><span className="text-[12px] text-ink-2">{c.payer}</span></Td>
        <Td>
          <div className="text-[12.5px] font-semibold font-mono">{c.cptCode}</div>
          <div className="text-[10.5px] text-ink-muted truncate max-w-[180px]" title={c.serviceLabel}>{c.serviceLabel}</div>
        </Td>
        <Td><span className="font-mono text-[12px] font-semibold">${c.billed}</span></Td>
        <Td>
          <span className="font-mono text-[12px] font-semibold" style={{ color: c.paid > 0 ? "var(--color-green)" : "var(--color-ink-muted)" }}>
            {c.paid > 0 ? `$${c.paid}` : "—"}
          </span>
        </Td>
        <Td><Pill intent={CLAIM_STATUS_INTENT[c.status]} dot>{CLAIM_STATUS_LABEL[c.status]}</Pill></Td>
        <Td><span className="font-mono text-[11px] text-ink-muted">{c.submittedDate}</span></Td>
        <Td>
          <div className="flex gap-1">
            {isDenied && (
              <button
                className="px-2.5 py-1 rounded-md bg-red-soft border border-red text-[11px] font-semibold text-red hover:bg-red hover:text-white transition-colors"
                onClick={(e) => { e.stopPropagation(); onResubmit(); }}
              >
                📤 Resubmit
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
            {/* Denial callout if denied */}
            {isDenied && c.denialReason && (
              <div className="mb-4 border border-red-soft rounded-md py-2.5 px-3.5 flex items-start gap-2.5" style={{ borderLeft: "3px solid var(--color-red)", background: "rgba(192,57,43,.04)" }}>
                <span className="text-[16px]">❌</span>
                <div className="flex-1">
                  <div className="text-[11px] font-bold uppercase tracking-widest text-red mb-0.5">
                    Denial · {c.denialCode}
                  </div>
                  <div className="text-[13px] text-ink-2">{c.denialReason}</div>
                </div>
                <button className="btn btn-primary btn-sm" onClick={onResubmit}>📤 Resubmit</button>
              </div>
            )}

            {/* Meta */}
            <div className="grid grid-cols-4 gap-3 mb-4 max-[800px]:grid-cols-2">
              <Field label="Claim ID"          value={c.id} mono />
              <Field label="Date of Service"   value={c.dateOfService} mono />
              <Field label="Provider"          value={c.providerName} />
              <Field label="Payer"             value={c.payer} />
              <Field label="CPT Code"          value={c.cptCode} mono />
              <Field label="ICD-10 Diagnosis"  value={c.icd10} mono />
              <Field label="Service"           value={c.serviceLabel} />
              <Field label="Submitted Date"    value={c.submittedDate} mono />
            </div>

            {/* EOB breakdown */}
            <div className="bg-surface border border-border rounded-md overflow-hidden mb-3">
              <div className="bg-surface-2 py-2 px-4 border-b border-border text-[10.5px] font-bold uppercase tracking-widest text-ink-2">
                Explanation of Benefits (EOB)
              </div>
              <table className="w-full text-[12.5px]">
                <tbody>
                  <EobRow label="Billed Amount"        value={`$${c.billed.toFixed(2)}`} />
                  <EobRow
                    label={c.status === "paid" ? "Allowed Amount" : "Pending Adjudication"}
                    value={c.status === "paid" ? `$${(c.paid + (c.patientResponsibility || 0)).toFixed(2)}` : "—"}
                    muted
                  />
                  <EobRow
                    label={c.status === "paid" ? "Insurance Paid" : "Insurance Will Pay"}
                    value={c.paid > 0 ? `$${c.paid.toFixed(2)}` : "—"}
                    intent="green"
                  />
                  <EobRow
                    label="Patient Responsibility"
                    value={c.patientResponsibility ? `$${c.patientResponsibility.toFixed(2)}` : "—"}
                  />
                  <EobRow
                    label="Adjustments / Write-off"
                    value={c.status === "paid" ? `$${(c.billed - c.paid - (c.patientResponsibility || 0)).toFixed(2)}` : "—"}
                    muted
                  />
                </tbody>
              </table>
            </div>

            {/* Actions */}
            <div className="flex gap-2 mt-3 flex-wrap">
              {c.patientId && (
                <Link href={`/patients/${c.patientId}`} className="btn btn-ghost btn-sm">
                  👤 View Patient Chart
                </Link>
              )}
              {c.status === "paid" && (
                <button className="btn btn-ghost btn-sm" onClick={() => toast(`📥 EOB PDF for ${c.id} downloaded`)}>
                  📥 Download EOB
                </button>
              )}
              <button className="btn btn-ghost btn-sm" onClick={() => toast(`📋 ${c.id} copied to clipboard`)}>
                📋 Copy
              </button>
              <button className="btn btn-ghost btn-sm" onClick={() => toast("🖨 Print preview opened")}>
                🖨 Print
              </button>
              {isDenied && (
                <button className="btn btn-primary btn-sm" onClick={onResubmit}>
                  📤 Resubmit 837P
                </button>
              )}
            </div>
          </td>
        </tr>
      )}
    </>
  );
}

function EobRow({ label, value, intent, muted }: { label: string; value: string; intent?: "green"; muted?: boolean }) {
  const color = intent === "green" ? "var(--color-green)" : muted ? "var(--color-ink-muted)" : "var(--color-ink)";
  return (
    <tr className="border-t border-border first:border-t-0">
      <td className="py-2.5 px-4 text-ink-muted">{label}</td>
      <td className="py-2.5 px-4 text-right font-mono font-semibold" style={{ color }}>{value}</td>
    </tr>
  );
}

function Field({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div>
      <div className="text-[10px] uppercase tracking-widest text-ink-muted font-bold mb-1">{label}</div>
      <div className={`text-[12.5px] font-semibold text-ink ${mono ? "font-mono" : ""}`}>{value}</div>
    </div>
  );
}

function TabButton({ active, onClick, children }: { active: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={[
        "py-2.5 px-4 text-[13px] font-semibold cursor-pointer whitespace-nowrap transition-colors -mb-[1.5px] border-b-[2.5px] flex items-center gap-1.5",
        active ? "text-brand border-brand" : "text-ink-muted border-transparent hover:text-ink hover:bg-surface-2",
      ].join(" ")}
    >
      {children}
    </button>
  );
}

function CountBadge({ count }: { count: number }) {
  return (
    <span className="inline-flex items-center justify-center min-w-[18px] h-[17px] px-1.5 rounded-pill text-[10px] font-bold bg-surface-3 text-ink-muted">
      {count}
    </span>
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
