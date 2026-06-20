"use client";

import { useEffect, useState, type ReactNode } from "react";
import { Modal } from "@/components/ui/Modal";
import type { Medication } from "@/lib/types";
import { MED_PROGRAMS, MED_FORMS } from "@/lib/data/medications";
import { usePharmacies } from "@/lib/hooks/usePharmacies";

export type MedDraft = Omit<Medication, "id" | "sent">;

interface Props {
  open: boolean;
  onClose: () => void;
  med?: Medication; // undefined = add
  onSave: (data: MedDraft) => void;
}

const BLANK: MedDraft = {
  name: "", strength: "", program: "Weight Loss", form: "Vial",
  pharmacy: "", unit: "per vial", cost: 0, ship: 0, status: "active",
};

export function MedicationModal({ open, onClose, med, onSave }: Props) {
  const [f, setF] = useState<MedDraft>(BLANK);
  const [err, setErr] = useState("");
  const isEdit = !!med;
  const pharmacies = usePharmacies((s) => s.pharmacies);
  const pharmacyNames = pharmacies.map((p) => p.name);
  const pharmacyOptions = Array.from(new Set([...pharmacyNames, ...(f.pharmacy ? [f.pharmacy] : [])]));

  useEffect(() => {
    if (!open) return;
    setErr("");
    setF(med ? { name: med.name, strength: med.strength, program: med.program, form: med.form, pharmacy: med.pharmacy, unit: med.unit, cost: med.cost, ship: med.ship, status: med.status } : { ...BLANK, pharmacy: pharmacyNames[0] || "" });
  }, [open, med]);

  const set = <K extends keyof MedDraft>(k: K, v: MedDraft[K]) => setF((p) => ({ ...p, [k]: v }));

  function save() {
    if (!f.name.trim()) { setErr("Medication name is required"); return; }
    onSave({ ...f, name: f.name.trim(), strength: f.strength.trim() || "—", unit: f.unit.trim() || "per unit", cost: Number(f.cost) || 0, ship: Number(f.ship) || 0 });
    onClose();
  }

  return (
    <Modal open={open} onClose={onClose} title={isEdit ? "Edit Medication" : "Add Medication"} icon="💊" width={600}
      footer={<><button className="btn btn-ghost" onClick={onClose}>Cancel</button><button className="btn btn-primary" onClick={save}>{isEdit ? "💾 Save Changes" : "✅ Add Medication"}</button></>}>
      {err && <div className="mb-3 px-3 py-2.5 rounded-md bg-red-soft text-red text-[12px] font-medium">⚠ {err}</div>}
      <Field label="Medication Name"><input className="fi" value={f.name} placeholder="Compounded Semaglutide" onChange={(e) => set("name", e.target.value)} /></Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Program"><select className="fsel" value={f.program} onChange={(e) => set("program", e.target.value)}>{MED_PROGRAMS.map((p) => <option key={p}>{p}</option>)}</select></Field>
        <Field label="Total mg"><input className="fi" value={f.strength} placeholder="e.g. 10 mg" onChange={(e) => set("strength", e.target.value)} /></Field>
        <Field label="Form"><select className="fsel" value={f.form} onChange={(e) => set("form", e.target.value)}>{MED_FORMS.map((x) => <option key={x}>{x}</option>)}</select></Field>
        <Field label="Pharmacy"><select className="fsel" value={f.pharmacy} onChange={(e) => set("pharmacy", e.target.value)}>{pharmacyOptions.length === 0 && <option value="">No pharmacies — add one in Pharmacies</option>}{pharmacyOptions.map((x) => <option key={x}>{x}</option>)}</select></Field>
        <Field label="Unit (priced per)"><input className="fi" value={f.unit} placeholder="per vial" onChange={(e) => set("unit", e.target.value)} /></Field>
        <Field label="Status"><select className="fsel" value={f.status} onChange={(e) => set("status", e.target.value as Medication["status"])}><option value="active">Active</option><option value="discontinued">Discontinued</option></select></Field>
        <Field label="Cost ($ / unit)"><input className="fi" type="number" step="0.01" value={f.cost || ""} placeholder="95" onChange={(e) => set("cost", parseFloat(e.target.value) || 0)} /></Field>
        <Field label="Shipping Cost ($)"><input className="fi" type="number" step="0.01" value={f.ship || ""} placeholder="14" onChange={(e) => set("ship", parseFloat(e.target.value) || 0)} /></Field>
      </div>
    </Modal>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return <div className="mb-2.5"><label className="fl">{label}</label>{children}</div>;
}
