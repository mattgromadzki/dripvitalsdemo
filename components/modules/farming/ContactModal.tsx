"use client";

import { useEffect, useState } from "react";
import { Modal } from "@/components/ui/Modal";
import { FARM_STATUSES } from "@/lib/types/farming";
import type { FarmContact, FarmGroup, FarmStatus, ContactInput } from "@/lib/types/farming";

interface Props {
  open: boolean;
  onClose: () => void;
  contact?: FarmContact | null;    // null → add mode
  groups: FarmGroup[];
  onSave: (input: ContactInput, id?: string) => void;
}

const BLANK = { firstName: "", lastName: "", email: "", phone: "", state: "", county: "", city: "", notes: "", status: "new" as FarmStatus, groupIds: [] as string[], optedOut: false };

export function ContactModal({ open, onClose, contact, groups, onSave }: Props) {
  const [f, setF] = useState(BLANK);
  const [err, setErr] = useState("");

  useEffect(() => {
    if (!open) return;
    setErr("");
    setF(contact
      ? { firstName: contact.firstName, lastName: contact.lastName, email: contact.email, phone: contact.phone, state: contact.custom?.state || "", county: contact.custom?.county || "", city: contact.custom?.city || "", notes: contact.notes || "", status: contact.status, groupIds: contact.groupIds, optedOut: contact.optedOut }
      : BLANK);
  }, [open, contact]);

  const set = <K extends keyof typeof f>(k: K, v: (typeof f)[K]) => setF((s) => ({ ...s, [k]: v }));
  const toggleGroup = (id: string) => setF((s) => ({ ...s, groupIds: s.groupIds.includes(id) ? s.groupIds.filter((g) => g !== id) : [...s.groupIds, id] }));

  function save() {
    if (!f.firstName.trim() && !f.lastName.trim()) { setErr("A first or last name is required."); return; }
    if (!f.email.trim() && !f.phone.trim()) { setErr("Enter an email or a phone — at least one is needed to reach the contact."); return; }
    // Merge location edits into the existing custom map so other captured
    // fields (address, zip, license #) are preserved.
    const custom = { ...(contact?.custom || {}), state: f.state.trim(), county: f.county.trim(), city: f.city.trim() };
    onSave({
      firstName: f.firstName.trim(), lastName: f.lastName.trim(), email: f.email.trim(), phone: f.phone.trim(),
      custom, notes: f.notes.trim() || undefined,
      status: f.status, groupIds: f.groupIds, optedOut: f.optedOut, source: contact ? contact.source : "Manual",
    }, contact?.id);
    onClose();
  }

  return (
    <Modal open={open} onClose={onClose} title={contact ? "Edit contact" : "Add contact"} icon="👤" width={560}
      footer={<><button className="btn btn-ghost" onClick={onClose}>Cancel</button><button className="btn btn-primary" onClick={save}>{contact ? "Save changes" : "Add contact"}</button></>}>
      {err && <div className="mb-3 px-3 py-2.5 rounded-md bg-red-soft text-red text-[12px] font-medium">⚠ {err}</div>}
      <div className="grid grid-cols-2 gap-3">
        <div><label className="fl">First name</label><input className="fi" value={f.firstName} onChange={(e) => set("firstName", e.target.value)} placeholder="Jane" /></div>
        <div><label className="fl">Last name</label><input className="fi" value={f.lastName} onChange={(e) => set("lastName", e.target.value)} placeholder="Doe" /></div>
        <div><label className="fl">Email</label><input className="fi" type="email" value={f.email} onChange={(e) => set("email", e.target.value)} placeholder="jane@company.com" /></div>
        <div><label className="fl">Phone</label><input className="fi" value={f.phone} onChange={(e) => set("phone", e.target.value)} placeholder="+1 (305) 555-0100" /></div>
      </div>
      <div className="grid grid-cols-3 gap-3 mt-1">
        <div><label className="fl">State</label><input className="fi" value={f.state} onChange={(e) => set("state", e.target.value)} placeholder="FL" /></div>
        <div><label className="fl">County</label><input className="fi" value={f.county} onChange={(e) => set("county", e.target.value)} placeholder="Broward" /></div>
        <div><label className="fl">City</label><input className="fi" value={f.city} onChange={(e) => set("city", e.target.value)} placeholder="Miami" /></div>
      </div>
      <div className="grid grid-cols-2 gap-3 mt-1">
        <div>
          <label className="fl">Status</label>
          <select className="fsel" value={f.status} onChange={(e) => set("status", e.target.value as FarmStatus)}>
            {FARM_STATUSES.map((s) => <option key={s.key} value={s.key}>{s.label}</option>)}
          </select>
        </div>
        <div className="flex items-end">
          <label className="flex items-center gap-2 cursor-pointer text-[12.5px] font-semibold text-ink-2 select-none pb-2">
            <input type="checkbox" checked={f.optedOut} onChange={(e) => set("optedOut", e.target.checked)} style={{ accentColor: "var(--color-red)" }} />
            Opted out (suppress from all sends)
          </label>
        </div>
      </div>
      {groups.length > 0 && (
        <div className="mt-2">
          <label className="fl">Groups</label>
          <div className="flex flex-wrap gap-1.5">
            {groups.map((g) => (
              <button key={g.id} type="button" onClick={() => toggleGroup(g.id)}
                className={`text-[11.5px] font-semibold px-2.5 py-1 rounded-full border transition-colors ${f.groupIds.includes(g.id) ? "text-white border-transparent" : "bg-surface border-border text-ink-2 hover:border-border-2"}`}
                style={f.groupIds.includes(g.id) ? { background: g.color } : undefined}>
                {g.name}
              </button>
            ))}
          </div>
        </div>
      )}
      <div className="mt-2"><label className="fl">Notes</label><textarea className="fi min-h-[64px] resize-y" value={f.notes} onChange={(e) => set("notes", e.target.value)} placeholder="Context, last touchpoint…" /></div>
    </Modal>
  );
}
