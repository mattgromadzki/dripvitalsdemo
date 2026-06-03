"use client";

import { useEffect, useState } from "react";
import { Modal } from "@/components/ui/Modal";
import { usePatients } from "@/lib/hooks/usePatients";
import type { MessageThread, ThreadParticipantKind } from "@/lib/types";

interface NewMessageModalProps {
  open: boolean;
  onClose: () => void;
  onSend: (thread: Omit<MessageThread, "id" | "orderedAt">) => void;
}

const STAFF = [
  { name: "Dr. Patel",  initials: "JP", color: "var(--color-green)"  },
  { name: "Dr. Lee",    initials: "JL", color: "var(--color-blue)"   },
  { name: "NP Wang",    initials: "NW", color: "var(--color-teal)"   },
];

const PHARMACIES = [
  { name: "Partner Network FL", initials: "PN", color: "var(--color-purple)" },
  { name: "Empower Pharmacy",   initials: "EP", color: "var(--color-coral)"  },
  { name: "Walgreens FL",       initials: "WG", color: "var(--color-blue)"   },
];

interface FormState {
  toType: ThreadParticipantKind;
  toId: string;     // patient id, or staff name, or pharmacy name
  body: string;
}

export function NewMessageModal({ open, onClose, onSend }: NewMessageModalProps) {
  const patients = usePatients((s) => s.patients);
  const [form, setForm] = useState<FormState>({
    toType: "patient",
    toId: patients[0]?.id || "",
    body: "",
  });
  const [error, setError] = useState("");

  useEffect(() => {
    if (open) {
      setForm({ toType: "patient", toId: patients[0]?.id || "", body: "" });
      setError("");
    }
  }, [open, patients]);

  function field<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  function handleSend() {
    if (!form.body.trim()) { setError("Message body is required"); return; }
    if (!form.toId)        { setError("Pick a recipient");          return; }

    let from = "";
    let initials = "";
    let color = "var(--color-ink-muted)";
    let patientId: string | undefined;

    if (form.toType === "patient") {
      const p = patients.find((x) => x.id === form.toId);
      if (!p) { setError("Patient not found"); return; }
      from = p.name; initials = p.first[0] + p.last[0]; color = p.color; patientId = p.id;
    } else if (form.toType === "staff") {
      const s = STAFF.find((x) => x.name === form.toId);
      if (!s) { setError("Staff member not found"); return; }
      from = s.name; initials = s.initials; color = s.color;
    } else if (form.toType === "pharmacy") {
      const px = PHARMACIES.find((x) => x.name === form.toId);
      if (!px) { setError("Pharmacy not found"); return; }
      from = px.name; initials = px.initials; color = px.color;
    }

    const h = new Date().getHours();
    const m = String(new Date().getMinutes()).padStart(2, "0");
    const ampm = h >= 12 ? "PM" : "AM";
    const h12 = h === 0 ? 12 : h > 12 ? h - 12 : h;
    const timeStr = `${h12}:${m} ${ampm}`;

    onSend({
      from,
      initials,
      color,
      kind: form.toType,
      patientId,
      preview: form.body.trim(),
      time: `Today ${timeStr}`,
      unread: false,
      thread: [{ from: "Dr. Rivera", text: form.body.trim(), time: timeStr, me: true }],
    });
    onClose();
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="New Message"
      icon="✉"
      width={520}
      footer={
        <>
          <button className="btn btn-ghost" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" onClick={handleSend}>Send 📤</button>
        </>
      }
    >
      {error && (
        <div className="mb-3 px-3 py-2.5 rounded-md bg-red-soft border border-red-soft text-red text-[12px] font-medium">
          ⚠ {error}
        </div>
      )}

      <div className="mb-3">
        <label className="fl">Recipient Type</label>
        <div className="flex gap-2">
          {(["patient", "staff", "pharmacy"] as ThreadParticipantKind[]).map((t) => (
            <button
              key={t}
              onClick={() => {
                let defaultId = "";
                if (t === "patient")  defaultId = patients[0]?.id || "";
                if (t === "staff")    defaultId = STAFF[0]?.name || "";
                if (t === "pharmacy") defaultId = PHARMACIES[0]?.name || "";
                setForm((f) => ({ ...f, toType: t, toId: defaultId }));
              }}
              className={[
                "flex-1 py-2 px-3 rounded text-[12px] font-semibold border transition-colors",
                form.toType === t
                  ? "bg-brand text-white border-brand"
                  : "bg-surface border-border text-ink-2 hover:border-border-2",
              ].join(" ")}
            >
              {t === "patient" ? "👤 Patient" : t === "staff" ? "🩺 Staff" : "🏥 Pharmacy"}
            </button>
          ))}
        </div>
      </div>

      <div className="mb-3">
        <label className="fl">Recipient<span className="text-red ml-0.5">*</span></label>
        <select className="fsel" value={form.toId} onChange={(e) => field("toId", e.target.value)}>
          {form.toType === "patient" && patients.map((p) => (
            <option key={p.id} value={p.id}>{p.name} · {p.id}</option>
          ))}
          {form.toType === "staff" && STAFF.map((s) => (
            <option key={s.name} value={s.name}>{s.name}</option>
          ))}
          {form.toType === "pharmacy" && PHARMACIES.map((p) => (
            <option key={p.name} value={p.name}>{p.name}</option>
          ))}
        </select>
      </div>

      <div>
        <label className="fl">Message<span className="text-red ml-0.5">*</span></label>
        <textarea
          className="fta"
          rows={5}
          placeholder="Type your message…"
          value={form.body}
          onChange={(e) => field("body", e.target.value)}
        />
      </div>

      <div className="mt-3 text-[11px] text-ink-muted bg-surface-2 border border-border rounded px-3 py-2 flex items-center gap-2">
        <span className="text-[13px]">🔒</span>
        <span><strong>HIPAA-encrypted</strong> · This message is end-to-end encrypted and logged in the audit trail.</span>
      </div>
    </Modal>
  );
}
