"use client";

import { useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";

import { ChartHeaderRich }   from "@/components/modules/chart/ChartHeaderRich";
import { ChartSummaryPanel } from "@/components/modules/chart/ChartSummaryPanel";
import { ChartTabs, type TabKey } from "@/components/modules/chart/ChartTabs";
import { OrdersTab }      from "@/components/modules/chart/tabs/OrdersTab";
import { OrdersRxTab }    from "@/components/modules/chart/tabs/OrdersRxTab";
import { ProfileTab }     from "@/components/modules/chart/tabs/ProfileTab";
import { LabsTab }        from "@/components/modules/chart/tabs/LabsTab";
import { VisitsTab }      from "@/components/modules/chart/tabs/VisitsTab";
import { ProgressTab }    from "@/components/modules/chart/tabs/ProgressTab";
import { BillingTab }     from "@/components/modules/chart/tabs/BillingTab";
import { DocumentsTab }   from "@/components/modules/chart/tabs/DocumentsTab";
import { ComplianceTab }  from "@/components/modules/chart/tabs/ComplianceTab";
import { AdminTab }       from "@/components/modules/chart/tabs/AdminTab";
import { Toast }          from "@/components/ui/Toast";
import { usePatients }    from "@/lib/hooks/usePatients";
import { PendingTreatmentCard } from "@/components/modules/PendingTreatmentCard";
import { getPatientExtra } from "@/lib/data/patientExtras";

export default function PatientDetailPage() {
  const params = useParams<{ id: string }>();
  const patient = usePatients((s) => s.patients.find((p) => p.id === params.id));
  const [tab, setTab] = useState<TabKey>("orders");

  if (!patient) {
    return (
      <div className="px-7 py-6">
        <Link href="/patients" className="btn btn-ghost btn-sm">← Back to patients</Link>
        <div className="bg-surface border border-border rounded-lg mt-4 p-12 text-center">
          <div className="text-[36px] opacity-40 mb-2">🔍</div>
          <div className="text-[14px] font-bold mb-1">Patient not found</div>
          <div className="text-[12px] text-ink-muted">No patient with ID <span className="font-mono">{params.id}</span></div>
        </div>
        <Toast />
      </div>
    );
  }

  const extra = getPatientExtra(patient);

  return (
    <div className="px-7 py-6 text-[14px] leading-relaxed">
      <Link href="/patients" className="text-[12.5px] text-ink-muted font-semibold hover:text-brand-dk inline-flex items-center gap-1.5 mb-3">← Patients</Link>

      {/* Always-visible rich header */}
      <ChartHeaderRich patient={patient} extra={extra} />

      {patient.intakeProgress && patient.intakeProgress !== "Completed" && (
        <div className="mt-3 px-4 py-3 rounded-xl bg-amber-soft text-amber border border-border text-[13px] font-semibold flex items-center gap-2">
          ⏳ Intake in progress — {patient.intakeProgress}
          <span className="font-normal text-[12px] opacity-80">· the rest of the chart fills in as the patient completes the intake.</span>
        </div>
      )}

      {/* Pending treatment requests from paid intake forms — review intake, Approve, then Prescribe → e-Prescribe */}
      <div className="my-4">
        <PendingTreatmentCard patient={patient} />
      </div>

      {/* Option B body: persistent summary panel + tabbed sections */}
      <div className="grid grid-cols-[300px_1fr] gap-4 items-start max-[1000px]:grid-cols-1">
        <ChartSummaryPanel patient={patient} extra={extra} />

        <div className="min-w-0">
          <ChartTabs active={tab} onChange={setTab} />

          {tab === "orders"         && <OrdersTab     patient={patient} extra={extra} />}
          {tab === "orders_current" && <OrdersRxTab   patient={patient} extra={extra} />}
          {tab === "profile"        && <ProfileTab    patient={patient} extra={extra} />}
          {tab === "labs"           && <LabsTab       patient={patient} extra={extra} />}
          {tab === "visits"         && <VisitsTab     patient={patient} extra={extra} />}
          {tab === "progress"       && <ProgressTab   patient={patient} extra={extra} />}
          {tab === "billing"        && <BillingTab    patient={patient} extra={extra} />}
          {tab === "documents"      && <DocumentsTab  patient={patient} extra={extra} />}
          {tab === "compliance"     && <ComplianceTab patient={patient} extra={extra} />}
          {tab === "admin"          && <AdminTab      patient={patient} extra={extra} />}
        </div>
      </div>

      <Toast />
    </div>
  );
}
