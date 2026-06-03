"use client";

import { useMemo, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import { PatientIntakeFlow } from "@/components/modules/PatientIntakeFlow";
import { useTreatmentsIntake } from "@/lib/hooks/useTreatmentsIntake";
import { usePatients } from "@/lib/hooks/usePatients";
import { useTreatmentRequests } from "@/lib/hooks/useTreatmentRequests";

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
  const addRequest = useTreatmentRequests((s) => s.add);
  const createdPatientId = useRef<string | null>(null);

  const form = useMemo(() => forms.find((f) => f.slug === slug), [forms, slug]);

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

    const patient = addPatient({
      first, last, name, email: client.email, phone: client.phone,
      age: ageFrom(dob), gender: gender as "M" | "F" | "Other", state, status: "pending", lifecycle: "awaiting_review",
      dob: dob || undefined, goalWt: undefined, zip: client.address?.zip || undefined,
      plan: tx.med, dose: "0.25mg", week: 0, provider: "Unassigned", doctorId: 1, pharmacyId: 1,
      wt: weight, wtStart: weight, bmi, bp: "—", hr: 0,
      since: nowParts().today, startDate: nowParts().today, lastVisit: "—", lastOrder: nowParts().today, nextRefill: "—", _refillDays: 30,
      sub: tx.price, allergies: "None", tags: ["New intake"], notes: "", color: COLORS[name.length % COLORS.length],
    });
    createdPatientId.current = patient.id;

    const np = nowParts();
    addRequest({
      patientId: patient.id, patientName: name,
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

  return (
    <PatientIntakeFlow
      key={form.id}
      formId={form.id}
      live
      onComplete={handleComplete}
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
