"use client";

import { useState } from "react";
import Link from "next/link";
import { toast } from "@/lib/hooks/useToast";
import { usePermission } from "@/lib/rbac/usePermission";
import { PatientContactComposer } from "@/components/modules/chart/PatientContactComposer";
import type { Patient } from "@/lib/types";

export function ChartActionBar({ patient }: { patient: Patient }) {
  const canLabs = usePermission("labs.order");
  const canRx = usePermission("rx.prescribe");
  const canEdit = usePermission("patients.edit");
  const canSms = usePermission("sms.send");
  const canEmail = usePermission("email.send");
  const canMessage = canEdit || canSms || canEmail;

  const [composerOpen, setComposerOpen] = useState(false);

  return (
    <div className="flex items-center gap-2.5 bg-surface border border-border rounded-lg px-3.5 py-2.5 mb-3.5 shadow-xs">
      <Link
        href="/patients"
        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-pill bg-surface-2 border border-border text-ink-2 text-[13px] font-semibold hover:bg-surface-3 hover:text-ink transition-colors"
      >
        ← Patients
      </Link>
      <div className="text-[12.5px] text-ink-muted">
        Patient · <b className="text-ink font-semibold">{patient.name}</b>
      </div>
      <div className="flex-1" />
      {canMessage && (
        <button className="btn btn-ghost btn-sm" onClick={() => setComposerOpen(true)}>
          💬 Message
        </button>
      )}
      {canLabs && (
        <button className="btn btn-ghost btn-sm" onClick={() => toast("🧪 Order labs flow opened")}>
          🧪 Order Labs
        </button>
      )}
      {canRx && (
        <button className="btn btn-ghost btn-sm" onClick={() => toast("💊 Prescribe flow opened")}>
          💊 Prescribe
        </button>
      )}
      {canEdit && (
        <button className="btn btn-ghost btn-sm" onClick={() => toast("✅ Add task")}>
          ✅ Add Task
        </button>
      )}
      {canEdit && (
        <button className="btn btn-primary btn-sm" onClick={() => toast("🎥 Starting video visit…")}>
          🎥 Start Visit
        </button>
      )}

      <PatientContactComposer patient={patient} open={composerOpen} onClose={() => setComposerOpen(false)} />
    </div>
  );
}
