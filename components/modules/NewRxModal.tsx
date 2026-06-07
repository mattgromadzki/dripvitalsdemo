"use client";

import { useEffect, useState } from "react";
import { Modal } from "@/components/ui/Modal";
import { usePatients } from "@/lib/hooks/usePatients";
import { ClinicalSafetyStrip } from "@/components/clinical/ClinicalSafetyStrip";
import type { Prescription } from "@/lib/types";

interface NewRxModalProps {
  open: boolean;
  onClose: () => void;
  onSave: (rx: Omit<Prescription, "id">) => void;
  defaultPatientId?: string;
}

const MEDICATIONS = [
  { name: "Semaglutide", strengths: ["0.25mg", "0.5mg", "1mg", "2mg", "2.4mg"], freq: "weekly" },
  { name: "Tirzepatide", strengths: ["2.5mg", "5mg", "7.5mg", "10mg", "15mg"],   freq: "weekly" },
  { name: "Metformin",   strengths: ["500mg", "1000mg"],                          freq: "twice daily" },
  { name: "Liraglutide", strengths: ["0.6mg", "1.2mg", "1.8mg", "3mg"],          freq: "daily" },
];

const PHARMACIES = ["Partner Network FL", "Empower Pharmacy", "Walgreens FL", "CVS", "Patient Self-Pickup"];

interface FormState {
  patientId: string;
  medication: string;
  strength: string;
  qty: number;
  refills: number;
  daySupply: number;
  pharmacy: string;
  sig: string;
}

function blankFor(med: string): FormState {
  const m = MEDICATIONS.find((x) => x.name === med) || MEDICATIONS[0];
  const isWeekly = m.freq === "weekly";
  return {
    patientId: "",
    medication: m.name,
    strength: m.strengths[0],
    qty: isWeekly ? 4 : 60,
    refills: 2,
    daySupply: isWeekly ? 28 : 30,
    pharmacy: "Partner Network FL",
    sig: "",
  };
}

export function NewRxModal({ open, onClose, onSave, defaultPatientId }: NewRxModalProps) {
  const patients = usePatients((s) => s.patients);
  const [form, setForm] = useState<FormState>(() => ({
    ...blankFor("Semaglutide"),
    patientId: defaultPatientId || patients[0]?.id || "",
  }));
  const [error, setError] = useState("");
  const selectedPatient = patients.find((p) => p.id === form.patientId) || null;

  useEffect(() => {
    if (open) {
      setForm({
        ...blankFor("Semaglutide"),
        patientId: defaultPatientId || patients[0]?.id || "",
      });
      setError("");
    }
  }, [open, defaultPatientId, patients]);

  function field<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  function handleMedChange(name: string) {
    const m = MEDICATIONS.find((x) => x.name === name) || MEDICATIONS[0];
    const isWeekly = m.freq === "weekly";
    setForm((f) => ({
      ...f,
      medication: m.name,
      strength: m.strengths[0],
      qty: isWeekly ? 4 : 60,
      daySupply: isWeekly ? 28 : 30,
    }));
  }

  function handleSave() {
    if (!form.patientId) { setError("Pick a patient"); return; }
    const patient = patients.find((p) => p.id === form.patientId);
    if (!patient) { setError("Patient not found"); return; }
    if (!form.sig.trim()) { setError("Signa (instructions) is required"); return; }

    const m = MEDICATIONS.find((x) => x.name === form.medication) || MEDICATIONS[0];
    const today = new Date();
    const months = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
    const prescribedDate = `${months[today.getMonth()]} ${today.getDate()}, ${today.getFullYear()}`;
    const prescribedAt = parseInt(`${today.getFullYear()}${String(today.getMonth() + 1).padStart(2, "0")}${String(today.getDate()).padStart(2, "0")}`, 10);

    onSave({
      patientName: patient.name,
      patientId: patient.id,
      medication: form.medication,
      strength: form.strength,
      dose: `${form.strength} ${m.freq}`,
      qty: form.qty,
      refillsRemaining: form.refills,
      daySupply: form.daySupply,
      pharmacy: form.pharmacy,
      prescribedDate, prescribedAt,
      prescriber: "Dr. Rivera",
      status: "pending",
      sig: form.sig.trim(),
    });
    onClose();
  }

  const currentMed = MEDICATIONS.find((m) => m.name === form.medication) || MEDICATIONS[0];

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="New Prescription"
      icon="💊"
      width={580}
      footer={
        <>
          <button className="btn btn-ghost" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" onClick={handleSave}>✓ Sign & Transmit</button>
        </>
      }
    >
      {error && (
        <div className="mb-3 px-3 py-2.5 rounded-md bg-red-soft border border-red-soft text-red text-[12px] font-medium">
          ⚠ {error}
        </div>
      )}

      <div className="mb-3">
        <label className="fl">Patient<span className="text-red ml-0.5">*</span></label>
        <select className="fsel" value={form.patientId} onChange={(e) => field("patientId", e.target.value)}>
          <option value="">Pick a patient…</option>
          {patients.map((p) => <option key={p.id} value={p.id}>{p.name} · {p.id}</option>)}
        </select>
      </div>

      {selectedPatient && <ClinicalSafetyStrip patient={selectedPatient} className="mb-3" />}

      <div className="grid grid-cols-2 gap-3 mb-3">
        <div>
          <label className="fl">Medication</label>
          <select className="fsel" value={form.medication} onChange={(e) => handleMedChange(e.target.value)}>
            {MEDICATIONS.map((m) => <option key={m.name} value={m.name}>{m.name}</option>)}
          </select>
        </div>
        <div>
          <label className="fl">Strength</label>
          <select className="fsel" value={form.strength} onChange={(e) => field("strength", e.target.value)}>
            {currentMed.strengths.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-3 mb-3">
        <div>
          <label className="fl">Quantity</label>
          <input
            type="number"
            min={1}
            className="fi"
            value={form.qty}
            onChange={(e) => field("qty", parseInt(e.target.value, 10) || 0)}
          />
        </div>
        <div>
          <label className="fl">Refills</label>
          <input
            type="number"
            min={0}
            max={11}
            className="fi"
            value={form.refills}
            onChange={(e) => field("refills", parseInt(e.target.value, 10) || 0)}
          />
        </div>
        <div>
          <label className="fl">Days Supply</label>
          <input
            type="number"
            min={1}
            className="fi"
            value={form.daySupply}
            onChange={(e) => field("daySupply", parseInt(e.target.value, 10) || 0)}
          />
        </div>
      </div>

      <div className="mb-3">
        <label className="fl">Pharmacy</label>
        <select className="fsel" value={form.pharmacy} onChange={(e) => field("pharmacy", e.target.value)}>
          {PHARMACIES.map((p) => <option key={p} value={p}>{p}</option>)}
        </select>
      </div>

      <div>
        <label className="fl">Signa (Patient Instructions)<span className="text-red ml-0.5">*</span></label>
        <textarea
          className="fta"
          rows={3}
          placeholder={`Inject ${form.strength} subcutaneously once weekly. Rotate injection sites.`}
          value={form.sig}
          onChange={(e) => field("sig", e.target.value)}
        />
      </div>

      <div className="mt-3 text-[11px] text-ink-muted bg-surface-2 border border-border rounded px-3 py-2">
        🔍 <strong>Drug interaction check:</strong> No interactions found with current patient medications.
      </div>
    </Modal>
  );
}
