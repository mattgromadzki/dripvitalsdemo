"use client";

import { useEffect, useState } from "react";
import { Modal } from "@/components/ui/Modal";
import { usePatients } from "@/lib/hooks/usePatients";
import type { QueueVisit, QueueStatus } from "@/lib/types";

interface ScheduleVisitModalProps {
  open: boolean;
  onClose: () => void;
  onSave: (visit: Omit<QueueVisit, "id">) => void;
  defaultPatientId?: string;
}

const VISIT_TYPES = [
  "GLP-1 Check-in",
  "Initial Consultation",
  "Medication Review",
  "Side Effect Review",
  "Labs Review",
  "Urgent — Side Effect",
  "Follow-up",
  "Weight Check",
];

const PROVIDERS = ["Dr. Rivera", "Dr. Patel", "Dr. Lee", "NP Wang"];

const TIMES = [
  "8:00 AM", "8:30 AM", "9:00 AM", "9:30 AM", "10:00 AM", "10:30 AM",
  "11:00 AM", "11:30 AM", "12:00 PM", "12:30 PM", "1:00 PM", "1:30 PM",
  "2:00 PM", "2:30 PM", "3:00 PM", "3:30 PM", "4:00 PM", "4:30 PM",
];

interface FormState {
  patientId: string;
  time: string;
  type: string;
  provider: string;
  reason: string;
  status: QueueStatus;
}

const BLANK: FormState = {
  patientId: "",
  time: "10:00 AM",
  type: "GLP-1 Check-in",
  provider: "Dr. Rivera",
  reason: "",
  status: "waiting",
};

export function ScheduleVisitModal({ open, onClose, onSave, defaultPatientId }: ScheduleVisitModalProps) {
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
    if (!form.patientId) {
      setError("Pick a patient");
      return;
    }
    const patient = patients.find((p) => p.id === form.patientId);
    if (!patient) {
      setError("Patient not found");
      return;
    }
    const status: QueueStatus = form.type.toLowerCase().includes("urgent") ? "urgent" : form.status;
    onSave({
      patientName: patient.name,
      patientId: patient.id,
      time: form.time,
      type: form.type,
      provider: form.provider,
      reason: form.reason.trim() || `${form.type} appointment`,
      status,
      color: patient.color,
    });
    onClose();
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Schedule Visit"
      icon="📅"
      width={520}
      footer={
        <>
          <button className="btn btn-ghost" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" onClick={handleSave}>📅 Schedule</button>
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
          {patients.map((p) => (
            <option key={p.id} value={p.id}>{p.name} · {p.id}</option>
          ))}
        </select>
      </div>

      <div className="grid grid-cols-2 gap-3 mb-3">
        <div>
          <label className="fl">Time</label>
          <select className="fsel" value={form.time} onChange={(e) => field("time", e.target.value)}>
            {TIMES.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
        </div>
        <div>
          <label className="fl">Visit Type</label>
          <select className="fsel" value={form.type} onChange={(e) => field("type", e.target.value)}>
            {VISIT_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 mb-3">
        <div>
          <label className="fl">Provider</label>
          <select className="fsel" value={form.provider} onChange={(e) => field("provider", e.target.value)}>
            {PROVIDERS.map((p) => <option key={p} value={p}>{p}</option>)}
          </select>
        </div>
        <div>
          <label className="fl">Status</label>
          <select
            className="fsel"
            value={form.status}
            onChange={(e) => field("status", e.target.value as QueueStatus)}
          >
            <option value="waiting">Waiting</option>
            <option value="in_progress">In Progress</option>
            <option value="scheduled">Scheduled</option>
            <option value="urgent">🔴 Urgent</option>
          </select>
        </div>
      </div>

      <div>
        <label className="fl">Reason</label>
        <textarea
          className="fta"
          rows={2}
          placeholder="e.g. Weight check + BP review"
          value={form.reason}
          onChange={(e) => field("reason", e.target.value)}
        />
      </div>
    </Modal>
  );
}
