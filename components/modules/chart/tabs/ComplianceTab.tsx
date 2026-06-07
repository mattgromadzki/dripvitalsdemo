"use client";

import type { ReactNode } from "react";
import { Pill } from "@/components/ui/Pill";
import { toast } from "@/lib/hooks/useToast";
import { SectionCard, DataField, DataGrid } from "@/components/modules/chart/SectionCard";
import type { Patient, PatientExtra } from "@/lib/types";

export function ComplianceTab({ patient, extra }: { patient: Patient; extra: PatientExtra }) {
  const rows = (patient.consents && patient.consents.length)
    ? patient.consents.map((c) => {
        const d = new Date(c.acceptedAt);
        const signed = isNaN(d.getTime()) ? c.acceptedAt : d.toLocaleDateString([], { month: "short", day: "numeric", year: "numeric" }) + " " + d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
        return { form: `${c.title} (${c.version})`, signed, ip: "Captured at intake", device: "Intake form · e-signature" };
      })
    : extra.consentHistory;
  return (
    <div className="flex flex-col gap-4">
      {patient.clinicalFlags && patient.clinicalFlags.length > 0 && (
        <div className="bg-amber-soft border border-amber/40 rounded-lg p-4">
          <div className="text-[13px] font-bold text-amber mb-1.5">🩺 Intake screening — {patient.clinicalFlags.length} clinical caution{patient.clinicalFlags.length > 1 ? "s" : ""} for review</div>
          <ul className="list-disc pl-5 space-y-0.5">
            {patient.clinicalFlags.map((f, i) => (
              <li key={i} className="text-[12.5px] text-ink-2">{f}</li>
            ))}
          </ul>
          <div className="text-[11px] text-ink-muted mt-2">Relative contraindications flagged at intake. Absolute contraindications block enrollment automatically.</div>
        </div>
      )}
      <div className="grid grid-cols-[1fr_1fr] gap-4 max-[1100px]:grid-cols-1">
      {/* LEFT: Consent log */}
      <SectionCard
        title="Consent & Signature Log"
        icon="✅"
        iconBg="var(--color-green-soft)"
        iconColor="var(--color-green)"
        action={
          <button className="btn btn-ghost btn-sm" onClick={() => toast("📥 Exporting consent audit log…")}>
            📥 Export Log
          </button>
        }
      >
        {rows.length === 0 ? (
          <div className="py-10 text-center text-ink-muted">
            <div className="text-[36px] opacity-40 mb-2">📜</div>
            <div className="text-[13px] font-bold mb-1 text-ink">No consents on file</div>
            <div className="text-[11.5px]">
              {patient.first} has not signed any consent forms yet
            </div>
          </div>
        ) : (
          <div className="overflow-x-auto -mx-5">
            <table className="w-full border-collapse text-[12.5px]">
              <thead className="bg-surface-2">
                <tr>
                  <Th>Form</Th>
                  <Th>Signed</Th>
                  <Th>IP Address</Th>
                  <Th>Device</Th>
                  <Th>{""}</Th>
                </tr>
              </thead>
              <tbody>
                {rows.map((c) => (
                  <tr key={c.form} className="hover:bg-surface-2 transition-colors">
                    <Td><span className="font-semibold text-[12.5px]">{c.form}</span></Td>
                    <Td><span className="font-mono text-[11px] text-ink-muted whitespace-nowrap">{c.signed}</span></Td>
                    <Td><span className="font-mono text-[11px] text-ink-muted-2">{c.ip}</span></Td>
                    <Td><span className="text-[11.5px] text-ink-muted">{c.device}</span></Td>
                    <Td><Pill intent="green">✓ Signed</Pill></Td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </SectionCard>

      {/* RIGHT column — Status grid + audit summary */}
      <div>
        <SectionCard
          title="HIPAA & Compliance Status"
          icon="🛡"
          iconBg="var(--color-violet-soft)"
          iconColor="var(--color-violet)"
        >
          <DataGrid>
            <DataField label="HIPAA Auth"          value={<Pill intent="green">✓ Signed</Pill>} />
            <DataField label="ID Verified"         value={extra.idVerified ? <Pill intent="green">✓ Verified</Pill> : <Pill intent="red">Pending</Pill>} />
            <DataField label="Telehealth Consent"  value={<Pill intent="green">✓ Signed</Pill>} />
            <DataField label="Financial Agreement" value={<Pill intent="green">✓ Signed</Pill>} />
            <DataField label="State Eligibility"   value={<Pill intent="green">✓ Eligible ({patient.state})</Pill>} />
            <DataField label="Provider Licensed"   value={<Pill intent="green">✓ {patient.provider} — {patient.state}</Pill>} />
            <DataField label="DEA Number"          value={<Pill intent="muted">N/A (no Rx)</Pill>} />
            <DataField label="Photo Release"       value={<Pill intent="green">✓ Signed</Pill>} />
          </DataGrid>
        </SectionCard>

        <SectionCard
          title="Audit Summary"
          icon="📋"
          iconBg="var(--color-blue-soft)"
          iconColor="var(--color-blue)"
          action={
            <button className="btn btn-ghost btn-sm" onClick={() => toast("📋 Opening full audit trail…")}>
              View Full Audit
            </button>
          }
        >
          <div className="flex flex-col gap-2.5">
            <AuditRow icon="👁"  label="Chart Accesses"     value="47"           sub="Last 30 days" />
            <AuditRow icon="✏"   label="Records Modified"   value="3"            sub="By you · all logged" />
            <AuditRow icon="📤"  label="Documents Shared"   value="0"            sub="No external shares" />
            <AuditRow icon="📥"  label="Documents Exported" value="2"            sub="Insurance card, lab report" />
            <AuditRow icon="🔒"  label="Encryption Status"  value="AES-256"      sub="At rest & in transit" />
          </div>
        </SectionCard>

        <SectionCard
          title="Required Documents"
          icon="📝"
          iconBg="var(--color-amber-soft)"
          iconColor="var(--color-amber)"
        >
          <div className="flex flex-col gap-2">
            <RequiredItem label="Government-issued ID"           done />
            <RequiredItem label="Telehealth Consent"             done />
            <RequiredItem label="HIPAA Privacy Notice"           done />
            <RequiredItem label="Financial Responsibility Form"  done />
            <RequiredItem label="GLP-1 Risk Acknowledgment"      done={patient.dose !== "—"} />
          </div>
        </SectionCard>
      </div>
      </div>
    </div>
  );
}

function AuditRow({ icon, label, value, sub }: { icon: string; label: string; value: string; sub: string }) {
  return (
    <div className="flex items-center gap-3 py-2.5 px-3 bg-surface-2 border border-border rounded-md">
      <div className="text-[18px] flex-shrink-0">{icon}</div>
      <div className="flex-1 min-w-0">
        <div className="text-[12.5px] font-semibold text-ink">{label}</div>
        <div className="text-[10.5px] text-ink-muted">{sub}</div>
      </div>
      <div className="text-[14px] font-bold text-ink-2 font-mono">{value}</div>
    </div>
  );
}

function RequiredItem({ label, done }: { label: string; done: boolean }) {
  return (
    <div className="flex items-center gap-2.5 py-1.5 px-2.5 rounded">
      <span
        className="w-5 h-5 rounded-full flex items-center justify-center text-[11px] font-bold flex-shrink-0"
        style={{
          background: done ? "var(--color-green)" : "var(--color-surface-3)",
          color: done ? "#fff" : "var(--color-ink-muted)",
        }}
      >
        {done ? "✓" : "—"}
      </span>
      <span className={`text-[12.5px] ${done ? "text-ink" : "text-ink-muted line-through"}`}>{label}</span>
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
