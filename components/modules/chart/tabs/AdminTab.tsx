"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Pill } from "@/components/ui/Pill";
import { toast } from "@/lib/hooks/useToast";
import { SectionCard, DataField, DataGrid } from "@/components/modules/chart/SectionCard";
import { ConfirmModal } from "@/components/ui/ConfirmModal";
import { usePatients } from "@/lib/hooks/usePatients";
import type { Patient, PatientExtra } from "@/lib/types";

interface AdminAction {
  icon: string;
  label: string;
  desc: string;
  variant: "ghost" | "danger";
  onClick: () => void;
  confirm?: boolean;
}

export function AdminTab({ patient, extra }: { patient: Patient; extra: PatientExtra }) {
  const router = useRouter();
  const removePatient = usePatients((s) => s.remove);
  const updatePatient = usePatients((s) => s.update);
  const [archiveOpen, setArchiveOpen] = useState(false);

  // Parse subscription price (e.g. "$549/qtr") for LTV math
  const subNum = parseFloat((patient.sub || "").replace(/[^0-9.]/g, "")) || 0;
  // Roughly: 8 billing cycles × cycle price = projected LTV
  const projectedLTV = subNum * 8;
  // Monthly revenue — divide quarterly by 3, monthly by 1
  const monthlyRev = patient.sub.includes("qtr") ? subNum / 3
                  : patient.sub.includes("6mo") ? subNum / 6
                  : subNum;
  const totalPaid = extra.invoices.reduce((acc, inv) => acc + parseFloat(inv.amount.replace(/[^0-9.]/g, "")), 0);

  const riskColor = extra.riskScore >= 75 ? "var(--color-green)"
                  : extra.riskScore >= 50 ? "var(--color-amber)"
                  :                         "var(--color-red)";

  function archivePatient() {
    updatePatient(patient.id, { status: "inactive", tags: [...patient.tags, "Archived"] });
    toast(`🗑 ${patient.name} archived — moved to inactive`);
    router.push("/patients");
  }

  const actions: AdminAction[] = [
    {
      icon: "🔄", label: "Force Refill Order",
      desc: "Manually trigger a prescription refill order",
      variant: "ghost",
      onClick: () => toast("🔄 Refill order queued"),
    },
    {
      icon: "⏸", label: "Pause Subscription",
      desc: "Place subscription on hold (30 days)",
      variant: "ghost",
      onClick: () => toast("⏸ Subscription paused for 30 days"),
    },
    {
      icon: "🚫", label: "Pause Rx (Safety Hold)",
      desc: "Pause pending prescriptions pending provider review",
      variant: "danger",
      onClick: () => toast("🚫 Rx paused — provider notified"),
    },
    {
      icon: "🔁", label: "Escalate Dose",
      desc: "Advance titration schedule by one step",
      variant: "ghost",
      onClick: () => toast("💊 Escalation queued for provider review"),
    },
    {
      icon: "📧", label: "Resend Welcome Email",
      desc: "Re-send onboarding email with portal link",
      variant: "ghost",
      onClick: () => toast("📧 Welcome email sent"),
    },
    {
      icon: "🔑", label: "Reset Patient Portal Password",
      desc: "Send a password reset link to the patient",
      variant: "ghost",
      onClick: () => toast("🔑 Password reset link emailed"),
    },
    {
      icon: "🗑", label: "Archive Patient",
      desc: "Move patient to inactive / archived state",
      variant: "danger",
      onClick: () => setArchiveOpen(true),
    },
  ];

  return (
    <div className="grid grid-cols-[1fr_1fr] gap-4 max-[1100px]:grid-cols-1">
      {/* LEFT: Admin controls */}
      <SectionCard
        title="Admin Controls"
        icon="⚙"
        iconBg="var(--color-red-soft)"
        iconColor="var(--color-red)"
      >
        <div className="flex flex-col gap-2.5">
          {actions.map((a) => (
            <div
              key={a.label}
              className="flex items-center gap-3 bg-surface-2 border border-border rounded-md py-2.5 px-3.5"
            >
              <div className="text-[18px] flex-shrink-0 w-7 text-center">{a.icon}</div>
              <div className="flex-1 min-w-0">
                <div className="font-bold text-[13px] text-ink">{a.label}</div>
                <div className="text-[11.5px] text-ink-muted">{a.desc}</div>
              </div>
              <button
                className={
                  a.variant === "danger"
                    ? "btn btn-sm text-red border border-red-soft bg-transparent hover:bg-red-soft transition-colors flex-shrink-0"
                    : "btn btn-ghost btn-sm flex-shrink-0"
                }
                onClick={a.onClick}
              >
                Run
              </button>
            </div>
          ))}
        </div>
      </SectionCard>

      {/* RIGHT: Patient Intelligence */}
      <div>
        <SectionCard
          title="Patient Intelligence"
          icon="📊"
          iconBg="var(--color-violet-soft)"
          iconColor="var(--color-violet)"
        >
          <div className="text-center py-4">
            <div className="text-[48px] font-black tracking-[-2px] leading-none" style={{ color: riskColor }}>
              {extra.riskScore}
            </div>
            <div className="text-[13px] font-bold text-ink-muted mt-1 mb-2">Retention Risk Score</div>
            <Pill intent={extra.riskScore >= 75 ? "green" : extra.riskScore >= 50 ? "amber" : "red"}>
              {extra.riskLabel} churn risk
            </Pill>
          </div>

          <DataGrid>
            <DataField label="Adherence Rate"   value={<span className="text-green">{patient.status === "active" ? "100%" : "—"}</span>} />
            <DataField label="Avg NPS Score"    value={<span className="text-green">{extra.riskScore > 75 ? "9/10" : extra.riskScore > 50 ? "7/10" : "—"}</span>} />
            <DataField label="LTV (Projected)"  value={<span className="text-brand">${projectedLTV.toLocaleString()}</span>} />
            <DataField label="Avg Monthly Rev"  value={<span className="text-green">${Math.round(monthlyRev)}</span>} />
            <DataField label="Subscription Age" value={patient.since} />
            <DataField label="Total Paid"       value={<span className="text-brand">${totalPaid.toFixed(2)}</span>} />
          </DataGrid>
        </SectionCard>

        <SectionCard
          title="Provider Assignment"
          icon="🩺"
          iconBg="var(--color-teal-soft)"
          iconColor="var(--color-teal)"
        >
          <DataGrid>
            <DataField label="Current Provider" value={patient.provider} />
            <DataField label="Assigned Since"   value={patient.since} />
            <div className="col-span-2 flex gap-2 mt-1">
              <button className="btn btn-ghost btn-sm" onClick={() => toast("🔄 Transfer flow opened")}>
                🔄 Transfer to Another Provider
              </button>
            </div>
          </DataGrid>
        </SectionCard>

        <SectionCard
          title="Danger Zone"
          icon="⚠"
          iconBg="var(--color-red-soft)"
          iconColor="var(--color-red)"
        >
          <div className="bg-red-soft border border-red-soft rounded-md p-4">
            <div className="text-[12.5px] text-ink-2 leading-relaxed mb-3">
              These actions are irreversible. Archived patients are retained for compliance but cannot
              be active. Deleted patient data is permanently removed after 7 years per HIPAA retention.
            </div>
            <div className="flex gap-2 flex-wrap">
              <button
                className="btn btn-sm text-red border border-red bg-transparent hover:bg-red hover:text-white transition-colors"
                onClick={() => setArchiveOpen(true)}
              >
                🗑 Archive Patient
              </button>
              <button
                className="btn btn-sm text-red border border-red bg-transparent hover:bg-red hover:text-white transition-colors"
                onClick={() => toast("📋 Data export queued — you'll receive an email when ready")}
              >
                📥 Export All Patient Data
              </button>
            </div>
          </div>
        </SectionCard>
      </div>

      <ConfirmModal
        open={archiveOpen}
        onClose={() => setArchiveOpen(false)}
        onConfirm={archivePatient}
        icon="🗑"
        title="Archive patient?"
        message={`${patient.name} will be moved to inactive status and removed from the active patient roster. They will still appear in audit logs and historical records.`}
        confirmLabel="Archive patient"
      />
    </div>
  );
}
