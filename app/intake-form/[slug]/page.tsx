"use client";

import { useMemo, useRef, useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { PatientIntakeFlow } from "@/components/modules/PatientIntakeFlow";
import { useTreatmentsIntake } from "@/lib/hooks/useTreatmentsIntake";
import { usePatients } from "@/lib/hooks/usePatients";
import type { Patient } from "@/lib/types";
import { useTreatmentRequests } from "@/lib/hooks/useTreatmentRequests";
import { alertWelcome } from "@/lib/notify/alert";
import { INTAKE_CONSENTS } from "@/lib/legal/documents";

const COLORS = ["#2f6df6", "#0e9f6e", "#7c3aed", "#f59e0b", "#0ea5e9", "#db2777"];
const parsePrice = (s: string) => Number((s || "").replace(/[^0-9.]/g, "")) || 0;
const ageFrom = (dob: string) => { if (!dob) return 35; const d = new Date(dob); return Math.floor((Date.now() - d.getTime()) / 3.15576e10); };
function nowParts() {
  const d = new Date(); const M = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
  const hr = d.getHours(), h12 = hr % 12 || 12, ap = hr >= 12 ? "PM" : "AM";
  return { display: `${h12}:${String(d.getMinutes()).padStart(2,"0")} ${ap}`, int: parseInt(`${d.getFullYear()}${String(d.getMonth()+1).padStart(2,"0")}${String(d.getDate()).padStart(2,"0")}${String(hr).padStart(2,"0")}${String(d.getMinutes()).padStart(2,"0")}`,10), today: `${M[d.getMonth()]} ${d.getDate()}` };
}

export default function IntakeFormPage() {
  const slug = useParams<{ slug: string }>().slug;
  const router = useRouter();
  const forms = useTreatmentsIntake((s) => s.forms);
  const addPatient = usePatients((s) => s.add);
  const updatePatient = usePatients((s) => s.update);
  const addRequest = useTreatmentRequests((s) => s.add);
  const createdPatientId = useRef<string | null>(null);
  const linkedPidRef = useRef<string | null>(null);

  const form = useMemo(() => forms.find((f) => f.slug === slug), [forms, slug]);

  // Pull the latest treatments + forms from the server BEFORE rendering the
  // questionnaire, so patients always see the clinic's current edits (not the
  // seed baked into their device). Falls back to whatever's local on error.
  const [formsReady, setFormsReady] = useState(false);
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const [f, t] = await Promise.all([
          fetch("/api/store/intake-forms", { cache: "no-store" }).then((r) => r.json()).catch(() => null),
          fetch("/api/store/treatments", { cache: "no-store" }).then((r) => r.json()).catch(() => null),
        ]);
        if (!alive) return;
        const cur = useTreatmentsIntake.getState();
        useTreatmentsIntake.setState({
          forms: (f?.data ?? cur.forms) as typeof cur.forms,
          treatments: (t?.data ?? cur.treatments) as typeof cur.treatments,
        });
      } catch { /* ignore — fall back to local */ }
      if (alive) setFormsReady(true);
    })();
    return () => { alive = false; };
  }, []);

  // If an admin/clinician sent this form to an existing patient, the link carries
  // ?pid=<patientId>. Capture it so the completed intake writes back to that
  // patient instead of creating a duplicate.
  useEffect(() => {
    try {
      const p = new URLSearchParams(window.location.search).get("pid");
      if (p) { linkedPidRef.current = p; createdPatientId.current = p; }
    } catch { /* ignore */ }
  }, []);

  if (!formsReady) return <Msg icon="⏳" title="Loading…" sub="Fetching the latest form." />;
  if (!form) return <Msg icon="🔍" title="Form not found" sub={`No intake form for “${slug}”.`} />;
  if (!form.active) return <Msg icon="🚧" title="This form is not active" sub="Please check back later or contact the clinic." />;

  // On successful payment, mirror the paid client into the doctor-side flow:
  // create a patient + a treatment request → chart → Approve → Prescribe → e-Prescribe.
  function handleComplete(clientId: number, treatmentId: number | null) {
    if (!form) return;
    const st = useTreatmentsIntake.getState();
    const client = st.clients.find((c) => c.id === clientId);
    const tx = treatmentId != null ? st.treatments.find((t) => t.id === treatmentId) : null;
    if (!client || !tx) return;

    const name = `${client.first} ${client.last}`.trim() || "New Client";
    const first = client.first || name; const last = client.last || "—";
    const price = parsePrice(tx.price);
    const state = client.address?.state || "—";

    // Pull a few highlights from the answers (BMI, DOB age, gender, goal)
    let bmi = 0, weight = 0, dob = "", gender = "Other", goal = "";
    for (const q of form.questions) {
      const raw = client.answers[q.id];
      if (raw == null) continue;
      if (q.type === "bmi" && typeof raw === "string" && raw.startsWith("{")) {
        try { const o = JSON.parse(raw); bmi = +o.bmi || 0; weight = parseFloat(o.weightLbs || o.weightKg) || 0; } catch { /* ignore */ }
      } else if (q.type === "date") {
        const r = String(raw);
        if (r.startsWith("{")) { try { const o = JSON.parse(r); if (o.y && o.m && o.d) dob = `${o.y}-${o.m}-${o.d}`; } catch { /* ignore */ } }
        else dob = r;
      }
      else if (q.type === "multiple" && /gender/i.test(q.text)) { const v = String(raw); gender = v.startsWith("M") ? "M" : v.startsWith("F") ? "F" : "Other"; }
      else if (/goal/i.test(q.text)) { goal = String(raw); }
    }

    const fields = {
      first, last, name, email: client.email, phone: client.phone,
      age: ageFrom(dob), gender: gender as "M" | "F" | "Other", state, status: "pending" as const, lifecycle: "awaiting_review" as const,
      dob: dob || undefined, goalWt: undefined, zip: client.address?.zip || undefined,
      plan: tx.med, dose: "0.25mg", week: 0, provider: "Unassigned", doctorId: 1, pharmacyId: 1,
      wt: weight, wtStart: weight, bmi, bp: "—", hr: 0,
      since: nowParts().today, startDate: nowParts().today, lastVisit: "—", lastOrder: nowParts().today, nextRefill: "—", _refillDays: 30,
      sub: tx.price, allergies: "None", tags: ["New intake"], notes: "", color: COLORS[name.length % COLORS.length],
      intakeProgress: "Completed",
      consents: INTAKE_CONSENTS.map((d) => ({ docId: d.id, title: d.title, version: d.version, acceptedAt: new Date().toISOString() })),
    };
    // Reuse the profile pre-created during intake; only create a new one if the
    // patient somehow reached completion without a captured contact step.
    let pid = createdPatientId.current;
    if (linkedPidRef.current) {
      // Sent to an existing patient — write the completed intake back to that id.
      pid = linkedPidRef.current;
      const patient = { id: pid, ...fields } as Patient;
      usePatients.getState().upsert(patient);
    } else if (pid) updatePatient(pid, fields);
    else { const created = addPatient(fields); pid = created.id; createdPatientId.current = pid; }
    syncCrm(pid);
    fetch("/api/intake/pending", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "complete", id: pid }) }).catch(() => {});
    if (client.email) alertWelcome({ email: client.email, name, first });

    const np = nowParts();
    addRequest({
      patientId: pid, patientName: name,
      treatmentId: `BX-${tx.id}`, treatmentName: tx.name, medication: `${tx.med} (compounded)`,
      dosingProtocol: tx.strength, duration: `${tx.duration} month${tx.duration === "1" ? "" : "s"}`, price,
      category: "GLP-1 / Weight Loss", icon: tx.icon, color: `var(--color-${tx.color})`,
      submittedAt: np.int, submittedDate: `Today · ${np.display}`,
      intakeFormId: `FORM-${form.id}`, intakeFormName: form.name,
      intakeHighlights: [
        ...(state !== "—" ? [{ label: "State", value: state }] : []),
        ...(goal ? [{ label: "Weight Loss Goal", value: goal }] : []),
        ...(bmi ? [{ label: "BMI", value: `${bmi}` }] : []),
        ...(weight ? [{ label: "Weight", value: `${weight} lbs` }] : []),
        { label: "Form", value: form.name },
      ],
      status: "pending",
    });
  }

  // Push the full patient profile to the server so it lands in the CRM roster
  // immediately, across devices.
  function syncCrm(id: string | null) {
    if (!id) return;
    const p = usePatients.getState().patients.find((x) => x.id === id);
    if (p) fetch("/api/crm/patients", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ patient: p }) }).catch(() => {});
  }

  // Fired as soon as the patient enters name + email (and phone). Pre-creates
  // the CRM patient profile, then keeps it updated as more is captured.
  function handleLead(info: { first: string; last: string; phone: string; email: string }) {
    const name = `${info.first} ${info.last}`.trim() || info.email || "New Lead";
    if (createdPatientId.current) {
      updatePatient(createdPatientId.current, {
        first: info.first || undefined, last: info.last || undefined, name,
        email: info.email || undefined, phone: info.phone || undefined,
      });
      syncCrm(createdPatientId.current);
      return;
    }
    const np = nowParts();
    const created = addPatient({
      first: info.first || name, last: info.last || "—", name, email: info.email, phone: info.phone,
      age: 0, gender: "Other", state: "—", status: "pending", lifecycle: "intake_pending",
      dob: undefined, goalWt: undefined, zip: undefined,
      plan: "—", dose: "—", week: 0, provider: "Unassigned", doctorId: 1, pharmacyId: 1,
      wt: 0, wtStart: 0, bmi: 0, bp: "—", hr: 0,
      since: np.today, startDate: np.today, lastVisit: "—", lastOrder: "—", nextRefill: "—", _refillDays: 30,
      sub: "—", allergies: "None", tags: ["New intake"], notes: "Created from intake form.",
      color: COLORS[name.length % COLORS.length], intakeProgress: "Contact captured",
    });
    createdPatientId.current = created.id;
    // Register the started intake server-side so the 24h reminder can fire if abandoned.
    fetch("/api/intake/pending", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "start", id: created.id, name, email: info.email, phone: info.phone }) }).catch(() => {});
    syncCrm(created.id);
  }

  // Fired on each step so the profile reflects how far the patient has gotten.
  function handleProgress(info: { stage: string; step: number; total: number }) {
    if (!createdPatientId.current) return;
    const label =
      info.stage === "treatment" ? "Selecting treatment" :
      info.stage === "checkout" ? "At payment" :
      info.stage === "success" ? "Completed" :
      info.stage === "disqualified" ? "Disqualified" :
      `Question ${Math.min(info.step + 1, info.total || 1)} of ${info.total || 1}`;
    updatePatient(createdPatientId.current, { intakeProgress: label });
    // Mirror progress server-side so the EMR sees it across devices/sessions.
    fetch("/api/intake/pending", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "progress", id: createdPatientId.current, progress: label }) }).catch(() => {});
    syncCrm(createdPatientId.current);
  }

  return (
    <PatientIntakeFlow
      key={form.id}
      formId={form.id}
      live
      onComplete={handleComplete}
      onLead={handleLead}
      onProgress={handleProgress}
      onExit={() => router.push("/patient-portal")}
    />
  );
}

function Msg({ icon, title, sub }: { icon: string; title: string; sub: string }) {
  return (
    <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", background: "var(--color-bg, #f5f7fb)", textAlign: "center", padding: 24 }}>
      <div style={{ fontSize: 44, marginBottom: 8 }}>{icon}</div>
      <h1 style={{ fontSize: 22, fontWeight: 800, margin: "0 0 4px" }}>{title}</h1>
      <p style={{ fontSize: 14, color: "var(--color-ink-muted, #6b7890)", maxWidth: 380 }}>{sub}</p>
    </div>
  );
}
