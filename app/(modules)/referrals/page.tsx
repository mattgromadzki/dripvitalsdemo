"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import type { Key, ReactNode } from "react";
import { Pill } from "@/components/ui/Pill";
import { Toast } from "@/components/ui/Toast";
import { KpiCard, KpiGrid } from "@/components/ui/Kpi";
import { ConfirmModal } from "@/components/ui/ConfirmModal";
import { NewReferralModal } from "@/components/modules/NewReferralModal";
import { toast } from "@/lib/hooks/useToast";
import { useReferrals } from "@/lib/hooks/useReferrals";
import type { Referral, ReferralStatus, ReferralUrgency, ReferralSpecialty, Specialist } from "@/lib/types";

type Tab = "all" | ReferralStatus | "directory";

const STATUS_LABEL: Record<ReferralStatus, string> = {
  pending:    "Pending",
  scheduled:  "Scheduled",
  completed:  "Completed",
  cancelled:  "Cancelled",
  incoming:   "Incoming",
  declined:   "Declined",
};

const STATUS_INTENT: Record<ReferralStatus, "amber" | "blue" | "green" | "muted" | "purple" | "red"> = {
  pending:    "amber",
  scheduled:  "blue",
  completed:  "green",
  cancelled:  "muted",
  incoming:   "purple",
  declined:   "red",
};

const URGENCY_INTENT: Record<ReferralUrgency, "muted" | "amber" | "red"> = {
  Routine:  "muted",
  Urgent:   "amber",
  STAT:     "red",
};

const URGENCY_LABEL: Record<ReferralUrgency, string> = {
  Routine:  "Routine",
  Urgent:   "⚠ Urgent",
  STAT:     "🚨 STAT",
};

const SPECIALTY_ICON: Record<ReferralSpecialty, string> = {
  "Endocrinology":      "🧬",
  "Cardiology":         "❤",
  "Gastroenterology":   "🩻",
  "Dietitian":          "🥗",
  "Psychiatry":         "🧠",
  "Sleep Medicine":     "💤",
  "Bariatric Surgery":  "⚕",
  "Primary Care":       "👨‍⚕️",
  "Other":              "📋",
};

export default function ReferralsPage() {
  const referrals         = useReferrals((s) => s.referrals);
  const specialists       = useReferrals((s) => s.specialists);
  const addReferral       = useReferrals((s) => s.addReferral);
  const scheduleReferral  = useReferrals((s) => s.scheduleReferral);
  const completeReferral  = useReferrals((s) => s.completeReferral);
  const cancelReferral    = useReferrals((s) => s.cancelReferral);
  const removeReferral    = useReferrals((s) => s.removeReferral);

  const [tab, setTab]                 = useState<Tab>("all");
  const [urgencyFilter, setUrgency]   = useState<"all" | ReferralUrgency>("all");
  const [search, setSearch]           = useState("");
  const [expandedId, setExpandedId]   = useState<string | null>(null);
  const [newOpen, setNewOpen]         = useState(false);
  const [cancelTarget, setCancelTarget] = useState<Referral | null>(null);

  // KPIs
  const counts = useMemo(() => {
    return {
      total: referrals.length,
      pending: referrals.filter((r) => r.status === "pending").length,
      scheduled: referrals.filter((r) => r.status === "scheduled").length,
      completed: referrals.filter((r) => r.status === "completed").length,
      cancelled: referrals.filter((r) => r.status === "cancelled").length,
      incoming: referrals.filter((r) => r.status === "incoming").length,
      urgent: referrals.filter((r) => (r.urgency === "Urgent" || r.urgency === "STAT") && (r.status === "pending" || r.status === "scheduled")).length,
    };
  }, [referrals]);

  // Filtered list
  const filtered = useMemo(() => {
    if (tab === "directory") return [];
    let list = referrals;
    if (tab !== "all") list = list.filter((r) => r.status === tab);
    if (urgencyFilter !== "all") list = list.filter((r) => r.urgency === urgencyFilter);
    if (search) {
      const q = search.toLowerCase();
      list = list.filter((r) =>
        r.patientName.toLowerCase().includes(q) ||
        r.id.toLowerCase().includes(q) ||
        r.specialistName.toLowerCase().includes(q) ||
        r.specialty.toLowerCase().includes(q) ||
        r.reason.toLowerCase().includes(q)
      );
    }
    return [...list].sort((a, b) => {
      const urgencyRank: Record<ReferralUrgency, number> = { STAT: 0, Urgent: 1, Routine: 2 };
      if (urgencyRank[a.urgency] !== urgencyRank[b.urgency]) return urgencyRank[a.urgency] - urgencyRank[b.urgency];
      return b.sentAt - a.sentAt;
    });
  }, [referrals, tab, urgencyFilter, search]);

  // Filtered specialists for directory tab
  const filteredSpecialists = useMemo(() => {
    if (!search) return specialists;
    const q = search.toLowerCase();
    return specialists.filter((s) =>
      s.name.toLowerCase().includes(q) ||
      s.specialty.toLowerCase().includes(q) ||
      s.practice.toLowerCase().includes(q) ||
      s.city.toLowerCase().includes(q)
    );
  }, [specialists, search]);

  function handleScheduleQuick(r: Referral) {
    const today = new Date();
    today.setDate(today.getDate() + 7);
    const months = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
    const dateStr = `${months[today.getMonth()]} ${today.getDate()}, ${today.getFullYear()}`;
    scheduleReferral(r.id, dateStr);
    toast(`📅 Scheduled ${r.id} for ${dateStr}`);
  }

  function exportCsv() {
    const header = ["Ref ID", "Patient", "Specialist", "Specialty", "Reason", "Urgency", "Status", "Sent", "Scheduled", "Completed"];
    const rows = filtered.map((r) => [
      r.id,
      `"${r.patientName.replace(/"/g, '""')}"`,
      `"${r.specialistName.replace(/"/g, '""')}"`,
      r.specialty,
      `"${r.reason.replace(/"/g, '""')}"`,
      r.urgency, r.status, r.sentDate,
      r.scheduledDate || "",
      r.completedDate || "",
    ].join(","));
    const csv = [header.join(","), ...rows].join("\n");
    const a = document.createElement("a");
    a.href = "data:text/csv;charset=utf-8," + encodeURIComponent(csv);
    a.download = `dripvitals_referrals_${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    toast(`📥 Exported ${filtered.length} referrals to CSV`);
  }

  return (
    <div className="px-7 py-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 mb-5 flex-wrap">
        <div>
          <div className="text-[22px] font-bold tracking-tight text-ink mb-1">Referral Management</div>
          <div className="text-[13px] text-ink-muted">
            Send & receive referrals · Specialist coordination · {specialists.length} specialists in network
          </div>
        </div>
        <div className="flex gap-2">
          <button className="btn btn-ghost btn-sm" onClick={exportCsv}>📥 Export CSV</button>
          <button className="btn btn-primary btn-sm" onClick={() => setNewOpen(true)}>+ New Referral</button>
        </div>
      </div>

      {/* KPI strip */}
      <KpiGrid cols={5}>
        <KpiCard
          label="Total Referrals"
          value={counts.total}
          icon="📋"
          iconBg="var(--color-brand-soft)"
          iconColor="var(--color-brand)"
          trend="Last 30 days"
          trendColor="var(--color-brand)"
        />
        <KpiCard
          label="Pending"
          value={counts.pending}
          icon="⏳"
          iconBg="var(--color-amber-soft)"
          iconColor="var(--color-amber)"
          trend={counts.urgent > 0 ? `${counts.urgent} urgent / STAT` : "All routine"}
          trendColor={counts.urgent > 0 ? "var(--color-red)" : "var(--color-amber)"}
        />
        <KpiCard
          label="Scheduled"
          value={counts.scheduled}
          icon="📅"
          iconBg="var(--color-blue-soft)"
          iconColor="var(--color-blue)"
          trend="Awaiting visit"
          trendColor="var(--color-blue)"
        />
        <KpiCard
          label="Completed"
          value={counts.completed}
          icon="✅"
          iconBg="var(--color-green-soft)"
          iconColor="var(--color-green)"
          trend="Findings received"
          trendColor="var(--color-green)"
        />
        <KpiCard
          label="Incoming"
          value={counts.incoming}
          icon="📥"
          iconBg="var(--color-violet-soft)"
          iconColor="var(--color-violet)"
          trend="From external providers"
          trendColor="var(--color-violet)"
        />
      </KpiGrid>

      {/* Urgent alert */}
      {counts.urgent > 0 && (
        <div
          className="border border-red-soft rounded-lg py-3 px-4 mb-4 flex items-center gap-3"
          style={{ borderLeft: "3px solid var(--color-red)", background: "rgba(192,57,43,.04)" }}
        >
          <span className="text-[18px] flex-shrink-0">🚨</span>
          <div className="flex-1 text-[12.5px]">
            <span className="font-bold text-red">
              {counts.urgent} urgent / STAT referral{counts.urgent === 1 ? "" : "s"} awaiting action.
            </span>
            <span className="text-ink-2 ml-1">Filter to view.</span>
          </div>
          <button className="btn btn-ghost btn-sm" onClick={() => setUrgency("STAT")}>View STAT</button>
        </div>
      )}

      {/* Tabs */}
      <div className="flex border-b-[1.5px] border-border mb-4 gap-1 overflow-x-auto">
        <TabButton active={tab === "all"}        onClick={() => setTab("all")}>All <CountBadge count={counts.total} /></TabButton>
        <TabButton active={tab === "pending"}    onClick={() => setTab("pending")}>Pending <CountBadge count={counts.pending} /></TabButton>
        <TabButton active={tab === "scheduled"}  onClick={() => setTab("scheduled")}>Scheduled <CountBadge count={counts.scheduled} /></TabButton>
        <TabButton active={tab === "completed"}  onClick={() => setTab("completed")}>Completed <CountBadge count={counts.completed} /></TabButton>
        <TabButton active={tab === "incoming"}   onClick={() => setTab("incoming")}>📥 Incoming <CountBadge count={counts.incoming} /></TabButton>
        <TabButton active={tab === "directory"}  onClick={() => setTab("directory")}>🏥 Directory <CountBadge count={specialists.length} /></TabButton>
      </div>

      {tab !== "directory" ? (
        <>
          {/* Urgency filter + search */}
          <div className="flex items-center gap-2 mb-4 flex-wrap">
            {(["all", "Routine", "Urgent", "STAT"] as const).map((u) => (
              <button
                key={u}
                onClick={() => setUrgency(u)}
                className={[
                  "py-1.5 px-3 rounded-pill text-[11.5px] font-semibold border transition-colors",
                  urgencyFilter === u
                    ? u === "STAT" ? "bg-red text-white border-red"
                    : u === "Urgent" ? "bg-amber text-white border-amber"
                    : "bg-brand text-white border-brand"
                    : "bg-surface border-border text-ink-2 hover:border-border-2",
                ].join(" ")}
              >
                {u === "all" ? "All Urgency" : URGENCY_LABEL[u]}
              </button>
            ))}
            <div className="flex items-center gap-1.5 bg-surface border border-border rounded-pill py-1 px-3.5 ml-auto min-w-[260px] focus-within:border-brand focus-within:shadow-[0_0_0_3px_rgba(31,138,112,.18)]">
              <span className="text-ink-muted text-[13px]">🔍</span>
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search ref ID, patient, specialist, reason…"
                className="flex-1 bg-transparent border-none outline-none text-[12px] text-ink placeholder:text-ink-muted"
              />
            </div>
          </div>

          {/* Referrals table */}
          <div className="bg-surface border border-border rounded-lg overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-[13px]">
                <thead className="bg-surface-2">
                  <tr>
                    <Th>Ref ID</Th>
                    <Th>Patient</Th>
                    <Th>Specialist</Th>
                    <Th>Specialty</Th>
                    <Th>Reason</Th>
                    <Th>Urgency</Th>
                    <Th>Status</Th>
                    <Th>Sent</Th>
                    <Th>{""}</Th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="py-12 text-center text-ink-muted">
                        <div className="text-[36px] opacity-40 mb-2">📋</div>
                        <div className="text-[13px] font-bold text-ink mb-0.5">No referrals match</div>
                        <div className="text-[11.5px]">Try a different filter or search term</div>
                      </td>
                    </tr>
                  ) : (
                    filtered.map((r, i) => (
                      <ReferralRow
                        key={r.id}
                        referral={r}
                        specialist={specialists.find((s) => s.id === r.specialistId)}
                        expanded={expandedId === r.id}
                        onToggle={() => setExpandedId(expandedId === r.id ? null : r.id)}
                        onSchedule={() => handleScheduleQuick(r)}
                        onComplete={() => {
                          completeReferral(r.id);
                          toast(`✓ ${r.id} marked completed`);
                        }}
                        onCancel={() => setCancelTarget(r)}
                        delay={i * 15}
                      />
                    ))
                  )}
                </tbody>
              </table>
            </div>
            <div className="py-2.5 px-[18px] border-t border-border bg-surface-2 text-[11.5px] text-ink-muted">
              Showing {filtered.length} of {referrals.length} referrals
            </div>
          </div>
        </>
      ) : (
        // Directory tab
        <>
          <div className="flex items-center gap-2 mb-4">
            <div className="flex items-center gap-1.5 bg-surface border border-border rounded-pill py-1 px-3.5 ml-auto min-w-[280px] focus-within:border-brand focus-within:shadow-[0_0_0_3px_rgba(31,138,112,.18)]">
              <span className="text-ink-muted text-[13px]">🔍</span>
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search specialist, specialty, practice, city…"
                className="flex-1 bg-transparent border-none outline-none text-[12px] text-ink placeholder:text-ink-muted"
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3 max-[900px]:grid-cols-1">
            {filteredSpecialists.map((s) => (
              <SpecialistCard
                key={s.id}
                specialist={s}
                referralCount={referrals.filter((r) => r.specialistId === s.id).length}
                onNewReferral={() => setNewOpen(true)}
              />
            ))}
          </div>
        </>
      )}

      <NewReferralModal
        open={newOpen}
        onClose={() => setNewOpen(false)}
        onCreate={(r) => {
          const created = addReferral(r);
          toast(`📤 Referral ${created.id} sent to ${created.specialistName}`);
        }}
      />
      <ConfirmModal
        open={!!cancelTarget}
        onClose={() => setCancelTarget(null)}
        onConfirm={() => {
          if (cancelTarget) {
            cancelReferral(cancelTarget.id);
            toast(`🗑 ${cancelTarget.id} cancelled`);
          }
          setCancelTarget(null);
        }}
        icon="🗑"
        title="Cancel this referral?"
        message={cancelTarget ? `${cancelTarget.id} for ${cancelTarget.patientName} → ${cancelTarget.specialistName} will be cancelled. ${cancelTarget.specialistName} will be notified.` : ""}
        confirmLabel="Cancel referral"
      />
      <Toast />
    </div>
  );
}

// ─── Referral row ─────────────────────────────────────────────────────────
interface ReferralRowProps {
  key?: Key;
  referral: Referral;
  specialist?: Specialist;
  expanded: boolean;
  onToggle: () => void;
  onSchedule: () => void;
  onComplete: () => void;
  onCancel: () => void;
  delay: number;
}

function ReferralRow({ referral: r, specialist, expanded, onToggle, onSchedule, onComplete, onCancel, delay }: ReferralRowProps) {
  const isUrgent = r.urgency === "STAT" || r.urgency === "Urgent";
  const initials = r.patientName.split(" ").map((s) => s[0]).join("").slice(0, 2);
  const isActive = r.status === "pending" || r.status === "scheduled";

  return (
    <>
      <tr
        onClick={onToggle}
        className="cursor-pointer hover:bg-surface-2 transition-colors animate-fadeUp"
        style={{
          animationDelay: `${delay}ms`,
          borderLeft: r.urgency === "STAT" ? "3px solid var(--color-red)"
                    : r.urgency === "Urgent" && isActive ? "3px solid var(--color-amber)"
                    : undefined,
          background: r.urgency === "STAT" && isActive ? "rgba(192,57,43,.025)" : undefined,
        }}
      >
        <Td><span className="font-mono text-[11.5px] text-brand-dk font-semibold">{r.id}</span></Td>
        <Td>
          <div className="flex items-center gap-2.5">
            <div
              className="w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-bold text-white flex-shrink-0"
              style={{ background: r.patientColor || "var(--color-ink-muted)" }}
            >
              {initials}
            </div>
            <Link href={`/patients/${r.patientId}`} onClick={(e) => e.stopPropagation()} className="text-[12.5px] font-semibold hover:text-brand-dk hover:underline">
              {r.patientName}
            </Link>
          </div>
        </Td>
        <Td>
          <div className="text-[12.5px] font-semibold truncate">{r.specialistName}</div>
          {specialist && (
            <div className="text-[10.5px] text-ink-muted">{specialist.practice}</div>
          )}
        </Td>
        <Td>
          <Pill intent="muted">
            <span className="mr-1">{SPECIALTY_ICON[r.specialty]}</span> {r.specialty}
          </Pill>
        </Td>
        <Td><span className="text-[12px] text-ink-2 truncate max-w-[200px] block" title={r.reason}>{r.reason}</span></Td>
        <Td><Pill intent={URGENCY_INTENT[r.urgency]} dot={isUrgent}>{URGENCY_LABEL[r.urgency]}</Pill></Td>
        <Td><Pill intent={STATUS_INTENT[r.status]} dot>{STATUS_LABEL[r.status]}</Pill></Td>
        <Td><span className="font-mono text-[11px] text-ink-muted">{r.sentDate}</span></Td>
        <Td>
          <div className="flex gap-1">
            {r.status === "pending" && (
              <button
                className="px-2.5 py-1 rounded-md bg-brand-soft border border-brand text-[11px] font-semibold text-brand-dk hover:bg-brand hover:text-white transition-colors"
                onClick={(e) => { e.stopPropagation(); onSchedule(); }}
              >
                📅 Schedule
              </button>
            )}
            {r.status === "scheduled" && (
              <button
                className="px-2.5 py-1 rounded-md bg-green-soft border border-green text-[11px] font-semibold text-green hover:bg-green hover:text-white transition-colors"
                onClick={(e) => { e.stopPropagation(); onComplete(); }}
              >
                ✓ Complete
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
            <div className="grid grid-cols-2 gap-4 max-[800px]:grid-cols-1">
              {/* Patient + dates */}
              <div className="bg-surface border border-border rounded-md p-4">
                <div className="text-[10.5px] font-bold uppercase tracking-widest text-ink-muted mb-3">Referral Details</div>
                <div className="grid grid-cols-2 gap-2.5">
                  <Field label="Referral ID"   value={r.id} mono />
                  <Field label="Direction"     value={r.direction === "incoming" ? "📥 Incoming" : "📤 Outgoing"} />
                  <Field label="Patient"       value={r.patientName} />
                  <Field label="Urgency"       value={r.urgency} />
                  <Field label="Sent"          value={r.sentDate} mono />
                  {r.scheduledDate && <Field label="Scheduled" value={r.scheduledDate} mono />}
                  {r.completedDate && <Field label="Completed" value={r.completedDate} mono />}
                </div>
              </div>

              {/* Specialist */}
              {specialist && (
                <div className="bg-surface border border-border rounded-md p-4">
                  <div className="text-[10.5px] font-bold uppercase tracking-widest text-ink-muted mb-3">Specialist Info</div>
                  <div className="flex items-start gap-3 mb-2.5">
                    <div
                      className="w-10 h-10 rounded-full flex items-center justify-center text-[11px] font-bold text-white flex-shrink-0"
                      style={{ background: specialist.color }}
                    >
                      {specialist.name.split(" ").map((s) => s[0]).join("").slice(0, 2)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-[13px] font-bold">{specialist.name}, {specialist.credentials}</div>
                      <div className="text-[11px] text-ink-muted">{specialist.practice}</div>
                      <div className="text-[11px] text-ink-muted">{specialist.city}, {specialist.state}</div>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-2.5 mt-2 pt-2 border-t border-border">
                    <Field label="Phone" value={specialist.phone} mono small />
                    <Field label="NPI"   value={specialist.npi} mono small />
                    <Field label="Avg Response" value={`${specialist.avgResponseDays}d`} small />
                    <Field label="Accepting New" value={specialist.acceptingNew ? "Yes" : "No"} small />
                  </div>
                </div>
              )}
            </div>

            {/* Reason + clinical notes */}
            <div className="bg-surface border border-border rounded-md p-4 mt-3">
              <div className="text-[10.5px] font-bold uppercase tracking-widest text-ink-muted mb-2">Reason for Referral</div>
              <div className="text-[12.5px] font-semibold text-ink mb-3">{r.reason}</div>
              {r.clinicalNotes && (
                <>
                  <div className="text-[10.5px] font-bold uppercase tracking-widest text-ink-muted mb-1">Clinical Notes</div>
                  <div className="text-[12px] text-ink-2 leading-relaxed">{r.clinicalNotes}</div>
                </>
              )}
              {r.appointmentNotes && (
                <div className="mt-3 pt-3 border-t border-border">
                  <div className="text-[10.5px] font-bold uppercase tracking-widest text-green mb-1">✓ Specialist Findings</div>
                  <div className="text-[12px] text-ink-2 leading-relaxed">{r.appointmentNotes}</div>
                </div>
              )}
            </div>

            {/* Authorization status */}
            {r.authorizationRequired && (
              <div className="bg-surface border border-border rounded-md p-3 mt-3 flex items-center gap-3">
                <span className="text-[16px]">🛡</span>
                <div className="flex-1 text-[11.5px]">
                  <strong className="text-ink-2">Prior Authorization Required</strong> ·
                  <span className="ml-1">
                    Status:{" "}
                    <Pill intent={r.authStatus === "approved" ? "green" : r.authStatus === "denied" ? "red" : "amber"}>
                      {r.authStatus === "approved" ? "✓ Approved" : r.authStatus === "denied" ? "Denied" : r.authStatus === "not_required" ? "Not Required" : "Pending"}
                    </Pill>
                  </span>
                </div>
              </div>
            )}

            {/* Actions */}
            <div className="flex gap-2 mt-3 flex-wrap">
              <Link href={`/patients/${r.patientId}`} className="btn btn-ghost btn-sm">
                👤 Patient Chart
              </Link>
              <button className="btn btn-ghost btn-sm" onClick={() => toast(`📞 Calling ${r.specialistName}`)}>
                📞 Call Specialist
              </button>
              <button className="btn btn-ghost btn-sm" onClick={() => toast(`📤 Resent referral to ${r.specialistName}`)}>
                📤 Resend
              </button>
              <button className="btn btn-ghost btn-sm" onClick={() => toast(`📋 Referral ${r.id} copied`)}>
                📋 Copy ID
              </button>
              {r.status === "pending" && (
                <button className="btn btn-primary btn-sm" onClick={onSchedule}>
                  📅 Schedule (next week)
                </button>
              )}
              {r.status === "scheduled" && (
                <button className="btn btn-primary btn-sm" onClick={onComplete}>
                  ✓ Mark Completed
                </button>
              )}
              {(r.status === "pending" || r.status === "scheduled") && (
                <button
                  className="btn btn-sm text-red border border-red-soft bg-transparent hover:bg-red-soft transition-colors ml-auto"
                  onClick={onCancel}
                >
                  🗑 Cancel
                </button>
              )}
            </div>
          </td>
        </tr>
      )}
    </>
  );
}

// ─── Specialist card ──────────────────────────────────────────────────────
interface SpecialistCardProps {
  key?: Key;
  specialist: Specialist;
  referralCount: number;
  onNewReferral: () => void;
}

function SpecialistCard({ specialist: s, referralCount, onNewReferral }: SpecialistCardProps) {
  const initials = s.name.split(" ").map((c) => c[0]).join("").slice(0, 2);

  return (
    <div className="bg-surface border border-border rounded-lg overflow-hidden hover:border-border-2 transition-colors">
      <div className="p-4">
        <div className="flex items-start gap-3 mb-3">
          <div
            className="w-12 h-12 rounded-full flex items-center justify-center text-[12px] font-bold text-white flex-shrink-0"
            style={{ background: s.color }}
          >
            {initials}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-0.5 flex-wrap">
              <div className="text-[14px] font-bold text-ink">{s.name}, {s.credentials}</div>
              {!s.acceptingNew && <Pill intent="amber">Waitlist</Pill>}
            </div>
            <div className="text-[11.5px] font-semibold mb-0.5" style={{ color: s.color }}>
              {SPECIALTY_ICON[s.specialty]} {s.specialty}
            </div>
            <div className="text-[11px] text-ink-muted">{s.practice} · {s.city}, {s.state}</div>
          </div>
          <button className="btn btn-primary btn-sm" onClick={onNewReferral}>
            + Refer
          </button>
        </div>

        <div className="grid grid-cols-3 gap-2 mb-3">
          <div className="bg-surface-2 border border-border rounded p-2 text-center">
            <div className="text-[14px] font-extrabold leading-none text-brand-dk">{referralCount}</div>
            <div className="text-[9.5px] font-bold uppercase tracking-widest text-ink-muted mt-1">Referrals</div>
          </div>
          <div className="bg-surface-2 border border-border rounded p-2 text-center">
            <div className="text-[14px] font-extrabold leading-none text-green">{s.avgResponseDays}d</div>
            <div className="text-[9.5px] font-bold uppercase tracking-widest text-ink-muted mt-1">Response</div>
          </div>
          <div className="bg-surface-2 border border-border rounded p-2 text-center">
            <div className="text-[14px] font-extrabold leading-none" style={{ color: s.acceptingNew ? "var(--color-green)" : "var(--color-amber)" }}>
              {s.acceptingNew ? "✓" : "⏸"}
            </div>
            <div className="text-[9.5px] font-bold uppercase tracking-widest text-ink-muted mt-1">Status</div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2 text-[11px]">
          <Field label="Phone" value={s.phone} mono small />
          <Field label="NPI"   value={s.npi} mono small />
        </div>

        {s.inNetworkPayers.length > 0 && (
          <div className="mt-3 pt-3 border-t border-border">
            <div className="text-[9.5px] font-bold uppercase tracking-widest text-ink-muted mb-1.5">In-Network</div>
            <div className="flex gap-1 flex-wrap">
              {s.inNetworkPayers.map((p) => (
                <span key={p} className="py-0.5 px-2 rounded-pill text-[10px] font-semibold bg-green-soft text-green border border-green-soft">
                  {p}
                </span>
              ))}
            </div>
          </div>
        )}

        {s.notes && (
          <div className="mt-3 pt-3 border-t border-border text-[11.5px] text-ink-muted leading-relaxed">
            💡 {s.notes}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Helpers ──────────────────────────────────────────────────────────────
function Field({ label, value, mono, small }: { label: string; value: string; mono?: boolean; small?: boolean }) {
  return (
    <div>
      <div className="text-[10px] uppercase tracking-widest text-ink-muted font-bold mb-0.5">{label}</div>
      <div className={`font-semibold text-ink truncate ${mono ? "font-mono" : ""} ${small ? "text-[11px]" : "text-[12.5px]"}`} title={value}>
        {value}
      </div>
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
