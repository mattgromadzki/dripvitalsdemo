"use client";

import { useEffect, useState } from "react";
import { Modal } from "@/components/ui/Modal";
import { usePatients } from "@/lib/hooks/usePatients";
import type { LabPanelOrder } from "@/lib/types";

interface OrderLabsModalProps {
  open: boolean;
  onClose: () => void;
  onSave: (lab: Omit<LabPanelOrder, "id">) => void;
  defaultPatientId?: string;
}

const PANELS = [
  "Comprehensive Metabolic Panel (CMP)",
  "Basic Metabolic Panel (BMP)",
  "Complete Blood Count (CBC)",
  "Lipid Panel",
  "HbA1c",
  "Thyroid Panel (TSH/T3/T4)",
  "CMP + Lipid + HbA1c",
  "Liver Function Tests",
  "Vitamin D, 25-OH",
  "Iron + Ferritin",
  "Custom Panel",
];

const LABS = ["LabCorp", "Quest Diagnostics", "BioReference", "In-House Draw"];
const PROVIDERS = ["Dr. Rivera", "Dr. Patel", "Dr. Lee", "NP Wang"];

interface FormState {
  patientId: string;
  panel: string;
  customPanel: string;
  laboratory: string;
  orderedBy: string;
  fasting: boolean;
  priority: "routine" | "urgent" | "stat";
  notes: string;
}

const BLANK: FormState = {
  patientId: "",
  panel: "CMP + Lipid + HbA1c",
  customPanel: "",
  laboratory: "LabCorp",
  orderedBy: "Dr. Rivera",
  fasting: true,
  priority: "routine",
  notes: "",
};

export function OrderLabsModal({ open, onClose, onSave, defaultPatientId }: OrderLabsModalProps) {
  const patients = usePatients((s) => s.patients);
  const [form, setForm] = useState<FormState>({ ...BLANK, patientId: defaultPatientId || patients[0]?.id || "" });
  const [error, setError] = useState("");

  useEffect(() => {
    if (open) {
      setForm({ ...BLANK, patientId: defaultPatientId || patients[0]?.id || "" });
      setError("");
    }
  }, [open, defaultPatientId, patients]);

  function field<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  function handleSave() {
    if (!form.patientId) { setError("Pick a patient"); return; }
    const patient = patients.find((p) => p.id === form.patientId);
    if (!patient) { setError("Patient not found"); return; }
    const panelName = form.panel === "Custom Panel" ? form.customPanel.trim() : form.panel;
    if (!panelName) { setError("Enter custom panel name"); return; }

    const today = new Date();
    const months = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
    const orderedDate = `${months[today.getMonth()]} ${today.getDate()}, ${today.getFullYear()}`;
    const orderedAt = parseInt(`${today.getFullYear()}${String(today.getMonth() + 1).padStart(2, "0")}${String(today.getDate()).padStart(2, "0")}`, 10);

    onSave({
      patientName: patient.name,
      patientId: patient.id,
      panel: panelName,
      laboratory: form.laboratory,
      orderedBy: form.orderedBy,
      orderedDate, orderedAt,
      status: form.priority === "stat" ? "ordered" : "pending",
      fasting: form.fasting,
      priority: form.priority,
      notes: form.notes.trim() || undefined,
      results: [],
    });
    onClose();
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Order Labs"
      icon="🧪"
      width={560}
      footer={
        <>
          <button className="btn btn-ghost" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" onClick={handleSave}>🧪 Submit Order</button>
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

      <div className="mb-3">
        <label className="fl">Lab Panel</label>
        <select className="fsel" value={form.panel} onChange={(e) => field("panel", e.target.value)}>
          {PANELS.map((p) => <option key={p} value={p}>{p}</option>)}
        </select>
      </div>

      {form.panel === "Custom Panel" && (
        <div className="mb-3">
          <label className="fl">Custom Panel Name<span className="text-red ml-0.5">*</span></label>
          <input
            className="fi"
            placeholder="e.g. Cortisol AM + DHEA-S"
            value={form.customPanel}
            onChange={(e) => field("customPanel", e.target.value)}
          />
        </div>
      )}

      <div className="grid grid-cols-2 gap-3 mb-3">
        <div>
          <label className="fl">Laboratory</label>
          <select className="fsel" value={form.laboratory} onChange={(e) => field("laboratory", e.target.value)}>
            {LABS.map((l) => <option key={l} value={l}>{l}</option>)}
          </select>
        </div>
        <div>
          <label className="fl">Ordering Provider</label>
          <select className="fsel" value={form.orderedBy} onChange={(e) => field("orderedBy", e.target.value)}>
            {PROVIDERS.map((p) => <option key={p} value={p}>{p}</option>)}
          </select>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 mb-3">
        <div>
          <label className="fl">Priority</label>
          <div className="flex gap-1.5">
            {(["routine", "urgent", "stat"] as const).map((p) => (
              <button
                key={p}
                onClick={() => field("priority", p)}
                className={[
                  "flex-1 py-2 px-2 rounded text-[11.5px] font-semibold border transition-colors",
                  form.priority === p
                    ? p === "stat" ? "bg-red text-white border-red"
                    : p === "urgent" ? "bg-amber text-white border-amber"
                    : "bg-brand text-white border-brand"
                    : "bg-surface border-border text-ink-2 hover:border-border-2",
                ].join(" ")}
              >
                {p === "stat" ? "🚨 STAT" : p === "urgent" ? "⚠ Urgent" : "Routine"}
              </button>
            ))}
          </div>
        </div>
        <div>
          <label className="fl">Fasting</label>
          <div className="flex gap-1.5">
            <button
              onClick={() => field("fasting", true)}
              className={[
                "flex-1 py-2 px-2 rounded text-[11.5px] font-semibold border transition-colors",
                form.fasting ? "bg-brand text-white border-brand" : "bg-surface border-border text-ink-2 hover:border-border-2",
              ].join(" ")}
            >
              Yes
            </button>
            <button
              onClick={() => field("fasting", false)}
              className={[
                "flex-1 py-2 px-2 rounded text-[11.5px] font-semibold border transition-colors",
                !form.fasting ? "bg-brand text-white border-brand" : "bg-surface border-border text-ink-2 hover:border-border-2",
              ].join(" ")}
            >
              No
            </button>
          </div>
        </div>
      </div>

      <div>
        <label className="fl">Clinical Notes</label>
        <textarea
          className="fta"
          rows={2}
          placeholder="Reason for order, special instructions for the lab…"
          value={form.notes}
          onChange={(e) => field("notes", e.target.value)}
        />
      </div>

      <div className="mt-3 text-[11px] text-ink-muted bg-surface-2 border border-border rounded px-3 py-2 flex items-center gap-2">
        <span className="text-[13px]">📋</span>
        <span>
          Order will be transmitted to <strong>{form.laboratory}</strong> via HL7. Patient will receive a draw appointment link by email.
        </span>
      </div>
    </Modal>
  );
}
