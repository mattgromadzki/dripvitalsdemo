"use client";

import { useState } from "react";
import { usePatients } from "@/lib/hooks/usePatients";
import { toast } from "@/lib/hooks/useToast";
import { usePermission } from "@/lib/rbac/usePermission";
import { PatientContactComposer } from "@/components/modules/chart/PatientContactComposer";
import { LIFECYCLE_META, LIFECYCLE_ORDER, deriveLifecycle } from "@/lib/data/lifecycle";
import type { Patient, PatientExtra } from "@/lib/types";

export function ChartHeaderRich({ patient, extra }: { patient: Patient; extra: PatientExtra }) {
  const update = usePatients((s) => s.update);
  const [open, setOpen] = useState(false);
  const [composerOpen, setComposerOpen] = useState(false);
  const canMessage = usePermission("patients.edit") || usePermission("sms.send") || usePermission("email.send");

  const current = deriveLifecycle(patient);
  const meta = LIFECYCLE_META[current];
  const initials = (patient.first[0] || "") + (patient.last[0] || "");
  const a = extra.address;
  const addr = a ? `${a.street}, ${a.city}, ${a.state} ${a.zip}` : "—";

  return (
    <div className="bg-surface border border-border rounded-lg shadow-xs mb-3.5 relative">
      {/* Identity strip */}
      <div className="flex items-center gap-4 px-5 py-4 border-b border-border flex-wrap">
        <div className="w-14 h-14 rounded-full flex items-center justify-center text-[20px] font-bold text-white flex-shrink-0"
             style={{ background: patient.color }}>
          {initials}
        </div>
        <div className="flex-1 min-w-[200px]">
          <div className="text-[21px] font-bold tracking-tight text-ink leading-tight">{patient.name}</div>
          <div className="text-[12.5px] text-ink-muted mt-0.5 flex gap-2.5 flex-wrap items-center">
            <span className="font-mono text-[11px] text-ink-2 bg-surface-2 border border-border px-1.5 py-px rounded font-semibold">{patient.id}</span>
            <span>{extra.gender} · Age {patient.age}</span>
            <span>DOB {extra.dob}</span>
          </div>
        </div>
        <div className="flex flex-col items-end gap-2.5">
          <div className="flex gap-2">
            {canMessage && <button className="btn btn-ghost btn-sm" onClick={() => setComposerOpen(true)}>✉ Message</button>}
            <button className="btn btn-ghost btn-sm" onClick={() => toast("💊 Open the Orders tab to prescribe a paid order")}>💊 Prescribe</button>
            <button className="btn btn-primary btn-sm" onClick={() => toast("🎥 Starting video visit…")}>🎥 Start Visit</button>
          </div>
          {/* Status control */}
          <div className="relative">
            <button
              onClick={() => setOpen((o) => !o)}
              className="inline-flex items-center gap-2 text-[12px] font-semibold px-3 py-1.5 rounded-[9px] border bg-surface"
              style={{ color: meta.tone, borderColor: meta.tone }}
            >
              <span className="w-2 h-2 rounded-full" style={{ background: meta.tone }} />
              {meta.label}
              <span className="opacity-60">▾</span>
            </button>
            {open && (
              <>
                <div className="fixed inset-0 z-[40]" onClick={() => setOpen(false)} />
                <div className="absolute top-[38px] right-0 w-[232px] bg-surface border border-border rounded-[11px] shadow-xl p-1.5 z-[50]">
                  <div className="text-[10px] uppercase tracking-wider text-ink-muted-2 font-bold px-2.5 pt-1.5 pb-1">Patient status</div>
                  {LIFECYCLE_ORDER.map((key) => {
                    const m = LIFECYCLE_META[key];
                    const on = key === current;
                    return (
                      <div
                        key={key}
                        onClick={() => { update(patient.id, { lifecycle: key }); setOpen(false); toast(`Status → ${m.label}`); }}
                        className={`flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-[12.5px] cursor-pointer ${on ? "bg-brand-soft text-brand-dk font-semibold" : "text-ink-2 hover:bg-surface-2"}`}
                      >
                        <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: m.tone }} />
                        {m.label}
                        {on && <span className="ml-auto text-brand-dk">✓</span>}
                      </div>
                    );
                  })}
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Detail columns */}
      <div className="grid grid-cols-[1.3fr_1fr_1fr] max-[920px]:grid-cols-1">
        <HeaderCol title="Contact">
          <Field label="Email" value={patient.email} />
          <Field label="Phone" value={patient.phone} />
          <Field label="Address" value={addr} />
          <Field label="State" value={patient.state} />
        </HeaderCol>
        <HeaderCol title="Care team">
          <Field label="Provider" value={patient.provider} />
          <Field label="Care coordinator" value={extra.careCoordinator} />
        </HeaderCol>
        <HeaderCol title="Activity" last>
          <Field label="Registered" value={patient.since} />
          <Field label="Last login" value={extra.lastLogin} />
          <Field label="Last appointment" value={patient.lastVisit} />
        </HeaderCol>
      </div>

      <PatientContactComposer patient={patient} open={composerOpen} onClose={() => setComposerOpen(false)} />
    </div>
  );
}

function HeaderCol({ title, children, last }: { title: string; children: React.ReactNode; last?: boolean }) {
  return (
    <div className={`px-5 py-3.5 ${last ? "" : "border-r border-border max-[920px]:border-r-0 max-[920px]:border-b"}`}>
      <div className="text-[10px] uppercase tracking-wider text-ink-muted-2 font-bold mb-2.5">{title}</div>
      {children}
    </div>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex gap-2 mb-1.5 text-[12.5px]">
      <span className="text-ink-muted min-w-[100px] flex-shrink-0">{label}</span>
      <span className="text-ink font-medium">{value}</span>
    </div>
  );
}
