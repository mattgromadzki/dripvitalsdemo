"use client";

import { useEffect, useState } from "react";
import { Modal } from "@/components/ui/Modal";
import { Pill } from "@/components/ui/Pill";
import { getLicenseStatus, formatLicenseExp } from "@/lib/hooks/useDoctors";
import { US_STATES_ALL } from "@/lib/types";
import { DOCTORS as SEED_DOCTORS } from "@/lib/data/doctors";
import type { Doctor, DoctorStateLicense } from "@/lib/types";

interface LicenseManagerModalProps {
  doctor: Doctor | null;
  onClose: () => void;
  onSave: (doctorId: string, licenses: DoctorStateLicense[]) => void;
}

export function LicenseManagerModal({ doctor, onClose, onSave }: LicenseManagerModalProps) {
  const [licenses, setLicenses] = useState<DoctorStateLicense[]>([]);
  const [newState, setNewState] = useState<string>("");
  const [newNumber, setNewNumber] = useState("");
  const [newExp, setNewExp] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    if (doctor) {
      // Working copy so cancel doesn't mutate
      setLicenses(doctor.licenses.map((l) => ({ ...l })));
      setNewState("");
      setNewNumber("");
      setNewExp("");
      setError("");
    }
  }, [doctor]);

  if (!doctor) return null;
  const doc = doctor;  // narrowed alias for nested closures

  const existingStates = new Set(licenses.map((l) => l.state));
  const availableStates = US_STATES_ALL.filter((s) => !existingStates.has(s));

  function addLicense() {
    if (!newState) { setError("Pick a state"); return; }
    if (existingStates.has(newState)) { setError("That state is already in this list"); return; }
    const next: DoctorStateLicense = {
      state: newState,
      number: newNumber.trim(),
      expDate: newExp,
    };
    setLicenses([...licenses, next]);
    setNewState("");
    setNewNumber("");
    setNewExp("");
    setError("");
  }

  // Merge in this doctor's default licenses from the code, adding any states not
  // already present — so it fills the roster without overwriting entries here.
  // Match by id, or fall back to name (a saved record may carry a different id).
  // Match by id, or by last name with tolerant first-name check (live profiles
  // sometimes fold the middle name into first, e.g. "Emmanuel Noel").
  const seedDoc =
    SEED_DOCTORS.find((d) => d.id === doc.id) ||
    SEED_DOCTORS.find((d) => {
      if (d.last.toLowerCase().trim() !== (doc.last || "").toLowerCase().trim()) return false;
      const a = d.first.toLowerCase().trim(), b = (doc.first || "").toLowerCase().trim();
      return !a || !b || a.includes(b) || b.includes(a);
    });
  const seedCount = seedDoc?.licenses?.length || 0;
  const seedMissing = seedDoc ? seedDoc.licenses.filter((l) => !existingStates.has(l.state)) : [];
  function loadDefaults() {
    if (!seedDoc || !seedDoc.licenses.length) { setError("No default licenses on file for this doctor"); return; }
    setLicenses((prev) => {
      const have = new Set(prev.map((l) => l.state));
      const additions = seedDoc.licenses.filter((l) => !have.has(l.state)).map((l) => ({ ...l }));
      return [...prev, ...additions];
    });
    setError("");
  }

  function updateLicense(idx: number, patch: Partial<DoctorStateLicense>) {
    setLicenses((prev) => prev.map((l, i) => (i === idx ? { ...l, ...patch } : l)));
  }

  function removeLicense(idx: number) {
    setLicenses((prev) => prev.filter((_, i) => i !== idx));
  }

  function handleSave() {
    // Validate: every license must have a license number and exp date
    const incomplete = licenses.find((l) => !l.number.trim() || !l.expDate);
    if (incomplete) {
      setError(`License for ${incomplete.state} is missing a number or expiration date`);
      return;
    }
    onSave(doc.id, licenses);
    onClose();
  }

  // Sort: expired → expiring → active, then alpha by state
  const sortedLicenses = [...licenses].sort((a, b) => {
    const statusOrder = { expired: 0, expiring: 1, active: 2, unknown: 3 };
    const sa = getLicenseStatus(a).key;
    const sb = getLicenseStatus(b).key;
    if (statusOrder[sa] !== statusOrder[sb]) return statusOrder[sa] - statusOrder[sb];
    return a.state.localeCompare(b.state);
  });

  return (
    <Modal
      open={!!doctor}
      onClose={onClose}
      title={`Manage Licenses · Dr. ${doc.last}`}
      icon="📋"
      width={620}
      footer={
        <>
          <span className="text-[11px] text-ink-muted self-center mr-auto">
            {licenses.length} license{licenses.length === 1 ? "" : "s"}
          </span>
          <button className="btn btn-ghost" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" onClick={handleSave}>💾 Save Licenses</button>
        </>
      }
    >
      {error && (
        <div className="mb-3 px-3 py-2.5 rounded-md bg-red-soft border border-red-soft text-red text-[12px] font-medium">
          ⚠ {error}
        </div>
      )}

      {seedMissing.length > 0 && (
        <div className="mb-3 px-3 py-3 rounded-md bg-amber-soft border border-border text-[12.5px] flex items-center justify-between gap-3 flex-wrap">
          <span>
            <b>{seedMissing.length} more license{seedMissing.length === 1 ? "" : "s"} on file</b> for Dr. {doc.last} {seedMissing.length === 1 ? "isn't" : "aren't"} saved yet. Load them, then click <b>Save Licenses</b> to keep them.
          </span>
          <button className="btn btn-primary btn-sm whitespace-nowrap" onClick={loadDefaults}>↺ Load all {seedCount}</button>
        </div>
      )}

      {/* Add new license */}
      <div className="bg-surface-2 border border-border rounded-md p-3 mb-4">
        <div className="text-[10.5px] font-bold uppercase tracking-widest text-ink-muted mb-2">Add a new license</div>
        <div className="grid grid-cols-[120px_1fr_140px_auto] gap-2 max-[600px]:grid-cols-2 items-end">
          <div>
            <label className="fl">State</label>
            <select className="fsel" value={newState} onChange={(e) => setNewState(e.target.value)}>
              <option value="">Select…</option>
              {availableStates.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
          <div>
            <label className="fl">License Number</label>
            <input
              type="text"
              className="fi font-mono"
              placeholder="e.g. ME123456"
              value={newNumber}
              onChange={(e) => setNewNumber(e.target.value)}
            />
          </div>
          <div>
            <label className="fl">Expiration</label>
            <input
              type="date"
              className="fi"
              value={newExp}
              onChange={(e) => setNewExp(e.target.value)}
            />
          </div>
          <button className="btn btn-primary btn-sm" onClick={addLicense}>+ Add</button>
        </div>
      </div>

      {/* License list */}
      {sortedLicenses.length === 0 ? (
        <div className="py-8 text-center text-ink-muted">
          <div className="text-[32px] opacity-40 mb-1">📋</div>
          <div className="text-[12.5px] font-bold text-ink mb-0.5">No licenses yet</div>
          <div className="text-[11px]">Add at least one state license above</div>
        </div>
      ) : (
        <div className="space-y-2 max-h-[340px] overflow-y-auto pr-1">
          {sortedLicenses.map((lic) => {
            const status = getLicenseStatus(lic);
            // Find original index for mutation
            const origIdx = licenses.findIndex((l) => l.state === lic.state);
            return (
              <div
                key={lic.state}
                className="bg-surface border rounded-md p-2.5 grid grid-cols-[60px_1fr_140px_auto_auto] gap-2 items-center max-[600px]:grid-cols-2"
                style={{
                  borderColor: status.key === "expired" ? "var(--color-red-soft)" : status.key === "expiring" ? "var(--color-amber-soft)" : "var(--color-border)",
                  borderLeft: status.key === "expired" ? "3px solid var(--color-red)" : status.key === "expiring" ? "3px solid var(--color-amber)" : undefined,
                }}
              >
                <div className="font-mono text-[14px] font-bold text-brand-dk text-center">{lic.state}</div>
                <input
                  type="text"
                  className="fi font-mono"
                  placeholder="License number"
                  value={lic.number}
                  onChange={(e) => updateLicense(origIdx, { number: e.target.value })}
                />
                <input
                  type="date"
                  className="fi"
                  value={lic.expDate}
                  onChange={(e) => updateLicense(origIdx, { expDate: e.target.value })}
                />
                <Pill intent={status.pillIntent} dot>
                  {status.icon} {status.label}
                  {status.daysUntil != null && status.key === "expiring" && ` · ${status.daysUntil}d`}
                </Pill>
                <button
                  className="px-2 py-1 rounded text-[14px] text-ink-muted hover:bg-red-soft hover:text-red transition-colors"
                  onClick={() => removeLicense(origIdx)}
                  title="Remove license"
                >
                  🗑
                </button>
              </div>
            );
          })}
        </div>
      )}

      <div className="text-[11px] text-ink-muted bg-surface-2 border border-border rounded px-3 py-2 mt-3 flex items-center gap-2">
        <span className="text-[13px]">💡</span>
        <span>
          Intake submissions will only route to this provider in states where their license is active and unexpired.
        </span>
      </div>
    </Modal>
  );
}

// Helper for displaying the formatted exp date inline elsewhere
export { formatLicenseExp };
