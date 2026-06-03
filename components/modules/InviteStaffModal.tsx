"use client";

import { useEffect, useState } from "react";
import { Modal } from "@/components/ui/Modal";
import type { StaffMember, StaffRole } from "@/lib/types";

interface InviteStaffModalProps {
  open: boolean;
  onClose: () => void;
  onInvite: (member: Omit<StaffMember, "id">) => void;
}

const ROLES: StaffRole[] = ["Admin", "Provider (MD)", "Provider (NP)", "Nurse", "Care Coordinator", "Pharmacist", "Billing"];

const COLORS = [
  "var(--color-brand)",
  "var(--color-coral)",
  "var(--color-purple)",
  "var(--color-teal)",
  "var(--color-pink)",
  "var(--color-amber)",
  "var(--color-blue)",
  "var(--color-violet)",
  "var(--color-green)",
];

interface FormState {
  name: string;
  email: string;
  role: StaffRole;
  npi: string;
  states: string;
}

const BLANK: FormState = {
  name: "",
  email: "",
  role: "Care Coordinator",
  npi: "",
  states: "",
};

export function InviteStaffModal({ open, onClose, onInvite }: InviteStaffModalProps) {
  const [form, setForm] = useState<FormState>(BLANK);
  const [error, setError] = useState("");

  useEffect(() => {
    if (open) {
      setForm(BLANK);
      setError("");
    }
  }, [open]);

  function field<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  function handleInvite() {
    const trimmedName = form.name.trim();
    const trimmedEmail = form.email.trim();
    if (!trimmedName) { setError("Name is required"); return; }
    if (!trimmedEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) {
      setError("Valid email is required");
      return;
    }

    const initials = trimmedName.split(" ").map((s) => s[0]).join("").slice(0, 2).toUpperCase();
    const isProvider = form.role.startsWith("Provider");
    if (isProvider && !form.npi.trim()) {
      setError("NPI is required for providers");
      return;
    }

    const today = new Date();
    const months = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
    const joined = `${months[today.getMonth()]} ${today.getDate()}, ${today.getFullYear()}`;

    onInvite({
      name: trimmedName,
      initials,
      role: form.role,
      email: trimmedEmail,
      npi: form.npi.trim() || undefined,
      states: form.states.trim() || undefined,
      licenses: [],
      active: false,             // starts inactive until invite is accepted
      color: COLORS[Math.floor(Math.random() * COLORS.length)],
      joined,
      patientsAssigned: 0,
    });
    onClose();
  }

  const isProvider = form.role.startsWith("Provider");

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Invite Staff Member"
      icon="👤"
      width={480}
      footer={
        <>
          <button className="btn btn-ghost" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" onClick={handleInvite}>✉ Send Invitation</button>
        </>
      }
    >
      {error && (
        <div className="mb-3 px-3 py-2.5 rounded-md bg-red-soft border border-red-soft text-red text-[12px] font-medium">
          ⚠ {error}
        </div>
      )}

      <div className="mb-3">
        <label className="fl">Full Name<span className="text-red ml-0.5">*</span></label>
        <input
          className="fi"
          placeholder="Dr. Jane Smith"
          value={form.name}
          onChange={(e) => field("name", e.target.value)}
        />
      </div>

      <div className="mb-3">
        <label className="fl">Email<span className="text-red ml-0.5">*</span></label>
        <input
          className="fi"
          type="email"
          placeholder="jane.smith@dripvitals.health"
          value={form.email}
          onChange={(e) => field("email", e.target.value)}
        />
      </div>

      <div className="mb-3">
        <label className="fl">Role</label>
        <select className="fsel" value={form.role} onChange={(e) => field("role", e.target.value as StaffRole)}>
          {ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
        </select>
      </div>

      {isProvider && (
        <>
          <div className="mb-3">
            <label className="fl">NPI Number<span className="text-red ml-0.5">*</span></label>
            <input
              className="fi"
              placeholder="1234567890"
              value={form.npi}
              onChange={(e) => field("npi", e.target.value.replace(/\D/g, "").slice(0, 10))}
            />
          </div>
          <div className="mb-3">
            <label className="fl">Licensed States</label>
            <input
              className="fi"
              placeholder="FL, TX, GA"
              value={form.states}
              onChange={(e) => field("states", e.target.value)}
            />
          </div>
        </>
      )}

      <div className="mt-3 text-[11px] text-ink-muted bg-surface-2 border border-border rounded px-3 py-2 flex items-center gap-2">
        <span className="text-[13px]">✉</span>
        <span>
          An invitation email will be sent to <strong>{form.email || "—"}</strong>. They will set up their password and 2FA on first login.
        </span>
      </div>
    </Modal>
  );
}
