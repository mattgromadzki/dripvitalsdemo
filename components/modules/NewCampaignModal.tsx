"use client";

import { useEffect, useState } from "react";
import { Modal } from "@/components/ui/Modal";
import { useMarketing } from "@/lib/hooks/useMarketing";
import type { Campaign, CampaignChannel, CampaignType } from "@/lib/types";

interface NewCampaignModalProps {
  open: boolean;
  onClose: () => void;
  onCreate: (c: Omit<Campaign, "id">) => void;
}

const CHANNELS: { value: CampaignChannel; label: string; icon: string }[] = [
  { value: "email", label: "Email",      icon: "📧" },
  { value: "sms",   label: "SMS",        icon: "📱" },
  { value: "both",  label: "Email + SMS",icon: "⚡" },
];

const TYPES: CampaignType[] = ["Triggered", "Recurring", "Drip", "One-time Blast"];

const COLORS = ["var(--color-brand)","var(--color-blue)","var(--color-coral)","var(--color-amber)","var(--color-violet)","var(--color-teal)","var(--color-purple)","var(--color-pink)"];

interface FormState {
  name: string;
  channel: CampaignChannel;
  type: CampaignType;
  audienceSegmentId: string;
  templateId: string;
  subject: string;
  startAsDraft: boolean;
}

const BLANK: FormState = {
  name: "",
  channel: "email",
  type: "Triggered",
  audienceSegmentId: "",
  templateId: "",
  subject: "",
  startAsDraft: false,
};

export function NewCampaignModal({ open, onClose, onCreate }: NewCampaignModalProps) {
  const segments  = useMarketing((s) => s.segments);
  const templates = useMarketing((s) => s.templates);

  const [form, setForm] = useState<FormState>(() => ({ ...BLANK, audienceSegmentId: segments[0]?.id || "" }));
  const [error, setError] = useState("");

  useEffect(() => {
    if (open) {
      setForm({ ...BLANK, audienceSegmentId: segments[0]?.id || "" });
      setError("");
    }
  }, [open, segments]);

  function field<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  function handleTemplate(id: string) {
    const tpl = templates.find((t) => t.id === id);
    setForm((f) => ({ ...f, templateId: id, subject: tpl?.subject || f.subject }));
  }

  function handleCreate() {
    const name = form.name.trim();
    if (!name) { setError("Campaign name is required"); return; }
    if (!form.audienceSegmentId) { setError("Pick an audience segment"); return; }

    const seg = segments.find((s) => s.id === form.audienceSegmentId);
    if (!seg) { setError("Audience segment not found"); return; }
    if (form.channel !== "sms" && !form.subject.trim()) {
      setError("Subject line is required for email campaigns");
      return;
    }

    const today = new Date();
    const months = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
    const createdDate = `${months[today.getMonth()]} ${today.getDate()}, ${today.getFullYear()}`;

    const icon = form.channel === "email" ? "📧" : form.channel === "sms" ? "📱" : "⚡";

    onCreate({
      name,
      channel: form.channel,
      type: form.type,
      status: form.startAsDraft ? "draft" : "active",
      audience: seg.name,
      subject: form.channel === "sms" ? "" : form.subject.trim(),
      sent: 0,
      delivered: 0,
      opens: 0,
      clicks: 0,
      conversions: 0,
      revenue: 0,
      icon,
      color: COLORS[Math.floor(Math.random() * COLORS.length)],
      createdDate,
    });
    onClose();
  }

  const isSmsOnly = form.channel === "sms";

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="New Campaign"
      icon="📣"
      width={580}
      footer={
        <>
          <button className="btn btn-ghost" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" onClick={handleCreate}>
            {form.startAsDraft ? "💾 Save as Draft" : "🚀 Launch Campaign"}
          </button>
        </>
      }
    >
      {error && (
        <div className="mb-3 px-3 py-2.5 rounded-md bg-red-soft border border-red-soft text-red text-[12px] font-medium">
          ⚠ {error}
        </div>
      )}

      <div className="mb-3">
        <label className="fl">Campaign Name<span className="text-red ml-0.5">*</span></label>
        <input
          className="fi"
          placeholder="e.g. June Wellness Promo"
          value={form.name}
          onChange={(e) => field("name", e.target.value)}
        />
      </div>

      <div className="mb-3">
        <label className="fl">Channel</label>
        <div className="grid grid-cols-3 gap-2">
          {CHANNELS.map((c) => (
            <button
              key={c.value}
              type="button"
              onClick={() => field("channel", c.value)}
              className={[
                "py-2.5 px-3 rounded-md border text-[12.5px] font-semibold transition-colors flex items-center justify-center gap-2",
                form.channel === c.value ? "bg-brand-soft border-brand text-brand-dk" : "bg-surface border-border text-ink-2 hover:border-border-2",
              ].join(" ")}
            >
              <span>{c.icon}</span> {c.label}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 mb-3">
        <div>
          <label className="fl">Campaign Type</label>
          <select className="fsel" value={form.type} onChange={(e) => field("type", e.target.value as CampaignType)}>
            {TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
        </div>
        <div>
          <label className="fl">Audience Segment<span className="text-red ml-0.5">*</span></label>
          <select className="fsel" value={form.audienceSegmentId} onChange={(e) => field("audienceSegmentId", e.target.value)}>
            {segments.map((s) => <option key={s.id} value={s.id}>{s.name} · {s.count.toLocaleString()} people</option>)}
          </select>
        </div>
      </div>

      <div className="mb-3">
        <label className="fl">Template (Optional)</label>
        <select className="fsel" value={form.templateId} onChange={(e) => handleTemplate(e.target.value)}>
          <option value="">— Start from scratch —</option>
          {templates
            .filter((t) => isSmsOnly ? t.channel === "SMS" : form.channel === "email" ? t.channel === "Email" : true)
            .map((t) => <option key={t.id} value={t.id}>{t.icon} {t.name}</option>)}
        </select>
      </div>

      {!isSmsOnly && (
        <div className="mb-3">
          <label className="fl">Subject Line<span className="text-red ml-0.5">*</span></label>
          <input
            className="fi"
            placeholder="Use {first_name} for personalization"
            value={form.subject}
            onChange={(e) => field("subject", e.target.value)}
          />
          <div className="text-[10.5px] text-ink-muted mt-1">
            Available variables: <code className="bg-surface-2 px-1 rounded">{"{first_name}"}</code>, <code className="bg-surface-2 px-1 rounded">{"{plan_name}"}</code>, <code className="bg-surface-2 px-1 rounded">{"{doctor_name}"}</code>
          </div>
        </div>
      )}

      <div className="flex items-center gap-2 mt-4 pt-3 border-t border-border">
        <label className="flex items-center gap-2 cursor-pointer text-[12.5px] font-semibold text-ink-2">
          <input
            type="checkbox"
            checked={form.startAsDraft}
            onChange={(e) => field("startAsDraft", e.target.checked)}
            style={{ accentColor: "var(--color-brand)" }}
          />
          Save as draft (don't send yet)
        </label>
      </div>
    </Modal>
  );
}
