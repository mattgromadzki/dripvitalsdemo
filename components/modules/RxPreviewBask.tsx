"use client";

import type { PatientDocument } from "@/lib/types";

interface Props {
  rx: NonNullable<PatientDocument["rxPayload"]>;
  status: "draft" | "signed";
  refNum?: string;
}

/**
 * RxPreviewBask — compact "Electronic Prescription" card matching the
 * bask_eprescribe.html design: labeled rx-field rows, dividers, italic Sig
 * box, no giant numbered sections. Renders identically in:
 *   - The e-Prescribe Review modal (with Cancel/Send buttons)
 *   - The standalone /documents/[id] viewer (with Print/Download buttons)
 *
 * Designed to print cleanly via window.print() — wrap in <div className="rx-printable">
 * and the global @media print rules will hide all other UI.
 */
export function RxPreviewBask({ rx, status, refNum }: Props) {
  const isDraft = status === "draft";
  return (
    <div className="rx-printable bg-surface border border-border rounded-md p-5 max-w-[640px] mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-3 pb-3 border-b border-border">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-md bg-brand-soft border border-brand-soft flex items-center justify-center text-[18px] flex-shrink-0" style={{ color: "var(--color-brand)" }}>
            ℞
          </div>
          <div>
            <div className="text-[10.5px] font-bold uppercase tracking-[1.2px] text-ink-muted">Electronic Prescription</div>
            <div className="text-[13px] font-bold text-ink leading-tight">DripVitals Health</div>
          </div>
        </div>
        <span
          className="inline-flex items-center gap-1 py-0.5 px-2.5 rounded-pill text-[9.5px] font-bold uppercase tracking-wider"
          style={{
            background: isDraft ? "var(--color-surface-3)" : "var(--color-brand-soft)",
            color:      isDraft ? "var(--color-ink-muted)" : "var(--color-brand-dk)",
            border:     isDraft ? "1px solid var(--color-border)" : "1px solid var(--color-brand-soft)",
          }}
        >
          {isDraft ? "DRAFT" : "✓ Signed"}
        </span>
      </div>

      {/* Patient + Prescriber */}
      <RxField label="Patient">
        <span className="font-sans">
          <strong>{rx.patient.name}</strong> · DOB {rx.patient.dob || "—"} · {rx.patient.id}
        </span>
      </RxField>
      <RxField label="Shipping Address">
        {rx.patient.address ? (
          <span className="font-sans text-[12px] leading-snug">
            {rx.patient.address.street}, {rx.patient.address.city}, {rx.patient.address.state} {rx.patient.address.zip}
          </span>
        ) : (
          <span className="font-sans italic text-ink-muted text-[12px]">No address on file</span>
        )}
      </RxField>
      <RxField label="Prescriber">
        <span className="font-sans">
          {rx.prescriberName} · NPI <span className="font-mono">{rx.prescriberNpi}</span>
          {rx.prescriberDea ? <> · DEA <span className="font-mono">{rx.prescriberDea}</span></> : null}
        </span>
      </RxField>
      <RxField label="Known Allergies">
        <span
          className="font-sans text-[12px]"
          style={{
            color: rx.patient.allergies && rx.patient.allergies !== "None"
              ? "var(--color-red)"
              : "var(--color-ink-muted)",
            fontWeight: rx.patient.allergies && rx.patient.allergies !== "None" ? 700 : 500,
          }}
        >
          {rx.patient.allergies && rx.patient.allergies !== "None"
            ? `⚠ ${rx.patient.allergies}`
            : "None documented"}
        </span>
      </RxField>

      <Divider />

      {/* Medications — one rx-field per drug */}
      {rx.medications.map((m, i) => (
        <div key={i} className={i < rx.medications.length - 1 ? "mb-3 pb-3 border-b border-dashed border-border" : ""}>
          <RxField label={`Medication M${i + 1}`}>
            <span className="font-sans">
              <strong>{m.name}</strong> · <span className="text-ink-2">{m.strength}</span>
            </span>
          </RxField>
          <RxField label="Qty / Unit / Days Supply">
            {m.qty} {m.unit} · {m.daySupply} days
          </RxField>
          <RxField label="Route · Frequency">
            <span className="font-sans">{m.route} · {m.freq}</span>
          </RxField>
          <RxField label="Refills">{String(m.refills)}</RxField>
          <RxField label="Sig">
            <div
              className="bg-surface-2 border border-border rounded-md py-2.5 px-3 text-[12px] text-ink-2 leading-relaxed italic min-h-[42px]"
              style={{ fontFamily: "var(--font-mono, monospace)" }}
            >
              {m.sig}
            </div>
          </RxField>
          {(m.daw || m.paRequired || m.controlled) && (
            <div className="flex flex-wrap gap-1.5 mt-1.5">
              {m.daw         && <FlagPill intent="blue">DAW</FlagPill>}
              {m.paRequired  && <FlagPill intent="amber">Prior Auth Required</FlagPill>}
              {m.controlled  && <FlagPill intent="red">DEA Controlled</FlagPill>}
            </div>
          )}
        </div>
      ))}

      {/* Supplies (if any) */}
      {rx.supplies.length > 0 && (
        <>
          <Divider />
          {rx.supplies.map((s, i) => (
            <div key={i} className={i < rx.supplies.length - 1 ? "mb-2 pb-2 border-b border-dashed border-border" : ""}>
              <RxField label={`Supply S${i + 1}`}>
                <span className="font-sans">{s.name}</span>
              </RxField>
              <RxField label="Quantity">{String(s.qty)} · {s.category}</RxField>
              {s.linkedToName && (
                <RxField label="Linked to"><span className="font-sans">{s.linkedToName}</span></RxField>
              )}
              {s.notes && (
                <RxField label="Notes">
                  <span className="font-sans italic text-[11.5px] text-ink-muted">{s.notes}</span>
                </RxField>
              )}
            </div>
          ))}
        </>
      )}

      <Divider />

      {/* Pharmacy + Date */}
      <RxField label="Pharmacy">
        <span className="font-sans text-[12px]">
          <strong>{rx.pharmacyName}</strong>
          {rx.pharmacyLocation ? <> · {rx.pharmacyLocation}</> : null}
        </span>
      </RxField>
      <RxField label="Date Written">{rx.dateWritten}</RxField>
      {!isDraft && <RxField label="Submitted At">{rx.signedAt}</RxField>}

      {/* Signature block (only when signed) */}
      {!isDraft && (
        <>
          <Divider />
          <div className="grid grid-cols-2 gap-4 mt-3 max-[480px]:grid-cols-1">
            <div>
              <div
                className="text-[22px] italic mb-1 leading-tight"
                style={{ fontFamily: "cursive", color: "var(--color-brand-dk)" }}
              >
                {rx.signatureText}
              </div>
              <div className="border-t border-border pt-1">
                <div className="text-[8.5px] font-bold uppercase tracking-[1px] text-ink-muted">Provider Signature</div>
                <div className="text-[10.5px] text-ink-2"><strong>{rx.prescriberName}</strong> · NPI {rx.prescriberNpi}</div>
              </div>
            </div>
            <div>
              <div className="text-[12.5px] font-mono text-ink mb-1">{rx.signedAt}</div>
              <div className="border-t border-border pt-1">
                <div className="text-[8.5px] font-bold uppercase tracking-[1px] text-ink-muted">Date Submitted &amp; Time</div>
                <div className="text-[10.5px] text-ink-2">Electronic timestamp · UTC</div>
              </div>
            </div>
          </div>
        </>
      )}

      {/* Footer — Surescripts pill + Doc ID */}
      <div className="mt-4 pt-3 border-t border-border flex items-center gap-2 flex-wrap">
        <div className="inline-flex items-center gap-1.5 py-0.5 px-2 rounded-pill text-[9.5px] font-bold bg-brand-soft border border-brand-soft" style={{ color: "var(--color-brand-dk)" }}>
          🛡 Surescripts Certified · EPCS · HIPAA Secured
        </div>
        <div className="flex-1" />
        <div className="text-[9.5px] text-ink-muted font-mono">
          Document ID: {refNum || rx.refNum}
        </div>
      </div>
    </div>
  );
}

// ─── Helpers ───────────────────────────────────────────────────────────
function RxField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="mb-2">
      <div className="text-[9px] font-bold uppercase tracking-[0.8px] text-ink-muted mb-0.5">{label}</div>
      <div className="text-[13px] font-semibold text-ink leading-snug font-mono">{children}</div>
    </div>
  );
}

function Divider() {
  return <div className="h-px bg-border my-3" />;
}

function FlagPill({ intent, children }: { intent: "blue" | "amber" | "red"; children: React.ReactNode }) {
  const styles = {
    blue:  { bg: "var(--color-blue-soft)",  color: "var(--color-blue)",  border: "var(--color-blue-soft)" },
    amber: { bg: "var(--color-amber-soft)", color: "var(--color-amber)", border: "var(--color-amber-soft)" },
    red:   { bg: "var(--color-red-soft)",   color: "var(--color-red)",   border: "var(--color-red-soft)" },
  }[intent];
  return (
    <span
      className="inline-flex items-center gap-1 py-0.5 px-2 rounded-pill text-[10px] font-bold"
      style={{ background: styles.bg, color: styles.color, border: `1px solid ${styles.border}` }}
    >
      {children}
    </span>
  );
}
