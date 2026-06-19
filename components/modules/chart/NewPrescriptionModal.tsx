"use client";

import { useState } from "react";
import { Modal } from "@/components/ui/Modal";
import { toast } from "@/lib/hooks/useToast";
import { usePermission } from "@/lib/rbac/usePermission";
import { usePrescriptions } from "@/lib/hooks/usePrescriptions";
import { DRUG_CATALOG, DOSE_PRESETS } from "@/lib/data/eprescribeCatalog";
import type { Patient, RxStatusFull, PaymentOverride } from "@/lib/types";

const STATUSES: RxStatusFull[] = ["active", "pending", "filled"];

export function NewPrescriptionModal({ patient, open, onClose }: { patient: Patient; open: boolean; onClose: () => void }) {
  const add = usePrescriptions((s) => s.add);
  const canCharge = usePermission("payments.charge");

  const [medName, setMedName]   = useState("");        // catalog name or "__other"
  const [medOther, setMedOther] = useState("");
  const [preset, setPreset]     = useState("");
  const [strength, setStrength] = useState("");
  const [freq, setFreq]         = useState("Once weekly");
  const [sig, setSig]           = useState("");
  const [qty, setQty]           = useState(4);
  const [daySupply, setDaySupply] = useState(28);
  const [refills, setRefills]   = useState(2);
  const [pharmacy, setPharmacy] = useState("GreenstoneRX");
  const [prescriber, setPrescriber] = useState(patient.provider || "Dr. Tancinco");
  const [status, setStatus]     = useState<RxStatusFull>("active");
  const [controlled, setControlled] = useState(false);

  // payment override
  const [override, setOverride] = useState(false);
  const [payMode, setPayMode]   = useState<"paid" | "waived">("paid");
  const [reason, setReason]     = useState("");

  const medication = medName === "__other" ? medOther.trim() : medName;

  function applyPreset(label: string) {
    setPreset(label);
    const p = DOSE_PRESETS.find((x) => x.label === label);
    if (!p || p.label === "Custom") return;
    setStrength(p.strength);
    setFreq(p.freq);
    setSig(p.sig);
    setQty(p.qty);
  }

  function resetAll() {
    setMedName(""); setMedOther(""); setPreset(""); setStrength(""); setFreq("Once weekly");
    setSig(""); setQty(4); setDaySupply(28); setRefills(2); setPharmacy("GreenstoneRX");
    setPrescriber(patient.provider || "Dr. Tancinco"); setStatus("active"); setControlled(false);
    setOverride(false); setPayMode("paid"); setReason("");
  }

  function submit() {
    if (!medication)      { toast("Choose or enter a medication"); return; }
    if (!strength.trim()) { toast("Enter a strength"); return; }
    if (!sig.trim())      { toast("Enter the sig / instructions"); return; }
    const useOverride = override && canCharge;
    if (useOverride && !reason.trim()) { toast("Add a reason for the payment override"); return; }

    const now = Date.now();
    const paymentOverride: PaymentOverride | undefined = useOverride
      ? { mode: payMode, reason: reason.trim(), by: prescriber.trim() || "Provider", at: now }
      : undefined;

    add({
      patientName: patient.name,
      patientId: patient.id,
      medication,
      dose: `${strength.trim()} · ${freq.trim()}`.trim(),
      strength: strength.trim(),
      qty: Number(qty) || 0,
      refillsRemaining: Number(refills) || 0,
      pharmacy: pharmacy.trim() || "—",
      prescribedDate: new Date(now).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }),
      prescribedAt: now,
      prescriber: prescriber.trim() || "—",
      status,
      daySupply: Number(daySupply) || 28,
      sig: sig.trim(),
      controlled,
      ...(paymentOverride ? { paymentOverride } : {}),
    });

    toast(paymentOverride
      ? `℞ created · payment ${payMode === "paid" ? "marked paid" : "waived"}`
      : "℞ Prescription created");
    resetAll();
    onClose();
  }

  return (
    <Modal open={open} onClose={onClose} title="New prescription" icon="💊" width={640}
      footer={<>
        <button className="btn btn-ghost btn-sm" onClick={onClose}>Cancel</button>
        <button className="btn btn-primary btn-sm" onClick={submit}>Create prescription</button>
      </>}
    >
      <div className="text-[12px] text-ink-muted mb-3">
        Manually recording a script for <b className="text-ink-2">{patient.name}</b> ({patient.id}). This creates the prescription
        record only — it does not transmit to the pharmacy. Use the e-prescribe workspace to send to GreenstoneRX.
      </div>

      {/* Medication */}
      <label className="fl">Medication</label>
      <select className="fi mb-2" value={medName} onChange={(e) => setMedName(e.target.value)}>
        <option value="">Select a medication…</option>
        {DRUG_CATALOG.map((d) => <option key={d.id} value={d.name}>{d.name}</option>)}
        <option value="__other">Other (enter manually)</option>
      </select>
      {medName === "__other" && (
        <input className="fi mb-2" placeholder="Medication name" value={medOther} onChange={(e) => setMedOther(e.target.value)} />
      )}

      {/* Dose preset */}
      <label className="fl">Dose preset</label>
      <select className="fi mb-2" value={preset} onChange={(e) => applyPreset(e.target.value)}>
        <option value="">Custom / none</option>
        {DOSE_PRESETS.filter((p) => p.label !== "Custom").map((p) => <option key={p.label} value={p.label}>{p.label}</option>)}
      </select>

      <div className="grid grid-cols-2 gap-3">
        <div><label className="fl">Strength</label><input className="fi" placeholder="0.5mg" value={strength} onChange={(e) => setStrength(e.target.value)} /></div>
        <div><label className="fl">Frequency</label><input className="fi" placeholder="Once weekly" value={freq} onChange={(e) => setFreq(e.target.value)} /></div>
      </div>

      <label className="fl mt-2">Sig / instructions</label>
      <textarea className="fi" rows={2} placeholder="Inject 0.5mg subcutaneously once weekly…" value={sig} onChange={(e) => setSig(e.target.value)} />

      <div className="grid grid-cols-3 gap-3 mt-2">
        <div><label className="fl">Quantity</label><input className="fi" type="number" min={0} value={qty} onChange={(e) => setQty(Number(e.target.value))} /></div>
        <div><label className="fl">Day supply</label><input className="fi" type="number" min={0} value={daySupply} onChange={(e) => setDaySupply(Number(e.target.value))} /></div>
        <div><label className="fl">Refills</label><input className="fi" type="number" min={0} value={refills} onChange={(e) => setRefills(Number(e.target.value))} /></div>
      </div>

      <div className="grid grid-cols-2 gap-3 mt-2">
        <div><label className="fl">Pharmacy</label><input className="fi" value={pharmacy} onChange={(e) => setPharmacy(e.target.value)} /></div>
        <div><label className="fl">Prescriber</label><input className="fi" value={prescriber} onChange={(e) => setPrescriber(e.target.value)} /></div>
      </div>

      <div className="grid grid-cols-2 gap-3 mt-2 items-end">
        <div><label className="fl">Status</label>
          <select className="fi" value={status} onChange={(e) => setStatus(e.target.value as RxStatusFull)}>
            {STATUSES.map((s) => <option key={s} value={s}>{s[0].toUpperCase() + s.slice(1)}</option>)}
          </select>
        </div>
        <label className="flex items-center gap-2 text-[12.5px] font-semibold text-ink-2 pb-2.5 cursor-pointer">
          <input type="checkbox" checked={controlled} onChange={(e) => setControlled(e.target.checked)} />
          Controlled substance
        </label>
      </div>

      {/* Payment override */}
      {canCharge ? (
        <div className="mt-4 rounded-lg border border-border bg-surface-2 p-3.5">
          <label className="flex items-center gap-2 text-[13px] font-bold text-ink cursor-pointer">
            <input type="checkbox" checked={override} onChange={(e) => setOverride(e.target.checked)} />
            💳 Override payment
          </label>
          {!override && <div className="text-[11.5px] text-ink-muted mt-1.5">Leave off to bill the patient normally.</div>}
          {override && (
            <div className="mt-3">
              <div className="flex gap-2 mb-2.5">
                <button
                  className={`flex-1 py-2 px-3 rounded-md border text-[12px] font-semibold transition-colors ${payMode === "paid" ? "border-brand bg-brand-soft text-brand-dk" : "border-border bg-surface text-ink-2"}`}
                  onClick={() => setPayMode("paid")}
                >Mark as paid<span className="block text-[10.5px] font-normal opacity-75">collected outside the app</span></button>
                <button
                  className={`flex-1 py-2 px-3 rounded-md border text-[12px] font-semibold transition-colors ${payMode === "waived" ? "border-brand bg-brand-soft text-brand-dk" : "border-border bg-surface text-ink-2"}`}
                  onClick={() => setPayMode("waived")}
                >Waive — comp<span className="block text-[10.5px] font-normal opacity-75">no charge</span></button>
              </div>
              <label className="fl">Reason (required)</label>
              <input className="fi" placeholder={payMode === "paid" ? "e.g. paid by card at clinic" : "e.g. provider comp / hardship"} value={reason} onChange={(e) => setReason(e.target.value)} />
              <div className="text-[11px] text-amber mt-2">⚠ Recorded on the prescription with your name and a timestamp for the audit trail.</div>
            </div>
          )}
        </div>
      ) : (
        <div className="mt-4 text-[11.5px] text-ink-muted">Payment override is unavailable — it requires the “charge payments” permission.</div>
      )}
    </Modal>
  );
}
