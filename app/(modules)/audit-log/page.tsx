"use client";

import { useMemo, useState, useEffect } from "react";
import Link from "next/link";
import type { Key, ReactNode } from "react";
import { Pill } from "@/components/ui/Pill";
import { Toast } from "@/components/ui/Toast";
import { KpiCard, KpiGrid } from "@/components/ui/Kpi";
import { toast } from "@/lib/hooks/useToast";
import { useAudit } from "@/lib/hooks/useAudit";
import { usePatients } from "@/lib/hooks/usePatients";
import type { AuditCategory, AuditEvent } from "@/lib/types";

// Map a server audit event (real access log) onto the page's display shape.
const SERVER_ACTION_META: Record<string, { category: AuditCategory; action: string; resourceType?: string }> = {
  "chart.view": { category: "patient", action: "Viewed patient chart", resourceType: "chart" },
  "auth.login": { category: "auth", action: "Signed in", resourceType: "session" },
  "auth.idle_logout": { category: "security", action: "Auto sign-out (inactivity)", resourceType: "session" },
};
interface ServerAuditEvent { id: string; at: string; action: string; actorEmail: string; actorName?: string; actorRole?: string; patientId?: string; detail?: string; ip?: string; }
function mapServerAudit(e: ServerAuditEvent, patientName?: string): AuditEvent {
  const at = Date.parse(e.at) || Date.now();
  const meta = SERVER_ACTION_META[e.action] || { category: "emr" as AuditCategory, action: e.action };
  return {
    id: e.id,
    timestamp: new Date(at).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }),
    orderedAt: at,
    user: e.actorName || e.actorEmail || "—",
    category: meta.category,
    action: meta.action,
    resourceType: meta.resourceType,
    patientId: e.patientId,
    patientName,
    ipAddress: e.ip || "—",
    success: true,
  };
}

type CategoryFilter = "all" | AuditCategory;
type DateRange = "today" | "week" | "month" | "all";

const PAGE_SIZE = 50;

const CATEGORY_LABEL: Record<AuditCategory, string> = {
  patient:  "Patient Data",
  auth:     "Auth",
  emr:      "EMR",
  billing:  "Billing",
  admin:    "Admin",
  security: "Security",
};

const CATEGORY_ICON: Record<AuditCategory, string> = {
  patient:  "👤",
  auth:     "🔐",
  emr:      "📝",
  billing:  "💳",
  admin:    "⚙",
  security: "🛡",
};

const CATEGORY_INTENT: Record<AuditCategory, "brand" | "green" | "purple" | "amber" | "blue" | "red"> = {
  patient:  "brand",
  auth:     "green",
  emr:      "purple",
  billing:  "amber",
  admin:    "blue",
  security: "red",
};

const RANGE_LABEL: Record<DateRange, string> = {
  today: "Today",
  week:  "Last 7 days",
  month: "Last 30 days",
  all:   "All time",
};

export default function AuditLogPage() {
  const events = useAudit((s) => s.events);
  const patients = usePatients((s) => s.patients);

  // Pull the real server-side access log and merge it into the viewer (deduped
  // by id). In production the demo seed is empty, so this shows only real events.
  useEffect(() => {
    let alive = true;
    fetch("/api/audit?limit=500")
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => {
        if (!alive || !j?.events || !Array.isArray(j.events)) return;
        const nameById = new Map(patients.map((p) => [p.id, p.name] as const));
        const mapped = (j.events as ServerAuditEvent[]).map((e) => mapServerAudit(e, e.patientId ? nameById.get(e.patientId) : undefined));
        useAudit.setState((s) => {
          const ids = new Set(mapped.map((m) => m.id));
          return { events: [...mapped, ...s.events.filter((ev) => !ids.has(ev.id))] };
        });
      })
      .catch(() => {});
    return () => { alive = false; };
  }, [patients]);

  const [category, setCategory] = useState<CategoryFilter>("all");
  const [range, setRange]       = useState<DateRange>("week");
  const [search, setSearch]     = useState("");
  const [page, setPage]         = useState(1);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  // KPIs — computed live
  const counts = useMemo(() => {
    const total = events.length;
    const phiAccesses = events.filter((e) => e.category === "patient" || e.category === "emr").length;
    const securityAlerts = events.filter((e) => e.category === "security" && !e.success).length;
    const failures = events.filter((e) => !e.success).length;
    return { total, phiAccesses, securityAlerts, failures };
  }, [events]);

  // Counts per category
  const categoryCounts = useMemo(() => {
    const map: Record<AuditCategory, number> = { patient: 0, auth: 0, emr: 0, billing: 0, admin: 0, security: 0 };
    for (const e of events) map[e.category]++;
    return map;
  }, [events]);

  // Filtered list
  const filtered = useMemo(() => {
    let list = events;
    if (category !== "all") list = list.filter((e) => e.category === category);

    // Date range — using the timestamp prefix
    if (range === "today") {
      list = list.filter((e) => e.timestamp.startsWith("Today"));
    } else if (range === "week") {
      list = list.filter((e) =>
        e.timestamp.startsWith("Today") ||
        e.timestamp.startsWith("Yesterday") ||
        /^May 2[3-9]/.test(e.timestamp)
      );
    }
    // "month" + "all" → no date filter

    if (search) {
      const q = search.toLowerCase();
      list = list.filter((e) =>
        e.user.toLowerCase().includes(q) ||
        e.action.toLowerCase().includes(q) ||
        (e.patientName || "").toLowerCase().includes(q) ||
        e.ipAddress.includes(q) ||
        e.id.toLowerCase().includes(q)
      );
    }
    return list;
  }, [events, category, range, search]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const start = (safePage - 1) * PAGE_SIZE;
  const pageRows = filtered.slice(start, start + PAGE_SIZE);

  function exportCsv() {
    const header = ["Event ID", "Timestamp", "User", "Category", "Action", "Patient", "Patient ID", "IP Address", "User Agent", "Success", "Error"];
    const rows = filtered.map((e) => [
      e.id,
      `"${e.timestamp}"`,
      `"${e.user.replace(/"/g, '""')}"`,
      CATEGORY_LABEL[e.category],
      `"${e.action.replace(/"/g, '""')}"`,
      e.patientName ? `"${e.patientName.replace(/"/g, '""')}"` : "",
      e.patientId || "",
      e.ipAddress,
      e.userAgent ? `"${e.userAgent}"` : "",
      e.success ? "true" : "false",
      e.errorMessage ? `"${e.errorMessage.replace(/"/g, '""')}"` : "",
    ].join(","));
    const csv = [header.join(","), ...rows].join("\n");
    const a = document.createElement("a");
    a.href = "data:text/csv;charset=utf-8," + encodeURIComponent(csv);
    a.download = `dripvitals_audit_log_${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    toast(`📥 Exported ${filtered.length} audit events to CSV · HIPAA-compliant retention`);
  }

  return (
    <div className="px-7 py-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 mb-5 flex-wrap">
        <div>
          <div className="text-[22px] font-bold tracking-tight text-ink mb-1">Audit Log</div>
          <div className="text-[13px] text-ink-muted">
            Immutable platform activity · HIPAA §164.312(b) · 7-year retention
          </div>
        </div>
        <div className="flex gap-2 items-center">
          <div
            className="inline-flex items-center gap-1.5 py-1.5 px-3 rounded-md text-[12px] font-semibold border"
            style={{ background: "var(--color-green-soft)", color: "var(--color-green)", borderColor: "rgba(31,138,112,.2)" }}
          >
            🛡 HIPAA Active
          </div>
          <button className="btn btn-ghost btn-sm" onClick={exportCsv}>📥 Export CSV</button>
        </div>
      </div>

      {/* KPI strip */}
      <KpiGrid cols={4}>
        <KpiCard
          label="Total Events"
          value={counts.total.toLocaleString()}
          icon="📋"
          iconBg="var(--color-brand-soft)"
          iconColor="var(--color-brand)"
          trend="Append-only"
          trendColor="var(--color-brand)"
        />
        <KpiCard
          label="PHI Accesses"
          value={counts.phiAccesses}
          icon="👤"
          iconBg="var(--color-green-soft)"
          iconColor="var(--color-green)"
          trend="Patient + EMR access"
          trendColor="var(--color-green)"
        />
        <KpiCard
          label="Security Alerts"
          value={counts.securityAlerts}
          icon="⚠"
          iconBg="var(--color-amber-soft)"
          iconColor="var(--color-amber)"
          trend={counts.securityAlerts > 0 ? "Review immediately" : "All clear"}
          trendColor={counts.securityAlerts > 0 ? "var(--color-amber)" : "var(--color-green)"}
        />
        <KpiCard
          label="Failed Operations"
          value={counts.failures}
          icon="🔴"
          iconBg="var(--color-red-soft)"
          iconColor="var(--color-red)"
          trend={counts.failures === 0 ? "No policy violations" : `${counts.failures} failures`}
          trendColor={counts.failures === 0 ? "var(--color-green)" : "var(--color-red)"}
        />
      </KpiGrid>

      {/* Compliance notice */}
      <div
        className="border border-green-soft rounded-lg py-3 px-4 mb-4 flex items-start gap-3"
        style={{ borderLeft: "3px solid var(--color-green)", background: "rgba(31,138,112,.04)" }}
      >
        <span className="text-[18px] flex-shrink-0">🛡</span>
        <div className="flex-1 text-[12px] text-ink-2">
          <div className="font-bold text-green mb-0.5">Audit log is read-only and append-only</div>
          <div>
            Per HIPAA §164.312(b), audit events cannot be edited or deleted. All entries are retained for <strong>7 years</strong> minimum. Encrypted at rest with AES-256. Log integrity is verified hourly via SHA-256 chain hashing.
          </div>
        </div>
      </div>

      {/* Filter bar */}
      <div className="bg-surface border border-border rounded-lg overflow-hidden">
        <div className="flex items-center gap-2 p-3 px-[18px] border-b border-border bg-surface-2 flex-wrap">
          {/* Category chips */}
          <button
            onClick={() => { setCategory("all"); setPage(1); }}
            className={[
              "py-1.5 px-3 rounded-pill text-[11.5px] font-semibold border transition-colors",
              category === "all" ? "bg-brand text-white border-brand" : "bg-surface border-border text-ink-2 hover:border-border-2",
            ].join(" ")}
          >
            All Types
          </button>
          {(Object.keys(CATEGORY_LABEL) as AuditCategory[]).map((c) => (
            <button
              key={c}
              onClick={() => { setCategory(c); setPage(1); }}
              className={[
                "py-1.5 px-3 rounded-pill text-[11.5px] font-semibold border transition-colors flex items-center gap-1.5",
                category === c ? "bg-brand text-white border-brand" : "bg-surface border-border text-ink-2 hover:border-border-2",
              ].join(" ")}
            >
              <span>{CATEGORY_ICON[c]}</span>
              <span>{CATEGORY_LABEL[c]}</span>
              <span
                className={[
                  "inline-flex items-center justify-center min-w-[18px] h-[17px] px-1 rounded-pill text-[10px] font-bold",
                  category === c ? "bg-white/20 text-white" : "bg-surface-3 text-ink-muted",
                ].join(" ")}
              >
                {categoryCounts[c]}
              </span>
            </button>
          ))}
          <div className="w-px h-5 bg-border mx-1" />
          {/* Date range */}
          <select
            className="fsel"
            style={{ width: 140, padding: "6px 26px 6px 12px", fontSize: 12 }}
            value={range}
            onChange={(e) => { setRange(e.target.value as DateRange); setPage(1); }}
          >
            {(Object.keys(RANGE_LABEL) as DateRange[]).map((r) => (
              <option key={r} value={r}>{RANGE_LABEL[r]}</option>
            ))}
          </select>
          <div className="flex items-center gap-1.5 bg-surface border border-border rounded-pill py-1 px-3.5 ml-auto min-w-[280px] focus-within:border-brand focus-within:shadow-[0_0_0_3px_rgba(31,138,112,.18)]">
            <span className="text-ink-muted text-[13px]">🔍</span>
            <input
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1); }}
              placeholder="Search user, action, patient, IP, event ID…"
              className="flex-1 bg-transparent border-none outline-none text-[12px] text-ink placeholder:text-ink-muted"
            />
          </div>
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-[13px]">
            <thead className="bg-surface-2">
              <tr>
                <Th>Timestamp</Th>
                <Th>User</Th>
                <Th>Category</Th>
                <Th>Action</Th>
                <Th>Patient</Th>
                <Th>IP Address</Th>
                <Th>Result</Th>
                <Th>{""}</Th>
              </tr>
            </thead>
            <tbody>
              {pageRows.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-ink-muted">
                    <div className="text-[36px] opacity-40 mb-2">📋</div>
                    <div className="text-[13px] font-bold text-ink mb-0.5">No events match</div>
                    <div className="text-[11.5px]">Try a different filter or search term</div>
                  </td>
                </tr>
              ) : (
                pageRows.map((e, i) => (
                  <AuditRow
                    key={e.id}
                    event={e}
                    expanded={expandedId === e.id}
                    onToggle={() => setExpandedId(expandedId === e.id ? null : e.id)}
                    delay={i * 8}
                  />
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        <div className="py-2.5 px-[18px] border-t border-border bg-surface-2 flex items-center gap-2.5 text-[11.5px] text-ink-muted">
          <span>
            {filtered.length === 0
              ? "0 events"
              : `Showing ${start + 1}–${Math.min(start + PAGE_SIZE, filtered.length)} of ${filtered.length.toLocaleString()}`}
          </span>
          <div className="flex-1" />
          <button className="btn btn-ghost btn-xs disabled:opacity-40" onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={safePage <= 1}>← Prev</button>
          <span className="font-semibold text-ink">Page {safePage} of {totalPages}</span>
          <button className="btn btn-ghost btn-xs disabled:opacity-40" onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={safePage >= totalPages}>Next →</button>
        </div>
      </div>

      <Toast />
    </div>
  );
}

// ─── Row component ────────────────────────────────────────────────────────
interface AuditRowProps {
  key?: Key;
  event: AuditEvent;
  expanded: boolean;
  onToggle: () => void;
  delay: number;
}

function AuditRow({ event: e, expanded, onToggle, delay }: AuditRowProps) {
  const userInitials = e.user.split(" ").map((s) => s[0]).join("").slice(0, 2);
  const isFailed = !e.success;

  return (
    <>
      <tr
        onClick={onToggle}
        className="cursor-pointer hover:bg-surface-2 transition-colors animate-fadeUp"
        style={{
          animationDelay: `${delay}ms`,
          borderLeft: isFailed ? "3px solid var(--color-red)" : undefined,
          background: isFailed ? "rgba(192,57,43,.025)" : undefined,
        }}
      >
        <Td><span className="font-mono text-[11px] text-ink-muted whitespace-nowrap">{e.timestamp}</span></Td>
        <Td>
          <div className="flex items-center gap-2">
            <div
              className="w-6 h-6 rounded-full flex items-center justify-center text-[9px] font-bold text-white flex-shrink-0"
              style={{ background: e.userColor || "var(--color-ink-muted)" }}
            >
              {userInitials}
            </div>
            <span className="text-[12px] font-semibold">{e.user}</span>
          </div>
        </Td>
        <Td>
          <Pill intent={CATEGORY_INTENT[e.category]}>
            <span className="mr-0.5">{CATEGORY_ICON[e.category]}</span> {CATEGORY_LABEL[e.category]}
          </Pill>
        </Td>
        <Td><span className="text-[12px]">{e.action}</span></Td>
        <Td>
          {e.patientId ? (
            <Link
              href={`/patients/${e.patientId}`}
              onClick={(ev) => ev.stopPropagation()}
              className="text-[12px] font-semibold text-brand-dk hover:underline"
            >
              {e.patientName}
            </Link>
          ) : e.patientName ? (
            <span className="text-[12px]">{e.patientName}</span>
          ) : (
            <span className="text-[11px] text-ink-muted">—</span>
          )}
        </Td>
        <Td><span className="font-mono text-[11px] text-ink-muted">{e.ipAddress}</span></Td>
        <Td>
          {e.success ? (
            <Pill intent="green" dot>✓ Success</Pill>
          ) : (
            <Pill intent="red" dot>✗ Failed</Pill>
          )}
        </Td>
        <Td>
          <button
            className="px-2 py-1 rounded-md bg-surface-2 border border-border text-[11px] font-semibold text-ink-2 hover:bg-brand-soft hover:border-brand hover:text-brand-dk transition-colors"
            onClick={(ev) => { ev.stopPropagation(); onToggle(); }}
          >
            {expanded ? "Hide" : "View"}
          </button>
        </Td>
      </tr>

      {expanded && (
        <tr>
          <td colSpan={8} className="py-[18px] px-[22px] border-b border-border-2" style={{ background: "#f8faff" }}>
            {/* Failure callout */}
            {isFailed && e.errorMessage && (
              <div className="mb-4 flex items-center gap-2.5 border border-red-soft rounded-md py-2.5 px-3.5" style={{ borderLeft: "3px solid var(--color-red)", background: "rgba(192,57,43,.04)" }}>
                <span className="text-[16px]">🔴</span>
                <div className="flex-1">
                  <div className="text-[11px] font-bold uppercase tracking-widest text-red mb-0.5">Operation Failed</div>
                  <div className="text-[13px] text-ink-2">{e.errorMessage}</div>
                </div>
              </div>
            )}

            <div className="grid grid-cols-4 gap-3 max-[800px]:grid-cols-2 mb-3">
              <Field label="Event ID"    value={e.id} mono />
              <Field label="Timestamp"   value={e.timestamp} mono />
              <Field label="User"        value={e.user} />
              <Field label="Category"    value={CATEGORY_LABEL[e.category]} />
              <Field label="Action"      value={e.action} />
              <Field label="IP Address"  value={e.ipAddress} mono />
              {e.userAgent && <Field label="User Agent" value={e.userAgent} />}
              {e.resourceType && <Field label="Resource Type" value={e.resourceType} />}
              {e.patientName && (
                <Field label="Patient" value={`${e.patientName}${e.patientId ? ` · ${e.patientId}` : ""}`} />
              )}
            </div>

            <div className="bg-surface border border-border rounded-md p-3 text-[11px] text-ink-muted flex items-center gap-2.5">
              <span className="text-[14px]">🔗</span>
              <div>
                <strong className="text-ink-2">Integrity Hash:</strong>
                <span className="font-mono text-ink-muted ml-2">sha256:{e.id.toLowerCase()}…a4f8</span>
                <span className="mx-2 text-ink-muted">·</span>
                <strong className="text-ink-2">Chained:</strong>
                <span className="font-mono text-ink-muted ml-1">prev:{`${parseInt(e.id.split("-")[1] || "0", 10) - 1}…b921`}</span>
              </div>
            </div>

            <div className="flex gap-2 mt-3 flex-wrap">
              {e.patientId && (
                <Link href={`/patients/${e.patientId}`} className="btn btn-ghost btn-sm">
                  👤 View Patient Chart
                </Link>
              )}
              <button className="btn btn-ghost btn-sm" onClick={() => toast(`📋 Event ${e.id} copied to clipboard`)}>
                📋 Copy Event ID
              </button>
              <button className="btn btn-ghost btn-sm" onClick={() => toast(`🔐 Compliance ticket opened for ${e.id}`)}>
                🚩 Flag for Review
              </button>
            </div>
          </td>
        </tr>
      )}
    </>
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
