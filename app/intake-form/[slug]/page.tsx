"use client";

import { useMemo, useRef, useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { PatientIntakeFlow } from "@/components/modules/PatientIntakeFlow";
import { useTreatmentsIntake } from "@/lib/hooks/useTreatmentsIntake";
import { usePatients } from "@/lib/hooks/usePatients";
import type { Patient } from "@/lib/types";
import { useTreatmentRequests } from "@/lib/hooks/useTreatmentRequests";
import { alertWelcome } from "@/lib/notify/alert";
import { resolveBrandId } from "@/lib/brands/resolve";
import { consentsFor } from "@/lib/legal/documents";
import { screenAnswers } from "@/lib/clinical/glp1Screening";
import { buildVisitPacket, buildSections } from "@/lib/visits/packet";
import { estDisplay } from "@/lib/time/est";

const COLORS = ["#2f6df6", "#0e9f6e", "#7c3aed", "#f59e0b", "#0ea5e9", "#db2777"];
const newVisitId = () => "V-" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
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
  const updatePatient = usePatients((s) => s.update);
  const addRequest = useTreatmentRequests((s) => s.add);
  const createdPatientId = useRef<string | null>(null);
  const linkedPidRef = useRef<string | null>(null);
  const visitIdRef = useRef<string | null>(null);
  // Affiliate attribution: intake links can carry ?aff=CODE (also accepts ?ref=
  // or ?affiliate=). Captured once on load and stamped onto the patient record.
  const affiliateRef = useRef<string>("");
  const leadEmailRef = useRef<string>("");
  useEffect(() => {
    try {
      const p = new URLSearchParams(window.location.search);
      const code = (p.get("aff") || p.get("affiliate") || p.get("ref") || "").trim().slice(0, 64);
      if (code) affiliateRef.current = code;
    } catch { /* ignore */ }
  }, []);

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
  async function handleComplete(clientId: number, treatmentId: number | null) {
    if (!form) return;
    const st = useTreatmentsIntake.getState();
    const client = st.clients.find((c) => c.id === clientId);
    const tx = treatmentId != null ? st.treatments.find((t) => t.id === treatmentId) : null;
    if (!client || !tx) return;

    const name = `${client.first} ${client.last}`.trim() || "New Client";
    const first = client.first || name; const last = client.last || "—";
    const price = parsePrice(tx.price);
    const state = client.address?.state || "—";

    // Pull a few highlights from the answers (BMI, weight, height, DOB, gender, goal)
    let bmi = 0, weight = 0, heightIn = 0, dob = "", gender = "Other", goal = "";
    for (const q of form.questions) {
      const raw = client.answers[q.id];
      if (raw == null) continue;
      if (q.type === "bmi" && typeof raw === "string" && raw.startsWith("{")) {
        try {
          const o = JSON.parse(raw);
          bmi = +o.bmi || 0;
          if (o.unit === "metric") {
            // Metric entries store kg/cm — convert so the chart is always lbs/inches.
            weight = Math.round((parseFloat(o.weightKg) || 0) * 2.20462);
            heightIn = Math.round((parseFloat(o.heightCm) || 0) / 2.54);
          } else {
            weight = Math.round(parseFloat(o.weightLbs) || 0);
            heightIn = (parseFloat(o.heightFt) || 0) * 12 + (parseFloat(o.heightIn) || 0);
          }
        } catch { /* ignore */ }
      } else if ((q.type === "number" || q.type === "text") && /\bweight\b/i.test(q.text) && !/goal/i.test(q.text)) {
        // Plain "What is your weight?" question (forms that don't use the BMI widget).
        const n = parseFloat(String(raw).replace(/[^0-9.]/g, ""));
        if (!weight && n > 0) weight = Math.round(n);
      } else if ((q.type === "number" || q.type === "text") && /\bheight\b/i.test(q.text)) {
        // Accepts 5'11, 5 ft 11, 5-11, or plain inches (71).
        const str = String(raw).trim();
        const ftIn = str.match(/(\d)\s*(?:'|ft|feet|-)\s*(\d{1,2})/i);
        if (ftIn) heightIn = heightIn || parseInt(ftIn[1], 10) * 12 + parseInt(ftIn[2], 10);
        else { const n = parseFloat(str.replace(/[^0-9.]/g, "")); if (!heightIn && n >= 36 && n <= 96) heightIn = Math.round(n); }
      } else if (q.type === "date") {
        const r = String(raw);
        if (r.startsWith("{")) { try { const o = JSON.parse(r); if (o.y && o.m && o.d) dob = `${o.y}-${o.m}-${o.d}`; } catch { /* ignore */ } }
        else dob = r;
      }
      else if (q.type === "multiple" && /gender/i.test(q.text)) { const v = String(raw); gender = v.startsWith("M") ? "M" : v.startsWith("F") ? "F" : "Other"; }
      else if (/goal/i.test(q.text)) { goal = String(raw); }
    }

    if (!bmi && weight > 0 && heightIn > 0) bmi = Math.round(((703 * weight) / (heightIn * heightIn)) * 10) / 10;

    const screen = screenAnswers(form.questions, client.answers);
    const reviewFlags = screen.reviewFlags;

    // Which brand did this order come in through? Prefer the form's assigned
    // brand, then the domain it was served on, then default (DripVitals).
    const brandId = resolveBrandId({
      brandId: (form as { brandId?: string }).brandId,
      slug,
      host: typeof window !== "undefined" ? window.location.host : null,
    });

    const fields = {
      brandId,
      first, last, name, email: client.email, phone: client.phone,
      age: ageFrom(dob), gender: gender as "M" | "F" | "Other", state, status: "pending" as const, lifecycle: "awaiting_review" as const,
      dob: dob || undefined, goalWt: undefined, zip: client.address?.zip || undefined,
      plan: tx.med, dose: "0.25mg", week: 0, provider: "Unassigned", doctorId: 1, pharmacyId: 1,
      wt: weight, wtStart: weight, bmi, bp: "—", hr: 0,
      ...(heightIn > 0 ? { heightIn: Math.round(heightIn) } : {}),
      since: nowParts().today, startDate: nowParts().today, lastVisit: "—", lastOrder: nowParts().today, nextRefill: "—", _refillDays: 30,
      sub: tx.price, allergies: "None",
      tags: form.questions.some((q) => q.type === "file" && /\b(id|identity|licen[sc]e|passport|government)\b/i.test(q.text) && client.answers[q.id] === "__SUBMIT_LATER__")
        ? ["New intake", "ID needed"] : ["New intake"],
      notes: "", color: COLORS[name.length % COLORS.length],
      intakeProgress: "Completed",
      ...(affiliateRef.current ? { affiliate: affiliateRef.current } : {}),
      consents: consentsFor({ treatmentName: tx.name, medication: tx.med, formName: form.name }).map((d) => ({ docId: d.id, title: d.title, version: d.version, acceptedAt: new Date().toISOString() })),
      ...(reviewFlags.length ? { clinicalFlags: reviewFlags } : {}),
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
    else { pid = await allocateId(); usePatients.getState().upsert({ id: pid, ...fields } as Patient); createdPatientId.current = pid; }
    syncCrm(pid);
    fetch("/api/intake/pending", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "complete", id: pid }) }).catch(() => {});
    // Flip the Visit to Paid — overwrites the displayed EST timestamp with the
    // payment time, and records the treatment + shipping for the visit record.
    if (!visitIdRef.current) visitIdRef.current = newVisitId();
    fetch("/api/visits", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({
      action: "pay", id: visitIdRef.current,
      patientId: pid, patientName: name, email: client.email, phone: client.phone,
      treatmentId: `BX-${tx.id}`, treatmentName: tx.name, price,
      intakeFormId: `FORM-${form.id}`, intakeFormName: form.name,
      shippingAddress: { street: client.address?.line1, line2: client.address?.apt, city: client.address?.city, state: client.address?.state, zip: client.address?.zip },
    }) }).catch(() => {});
    if (client.email) alertWelcome({ email: client.email, name, first, brandId });

    // ── Generate the Visit Packet (visit record + intake Q&A) and file it under
    // the patient's Documents tab. Self-contained snapshot — no binary storage. ──
    try {
      const ts = nowParts();
      const createdDisplay = estDisplay(Date.now());
      const packetConsents = consentsFor({ treatmentName: tx.name, medication: tx.med, formName: form.name })
        .map((d) => ({ title: d.title, version: d.version, acceptedAt: new Date().toISOString() }));
      const packet = buildVisitPacket({
        visitId: visitIdRef.current,
        createdDisplay,
        status: "Paid",
        patient: {
          name, patientId: String(pid),
          dob: dob || undefined, age: dob ? ageFrom(dob) : undefined,
          email: client.email, phone: client.phone,
          sex: gender === "M" ? "Male" : gender === "F" ? "Female" : (gender || undefined),
        },
        shipping: { line1: client.address?.line1, line2: client.address?.apt, city: client.address?.city, state: client.address?.state, zip: client.address?.zip },
        treatment: {
          program: tx.name, medication: `${tx.med} (compounded)`,
          totalMg: tx.strength || undefined,
          supply: `${tx.duration} month${tx.duration === "1" ? "" : "s"}`,
          price: tx.price, intakeFormName: form.name, intakeFormId: `FORM-${form.id}`,
        },
        screening: { eligibility: "Eligible", flaggedCount: reviewFlags.length, decision: "Awaiting provider review" },
        consents: packetConsents,
        questions: form.questions,
        answers: client.answers,
        signedName: name,
        signedDisplay: createdDisplay,
      });
      fetch("/api/patient-documents", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({
        patientId: pid, category: "visit",
        title: `Visit Record & Intake — ${form.name}`,
        icon: "📋",
        createdAt: ts.int, createdDate: `Today · ${ts.display}`,
        signedBy: name,
        visitPayload: packet,
      }) }).catch(() => {});
    } catch { /* non-fatal: completion still succeeds */ }

    // File any government-ID image uploaded during intake as an "id" document.
    try {
      const ts = nowParts();
      for (const q of form.questions) {
        if (q.type !== "file") continue;
        const raw = client.answers[q.id];
        if (typeof raw !== "string" || !raw.startsWith("data:image")) continue;
        if (!/\b(id|identity|licen[sc]e|passport|government)\b/i.test(q.text)) continue;
        fetch("/api/patient-documents", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({
          patientId: pid, category: "id",
          title: `Government ID — ${name}`, icon: "🪪",
          createdAt: ts.int, createdDate: `Today · ${ts.display}`,
          idPayload: { dataUrl: raw, mimeType: "image/jpeg", label: `${state} ID`, side: "front", verified: false },
        }) }).catch(() => {});
        break; // one ID document per intake
      }
    } catch { /* non-fatal */ }

    const np = nowParts();
    addRequest({
      brandId,
      patientId: pid, patientName: name,
      visitId: visitIdRef.current ?? undefined,
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
      ...(reviewFlags.length ? { clinicalFlags: reviewFlags } : {}),
    });
  }

  // Push the full patient profile to the server so it lands in the CRM roster
  // immediately, across devices.
  // Get a unique patient number from the server (atomic — safe across many
  // simultaneous intakes). If the endpoint is unreachable, fall back to a random
  // high number (PT-9xxxx) that cannot collide with the real 1001+ sequence.
  async function allocateId(): Promise<string> {
    try {
      const r = await fetch("/api/crm/patients/allocate-id", { method: "POST" });
      const d = await r.json().catch(() => null);
      if (r.ok && d?.ok && typeof d.id === "string") return d.id;
    } catch { /* fall through */ }
    return `PT-9${String(Math.floor(10000 + Math.random() * 89999))}`;
  }

  function syncCrm(id: string | null) {
    if (!id) return;
    const p = usePatients.getState().patients.find((x) => x.id === id);
    if (p) fetch("/api/crm/patients", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ patient: p }) }).catch(() => {});
  }

  // Fired as soon as the patient enters name + email (and phone). Pre-creates
  // the CRM patient profile, then keeps it updated as more is captured.
  async function handleLead(info: { first: string; last: string; phone: string; email: string }) {
    const name = `${info.first} ${info.last}`.trim() || info.email || "New Lead";
    if (info.email) leadEmailRef.current = info.email;
    if (createdPatientId.current) {
      updatePatient(createdPatientId.current, {
        first: info.first || undefined, last: info.last || undefined, name,
        email: info.email || undefined, phone: info.phone || undefined,
      });
      if (!visitIdRef.current) {
        visitIdRef.current = newVisitId();
        fetch("/api/visits", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "start", id: visitIdRef.current, patientId: createdPatientId.current, patientName: name, email: info.email, phone: info.phone, intakeFormId: form ? `FORM-${form.id}` : undefined, intakeFormName: form?.name }) }).catch(() => {});
      }
      syncCrm(createdPatientId.current);
      return;
    }
    const np = nowParts();
    // Server-issued id (atomic) so simultaneous intakes can never collide.
    const newId = await allocateId();
    if (createdPatientId.current) return; // a parallel call won the race while we awaited
    const created = { id: newId } as { id: string };
    usePatients.getState().upsert({
      id: newId,
      first: info.first || name, last: info.last || "—", name, email: info.email, phone: info.phone,
      age: 0, gender: "Other", state: "—", status: "pending", lifecycle: "intake_pending",
      dob: undefined, goalWt: undefined, zip: undefined,
      plan: "—", dose: "—", week: 0, provider: "Unassigned", doctorId: 1, pharmacyId: 1,
      wt: 0, wtStart: 0, bmi: 0, bp: "—", hr: 0,
      since: np.today, startDate: np.today, lastVisit: "—", lastOrder: "—", nextRefill: "—", _refillDays: 30,
      sub: "—", allergies: "None", tags: ["New intake"], notes: "Created from intake form.",
      color: COLORS[name.length % COLORS.length], intakeProgress: "Contact captured",
      ...(affiliateRef.current ? { affiliate: affiliateRef.current } : {}),
    } as Patient);
    createdPatientId.current = created.id;
    // Register the started intake server-side so the 24h reminder can fire if abandoned.
    fetch("/api/intake/pending", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "start", id: created.id, name, email: info.email, phone: info.phone }) }).catch(() => {});
    // Open a Visit (EST-stamped) at this first real step. Idempotent per session.
    if (!visitIdRef.current) visitIdRef.current = newVisitId();
    fetch("/api/visits", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "start", id: visitIdRef.current, patientId: created.id, patientName: name, email: info.email, phone: info.phone, intakeFormId: form ? `FORM-${form.id}` : undefined, intakeFormName: form?.name }) }).catch(() => {});
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
    // Mirror the answers so far onto the patient record — staff can read the
    // questionnaire on the chart even if the patient never reaches payment.
    try {
      if (form && leadEmailRef.current) {
        const cl = useTreatmentsIntake.getState().clients.find((c) => (c.email || "").toLowerCase() === leadEmailRef.current.toLowerCase());
        if (cl) {
          const qa = buildSections(form.questions, cl.answers)
            .flatMap((sec) => sec.items)
            .filter((it) => it.answer !== undefined && it.answer !== "")
            .slice(0, 150)
            .map((it) => ({ q: String(it.question).slice(0, 300), a: String(it.answer).slice(0, 600) }));
          // Vitals land on the profile as soon as they're answered — not only at
          // payment. Same parsing as completion (imperial + metric, plain
          // weight/height questions, BMI recompute).
          let w = 0, hIn = 0, bmiV = 0, dobV = "", sexV: "" | "M" | "F" = "";
          for (const q of form.questions) {
            const raw = cl.answers[q.id];
            if (raw == null) continue;
            if (q.type === "bmi" && typeof raw === "string" && raw.startsWith("{")) {
              try {
                const o = JSON.parse(raw);
                bmiV = +o.bmi || 0;
                if (o.unit === "metric") { w = Math.round((parseFloat(o.weightKg) || 0) * 2.20462); hIn = Math.round((parseFloat(o.heightCm) || 0) / 2.54); }
                else { w = Math.round(parseFloat(o.weightLbs) || 0); hIn = (parseFloat(o.heightFt) || 0) * 12 + (parseFloat(o.heightIn) || 0); }
              } catch { /* ignore */ }
            } else if ((q.type === "number" || q.type === "text") && /\bweight\b/i.test(q.text) && !/goal/i.test(q.text)) {
              const n = parseFloat(String(raw).replace(/[^0-9.]/g, "")); if (!w && n > 0) w = Math.round(n);
            } else if ((q.type === "number" || q.type === "text") && /\bheight\b/i.test(q.text)) {
              const str = String(raw).trim();
              const ftIn = str.match(/(\d)\s*(?:'|ft|feet|-)\s*(\d{1,2})/i);
              if (ftIn) hIn = hIn || parseInt(ftIn[1], 10) * 12 + parseInt(ftIn[2], 10);
              else { const n = parseFloat(str.replace(/[^0-9.]/g, "")); if (!hIn && n >= 36 && n <= 96) hIn = Math.round(n); }
            } else if (q.type === "date" && /birth|dob/i.test(q.text) && typeof raw === "string") {
              dobV = raw;
            } else if (/gender|sex\b/i.test(q.text) && typeof raw === "string") {
              sexV = /^m/i.test(raw) ? "M" : /^f/i.test(raw) ? "F" : "";
            }
          }
          if (!bmiV && w > 0 && hIn > 0) bmiV = Math.round(((703 * w) / (hIn * hIn)) * 10) / 10;
          const curP = usePatients.getState().patients.find((x) => x.id === createdPatientId.current);
          const vitals: Record<string, unknown> = {};
          if (w > 0) { vitals.wt = w; if (!curP?.wtStart) vitals.wtStart = w; }
          if (hIn > 0) vitals.heightIn = Math.round(hIn);
          if (bmiV > 0) vitals.bmi = bmiV;
          if (dobV) vitals.dob = dobV;
          if (sexV) vitals.gender = sexV;
          if (qa.length || Object.keys(vitals).length) {
            updatePatient(createdPatientId.current, { ...(qa.length ? { intakeQa: qa } : {}), ...vitals });
            syncCrm(createdPatientId.current);
          }
        }
      }
    } catch { /* mirroring must never break the intake */ }
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
