"use client";

import { useEffect, useState } from "react";
import { Modal } from "@/components/ui/Modal";
import { usePatients } from "@/lib/hooks/usePatients";
import type { Claim, Payer } from "@/lib/types";

interface SubmitClaimModalProps {
  open: boolean;
  onClose: () => void;
  onSubmit: (claim: Omit<Claim, "id">) => void;
}

const PAYERS: Payer[] = ["BlueCross", "Aetna", "UnitedHealthcare", "Cigna", "Medicare", "Medicaid", "Self-Pay", "Other"];

const SERVICES = [
  { cpt: "99214", label: "Office Visit · Complex",        defaultBilled: 285 },
  { cpt: "99213", label: "Office Visit · Established",     defaultBilled: 195 },
  { cpt: "99423", label: "Telehealth Visit · Established", defaultBilled: 165 },
  { cpt: "99204", label: "New Patient · Comprehensive",    defaultBilled: 320 },
  { cpt: "99497", label: "Advance Care Planning",          defaultBilled: 165 },
  { cpt: "99354", label: "Prolonged Service · 30-74 min",  defaultBilled: 145 },
];

const PROVIDERS = ["Dr. Rivera", "Dr. Patel", "Dr. Lee", "NP Wang"];

interface FormState {
  patientId: string;
  payer: Payer;
  cpt: string;
  icd10: string;
  billed: number;
  provider: string;
}

const BLANK: FormState = {
  patientId: "",
  payer: "BlueCross",
  cpt: "99214",
  icd10: "E66.9",
  billed: 285,
  provider: "Dr. Rivera",
};

export function SubmitClaimModal({ open, onClose, onSubmit }: SubmitClaimModalProps) {
  const patients = usePatients((s) => s.patients);
  const [form, setForm] = useState<FormState>(() => ({ ...BLANK, patientId: patients[0]?.id || "" }));
  const [error, setError] = useState("");

  useEffect(() => {
    if (open) {
      setForm({ ...BLANK, patientId: patients[0]?.id || "" });
      setError("");
    }
  }, [open, patients]);

  function field<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  function handleCptChange(cpt: string) {
    const svc = SERVICES.find((s) => s.cpt === cpt);
    setForm((f) => ({ ...f, cpt, billed: svc?.defaultBilled || f.billed }));
  }

  function handleSubmit() {
    if (!form.patientId) { setError("Pick a patient"); return; }
    const patient = patients.find((p) => p.id === form.patientId);
    if (!patient) { setError("Patient not found"); return; }
    if (!form.icd10.trim()) { setError("ICD-10 code is required"); return; }
    if (form.billed <= 0)   { setError("Billed amount must be greater than zero"); return; }

    const today = new Date();
    const months = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
    const submittedDate = `${months[today.getMonth()]} ${today.getDate()}, ${today.getFullYear()}`;
    const submittedAt = parseInt(`${today.getFullYear()}${String(today.getMonth() + 1).padStart(2, "0")}${String(today.getDate()).padStart(2, "0")}`, 10);
    const service = SERVICES.find((s) => s.cpt === form.cpt) || SERVICES[0];

    onSubmit({
      patientName: patient.name,
      patientId: patient.id,
      payer: form.payer,
      cptCode: form.cpt,
      serviceLabel: service.label,
      icd10: form.icd10.trim(),
      billed: form.billed,
      paid: 0,
      patientResponsibility: 0,
      submittedDate, submittedAt,
      status: "submitted",
      providerName: form.provider,
      dateOfService: submittedDate,
    });
    onClose();
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Submit Claim"
      icon="📋"
      width={580}
      footer={
        <>
          <button className="btn btn-ghost" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" onClick={handleSubmit}>📤 Submit 837P</button>
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
          <label className="fl">Payer</label>
          <select className="fsel" value={form.payer} onChange={(e) => field("payer", e.target.value as Payer)}>
            {PAYERS.map((p) => <option key={p} value={p}>{p}</option>)}
          </select>
        </div>
      </div>

      <div className="mb-3">
        <label className="fl">Service · CPT Code</label>
        <select className="fsel" value={form.cpt} onChange={(e) => handleCptChange(e.target.value)}>
          {SERVICES.map((s) => <option key={s.cpt} value={s.cpt}>{s.cpt} — {s.label}</option>)}
        </select>
      </div>

      <div className="grid grid-cols-2 gap-3 mb-3">
        <div>
          <label className="fl">ICD-10 Diagnosis<span className="text-red ml-0.5">*</span></label>
          <input className="fi" placeholder="E66.9, I10" value={form.icd10} onChange={(e) => field("icd10", e.target.value)} />
        </div>
        <div>
          <label className="fl">Billed Amount</label>
          <input
            type="number"
            min={1}
            className="fi"
            value={form.billed}
            onChange={(e) => field("billed", parseInt(e.target.value, 10) || 0)}
          />
        </div>
      </div>

      <div className="mb-3">
        <label className="fl">Rendering Provider</label>
        <select className="fsel" value={form.provider} onChange={(e) => field("provider", e.target.value)}>
          {PROVIDERS.map((p) => <option key={p} value={p}>{p}</option>)}
        </select>
      </div>

      <div className="mt-3 text-[11px] text-ink-muted bg-surface-2 border border-border rounded px-3 py-2 flex items-center gap-2">
        <span className="text-[13px]">📤</span>
        <span>Claim will be submitted as an <strong>837P</strong> via Office Ally clearinghouse. Adjudication typically 2-4 weeks.</span>
      </div>
    </Modal>
  );
}
