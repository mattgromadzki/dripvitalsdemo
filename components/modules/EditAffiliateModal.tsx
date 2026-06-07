"use client";

import { useEffect, useState } from "react";
import { Modal } from "@/components/ui/Modal";
import { useAffiliates } from "@/lib/hooks/useAffiliates";
import type { Affiliate, AffiliateType, AffiliateStatus } from "@/lib/types";

const TYPES: AffiliateType[] = ["Influencer", "Doctor", "Health Coach", "Podcast", "Press", "Affiliate Network", "Other"];
const STATUSES: AffiliateStatus[] = ["active", "paused", "pending", "terminated"];

export function EditAffiliateModal({ affiliate, open, onClose }: { affiliate: Affiliate; open: boolean; onClose: () => void }) {
  const update = useAffiliates((s) => s.update);
  const [form, setForm] = useState({
    name: affiliate.name, handle: affiliate.handle, type: affiliate.type, code: affiliate.code,
    commissionRate: affiliate.commissionRate, cookieWindow: affiliate.cookieWindow ?? 30,
    status: affiliate.status, contactEmail: affiliate.contactEmail ?? "", notes: affiliate.notes ?? "",
  });
  const [error, setError] = useState("");

  useEffect(() => {
    if (open) {
      setForm({
        name: affiliate.name, handle: affiliate.handle, type: affiliate.type, code: affiliate.code,
        commissionRate: affiliate.commissionRate, cookieWindow: affiliate.cookieWindow ?? 30,
        status: affiliate.status, contactEmail: affiliate.contactEmail ?? "", notes: affiliate.notes ?? "",
      });
      setError("");
    }
  }, [open, affiliate]);

  function field<K extends keyof typeof form>(k: K, v: (typeof form)[K]) { setForm((f) => ({ ...f, [k]: v })); }

  function save() {
    if (!form.name.trim()) { setError("Name is required"); return; }
    if (!form.code.trim()) { setError("Promo code is required"); return; }
    if (form.commissionRate <= 0 || form.commissionRate > 100) { setError("Commission rate must be 1–100%"); return; }
    if (form.cookieWindow <= 0 || form.cookieWindow > 365) { setError("Cookie window must be 1–365 days"); return; }
    update(affiliate.id, {
      name: form.name.trim(), handle: form.handle.trim() || `@${form.name.toLowerCase().replace(/\s+/g, "")}`,
      type: form.type, code: form.code.trim().toUpperCase(), commissionRate: form.commissionRate,
      cookieWindow: form.cookieWindow, status: form.status,
      contactEmail: form.contactEmail.trim() || undefined, notes: form.notes.trim() || undefined,
    });
    onClose();
  }

  return (
    <Modal open={open} onClose={onClose} title={`Edit ${affiliate.name}`} icon="✏️" width={560}
      footer={<><button className="btn btn-ghost" onClick={onClose}>Cancel</button><button className="btn btn-primary" onClick={save}>Save changes</button></>}>
      {error && <div className="mb-3 px-3 py-2.5 rounded-md bg-red-soft border border-red-soft text-red text-[12px] font-medium">⚠ {error}</div>}

      <label className="fl">Affiliate Name<span className="text-red ml-0.5">*</span></label>
      <input className="fi mb-3" value={form.name} onChange={(e) => field("name", e.target.value)} />

      <div className="grid grid-cols-2 gap-3 mb-3">
        <div><label className="fl">Type</label>
          <select className="fsel" value={form.type} onChange={(e) => field("type", e.target.value as AffiliateType)}>{TYPES.map((t) => <option key={t} value={t}>{t}</option>)}</select></div>
        <div><label className="fl">Status</label>
          <select className="fsel" value={form.status} onChange={(e) => field("status", e.target.value as AffiliateStatus)}>{STATUSES.map((s) => <option key={s} value={s} className="capitalize">{s}</option>)}</select></div>
      </div>

      <div className="grid grid-cols-2 gap-3 mb-3">
        <div><label className="fl">Handle / Display</label>
          <input className="fi" value={form.handle} onChange={(e) => field("handle", e.target.value)} placeholder="@handle" /></div>
        <div><label className="fl">Promo Code<span className="text-red ml-0.5">*</span></label>
          <input className="fi font-mono" value={form.code} onChange={(e) => field("code", e.target.value.toUpperCase())} /></div>
      </div>

      <div className="grid grid-cols-2 gap-3 mb-3">
        <div><label className="fl">Commission Rate (%)</label>
          <input className="fi" type="number" min={1} max={100} value={form.commissionRate} onChange={(e) => field("commissionRate", parseInt(e.target.value, 10) || 0)} /></div>
        <div><label className="fl">Cookie Window (days)</label>
          <input className="fi" type="number" min={1} max={365} value={form.cookieWindow} onChange={(e) => field("cookieWindow", parseInt(e.target.value, 10) || 0)} /></div>
      </div>

      <label className="fl">Contact Email</label>
      <input className="fi mb-3" value={form.contactEmail} onChange={(e) => field("contactEmail", e.target.value)} placeholder="partner@example.com" />

      <label className="fl">Notes</label>
      <textarea className="fta" rows={2} value={form.notes} onChange={(e) => field("notes", e.target.value)} placeholder="Internal notes about this partner…" />
    </Modal>
  );
}
