"use client";

import { useEffect, useState } from "react";
import { Modal } from "@/components/ui/Modal";
import type { FarmGroup } from "@/lib/types/farming";

interface Props {
  open: boolean;
  onClose: () => void;
  group?: FarmGroup | null;   // null → create mode
  onSave: (input: Omit<FarmGroup, "id">, id?: string) => void;
}

const COLORS = ["#2f6df6", "#0e9f6e", "#7c3aed", "#f59e0b", "#0ea5e9", "#ef4444", "#14b8a6", "#ec4899"];

export function GroupModal({ open, onClose, group, onSave }: Props) {
  const [name, setName] = useState("");
  const [color, setColor] = useState(COLORS[0]);
  const [description, setDescription] = useState("");
  const [err, setErr] = useState("");

  useEffect(() => {
    if (!open) return;
    setErr("");
    setName(group?.name || "");
    setColor(group?.color || COLORS[0]);
    setDescription(group?.description || "");
  }, [open, group]);

  function save() {
    if (!name.trim()) { setErr("Group name is required."); return; }
    onSave({ name: name.trim(), color, description: description.trim() || undefined }, group?.id);
    onClose();
  }

  return (
    <Modal open={open} onClose={onClose} title={group ? "Edit group" : "New group"} icon="🗂" width={460}
      footer={<><button className="btn btn-ghost" onClick={onClose}>Cancel</button><button className="btn btn-primary" onClick={save}>{group ? "Save" : "Create group"}</button></>}>
      {err && <div className="mb-3 px-3 py-2.5 rounded-md bg-red-soft text-red text-[12px] font-medium">⚠ {err}</div>}
      <div className="mb-3"><label className="fl">Name</label><input className="fi" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Med spa prospects" /></div>
      <div className="mb-3">
        <label className="fl">Color</label>
        <div className="flex gap-2">
          {COLORS.map((c) => (
            <button key={c} type="button" onClick={() => setColor(c)} aria-label={c}
              className={`w-7 h-7 rounded-full transition-transform ${color === c ? "ring-2 ring-offset-2 ring-ink scale-110" : ""}`} style={{ background: c }} />
          ))}
        </div>
      </div>
      <div><label className="fl">Description (optional)</label><input className="fi" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Who's in this group" /></div>
    </Modal>
  );
}
