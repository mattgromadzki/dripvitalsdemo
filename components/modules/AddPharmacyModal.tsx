"use client";

import { useEffect, useState } from "react";
import { Modal } from "@/components/ui/Modal";
import type { Pharmacy } from "@/lib/types";

interface AddPharmacyModalProps {
  open: boolean;
  onClose: () => void;
  onSave: (p: Omit<Pharmacy, "id">) => void;
}

const ICONS = ["🏪", "🔬", "⚗️", "🧪", "💊", "🌿", "🌊", "🩺", "🏥"];
const TYPES: Pharmacy["type"][] = ["compounding", "retail", "specialty", "mail-order"];

interface FormState {
  name: string;
  icon: string;
  location: string;
  states: string;
  turnaround: string;
  type: Pharmacy["type"];
  contactName: string;
  contactEmail: string;
  contactPhone: string;
  apiEndpoint: string;
}

const BLANK: FormState = {
  name: "",
  icon: "🏪",
  location: "",
  states: "",
  turnaround: "48h",
  type: "compounding",
  contactName: "",
  contactEmail: "",
  contactPhone: "",
  apiEndpoint: "",
};

export function AddPharmacyModal({ open, onClose, onSave }: AddPharmacyModalProps) {
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

  function handleSave() {
    if (!form.name.trim())     { setError("Pharmacy name is required"); return; }
    if (!form.location.trim()) { setError("Location is required");      return; }
    if (!form.states.trim())   { setError("State coverage is required"); return; }

    const today = new Date();
    const months = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
    const contractedSince = `${months[today.getMonth()]} ${today.getFullYear()}`;

    onSave({
      name: form.name.trim(),
      icon: form.icon,
      location: form.location.trim(),
      states: form.states.trim(),
      turnaround: form.turnaround.trim(),
      type: form.type,
      contactName: form.contactName.trim() || undefined,
      contactEmail: form.contactEmail.trim() || undefined,
      contactPhone: form.contactPhone.trim() || undefined,
      apiEndpoint: form.apiEndpoint.trim() || undefined,
      status: form.apiEndpoint.trim() ? "syncing" : "paused",
      lastSync: form.apiEndpoint.trim() ? "Awaiting first sync" : undefined,
      monthlyOrders: 0,
      successRate: 0,
      avgFulfillmentDays: 0,
      contractedSince,
    });
    onClose();
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Add Partner Pharmacy"
      icon="🏥"
      width={580}
      footer={
        <>
          <button className="btn btn-ghost" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" onClick={handleSave}>+ Add Pharmacy</button>
        </>
      }
    >
      {error && (
        <div className="mb-3 px-3 py-2.5 rounded-md bg-red-soft border border-red-soft text-red text-[12px] font-medium">
          ⚠ {error}
        </div>
      )}

      <div className="grid grid-cols-[80px_1fr] gap-3 mb-3">
        <div>
          <label className="fl">Icon</label>
          <div className="grid grid-cols-3 gap-1">
            {ICONS.map((ic) => (
              <button
                key={ic}
                onClick={() => field("icon", ic)}
                className={[
                  "h-9 rounded text-[18px] border transition-colors",
                  form.icon === ic ? "bg-brand-soft border-brand" : "bg-surface-2 border-border hover:border-border-2",
                ].join(" ")}
              >
                {ic}
              </button>
            ))}
          </div>
        </div>
        <div>
          <label className="fl">Pharmacy Name<span className="text-red ml-0.5">*</span></label>
          <input className="fi mb-2" placeholder="e.g. Hallandale Pharmacy" value={form.name} onChange={(e) => field("name", e.target.value)} />
          <label className="fl">Type</label>
          <select className="fsel" value={form.type} onChange={(e) => field("type", e.target.value as Pharmacy["type"])}>
            {TYPES.map((t) => <option key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</option>)}
          </select>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 mb-3">
        <div>
          <label className="fl">Location<span className="text-red ml-0.5">*</span></label>
          <input className="fi" placeholder="Hallandale Beach, FL" value={form.location} onChange={(e) => field("location", e.target.value)} />
        </div>
        <div>
          <label className="fl">Turnaround</label>
          <select className="fsel" value={form.turnaround} onChange={(e) => field("turnaround", e.target.value)}>
            <option value="24h">24h</option>
            <option value="48h">48h</option>
            <option value="72h">72h</option>
            <option value="96h">96h</option>
            <option value="1 week">1 week</option>
          </select>
        </div>
      </div>

      <div className="mb-3">
        <label className="fl">State Coverage<span className="text-red ml-0.5">*</span></label>
        <input
          className="fi"
          placeholder="FL, TX, CA, NY or 'All 50 states'"
          value={form.states}
          onChange={(e) => field("states", e.target.value)}
        />
      </div>

      <div className="text-[10.5px] font-bold uppercase tracking-widest text-ink-muted mb-2 mt-4">Primary Contact</div>
      <div className="grid grid-cols-2 gap-3 mb-3">
        <div>
          <label className="fl">Contact Name</label>
          <input className="fi" placeholder="Jane Doe" value={form.contactName} onChange={(e) => field("contactName", e.target.value)} />
        </div>
        <div>
          <label className="fl">Phone</label>
          <input className="fi" placeholder="(555) 555-0100" value={form.contactPhone} onChange={(e) => field("contactPhone", e.target.value)} />
        </div>
      </div>
      <div className="mb-3">
        <label className="fl">Email</label>
        <input className="fi" type="email" placeholder="orders@pharmacy.com" value={form.contactEmail} onChange={(e) => field("contactEmail", e.target.value)} />
      </div>

      <div className="text-[10.5px] font-bold uppercase tracking-widest text-ink-muted mb-2 mt-4">API Integration (Optional)</div>
      <div>
        <label className="fl">API Endpoint URL</label>
        <input
          className="fi"
          placeholder="https://api.pharmacy.com/v1"
          value={form.apiEndpoint}
          onChange={(e) => field("apiEndpoint", e.target.value)}
        />
        <div className="text-[10.5px] text-ink-muted mt-1.5">
          Leave blank to add the pharmacy manually. With an API, prescriptions can be routed automatically.
        </div>
      </div>
    </Modal>
  );
}
