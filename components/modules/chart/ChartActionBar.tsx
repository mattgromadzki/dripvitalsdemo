"use client";

import Link from "next/link";
import { toast } from "@/lib/hooks/useToast";
import type { Patient } from "@/lib/types";

export function ChartActionBar({ patient }: { patient: Patient }) {
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
      <button className="btn btn-ghost btn-sm" onClick={() => toast("🧪 Order labs flow opened")}>
        🧪 Order Labs
      </button>
      <button className="btn btn-ghost btn-sm" onClick={() => toast("💊 Prescribe flow opened")}>
        💊 Prescribe
      </button>
      <button className="btn btn-ghost btn-sm" onClick={() => toast("✅ Add task")}>
        ✅ Add Task
      </button>
      <button className="btn btn-primary btn-sm" onClick={() => toast("🎥 Starting video visit…")}>
        🎥 Start Visit
      </button>
    </div>
  );
}
