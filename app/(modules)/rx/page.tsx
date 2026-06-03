"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import type { Key, ReactNode } from "react";
import { Pill } from "@/components/ui/Pill";
import { Toast } from "@/components/ui/Toast";
import { KpiCard, KpiGrid } from "@/components/ui/Kpi";
import { ConfirmModal } from "@/components/ui/ConfirmModal";
import { NewRxModal } from "@/components/modules/NewRxModal";
import { toast } from "@/lib/hooks/useToast";
import { usePrescriptions } from "@/lib/hooks/usePrescriptions";
import { usePatients } from "@/lib/hooks/usePatients";
import type { Prescription, RxStatusFull } from "@/lib/types";

type Filter = "all" | "active" | "pending" | "refill" | "denied" | "interactions";

const PAGE_SIZE = 25;

const STATUS_LABEL: Record<RxStatusFull, string> = {
  active:  "Active",
  pending: "Pending",
  refill:  "Refill Due",
  filled:  "Filled",
  denied:  "Denied",
  expired: "Expired",
};

const STATUS_INTENT: Record<RxStatusFull, "green" | "amber" | "red" | "muted" | "blue"> = {
  active:  "green",
  pending: "amber",
  refill:  "amber",
  filled:  "muted",
  denied:  "red",
  expired: "muted",
};

export default function RxPage() {
  const prescriptions = usePrescriptions((s) => s.prescriptions);
  const sendRefill    = usePrescriptions((s) => s.sendRefill);
  const renewRx       = usePrescriptions((s) => s.renew);
  const cancelRx      = usePrescriptions((s) => s.cancel);
  const addRx         = usePrescriptions((s) => s.add);
  const setRxStatus   = usePrescriptions((s) => s.setStatus);
  const patients      = usePatients((s) => s.patients);

  const [filter, setFilter]       = useState<Filter>("all");
  const [search, setSearch]       = useState("");
  const [page, setPage]           = useState(1);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [newRxOpen, setNewRxOpen] = useState(false);
  const [cancelTarget, setCancelTarget] = useState<Prescription | null>(null);

  // KPIs
  const counts = useMemo(() => {
    return {
      total:        prescriptions.length,
      thisMonth:    prescriptions.filter((r) => r.prescribedAt >= 20260501).length,
      transmitted:  prescriptions.filter((r) => r.status === "active" || r.status === "filled").length,
      pending:      prescriptions.filter((r) => r.status === "pending").length,
      refillDue:    prescriptions.filter((r) => r.status === "refill" || r.refillsRemaining === 0 && r.status === "active").length,
      interactions: prescriptions.filter((r) => r.interactionFlag).length,
      active:       prescriptions.filter((r) => r.status === "active").length,
      denied:       prescriptions.filter((r) => r.status === "denied").length,
    };
  }, [prescriptions]);

  // Filtered + searched list
  const filtered = useMemo(() => {
    let list = prescriptions;
    switch (filter) {
      case "active":       list = list.filter((r) => r.status === "active"); break;
      case "pending":      list = list.filter((r) => r.status === "pending"); break;
      case "refill":       list = list.filter((r) => r.status === "refill" || (r.status === "active" && r.refillsRemaining === 0)); break;
      case "denied":       list = list.filter((r) => r.status === "denied" || r.status === "expired"); break;
      case "interactions": list = list.filter((r) => !!r.interactionFlag); break;
    }
    if (search) {
      const q = search.toLowerCase();
      list = list.filter((r) =>
        r.patientName.toLowerCase().includes(q) ||
        r.medication.toLowerCase().includes(q) ||
        r.id.toLowerCase().includes(q) ||
        r.pharmacy.toLowerCase().includes(q)
      );
    }
    return [...list].sort((a, b) => b.prescribedAt - a.prescribedAt);
  }, [prescriptions, filter, search]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const start = (safePage - 1) * PAGE_SIZE;
  const pageRows = filtered.slice(start, start + PAGE_SIZE);

  function handleSendRefill(r: Prescription) {
    if (r.refillsRemaining === 0) {
      toast(`⚠ No refills remaining — renew to issue a new prescription`);
      return;
    }
    sendRefill(r.id);
    toast(`📦 Refill sent to ${r.pharmacy} · ${r.refillsRemaining - 1} refill${r.refillsRemaining - 1 === 1 ? "" : "s"} left`);
  }

  function handleRenew(r: Prescription) {
    const created = renewRx(r.id);
    if (created) {
      toast(`↻ Renewed as ${created.id} — pending pharmacy transmission`);
      setExpandedId(created.id);
    }
  }

  function handleApprove(r: Prescription) {
    setRxStatus(r.id, "active");
    toast(`✓ ${r.id} approved · transmitted to ${r.pharmacy}`);
  }

  function exportCsv() {
    const header = ["Rx ID", "Patient", "Patient ID", "Medication", "Strength", "Dose", "Qty", "Refills", "Pharmacy", "Date", "Status", "Prescriber"];
    const rows = filtered.map((r) => [
      r.id,
      `"${r.patientName.replace(/"/g, '""')}"`,
      r.patientId || "",
      r.medication, r.strength, r.dose,
      r.qty, r.refillsRemaining,
      r.pharmacy, r.prescribedDate, r.status, r.prescriber,
    ].join(","));
    const csv = [header.join(","), ...rows].join("\n");
    const a = document.createElement("a");
    a.href = "data:text/csv;charset=utf-8," + encodeURIComponent(csv);
    a.download = `dripvitals_rx_${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    toast(`📥 Exported ${filtered.length} prescription${filtered.length === 1 ? "" : "s"} to CSV`);
  }

  return (
    <div className="px-7 py-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 mb-5 flex-wrap">
        <div>
          <div className="text-[22px] font-bold tracking-tight text-ink mb-1">e-Prescribe</div>
          <div className="text-[13px] text-ink-muted">
            EPCS-compliant · Real-time drug interaction check
          </div>
        </div>
        <div className="flex gap-2">
          <button className="btn btn-ghost btn-sm" onClick={exportCsv}>📥 Export CSV</button>
          <button className="btn btn-primary btn-sm" onClick={() => setNewRxOpen(true)}>+ New Prescription</button>
        </div>
      </div>

      {/* KPI strip */}
      <KpiGrid cols={4}>
        <KpiCard
          label="Rx This Month"
          value={counts.thisMonth}
          icon="💊"
          iconBg="var(--color-brand-soft)"
          iconColor="var(--color-brand)"
          trend={`${counts.total} all-time`}
          trendColor="var(--color-brand)"
        />
        <KpiCard
          label="Transmitted"
          value={counts.transmitted}
          icon="✅"
          iconBg="var(--color-green-soft)"
          iconColor="var(--color-green)"
          trend={`${Math.round((counts.transmitted / Math.max(1, counts.total)) * 100)}% success`}
          trendColor="var(--color-green)"
        />
        <KpiCard
          label="Pending Fill"
          value={counts.pending}
          icon="⏳"
          iconBg="var(--color-amber-soft)"
          iconColor="var(--color-amber)"
          trend={counts.pending > 0 ? "Action needed" : "All clear"}
          trendColor="var(--color-amber)"
        />
        <KpiCard
          label="Interactions Found"
          value={counts.interactions}
          icon="⚠️"
          iconBg="var(--color-red-soft)"
          iconColor="var(--color-red)"
          trend={counts.interactions > 0 ? "Review now" : "Clean"}
          trendColor={counts.interactions > 0 ? "var(--color-red)" : "var(--color-green)"}
        />
      </KpiGrid>

      {/* Filter bar */}
      <div className="bg-surface border border-border rounded-lg overflow-hidden">
        <div className="flex items-center gap-2 p-3 px-[18px] border-b border-border bg-surface-2 flex-wrap">
          {([
            { v: "all",          label: "All" },
            { v: "active",       label: "Active" },
            { v: "pending",      label: "Pending" },
            { v: "refill",       label: "Refills Due" },
            { v: "interactions", label: "⚠ Interactions" },
            { v: "denied",       label: "Denied" },
          ] as { v: Filter; label: string }[]).map((f) => (
            <button
              key={f.v}
              onClick={() => { setFilter(f.v); setPage(1); }}
              className={[
                "py-1.5 px-3 rounded-pill text-[11.5px] font-semibold border transition-colors",
                filter === f.v ? "bg-brand text-white border-brand" : "bg-surface border-border text-ink-2 hover:border-border-2",
              ].join(" ")}
            >
              {f.label}
            </button>
          ))}
          <div className="flex items-center gap-1.5 bg-surface border border-border rounded-pill py-1 px-3.5 ml-auto min-w-[240px] focus-within:border-brand focus-within:shadow-[0_0_0_3px_rgba(31,138,112,.18)]">
            <span className="text-ink-muted text-[13px]">🔍</span>
            <input
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1); }}
              placeholder="Search by patient, medication, ID…"
              className="flex-1 bg-transparent border-none outline-none text-[12px] text-ink placeholder:text-ink-muted"
            />
          </div>
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-[13px]">
            <thead className="bg-surface-2">
              <tr>
                <Th>Patient</Th>
                <Th>Medication</Th>
                <Th>Dose</Th>
                <Th>Qty</Th>
                <Th>Refills</Th>
                <Th>Pharmacy</Th>
                <Th>Date</Th>
                <Th>Status</Th>
                <Th>{""}</Th>
              </tr>
            </thead>
            <tbody>
              {pageRows.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-12 text-center text-ink-muted">
                    <div className="text-[36px] opacity-40 mb-2">💊</div>
                    <div className="text-[13px] font-bold text-ink mb-0.5">No prescriptions match</div>
                    <div className="text-[11.5px]">Try a different filter or search term</div>
                  </td>
                </tr>
              ) : (
                pageRows.map((r, i) => {
                  const expanded = expandedId === r.id;
                  const patient = r.patientId ? patients.find((p) => p.id === r.patientId) : undefined;
                  return (
                    <RxRow
                      key={r.id}
                      rx={r}
                      expanded={expanded}
                      onToggle={() => setExpandedId(expanded ? null : r.id)}
                      onSendRefill={() => handleSendRefill(r)}
                      onRenew={() => handleRenew(r)}
                      onApprove={() => handleApprove(r)}
                      onCancel={() => setCancelTarget(r)}
                      patient={patient}
                      delay={i * 20}
                    />
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        <div className="py-2.5 px-[18px] border-t border-border bg-surface-2 flex items-center gap-2.5 text-[11.5px] text-ink-muted">
          <span>
            {filtered.length === 0
              ? "0 prescriptions"
              : `Showing ${start + 1}–${Math.min(start + PAGE_SIZE, filtered.length)} of ${filtered.length}`}
          </span>
          <div className="flex-1" />
          <button
            className="btn btn-ghost btn-xs disabled:opacity-40"
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={safePage <= 1}
          >← Prev</button>
          <span className="font-semibold text-ink">Page {safePage} of {totalPages}</span>
          <button
            className="btn btn-ghost btn-xs disabled:opacity-40"
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={safePage >= totalPages}
          >Next →</button>
        </div>
      </div>

      <NewRxModal
        open={newRxOpen}
        onClose={() => setNewRxOpen(false)}
        onSave={(rx) => {
          const created = addRx(rx);
          toast(`✓ ${created.id} created · ${created.patientName} · ${created.medication} ${created.strength}`);
        }}
      />

      <ConfirmModal
        open={!!cancelTarget}
        onClose={() => setCancelTarget(null)}
        onConfirm={() => {
          if (cancelTarget) {
            cancelRx(cancelTarget.id);
            toast(`🚫 ${cancelTarget.id} cancelled`);
          }
        }}
        icon="🚫"
        title="Cancel this prescription?"
        message={cancelTarget ? `${cancelTarget.id} for ${cancelTarget.patientName} (${cancelTarget.medication} ${cancelTarget.strength}) will be marked as denied. The patient and pharmacy will be notified.` : ""}
        confirmLabel="Cancel Rx"
      />

      <Toast />
    </div>
  );
}

// ─── Row component ────────────────────────────────────────────────────────
interface RxRowProps {
  key?: Key;
  rx: Prescription;
  expanded: boolean;
  onToggle: () => void;
  onSendRefill: () => void;
  onRenew: () => void;
  onApprove: () => void;
  onCancel: () => void;
  patient?: { color: string };
  delay: number;
}

function RxRow({ rx: r, expanded, onToggle, onSendRefill, onRenew, onApprove, onCancel, patient, delay }: RxRowProps) {
  const initials = r.patientName.split(" ").map((s) => s[0]).join("").slice(0, 2);
  const color = patient?.color || "var(--color-ink-muted)";
  const hasInteraction = !!r.interactionFlag;
  const noRefills = r.refillsRemaining === 0;

  return (
    <>
      <tr
        onClick={onToggle}
        className="cursor-pointer hover:bg-surface-2 transition-colors animate-fadeUp"
        style={{
          animationDelay: `${delay}ms`,
          borderLeft: hasInteraction ? "3px solid var(--color-red)" : undefined,
          background: hasInteraction ? "rgba(192,57,43,.025)" : undefined,
        }}
      >
        <Td>
          <div className="flex items-center gap-2.5">
            <div
              className="w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-bold text-white flex-shrink-0"
              style={{ background: color }}
            >
              {initials}
            </div>
            <div>
              <span className="text-[12.5px] font-semibold">{r.patientName}</span>
              <div className="text-[10px] font-mono text-ink-muted">{r.id}</div>
            </div>
          </div>
        </Td>
        <Td>
          <div className="flex items-center gap-1.5">
            <span className="font-semibold text-[12.5px]">{r.medication}</span>
            {hasInteraction && <span title={r.interactionFlag} className="text-[12px]">⚠️</span>}
          </div>
          <div className="text-[10.5px] text-ink-muted">{r.strength}</div>
        </Td>
        <Td><span className="text-[12px]">{r.dose}</span></Td>
        <Td><span className="font-mono text-[11.5px]">{r.qty}</span></Td>
        <Td>
          <span className={`font-mono text-[11.5px] font-semibold ${noRefills ? "text-amber" : "text-ink"}`}>
            {r.refillsRemaining}
          </span>
        </Td>
        <Td><span className="text-[12px] text-ink-2">{r.pharmacy}</span></Td>
        <Td><span className="font-mono text-[11px] text-ink-muted">{r.prescribedDate}</span></Td>
        <Td><Pill intent={STATUS_INTENT[r.status]} dot>{STATUS_LABEL[r.status]}</Pill></Td>
        <Td>
          <button
            className="px-2.5 py-1 rounded-md bg-surface-2 border border-border text-[11px] font-semibold text-ink-2 hover:bg-brand-soft hover:border-brand hover:text-brand-dk transition-colors"
            onClick={(e) => { e.stopPropagation(); onToggle(); }}
          >
            {expanded ? "Hide" : "View"}
          </button>
        </Td>
      </tr>

      {expanded && (
        <tr>
          <td colSpan={9} className="py-[18px] px-[22px] border-b border-border-2" style={{ background: "#f8faff" }}>
            {hasInteraction && (
              <div className="mb-4 flex items-start gap-2.5 border border-red-soft rounded-md py-2.5 px-3.5" style={{ borderLeft: "3px solid var(--color-red)", background: "rgba(192,57,43,.04)" }}>
                <span className="text-[16px]">⚠️</span>
                <div className="flex-1">
                  <div className="text-[11px] font-bold uppercase tracking-widest text-red mb-0.5">Drug Interaction</div>
                  <div className="text-[13px] text-ink-2">{r.interactionFlag}</div>
                </div>
              </div>
            )}

            <div className="grid grid-cols-4 gap-3 max-[800px]:grid-cols-2">
              <DetailField label="Rx ID"          value={r.id} mono />
              <DetailField label="Prescriber"     value={r.prescriber} />
              <DetailField label="Days Supply"    value={`${r.daySupply} days`} />
              <DetailField label="Date Written"   value={r.prescribedDate} mono />
            </div>

            <div className="mt-3 grid grid-cols-3 gap-3 max-[800px]:grid-cols-2">
              <DetailField label="Medication"     value={`${r.medication} ${r.strength}`} />
              <DetailField label="Qty"            value={String(r.qty)} mono />
              <DetailField label="Refills Left"   value={String(r.refillsRemaining)} mono />
            </div>

            <div className="mt-3 bg-surface border border-border rounded-md px-4 py-3">
              <div className="text-[10px] uppercase tracking-widest text-ink-muted font-bold mb-1">Signa / Instructions</div>
              <div className="text-[13px] text-ink leading-relaxed whitespace-pre-wrap">{r.sig}</div>
            </div>

            <div className="flex gap-2 mt-4 flex-wrap">
              {r.status === "pending" && (
                <button className="btn btn-primary btn-sm" onClick={onApprove}>
                  ✓ Approve & Transmit
                </button>
              )}
              {(r.status === "active" || r.status === "refill") && r.refillsRemaining > 0 && (
                <button className="btn btn-primary btn-sm" onClick={onSendRefill}>
                  📦 Send Refill ({r.refillsRemaining} left)
                </button>
              )}
              {(r.status === "active" || r.refillsRemaining === 0) && (
                <button className="btn btn-ghost btn-sm" onClick={onRenew}>
                  ↻ Renew Prescription
                </button>
              )}
              {r.patientId && (
                <Link href={`/patients/${r.patientId}`} className="btn btn-ghost btn-sm">
                  👤 View Patient Chart
                </Link>
              )}
              <button className="btn btn-ghost btn-sm" onClick={() => toast(`📋 ${r.id} details copied`)}>
                📋 Copy
              </button>
              <button className="btn btn-ghost btn-sm" onClick={() => toast("🖨 Print Rx preview")}>
                🖨 Print
              </button>
              {r.status !== "denied" && r.status !== "expired" && (
                <button
                  className="btn btn-sm text-red border border-red-soft bg-transparent hover:bg-red-soft transition-colors"
                  onClick={onCancel}
                >
                  🚫 Cancel
                </button>
              )}
            </div>
          </td>
        </tr>
      )}
    </>
  );
}

function DetailField({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
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
