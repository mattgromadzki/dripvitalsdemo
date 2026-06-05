"use client";

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Modal } from "@/components/ui/Modal";
import type { Patient } from "@/lib/types";
import { validateAddress } from "@/lib/usps/validateAddress";
import { fetchSuggestions, cleanStreet } from "@/lib/usps/autocomplete";
import { AddressLookupBadge } from "@/components/ui/AddressLookupBadge";
import type { UspsValidateResult, UspsValidateInput, AddressSuggestion } from "@/lib/usps/types";

const COLORS = [
  "var(--color-brand)", "var(--color-coral)", "var(--color-purple)",
  "var(--color-teal)", "var(--color-pink)", "var(--color-amber)", "var(--color-blue)",
];

const STATES = ["AL","AK","AZ","AR","CA","CO","CT","DE","FL","GA","HI","ID","IL","IN","IA","KS","KY","LA","ME","MD","MA","MI","MN","MS","MO","MT","NE","NV","NH","NJ","NM","NY","NC","ND","OH","OK","OR","PA","RI","SC","SD","TN","TX","UT","VT","VA","WA","WV","WI","WY"];

const PROGRAMS = ["Weight Loss", "TRT", "ED", "NAD+", "Sermorelin", "Vitamins"];
const PLAN_FOR: Record<string, string> = {
  "Weight Loss": "Compounded Semaglutide", "TRT": "Testosterone Cypionate", "ED": "Sildenafil 100mg",
  "NAD+": "NAD+ Injection", "Sermorelin": "Sermorelin", "Vitamins": "Vitamin B12",
};

const NOW = new Date(2026, 4, 31);
function ageFromDob(dob: string): number {
  if (!dob) return 0;
  const d = new Date(dob);
  if (isNaN(d.getTime())) return 0;
  let a = NOW.getFullYear() - d.getFullYear();
  const m = NOW.getMonth() - d.getMonth();
  if (m < 0 || (m === 0 && NOW.getDate() < d.getDate())) a--;
  return a;
}

interface PatientFormModalProps {
  open: boolean;
  onClose: () => void;
  patient?: Patient;
  onSave: (data: Omit<Patient, "id"> | Patient) => void;
}

interface FormState {
  first: string; last: string; dob: string; gender: "" | Patient["gender"];
  email: string; phone: string; state: string; address: string; apt: string; city: string; zip: string;
  program: string;
  weightCurrent: string; heightFt: string; heightIn: string; goalWeight: string;
  priorGLP1: "" | "yes" | "no"; transferDose: string;
}

const BLANK: FormState = {
  first: "", last: "", dob: "", gender: "", email: "", phone: "", state: "FL",
  address: "", apt: "", city: "", zip: "", program: "Weight Loss",
  weightCurrent: "", heightFt: "", heightIn: "", goalWeight: "", priorGLP1: "", transferDose: "",
};

function patientToForm(p: Patient): FormState {
  const prog = Object.keys(PLAN_FOR).find((k) => p.plan?.toLowerCase().includes(PLAN_FOR[k].split(" ")[0].toLowerCase())) || "Weight Loss";
  return {
    first: p.first, last: p.last, dob: p.dob || "", gender: p.gender,
    email: p.email, phone: p.phone, state: p.state,
    address: p.address || "", apt: p.apt || "", city: p.city || "", zip: p.zip || "",
    program: prog,
    weightCurrent: p.wt ? String(p.wt) : "",
    heightFt: p.heightIn ? String(Math.floor(p.heightIn / 12)) : "",
    heightIn: p.heightIn ? String(p.heightIn % 12) : "",
    goalWeight: p.goalWt ? String(p.goalWt) : "",
    priorGLP1: p.priorGLP1 == null ? "" : p.priorGLP1 ? "yes" : "no",
    transferDose: p.transferDose || "",
  };
}

export function PatientFormModal({ open, onClose, patient, onSave }: PatientFormModalProps) {
  const [form, setForm] = useState<FormState>(BLANK);
  const [error, setError] = useState<string>("");
  const [verify, setVerify] = useState<UspsValidateResult | null>(null);
  const [verifying, setVerifying] = useState(false);
  const [suggestions, setSuggestions] = useState<AddressSuggestion[]>([]);
  const [showSug, setShowSug] = useState(false);
  const sugTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isEdit = !!patient;

  useEffect(() => {
    if (!open) return;
    setForm(patient ? patientToForm(patient) : BLANK);
    setError("");
    setVerify(null);
    setSuggestions([]);
    setShowSug(false);
  }, [open, patient]);

  function field<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((f) => ({ ...f, [key]: value }));
    if (key === "address" || key === "apt" || key === "city" || key === "zip" || key === "state") setVerify(null);
  }

  async function doVerify(input: UspsValidateInput) {
    setVerifying(true);
    const res = await validateAddress(input);
    setVerify(res);
    setVerifying(false);
  }
  function runVerify() {
    if (!form.address.trim()) { setVerify({ status: "error", dpv: null, address: null, corrections: [], warnings: [], vacant: false, changed: false, message: "Enter a street address first.", source: "mock" }); return; }
    doVerify({ streetAddress: form.address, secondaryAddress: form.apt, city: form.city, state: form.state, ZIPCode: form.zip });
  }
  function onStreet(v: string) {
    field("address", v);
    if (sugTimer.current) clearTimeout(sugTimer.current);
    if (v.trim().length >= 3) {
      sugTimer.current = setTimeout(async () => {
        const s = await fetchSuggestions(v, form.state);
        setSuggestions(s); setShowSug(true);
      }, 200);
    } else { setSuggestions([]); setShowSug(false); }
  }
  function pickSuggestion(s: AddressSuggestion) {
    setForm((f) => ({ ...f, address: cleanStreet(s.street), apt: s.secondary || f.apt, city: s.city, state: s.state, zip: s.zip }));
    setSuggestions([]); setShowSug(false);
    doVerify({ streetAddress: s.street, secondaryAddress: s.secondary, city: s.city, state: s.state, ZIPCode: s.zip });
  }
  function applyStandardized() {
    if (!verify?.address) return;
    const a = verify.address;
    setForm((f) => ({ ...f, address: cleanStreet(a.streetAddress), apt: a.secondaryAddress || f.apt, city: a.city, zip: a.ZIPPlus4 ? `${a.ZIPCode}-${a.ZIPPlus4}` : a.ZIPCode, state: a.state }));
    setVerify({ ...verify, changed: false, status: verify.dpv === "Y" ? "verified" : verify.status, message: verify.dpv === "Y" ? "Address verified — deliverable by USPS." : verify.message });
  }

  const isWeightLoss = form.program === "Weight Loss";
  const totalIn = (parseFloat(form.heightFt) || 0) * 12 + (parseFloat(form.heightIn) || 0);
  const lb = parseFloat(form.weightCurrent) || 0;
  const bmi = useMemo(() => (totalIn > 0 && lb > 0 ? +(703 * lb / (totalIn * totalIn)).toFixed(1) : 0), [totalIn, lb]);

  function handleSave() {
    const req: [string, string][] = [
      ["First name", form.first], ["Last name", form.last], ["Date of birth", form.dob],
      ["Gender", form.gender], ["Email address", form.email], ["Mobile phone", form.phone],
      ["State", form.state], ["Address", form.address], ["City", form.city], ["ZIP code", form.zip],
    ];
    for (const [label, val] of req) {
      if (!String(val).trim()) { setError(`${label} is required`); return; }
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) { setError("Email looks malformed"); return; }
    const age = ageFromDob(form.dob);
    if (age < 18 || age > 100) { setError("Patient must be 18 or older"); return; }

    const name = `${form.first.trim()} ${form.last.trim()}`;
    const goalWt = form.goalWeight ? parseFloat(form.goalWeight) : undefined;
    const heightInTotal = totalIn || undefined;
    const dose = isWeightLoss && form.priorGLP1 === "yes" && form.transferDose
      ? form.transferDose
      : isWeightLoss ? "0.25 mg/wk" : "—";

    const data: Omit<Patient, "id"> = {
      first: form.first.trim(), last: form.last.trim(), name,
      email: form.email.trim(), phone: form.phone.trim(),
      age, gender: (form.gender || "Other") as Patient["gender"], state: form.state, status: "pending",
      dob: form.dob, address: form.address.trim(), apt: form.apt.trim() || undefined, city: form.city.trim(), zip: form.zip.trim(),
      heightIn: heightInTotal, goalWt,
      priorGLP1: isWeightLoss ? form.priorGLP1 === "yes" : undefined,
      transferDose: isWeightLoss && form.priorGLP1 === "yes" ? form.transferDose.trim() : undefined,
      // Program
      plan: PLAN_FOR[form.program] || form.program,
      dose, week: 0, provider: patient?.provider || "Dr. Rivera", doctorId: patient?.doctorId || 1, pharmacyId: patient?.pharmacyId || 1,
      // Vitals
      wt: lb, wtStart: lb, bmi: isWeightLoss ? bmi : 0,
      bp: patient?.bp || "—", hr: patient?.hr || 0, a1c: patient?.a1c,
      // Dates
      since: patient?.since || NOW.toISOString().slice(0, 10),
      startDate: patient?.startDate || "—",
      lastVisit: patient?.lastVisit || "—", lastOrder: patient?.lastOrder || "—",
      nextRefill: patient?.nextRefill || "—", _refillDays: patient?._refillDays ?? 999,
      // Subscription / misc
      sub: patient?.sub || "—", allergies: patient?.allergies || "NKDA",
      tags: patient?.tags || [], notes: patient?.notes || "",
      color: patient?.color || COLORS[Math.floor(Math.random() * COLORS.length)],
    };

    if (isEdit && patient) onSave({ ...data, id: patient.id });
    else onSave(data);
    onClose();
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={isEdit ? `Edit Patient — ${patient.name}` : "Add New Patient"}
      icon="👤"
      width={680}
      footer={
        <>
          <button className="btn btn-ghost" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" onClick={handleSave}>{isEdit ? "💾 Save Changes" : "✅ Add Patient"}</button>
        </>
      }
    >
      {error && (
        <div className="mb-3 px-3 py-2.5 rounded-md bg-red-soft border border-red-soft text-red text-[12px] font-medium">⚠ {error}</div>
      )}

      <Section title="Personal Information">
        <Row cols={2}>
          <Field label="First Name" required>
            <input className="fi" placeholder="Sarah" value={form.first} onChange={(e) => field("first", e.target.value)} />
          </Field>
          <Field label="Last Name" required>
            <input className="fi" placeholder="Mitchell" value={form.last} onChange={(e) => field("last", e.target.value)} />
          </Field>
        </Row>
        <Row cols={3}>
          <Field label="Date of Birth" required>
            <input className="fi" type="date" value={form.dob} onChange={(e) => field("dob", e.target.value)} />
          </Field>
          <Field label="Gender" required>
            <select className="fsel" value={form.gender} onChange={(e) => field("gender", e.target.value as FormState["gender"])}>
              <option value="">Select…</option>
              <option value="F">Female</option>
              <option value="M">Male</option>
              <option value="Other">Other</option>
            </select>
          </Field>
          <Field label="Mobile Phone" required>
            <input className="fi" placeholder="(305) 555-0000" value={form.phone} onChange={(e) => field("phone", e.target.value)} />
          </Field>
        </Row>
        <Row cols={2}>
          <Field label="Email Address" required>
            <input className="fi" type="email" placeholder="sarah@email.com" value={form.email} onChange={(e) => field("email", e.target.value)} />
          </Field>
          <Field label="State" required>
            <select className="fsel" value={form.state} onChange={(e) => field("state", e.target.value)}>
              {STATES.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </Field>
        </Row>
        <div className="grid gap-3 mb-2.5" style={{ gridTemplateColumns: "2fr 1fr" }}>
          <Field label="Street Address" required>
            <div className="relative">
              <input className="fi" placeholder="Start typing your address…" value={form.address} autoComplete="off"
                onChange={(e) => onStreet(e.target.value)}
                onFocus={() => { if (suggestions.length) setShowSug(true); }}
                onBlur={() => setTimeout(() => setShowSug(false), 150)} />
              {showSug && suggestions.length > 0 && (
                <div className="absolute z-50 left-0 right-0 mt-1 bg-surface border border-border rounded-lg shadow-lg overflow-hidden">
                  {suggestions.map((s, i) => (
                    <button type="button" key={i} onMouseDown={() => pickSuggestion(s)} className="w-full text-left px-3 py-2 text-[12px] hover:bg-surface-2 border-b border-border last:border-none">
                      <span className="font-medium">{s.street}</span><span className="text-ink-muted">, {s.city}, {s.state} {s.zip}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
            <div className="mt-1"><AddressLookupBadge /></div>
          </Field>
          <Field label="Apt / Suite / Unit">
            <input className="fi" placeholder="Apt 4 (optional)" value={form.apt} onChange={(e) => field("apt", e.target.value)} />
          </Field>
        </div>
        <Row cols={2}>
          <Field label="City" required>
            <input className="fi" placeholder="Miami" value={form.city} onChange={(e) => field("city", e.target.value)} />
          </Field>
          <Field label="ZIP Code" required>
            <input className="fi" placeholder="33101" value={form.zip} onChange={(e) => field("zip", e.target.value)} />
          </Field>
        </Row>
        <div className="mt-2 flex items-center gap-2.5">
          <button type="button" className="btn btn-ghost btn-sm" onClick={runVerify} disabled={verifying}>
            {verifying ? "Verifying…" : "📍 Verify address with USPS"}
          </button>
          {verify && verify.status === "verified" && <span className="text-[12px] font-semibold text-green">✓ Verified deliverable</span>}
        </div>
        {verify && (
          <div className={`mt-2.5 rounded-lg border px-3.5 py-3 text-[12.5px] ${
            verify.status === "verified" ? "bg-green-soft border-green/30" :
            verify.status === "corrected" ? "bg-blue-soft border-blue/30" :
            verify.status === "needs_secondary" ? "bg-amber-soft border-amber/30" :
            "bg-red-soft border-red/30"}`}>
            <div className="font-semibold mb-1">
              {verify.status === "verified" && "✓ Address verified"}
              {verify.status === "corrected" && "✎ USPS standardized this address"}
              {verify.status === "needs_secondary" && "⚠ Needs apartment / suite / unit"}
              {(verify.status === "unverified" || verify.status === "error") && "✕ Could not verify"}
            </div>
            <div className="text-ink-2">{verify.message}</div>
            {verify.address && (verify.changed || verify.status === "corrected") && (
              <div className="mt-2 p-2.5 rounded-md bg-surface border border-border">
                <div className="text-[10px] uppercase tracking-wide text-ink-muted font-bold mb-1">USPS format</div>
                <div className="font-medium">{verify.address.streetAddress}{verify.address.secondaryAddress ? `, ${verify.address.secondaryAddress}` : ""}</div>
                <div className="text-ink-2">{verify.address.city}, {verify.address.state} {verify.address.ZIPCode}{verify.address.ZIPPlus4 ? `-${verify.address.ZIPPlus4}` : ""}</div>
                <button type="button" className="btn btn-primary btn-sm mt-2" onClick={applyStandardized}>Use this address</button>
              </div>
            )}
            {verify.corrections.map((c, i) => <div key={i} className="mt-1 text-ink-2">• {c}</div>)}
            {verify.warnings.map((w, i) => <div key={i} className="mt-1 text-amber">⚠ {w}</div>)}
            <div className="mt-1.5 text-[10.5px] text-ink-muted-2">{verify.source === "usps" ? "Verified via USPS Addresses API" : "Demo validator (add USPS credentials to validate live)"}</div>
          </div>
        )}
      </Section>

      <Section title="Program">
        <Field label="Treatment Program">
          <select className="fsel" value={form.program} onChange={(e) => field("program", e.target.value)}>
            {PROGRAMS.map((p) => <option key={p} value={p}>{p}</option>)}
          </select>
        </Field>
      </Section>

      {isWeightLoss && (
        <Section title="Weight Loss Snapshot (optional)">
          <Row cols={2}>
            <Field label="Current Weight (lb)">
              <input className="fi" type="number" step="0.1" placeholder="182" value={form.weightCurrent} onChange={(e) => field("weightCurrent", e.target.value)} />
            </Field>
            <Field label="Goal Weight (lb)">
              <input className="fi" type="number" step="0.1" placeholder="150" value={form.goalWeight} onChange={(e) => field("goalWeight", e.target.value)} />
            </Field>
          </Row>
          <Row cols={3}>
            <Field label="Height (ft)">
              <input className="fi" type="number" placeholder="5" value={form.heightFt} onChange={(e) => field("heightFt", e.target.value)} />
            </Field>
            <Field label="Height (in)">
              <input className="fi" type="number" placeholder="7" value={form.heightIn} onChange={(e) => field("heightIn", e.target.value)} />
            </Field>
            <Field label="BMI (auto)">
              <input className="fi" readOnly value={bmi || ""} placeholder="—" style={{ background: "var(--color-surface-3)", fontWeight: 700 }} />
            </Field>
          </Row>
          <Row cols={2}>
            <Field label="Previous GLP-1 Use">
              <select className="fsel" value={form.priorGLP1} onChange={(e) => field("priorGLP1", e.target.value as FormState["priorGLP1"])}>
                <option value="">Select…</option>
                <option value="no">No</option>
                <option value="yes">Yes</option>
              </select>
            </Field>
            {form.priorGLP1 === "yes" && (
              <Field label="Current Dose (transferring)">
                <input className="fi" placeholder="0.5 mg/wk" value={form.transferDose} onChange={(e) => field("transferDose", e.target.value)} />
              </Field>
            )}
          </Row>
        </Section>
      )}
    </Modal>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="mb-5 last:mb-0">
      <div className="text-[10.5px] uppercase tracking-wider text-brand-dk font-bold mb-2.5 pb-2 border-b border-dashed border-border">{title}</div>
      {children}
    </div>
  );
}
function Row({ cols, children }: { cols: number; children: ReactNode }) {
  return <div className="grid gap-3 mb-2.5" style={{ gridTemplateColumns: `repeat(${cols}, 1fr)` }}>{children}</div>;
}
function Field({ label, required, children }: { label: string; required?: boolean; children: ReactNode }) {
  return (
    <div className="mb-2.5">
      <label className="fl">{label}{required && <span className="text-red ml-0.5">*</span>}</label>
      {children}
    </div>
  );
}
