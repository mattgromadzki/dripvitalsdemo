"use client";

import { Suspense } from "react";
import { useParams, useSearchParams } from "next/navigation";
import { usePatients } from "@/lib/hooks/usePatients";
import { getPatientExtra } from "@/lib/data/patientExtras";
import { EPrescribeWorkspace } from "@/components/modules/eprescribe/EPrescribeWorkspace";

export default function PatientPrescribePage() {
  return (
    <Suspense fallback={<div className="px-7 py-6 text-ink-muted text-[13px]">Loading e-Prescribe…</div>}>
      <Inner />
    </Suspense>
  );
}

function Inner() {
  const { id } = useParams<{ id: string }>();
  const sp = useSearchParams();
  const orderId = sp.get("order");
  const tx = sp.get("tx");
  const patient = usePatients((s) => s.patients.find((p) => p.id === id));
  const extra = patient ? getPatientExtra(patient) : null;
  const order = extra?.orders.find((o) => o.id === orderId) || null;
  const orderContext = order
    ? { id: order.id, treatmentName: order.treatmentName, placedAt: order.placedAt, price: order.price, kind: "paid" as const }
    : tx
    ? { id: "", treatmentName: tx, placedAt: new Date().toLocaleDateString("en-US", { month: "short", day: "numeric" }), kind: "treatment" as const }
    : undefined;

  return <EPrescribeWorkspace embeddedPatientId={id} orderContext={orderContext} />;
}
