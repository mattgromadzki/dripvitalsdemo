"use client";

import { useEffect, useState } from "react";
import { Modal } from "@/components/ui/Modal";
import type { Affiliate, AffiliateType } from "@/lib/types";

interface NewAffiliateModalProps {
  open: boolean;
  onClose: () => void;
  onCreate: (a: Omit<Affiliate, "id">) => void;
}

const TYPES: AffiliateType[] = ["Influencer", "Doctor", "Health Coach", "Podcast", "Press", "Affiliate Network", "Other"];

const COLORS = [
  "var(--color-brand)",
  "var(--color-pink)",
  "var(--color-violet)",
  "var(--color-teal)",
  "var(--color-amber)",
  "var(--color-purple)",
  "var(--color-blue)",
  "var(--color-green)",
];

interface FormState {
  name: string;
  handle: string;
  type: AffiliateType;
  code: string;
  commissionRate: number;
  contactEmail: string;
  cookieWindow: number;
  notes: string;
}

const BLANK: FormState = {
  name: "",
  handle: "",
  type: "Influencer",
  code: "",
  commissionRate: 20,
  contactEmail: "",
  cookieWindow: 30,
  notes: "",
};

export function NewAffiliateModal({ open, onClose, onCreate }: NewAffiliateModalProps) {
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

  function suggestCode(name: string): string {
    const slug = name.toUpperCase().replace(/[^A-Z]/g, "").slice(0, 6);
    return slug ? `${slug}${form.commissionRate * 2}` : "";
  }

  function handleCreate() {
    const name = form.name.trim();
    const code = form.code.trim().toUpperCase();
    if (!name) { setError("Affiliate name is required"); return; }
    if (!code) { setError("Promo code is required"); return; }
    if (form.commissionRate <= 0 || form.commissionRate > 100) { setError("Commission rate must be 1–100%"); return; }

    const today = new Date();
    const months = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
    const joinedDate = `${months[today.getMonth()]} ${today.getDate()}, ${today.getFullYear()}`;

    onCreate({
      name,
      handle: form.handle.trim() || `@${name.toLowerCase().replace(/\s+/g, "")}`,
      type: form.type,
      code,
      color: COLORS[Math.floor(Math.random() * COLORS.length)],
      commissionRate: form.commissionRate,
      status: "pending",
      joinedDate,
      conversionsAllTime: 0,
      conversions30d: 0,
      revenueAllTime: 0,
      revenue30d: 0,
      commissionPaidAllTime: 0,
      commissionPending: 0,
      clickThroughs30d: 0,
      contactEmail: form.contactEmail.trim() || undefined,
      cookieWindow: form.cookieWindow,
      notes: form.notes.trim() || undefined,
      payouts: [],
    });
    onClose();
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Add Affiliate"
      icon="🏆"
      width={520}
      footer={
        <>
          <button className="btn btn-ghost" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" onClick={handleCreate}>+ Add Affiliate</button>
        </>
      }
    >
      {error && (
        <div className="mb-3 px-3 py-2.5 rounded-md bg-red-soft border border-red-soft text-red text-[12px] font-medium">
          ⚠ {error}
        </div>
      )}

      <div className="mb-3">
        <label className="fl">Affiliate Name<span className="text-red ml-0.5">*</span></label>
        <input
          className="fi"
          placeholder="Kenzie Fit"
          value={form.name}
          onChange={(e) => {
            field("name", e.target.value);
            if (!form.code) field("code", suggestCode(e.target.value));
          }}
        />
      </div>

      <div className="grid grid-cols-2 gap-3 mb-3">
        <div>
          <label className="fl">Type</label>
          <select className="fsel" value={form.type} onChange={(e) => field("type", e.target.value as AffiliateType)}>
            {TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
        </div>
        <div>
          <label className="fl">Handle / Display</label>
          <input
            className="fi"
            placeholder="@handle or 'Podcast · 40K'"
            value={form.handle}
            onChange={(e) => field("handle", e.target.value)}
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 mb-3">
        <div>
          <label className="fl">Promo Code<span className="text-red ml-0.5">*</span></label>
          <input
            className="fi font-mono uppercase"
            placeholder="KENZIE50"
            value={form.code}
            onChange={(e) => field("code", e.target.value.toUpperCase())}
          />
        </div>
        <div>
          <label className="fl">Commission Rate (%)</label>
          <input
            type="number"
            min={1} max={100}
            className="fi"
            value={form.commissionRate}
            onChange={(e) => field("commissionRate", parseInt(e.target.value, 10) || 0)}
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 mb-3">
        <div>
          <label className="fl">Contact Email</label>
          <input
            type="email"
            className="fi"
            placeholder="partner@example.com"
            value={form.contactEmail}
            onChange={(e) => field("contactEmail", e.target.value)}
          />
        </div>
        <div>
          <label className="fl">Cookie Window (days)</label>
          <select className="fsel" value={form.cookieWindow} onChange={(e) => field("cookieWindow", parseInt(e.target.value, 10))}>
            <option value={7}>7 days</option>
            <option value={14}>14 days</option>
            <option value={30}>30 days</option>
            <option value={60}>60 days</option>
            <option value={90}>90 days</option>
          </select>
        </div>
      </div>

      <div className="mb-3">
        <label className="fl">Notes</label>
        <textarea
          className="fta"
          rows={2}
          placeholder="Audience size, content schedule, special terms…"
          value={form.notes}
          onChange={(e) => field("notes", e.target.value)}
        />
      </div>

      <div className="text-[11px] text-ink-muted bg-surface-2 border border-border rounded px-3 py-2 flex items-center gap-2">
        <span className="text-[13px]">📋</span>
        <span>
          New affiliates start in <strong>pending</strong> status until W-9 is on file and the first conversion lands. The promo code is reserved immediately.
        </span>
      </div>
    </Modal>
  );
}
