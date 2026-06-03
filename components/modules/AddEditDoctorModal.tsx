"use client";

import { useEffect, useMemo, useState } from "react";
import { Modal } from "@/components/ui/Modal";
import { Pill } from "@/components/ui/Pill";
import { US_STATES_ALL, DOCTOR_SPECIALTIES } from "@/lib/types";
import { AVATAR_COLOR_POOL } from "@/lib/data/doctors";
import type { Doctor, DoctorTitle, DoctorRole, DoctorStateLicense } from "@/lib/types";

interface AddEditDoctorModalProps {
  open: boolean;
  initial?: Doctor | null;       // null = create mode, doctor = edit mode
  onClose: () => void;
  onSave: (input: Omit<Doctor, "id">, editingId?: string) => void;
}

const TITLES: DoctorTitle[] = ["MD", "DO", "NP", "PA", "PharmD", "PhD"];
const ROLES: DoctorRole[]   = ["Medical Director", "Attending Physician", "Associate Physician", "Nurse Practitioner", "Physician Assistant"];

interface FormState {
  first: string;
  last: string;
  middle: string;
  title: DoctorTitle;
  role: DoctorRole;
  yearsExperience: string;
  gender: "Male" | "Female" | "Other" | "";
  dob: string;
  email: string;
  phone: string;
  npi: string;
  dea: string;
  boardId: string;
  medicalSchool: string;
  residency: string;
  specialties: Set<string>;
  licenses: DoctorStateLicense[];
  active: boolean;
  epcs: boolean;
  surescripts: boolean;
  onCall: boolean;
  acceptingNew: boolean;
  maxPatients: string;
  hoursPerWeek: string;
}

function makeBlank(): FormState {
  return {
    first: "", last: "", middle: "",
    title: "MD", role: "Attending Physician",
    yearsExperience: "",
    gender: "", dob: "",
    email: "", phone: "",
    npi: "", dea: "", boardId: "",
    medicalSchool: "", residency: "",
    specialties: new Set(["Weight Management"]),
    licenses: [],
    active: true, epcs: false, surescripts: true, onCall: false, acceptingNew: true,
    maxPatients: "", hoursPerWeek: "",
  };
}

function makeFromDoctor(d: Doctor): FormState {
  return {
    first: d.first, last: d.last, middle: d.middle || "",
    title: d.title, role: d.role,
    yearsExperience: String(d.yearsExperience),
    gender: (d.gender || "") as FormState["gender"],
    dob: d.dob || "",
    email: d.email, phone: d.phone,
    npi: d.npi, dea: d.dea || "", boardId: d.boardId || "",
    medicalSchool: d.medicalSchool || "", residency: d.residency || "",
    specialties: new Set(d.specialties),
    licenses: d.licenses.map((l) => ({ ...l })),
    active: d.active, epcs: d.epcs, surescripts: d.surescripts, onCall: d.onCall, acceptingNew: d.acceptingNew,
    maxPatients: d.maxPatients != null ? String(d.maxPatients) : "",
    hoursPerWeek: d.hoursPerWeek != null ? String(d.hoursPerWeek) : "",
  };
}

export function AddEditDoctorModal({ open, initial, onClose, onSave }: AddEditDoctorModalProps) {
  const [form, setForm]     = useState<FormState>(() => initial ? makeFromDoctor(initial) : makeBlank());
  const [error, setError]   = useState("");
  const [stateSearch, setStateSearch] = useState("");

  useEffect(() => {
    if (open) {
      setForm(initial ? makeFromDoctor(initial) : makeBlank());
      setError("");
      setStateSearch("");
    }
  }, [open, initial]);

  const selectedStates = useMemo(() => new Set(form.licenses.map((l) => l.state)), [form.licenses]);

  function f<K extends keyof FormState>(key: K, val: FormState[K]) {
    setForm((p) => ({ ...p, [key]: val }));
  }

  function toggleSpecialty(s: string) {
    setForm((p) => {
      const next = new Set(p.specialties);
      if (next.has(s)) next.delete(s); else next.add(s);
      return { ...p, specialties: next };
    });
  }

  function toggleState(s: string) {
    setForm((p) => {
      if (selectedStates.has(s)) {
        return { ...p, licenses: p.licenses.filter((l) => l.state !== s) };
      }
      return { ...p, licenses: [...p.licenses, { state: s, number: "", expDate: "" }] };
    });
  }

  function updateLicense(state: string, patch: Partial<DoctorStateLicense>) {
    setForm((p) => ({
      ...p,
      licenses: p.licenses.map((l) => (l.state === state ? { ...l, ...patch } : l)),
    }));
  }

  function removeLicense(state: string) {
    setForm((p) => ({ ...p, licenses: p.licenses.filter((l) => l.state !== state) }));
  }

  function handleSave() {
    if (!form.first.trim()) { setError("First name is required"); return; }
    if (!form.last.trim())  { setError("Last name is required"); return; }
    if (!form.email.trim()) { setError("Email is required"); return; }

    const input: Omit<Doctor, "id"> = {
      first: form.first.trim(),
      last:  form.last.trim(),
      middle: form.middle.trim() || undefined,
      title: form.title,
      role:  form.role,
      email: form.email.trim(),
      phone: form.phone.trim(),
      npi:   form.npi.trim(),
      dea:   form.dea.trim() || undefined,
      boardId: form.boardId.trim() || undefined,
      medicalSchool: form.medicalSchool.trim() || undefined,
      residency:     form.residency.trim() || undefined,
      yearsExperience: parseInt(form.yearsExperience, 10) || 0,
      gender: form.gender || undefined,
      dob:    form.dob || undefined,
      specialties: Array.from(form.specialties),
      active: form.active,
      epcs: form.epcs,
      surescripts: form.surescripts,
      onCall: form.onCall,
      acceptingNew: form.acceptingNew,
      maxPatients:  form.maxPatients  ? parseInt(form.maxPatients, 10)  : undefined,
      hoursPerWeek: form.hoursPerWeek ? parseInt(form.hoursPerWeek, 10) : undefined,
      patients: initial?.patients ?? 0,
      color: initial?.color ?? AVATAR_COLOR_POOL[Math.floor(Math.random() * AVATAR_COLOR_POOL.length)],
      licenses: form.licenses,
    };

    onSave(input, initial?.id);
    onClose();
  }

  const filteredStates = useMemo(() => {
    const q = stateSearch.trim().toUpperCase();
    if (!q) return US_STATES_ALL;
    return US_STATES_ALL.filter((s) => s.startsWith(q));
  }, [stateSearch]);

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={initial ? `Edit Doctor · Dr. ${initial.last}` : "Add Doctor"}
      icon="🩺"
      width={760}
      footer={
        <>
          <button className="btn btn-ghost" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" onClick={handleSave}>🩺 {initial ? "Save Changes" : "Save Doctor"}</button>
        </>
      }
    >
      {error && (
        <div className="mb-3 px-3 py-2.5 rounded-md bg-red-soft border border-red-soft text-red text-[12px] font-medium">
          ⚠ {error}
        </div>
      )}

      {/* Personal & Professional */}
      <FormSection title="Personal & Professional Info">
        <div className="grid grid-cols-3 gap-3 max-[600px]:grid-cols-1">
          <Field label="First Name" required>
            <input className="fi" placeholder="Maria" value={form.first} onChange={(e) => f("first", e.target.value)} />
          </Field>
          <Field label="Last Name" required>
            <input className="fi" placeholder="Garcia" value={form.last} onChange={(e) => f("last", e.target.value)} />
          </Field>
          <Field label="Middle Name">
            <input className="fi" placeholder="Optional" value={form.middle} onChange={(e) => f("middle", e.target.value)} />
          </Field>
        </div>
        <div className="grid grid-cols-3 gap-3 mt-3 max-[600px]:grid-cols-1">
          <Field label="Title / Degree" required>
            <select className="fsel" value={form.title} onChange={(e) => f("title", e.target.value as DoctorTitle)}>
              {TITLES.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
          </Field>
          <Field label="Role">
            <select className="fsel" value={form.role} onChange={(e) => f("role", e.target.value as DoctorRole)}>
              {ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
            </select>
          </Field>
          <Field label="Years of Experience">
            <input type="number" className="fi" placeholder="e.g. 12" value={form.yearsExperience} onChange={(e) => f("yearsExperience", e.target.value)} />
          </Field>
        </div>
        <div className="grid grid-cols-2 gap-3 mt-3 max-[600px]:grid-cols-1">
          <Field label="Gender">
            <select className="fsel" value={form.gender} onChange={(e) => f("gender", e.target.value as FormState["gender"])}>
              <option value="">—</option>
              <option value="Male">Male</option>
              <option value="Female">Female</option>
              <option value="Other">Other</option>
            </select>
          </Field>
          <Field label="Date of Birth">
            <input type="date" className="fi" value={form.dob} onChange={(e) => f("dob", e.target.value)} />
          </Field>
        </div>
      </FormSection>

      {/* Contact & Credentials */}
      <FormSection title="Contact & Credentials">
        <div className="grid grid-cols-2 gap-3 max-[600px]:grid-cols-1">
          <Field label="Email" required>
            <input type="email" className="fi" placeholder="dr@dripvitals.health" value={form.email} onChange={(e) => f("email", e.target.value)} />
          </Field>
          <Field label="Phone">
            <input className="fi" placeholder="(305) 555-0100" value={form.phone} onChange={(e) => f("phone", e.target.value)} />
          </Field>
        </div>
        <div className="grid grid-cols-3 gap-3 mt-3 max-[600px]:grid-cols-1">
          <Field label="NPI Number">
            <input className="fi font-mono" placeholder="10-digit NPI" value={form.npi} onChange={(e) => f("npi", e.target.value)} />
          </Field>
          <Field label="DEA Number">
            <input className="fi font-mono" placeholder="DEA #" value={form.dea} onChange={(e) => f("dea", e.target.value)} />
          </Field>
          <Field label="Board Cert ID">
            <input className="fi font-mono" placeholder="e.g. FL-MD-12345" value={form.boardId} onChange={(e) => f("boardId", e.target.value)} />
          </Field>
        </div>
        <div className="grid grid-cols-2 gap-3 mt-3 max-[600px]:grid-cols-1">
          <Field label="Medical School">
            <input className="fi" placeholder="e.g. University of Miami" value={form.medicalSchool} onChange={(e) => f("medicalSchool", e.target.value)} />
          </Field>
          <Field label="Residency / Fellowship">
            <input className="fi" placeholder="e.g. Jackson Memorial Hospital" value={form.residency} onChange={(e) => f("residency", e.target.value)} />
          </Field>
        </div>
      </FormSection>

      {/* Specialties */}
      <FormSection title="Specialties & Focus Areas">
        <div className="flex flex-wrap gap-1.5">
          {DOCTOR_SPECIALTIES.map((s) => {
            const sel = form.specialties.has(s);
            return (
              <button
                key={s}
                type="button"
                onClick={() => toggleSpecialty(s)}
                className={[
                  "py-1.5 px-3 rounded-pill text-[11.5px] font-semibold border transition-colors",
                  sel
                    ? "bg-brand-soft border-brand text-brand-dk"
                    : "bg-surface border-border text-ink-2 hover:border-border-2",
                ].join(" ")}
              >
                {sel && "✓ "}{s}
              </button>
            );
          })}
        </div>
      </FormSection>

      {/* State Licenses */}
      <FormSection
        title="State Licenses"
        hint="Click states to add, then enter license # and expiry below"
      >
        <input
          className="fi mb-2"
          placeholder="Search states (e.g. FL)…"
          value={stateSearch}
          onChange={(e) => setStateSearch(e.target.value)}
        />
        <div
          className="grid gap-1 mb-3 max-h-[160px] overflow-y-auto p-1 bg-surface-2 border border-border rounded-md"
          style={{ gridTemplateColumns: "repeat(auto-fill, minmax(50px, 1fr))" }}
        >
          {filteredStates.map((s) => {
            const sel = selectedStates.has(s);
            return (
              <button
                key={s}
                type="button"
                onClick={() => toggleState(s)}
                className={[
                  "py-1.5 px-1 rounded text-[11px] font-mono font-bold transition-colors border text-center",
                  sel
                    ? "bg-brand text-white border-brand"
                    : "bg-surface border-border text-ink-2 hover:border-brand hover:text-brand-dk",
                ].join(" ")}
              >
                {s}
              </button>
            );
          })}
        </div>

        {form.licenses.length === 0 ? (
          <div className="text-[11.5px] text-ink-muted italic px-2 py-2">
            No states selected. Click a state above to add a license.
          </div>
        ) : (
          <div className="space-y-2">
            {form.licenses.map((lic) => (
              <div key={lic.state} className="grid grid-cols-[50px_1fr_140px_auto] gap-2 items-center max-[600px]:grid-cols-2">
                <div className="text-center bg-brand-soft border border-brand-soft rounded-md py-1.5 font-mono text-[12px] font-bold text-brand-dk">
                  {lic.state}
                </div>
                <input
                  type="text"
                  className="fi font-mono"
                  placeholder="License number"
                  value={lic.number}
                  onChange={(e) => updateLicense(lic.state, { number: e.target.value })}
                />
                <input
                  type="date"
                  className="fi"
                  value={lic.expDate}
                  onChange={(e) => updateLicense(lic.state, { expDate: e.target.value })}
                />
                <button
                  type="button"
                  className="px-2 py-1 rounded text-[14px] text-ink-muted hover:bg-red-soft hover:text-red transition-colors"
                  onClick={() => removeLicense(lic.state)}
                  title="Remove"
                >
                  🗑
                </button>
              </div>
            ))}
          </div>
        )}
      </FormSection>

      {/* Settings */}
      <FormSection title="Settings & Availability">
        <div className="bg-surface-2 border border-border rounded-md py-1 px-3">
          <ToggleRow
            label="Active — Accepting Patients"
            sub="Can be assigned new patients and visits"
            checked={form.active}
            onChange={(v) => f("active", v)}
          />
          <ToggleRow
            label="EPCS Certified"
            sub="Can e-prescribe controlled substances via DEA"
            checked={form.epcs}
            onChange={(v) => f("epcs", v)}
          />
          <ToggleRow
            label="Surescripts Enrolled"
            sub="Can send e-prescriptions via Surescripts"
            checked={form.surescripts}
            onChange={(v) => f("surescripts", v)}
          />
          <ToggleRow
            label="On-Call Available"
            sub="Available for urgent patient messages"
            checked={form.onCall}
            onChange={(v) => f("onCall", v)}
          />
          <ToggleRow
            label="Accepting New Patients"
            sub="Open to new patient assignments"
            checked={form.acceptingNew}
            onChange={(v) => f("acceptingNew", v)}
            isLast
          />
        </div>
        <div className="grid grid-cols-2 gap-3 mt-3 max-[600px]:grid-cols-1">
          <Field label="Max Patients">
            <input type="number" className="fi" placeholder="e.g. 150" value={form.maxPatients} onChange={(e) => f("maxPatients", e.target.value)} />
          </Field>
          <Field label="Availability (hrs/week)">
            <input type="number" className="fi" placeholder="e.g. 30" value={form.hoursPerWeek} onChange={(e) => f("hoursPerWeek", e.target.value)} />
          </Field>
        </div>
      </FormSection>

      {/* Status preview */}
      {initial && (
        <div className="mt-3 text-[11px] text-ink-muted bg-surface-2 border border-border rounded px-3 py-2 flex items-center gap-2 flex-wrap">
          <span>Current status:</span>
          <Pill intent={form.active ? "green" : "muted"} dot>{form.active ? "Active" : "Inactive"}</Pill>
          {form.epcs        && <Pill intent="purple">EPCS</Pill>}
          {form.surescripts && <Pill intent="blue">Surescripts</Pill>}
          {form.onCall      && <Pill intent="amber">On-Call</Pill>}
          <span className="ml-auto">{initial.patients} / {form.maxPatients || "∞"} patients</span>
        </div>
      )}
    </Modal>
  );
}

// ─── Small helpers ──────────────────────────────────────────────────────
function FormSection({ title, hint, children }: { title: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="mb-4 pb-3 border-b border-border last:border-b-0 last:mb-0 last:pb-0">
      <div className="text-[10.5px] font-bold uppercase tracking-widest text-ink-muted mb-2 flex items-center gap-1.5">
        <span>{title}</span>
        {hint && <span className="text-ink-muted-2 normal-case tracking-normal font-medium">— {hint}</span>}
      </div>
      {children}
    </div>
  );
}

function Field({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <div>
      <label className="fl">
        {label}
        {required && <span className="text-red ml-0.5">*</span>}
      </label>
      {children}
    </div>
  );
}

function ToggleRow({ label, sub, checked, onChange, isLast }: { label: string; sub: string; checked: boolean; onChange: (v: boolean) => void; isLast?: boolean }) {
  return (
    <label
      className={`flex items-center justify-between gap-3 py-2.5 cursor-pointer ${isLast ? "" : "border-b border-border"}`}
    >
      <div className="flex-1 min-w-0">
        <div className="text-[12.5px] font-bold text-ink">{label}</div>
        <div className="text-[10.5px] text-ink-muted leading-snug">{sub}</div>
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={[
          "relative w-9 h-5 rounded-pill border transition-colors flex-shrink-0",
          checked ? "bg-brand border-brand" : "bg-surface-3 border-border-2",
        ].join(" ")}
      >
        <span
          className="absolute top-[1px] left-[1px] w-[15px] h-[15px] rounded-full bg-white shadow-sm transition-transform"
          style={{ transform: checked ? "translateX(16px)" : "translateX(0)" }}
        />
      </button>
    </label>
  );
}
