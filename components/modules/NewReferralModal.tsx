"use client";

import { useEffect, useState } from "react";
import { Modal } from "@/components/ui/Modal";
import { usePatients } from "@/lib/hooks/usePatients";
import { useReferrals } from "@/lib/hooks/useReferrals";
import type { Referral, ReferralUrgency } from "@/lib/types";

interface NewReferralModalProps {
  open: boolean;
  onClose: () => void;
  onCreate: (r: Omit<Referral, "id">) => void;
}

const URGENCIES: ReferralUrgency[] = ["Routine", "Urgent", "STAT"];

interface FormState {
  patientId: string;
  specialistId: string;
  reason: string;
  clinicalNotes: string;
  urgency: ReferralUrgency;
  authRequired: boolean;
}

const BLANK: FormState = {
  patientId: "",
  specialistId: "",
  reason: "",
  clinicalNotes: "",
  urgency: "Routine",
  authRequired: false,
};

export function NewReferralModal({ open, onClose, onCreate }: NewReferralModalProps) {
  const patients    = usePatients((s) => s.patients);
  const specialists = useReferrals((s) => s.specialists);

  const [form, setForm] = useState<FormState>(() => ({
    ...BLANK,
    patientId: patients[0]?.id || "",
    specialistId: specialists[0]?.id || "",
  }));
  const [error, setError] = useState("");

  useEffect(() => {
    if (open) {
      setForm({
        ...BLANK,
        patientId: patients[0]?.id || "",
        specialistId: specialists[0]?.id || "",
      });
      setError("");
    }
  }, [open, patients, specialists]);

  function field<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  function handleSubmit() {
    if (!form.patientId)    { setError("Pick a patient"); return; }
    if (!form.specialistId) { setError("Pick a specialist"); return; }
    if (!form.reason.trim()) { setError("Referral reason is required"); return; }

    const patient = patients.find((p) => p.id === form.patientId);
    const specialist = specialists.find((s) => s.id === form.specialistId);
    if (!patient || !specialist) { setError("Selection not found"); return; }

    const today = new Date();
    const months = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
    const sentDate = `${months[today.getMonth()]} ${today.getDate()}, ${today.getFullYear()}`;
    const sentAt = parseInt(`${today.getFullYear()}${String(today.getMonth() + 1).padStart(2, "0")}${String(today.getDate()).padStart(2, "0")}`, 10);

    onCreate({
      patientName: patient.name,
      patientId: patient.id,
      patientColor: patient.color,
      specialistId: specialist.id,
      specialistName: specialist.name,
      specialty: specialist.specialty,
      reason: form.reason.trim(),
      clinicalNotes: form.clinicalNotes.trim() || undefined,
      urgency: form.urgency,
      status: "pending",
      direction: "outgoing",
      sentDate, sentAt,
      authorizationRequired: form.authRequired,
      authStatus: form.authRequired ? "pending" : "not_required",
    });
    onClose();
  }

  const selectedSpec = specialists.find((s) => s.id === form.specialistId);

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="New Referral"
      icon="📋"
      width={580}
      footer={
        <>
          <button className="btn btn-ghost" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" onClick={handleSubmit}>📤 Send Referral</button>
        </>
      }
    >
      {error && (
        <div className="mb-3 px-3 py-2.5 rounded-md bg-red-soft border border-red-soft text-red text-[12px] font-medium">
          ⚠ {error}
        </div>
      )}

      <div className="grid grid-cols-2 gap-3 mb-3">
        <div>
          <label className="fl">Patient<span className="text-red ml-0.5">*</span></label>
          <select className="fsel" value={form.patientId} onChange={(e) => field("patientId", e.target.value)}>
            {patients.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        </div>
        <div>
          <label className="fl">Urgency</label>
          <select className="fsel" value={form.urgency} onChange={(e) => field("urgency", e.target.value as ReferralUrgency)}>
            {URGENCIES.map((u) => (
              <option key={u} value={u}>
                {u === "STAT" ? "🚨 STAT (same day)" : u === "Urgent" ? "⚠ Urgent (24-72h)" : "Routine (1-2 weeks)"}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="mb-3">
        <label className="fl">Specialist<span className="text-red ml-0.5">*</span></label>
        <select className="fsel" value={form.specialistId} onChange={(e) => field("specialistId", e.target.value)}>
          {specialists.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}, {s.credentials} · {s.specialty} · {s.city}, {s.state}
              {!s.acceptingNew ? " · ⚠ Not accepting" : ""}
            </option>
          ))}
        </select>
        {selectedSpec && (
          <div className="text-[11px] text-ink-muted mt-1.5 flex items-center gap-3 flex-wrap">
            <span>📞 {selectedSpec.phone}</span>
            <span>⏱ ~{selectedSpec.avgResponseDays}d response</span>
            <span>{selectedSpec.acceptingNew ? "✓ Accepting new" : "⚠ Not accepting (waitlist)"}</span>
          </div>
        )}
      </div>

      <div className="mb-3">
        <label className="fl">Reason for Referral<span className="text-red ml-0.5">*</span></label>
        <input
          className="fi"
          placeholder="e.g. LDL management, BP control, GLP-1 GI side effects"
          value={form.reason}
          onChange={(e) => field("reason", e.target.value)}
        />
      </div>

      <div className="mb-3">
        <label className="fl">Clinical Notes</label>
        <textarea
          className="fta"
          rows={3}
          placeholder="Relevant labs, current medications, specific concerns or questions for the specialist…"
          value={form.clinicalNotes}
          onChange={(e) => field("clinicalNotes", e.target.value)}
        />
      </div>

      <div className="flex items-center gap-2 pt-3 border-t border-border">
        <label className="flex items-center gap-2 cursor-pointer text-[12.5px] font-semibold text-ink-2">
          <input
            type="checkbox"
            checked={form.authRequired}
            onChange={(e) => field("authRequired", e.target.checked)}
            style={{ accentColor: "var(--color-brand)" }}
          />
          Prior authorization required
        </label>
      </div>

      <div className="mt-3 text-[11px] text-ink-muted bg-surface-2 border border-border rounded px-3 py-2 flex items-center gap-2">
        <span className="text-[13px]">📤</span>
        <span>Referral will be transmitted via secure direct message + fax fallback. Specialist receives patient demographics, reason, and chart summary.</span>
      </div>
    </Modal>
  );
}
