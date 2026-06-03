"use client";

import { useMemo, useState } from "react";
import type { Key } from "react";
import Link from "next/link";
import { Pill } from "@/components/ui/Pill";
import { Modal } from "@/components/ui/Modal";
import { toast } from "@/lib/hooks/useToast";
import { useTreatmentRequests } from "@/lib/hooks/useTreatmentRequests";
import { usePrescriptions } from "@/lib/hooks/usePrescriptions";
import { usePatientDocuments } from "@/lib/hooks/usePatientDocuments";
import type { Patient, Prescription, PatientDocument, TreatmentRequest, TreatmentRequestStatus } from "@/lib/types";

interface Props {
  patient: Patient;
}

const STATUS_PILL: Record<TreatmentRequestStatus, { intent: "amber" | "green" | "red" | "muted" | "brand"; label: string; dot?: boolean }> = {
  pending:    { intent: "amber", label: "⏳ Awaiting Review", dot: true },
  approved:   { intent: "green", label: "✓ Approved — Ready to Prescribe", dot: true },
  prescribed: { intent: "brand", label: "💊 Prescribed", dot: true },
  denied:     { intent: "red",   label: "✕ Denied", dot: true },
};

export function PendingTreatmentCard({ patient }: Props) {
  // IMPORTANT: pulling the array reference directly (not .filter() inside the
  // selector) keeps the snapshot stable across renders. Filtering inside the
  // selector creates a new array each render, which makes
  // useSyncExternalStore (zustand's underlying API) loop infinitely.
  const allRequests = useTreatmentRequests((s) => s.requests);
  const approve     = useTreatmentRequests((s) => s.approve);
  const deny        = useTreatmentRequests((s) => s.deny);

  const requests = useMemo(
    () => allRequests.filter((r) => r.patientId === patient.id),
    [allRequests, patient.id]
  );

  const [approveTarget, setApproveTarget] = useState<TreatmentRequest | null>(null);
  const [denyTarget,    setDenyTarget]    = useState<TreatmentRequest | null>(null);
  const [denyReason, setDenyReason] = useState("");
  const [approveNotes, setApproveNotes] = useState("");
  const [reviewer, setReviewer]   = useState("Dr. Rivera");
  const [collapsed, setCollapsed] = useState(false);

  // Sort: pending → approved → prescribed → denied. Within each, newest first.
  const sortedRequests = useMemo(() => {
    const order: Record<TreatmentRequestStatus, number> = { pending: 0, approved: 1, prescribed: 2, denied: 3 };
    return [...requests].sort((a, b) => {
      if (order[a.status] !== order[b.status]) return order[a.status] - order[b.status];
      return b.submittedAt - a.submittedAt;
    });
  }, [requests]);

  if (sortedRequests.length === 0) return null;

  const pendingCount = sortedRequests.filter((r) => r.status === "pending").length;
  const approvedCount = sortedRequests.filter((r) => r.status === "approved").length;
  const hasActionable = pendingCount > 0 || approvedCount > 0;

  return (
    <div
      className={`bg-surface border rounded-lg mb-4 overflow-hidden ${hasActionable ? "border-amber" : "border-border"}`}
      style={hasActionable ? { borderLeft: "3px solid var(--color-amber)" } : undefined}
    >
      {/* Card header */}
      <button
        onClick={() => setCollapsed(!collapsed)}
        className="w-full py-3 px-4 flex items-center gap-3 bg-surface-2 border-b border-border hover:bg-surface-3 transition-colors text-left"
      >
        <div
          className="w-9 h-9 rounded-md flex items-center justify-center text-[16px] flex-shrink-0 border"
          style={{
            background: hasActionable ? "var(--color-amber-soft)" : "var(--color-brand-soft)",
            color:      hasActionable ? "var(--color-amber)"      : "var(--color-brand)",
            borderColor: hasActionable ? "var(--color-amber-soft)" : "var(--color-brand-soft)",
          }}
        >
          {hasActionable ? "⚠" : "💉"}
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-[13.5px] font-bold text-ink flex items-center gap-2 flex-wrap">
            Treatment Requests
            {pendingCount > 0 && <Pill intent="amber" dot>{pendingCount} pending</Pill>}
            {approvedCount > 0 && <Pill intent="green" dot>{approvedCount} ready to prescribe</Pill>}
          </div>
          <div className="text-[11.5px] text-ink-muted mt-0.5">
            {pendingCount > 0
              ? `Patient submitted a treatment request via intake form — review and approve, deny, or escalate.`
              : approvedCount > 0
                ? `Approved request${approvedCount === 1 ? "" : "s"} awaiting prescription — click Prescribe to send to e-Rx.`
                : `Showing complete request history for this patient.`}
          </div>
        </div>
        <span className="text-ink-muted text-[13px] flex-shrink-0">
          {collapsed ? "▸" : "▾"}
        </span>
      </button>

      {/* Card body */}
      {!collapsed && (
        <div className="p-4 space-y-3">
          {sortedRequests.map((r) => (
            <RequestRow
              key={r.id}
              request={r}
              onApprove={() => {
                setApproveTarget(r);
                setApproveNotes("");
                setReviewer("Dr. Rivera");
              }}
              onDeny={() => {
                setDenyTarget(r);
                setDenyReason("");
                setReviewer("Dr. Rivera");
              }}
            />
          ))}
        </div>
      )}

      {/* Approve modal */}
      {approveTarget && (
        <Modal
          open={!!approveTarget}
          onClose={() => setApproveTarget(null)}
          title="Approve Treatment Request"
          icon="✓"
          width={520}
          footer={
            <>
              <button className="btn btn-ghost" onClick={() => setApproveTarget(null)}>Cancel</button>
              <button
                className="btn btn-primary"
                onClick={() => {
                  approve(approveTarget.id, reviewer, approveNotes.trim() || undefined);
                  toast(`✓ ${approveTarget.treatmentName} approved for ${approveTarget.patientName}`);
                  setApproveTarget(null);
                }}
              >
                ✓ Approve
              </button>
            </>
          }
        >
          <div className="bg-surface-2 border border-border rounded-md p-3 mb-3 flex items-center gap-3">
            <div
              className="w-10 h-10 rounded-md flex items-center justify-center text-[18px] flex-shrink-0 border border-border bg-surface"
              style={{ color: approveTarget.color }}
            >
              {approveTarget.icon}
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-[13px] font-bold">{approveTarget.treatmentName}</div>
              <div className="text-[11px] text-ink-muted">{approveTarget.medication} · {approveTarget.dosingProtocol}</div>
            </div>
          </div>
          <div className="mb-3">
            <label className="fl">Approving Provider</label>
            <select className="fsel" value={reviewer} onChange={(e) => setReviewer(e.target.value)}>
              <option>Dr. Rivera</option>
              <option>Dr. Patel</option>
              <option>Dr. Lee</option>
              <option>NP Wang</option>
            </select>
          </div>
          <div className="mb-3">
            <label className="fl">Clinical Notes <span className="text-ink-muted font-normal">(optional)</span></label>
            <textarea
              className="fta"
              rows={3}
              value={approveNotes}
              onChange={(e) => setApproveNotes(e.target.value)}
              placeholder="e.g. Patient meets criteria. Confirmed no contraindications. Start at lowest dose."
            />
          </div>
          <div className="text-[11px] text-ink-muted bg-green-soft border border-green-soft rounded px-3 py-2">
            ✓ After approval, you'll be able to <strong>Prescribe</strong> from this request to create an e-Rx and route it to the pharmacy.
          </div>
        </Modal>
      )}

      {/* Deny modal */}
      {denyTarget && (
        <Modal
          open={!!denyTarget}
          onClose={() => setDenyTarget(null)}
          title="Deny Treatment Request"
          icon="✕"
          width={520}
          footer={
            <>
              <button className="btn btn-ghost" onClick={() => setDenyTarget(null)}>Cancel</button>
              <button
                className="px-3.5 py-2 rounded-md bg-red text-white text-[12px] font-bold hover:opacity-90 transition-opacity"
                style={{ background: "var(--color-red)" }}
                onClick={() => {
                  if (!denyReason.trim()) {
                    toast("⚠ A denial reason is required");
                    return;
                  }
                  deny(denyTarget.id, reviewer, denyReason.trim());
                  toast(`✕ ${denyTarget.treatmentName} denied for ${denyTarget.patientName}`);
                  setDenyTarget(null);
                }}
              >
                ✕ Confirm Denial
              </button>
            </>
          }
        >
          <div className="bg-surface-2 border border-border rounded-md p-3 mb-3 flex items-center gap-3">
            <div
              className="w-10 h-10 rounded-md flex items-center justify-center text-[18px] flex-shrink-0 border border-border bg-surface"
              style={{ color: denyTarget.color }}
            >
              {denyTarget.icon}
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-[13px] font-bold">{denyTarget.treatmentName}</div>
              <div className="text-[11px] text-ink-muted">{denyTarget.medication}</div>
            </div>
          </div>
          <div className="mb-3">
            <label className="fl">Denying Provider</label>
            <select className="fsel" value={reviewer} onChange={(e) => setReviewer(e.target.value)}>
              <option>Dr. Rivera</option>
              <option>Dr. Patel</option>
              <option>Dr. Lee</option>
              <option>NP Wang</option>
            </select>
          </div>
          <div className="mb-3">
            <label className="fl">Denial Reason<span className="text-red ml-0.5">*</span></label>
            <textarea
              className="fta"
              rows={4}
              value={denyReason}
              onChange={(e) => setDenyReason(e.target.value)}
              placeholder="e.g. BMI below eligibility threshold. Alternative therapy recommended..."
            />
          </div>
          <div className="text-[11px] text-ink-muted bg-amber-soft border border-amber-soft rounded px-3 py-2">
            💡 The patient will be notified of the denial via the patient portal. Recommended: schedule a follow-up to discuss alternatives.
          </div>
        </Modal>
      )}
    </div>
  );
}

// ─── Individual request row ───────────────────────────────────────────
function RequestRow({ request: r, onApprove, onDeny }: {
  key?: Key;
  request: TreatmentRequest;
  onApprove: () => void;
  onDeny: () => void;
}) {
  const [expanded, setExpanded] = useState(r.status === "pending" || r.status === "approved");
  const meta = STATUS_PILL[r.status];

  // Look up the live Rx for this request — surfaces the current order status
  // (Pending / Filled / Denied / etc.) so the chart card always reflects the
  // pharmacy's latest state, not just the snapshot at submission time.
  const allRx = usePrescriptions((s) => s.prescriptions);
  const rx = useMemo<Prescription | null>(
    () => (r.prescriptionId ? allRx.find((p) => p.id === r.prescriptionId) || null : null),
    [allRx, r.prescriptionId]
  );

  // Find the saved patient-document for this Rx so "View Document" deep-links
  // to the signed prescription. We pick the latest rx-category doc for the
  // patient whose rxPayload contains a medication matching this request.
  const allDocs = usePatientDocuments((s) => s.documents);
  const doc = useMemo<PatientDocument | null>(() => {
    if (r.status !== "prescribed") return null;
    const candidates = allDocs.filter(
      (d) => d.patientId === r.patientId && d.category === "rx" && d.rxPayload,
    );
    // Match by medication name in rxPayload.medications, fall back to latest
    const match = candidates.find((d) =>
      d.rxPayload?.medications.some(
        (m) => m.name.toLowerCase().includes(r.medication.toLowerCase()) ||
               r.medication.toLowerCase().includes(m.name.toLowerCase()),
      ),
    );
    return match || candidates[0] || null;
  }, [allDocs, r.status, r.patientId, r.medication]);

  // Live order-status pill (from Prescription, not TreatmentRequest)
  const orderStatusPill = useMemo<{ intent: "amber" | "green" | "red" | "muted" | "blue"; label: string } | null>(() => {
    if (!rx) return null;
    const s = (rx.status || "").toLowerCase();
    if (s === "pending")  return { intent: "amber", label: "⏳ Pending pharmacy fulfillment" };
    if (s === "filled")   return { intent: "green", label: "✓ Filled" };
    if (s === "shipped")  return { intent: "blue",  label: "📦 Shipped" };
    if (s === "denied")   return { intent: "red",   label: "✕ Denied" };
    if (s === "expired")  return { intent: "muted", label: "Expired" };
    return { intent: "muted", label: rx.status || "Unknown" };
  }, [rx]);

  return (
    <div
      className={`rounded-md border overflow-hidden transition-colors ${
        r.status === "pending"    ? "border-amber bg-amber-soft/30" :
        r.status === "approved"   ? "border-green bg-green-soft/40" :
        r.status === "prescribed" ? "border-brand-soft bg-brand-soft/30" :
        r.status === "denied"     ? "border-border bg-surface-2 opacity-75" :
                                    "border-border bg-surface"
      }`}
    >
      {/* Header row — always visible */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full text-left p-3.5 flex items-center gap-3 hover:bg-white/30 transition-colors"
      >
        <div
          className="w-11 h-11 rounded-md flex items-center justify-center text-[20px] flex-shrink-0 border border-border bg-surface"
          style={{ color: r.color }}
        >
          {r.icon}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-0.5 flex-wrap">
            <div className="text-[13.5px] font-bold text-ink">{r.treatmentName}</div>
            <Pill intent={meta.intent} dot={meta.dot}>{meta.label}</Pill>
          </div>
          <div className="text-[11.5px] text-ink-muted">
            {r.medication} · {r.dosingProtocol} · ${r.price.toLocaleString()}
          </div>
          <div className="text-[10.5px] text-ink-muted mt-0.5">
            📝 Submitted <strong className="text-ink-2">{r.submittedDate}</strong>
            {r.intakeFormName ? ` via ${r.intakeFormName}` : ""}
            {r.visitId ? ` · Visit ${r.visitId}` : ""}
          </div>
        </div>
        <span className="text-ink-muted text-[13px] flex-shrink-0">
          {expanded ? "▾" : "▸"}
        </span>
      </button>

      {/* Expanded content */}
      {expanded && (
        <div className="px-3.5 pb-3.5 pt-1 space-y-3">
          {/* Intake highlights */}
          {r.intakeHighlights && r.intakeHighlights.length > 0 && (
            <div>
              <div className="text-[10px] font-bold uppercase tracking-widest text-ink-muted mb-1.5">
                📋 Patient Intake Answers
              </div>
              <div className="bg-surface border border-border rounded-md overflow-hidden">
                {r.intakeHighlights.map((h, i) => (
                  <div
                    key={i}
                    className={`flex items-center gap-3 py-2 px-3 ${i < (r.intakeHighlights!.length - 1) ? "border-b border-border" : ""}`}
                  >
                    <div className="text-[11.5px] text-ink-muted font-medium flex-shrink-0 w-[180px]">{h.label}</div>
                    <div className="text-[12px] font-semibold text-ink-2 flex-1 min-w-0">{h.value}</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Status-specific context */}
          {r.status === "approved" && (r.notes || r.approvedBy) && (
            <div className="bg-green-soft border border-green-soft rounded-md p-2.5 text-[11.5px]">
              <div className="font-bold text-green mb-0.5">
                ✓ Approved by {r.approvedBy} · {r.approvedDate}
              </div>
              {r.notes && <div className="text-ink-2">{r.notes}</div>}
            </div>
          )}
          {r.status === "denied" && (
            <div className="bg-red-soft border border-red-soft rounded-md p-2.5 text-[11.5px]">
              <div className="font-bold text-red mb-0.5">
                ✕ Denied by {r.deniedBy}
              </div>
              {r.deniedReason && <div className="text-ink-2">{r.deniedReason}</div>}
            </div>
          )}
          {r.status === "prescribed" && r.prescriptionId && (
            <div className="bg-brand-soft border border-brand-soft rounded-md p-3 space-y-2">
              {/* Top row: prescribed header + live order status */}
              <div className="flex items-center gap-2 flex-wrap">
                <div className="font-bold text-brand-dk text-[12.5px]">
                  💊 Prescribed {r.prescribedDate}
                </div>
                {orderStatusPill && <Pill intent={orderStatusPill.intent} dot>{orderStatusPill.label}</Pill>}
              </div>

              {/* Order details */}
              <div className="text-[11.5px] text-ink-2 space-y-0.5">
                <div>
                  Rx <span className="font-mono font-bold">{r.prescriptionId}</span>
                  {r.approvedBy && <> · approved by <strong>{r.approvedBy}</strong></>}
                </div>
                {rx && (
                  <div>
                    <span className="text-ink-muted">Routed to:</span>{" "}
                    <strong>{rx.pharmacy}</strong>
                    {rx.daySupply ? <> · {rx.daySupply} day supply</> : null}
                    {rx.refillsRemaining > 0 ? <> · {rx.refillsRemaining} refills</> : null}
                  </div>
                )}
              </div>

              {/* Action bar */}
              <div className="flex gap-2 flex-wrap pt-1.5 border-t border-brand-soft">
                {doc && (
                  <Link href={`/documents/${doc.id}`} className="btn btn-ghost btn-sm">
                    📄 View Document
                  </Link>
                )}
                <Link href="/rx" className="btn btn-ghost btn-sm">
                  📋 View in Prescriptions →
                </Link>
              </div>
            </div>
          )}

          {/* Action bar */}
          {r.status === "pending" && (
            <div className="flex gap-2 pt-1 border-t border-border">
              <button className="btn btn-primary btn-sm" onClick={onApprove}>
                ✓ Approve
              </button>
              <button
                className="px-3 py-1.5 rounded-md bg-surface border border-red text-[11.5px] font-semibold text-red hover:bg-red-soft transition-colors"
                onClick={onDeny}
              >
                ✕ Deny
              </button>
              <button className="btn btn-ghost btn-sm ml-auto" onClick={() => toast("📩 Message thread opened")}>
                💬 Message Patient
              </button>
            </div>
          )}

          {r.status === "approved" && (
            <div className="flex gap-2 pt-1 border-t border-border">
              <Link
                href={`/e-prescribe?request=${r.id}`}
                className="btn btn-primary btn-sm"
              >
                💊 Prescribe →
              </Link>
              <button className="btn btn-ghost btn-sm" onClick={onDeny}>
                ↩ Revoke Approval
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
