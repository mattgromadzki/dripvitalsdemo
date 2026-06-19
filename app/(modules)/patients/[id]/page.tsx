"use client";

import { useMemo, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { Pill } from "@/components/ui/Pill";
import { Toast } from "@/components/ui/Toast";
import { toast } from "@/lib/hooks/useToast";
import { usePatients } from "@/lib/hooks/usePatients";
import { useEmails } from "@/lib/hooks/useEmails";
import { getPatientExtra } from "@/lib/data/patientExtras";
import { NewOrderModal } from "@/components/modules/chart/NewOrderModal";
import { NewPrescriptionModal } from "@/components/modules/chart/NewPrescriptionModal";
import { PatientMessageCenter } from "@/components/modules/chart/PatientMessageCenter";

type TabKey = "summary" | "intake" | "treatment" | "orders" | "weight" | "messages" | "documents" | "billing" | "admin";
const TABS: { key: TabKey; label: string }[] = [
  { key: "summary", label: "Summary" }, { key: "intake", label: "Intake" }, { key: "treatment", label: "Treatment" },
  { key: "orders", label: "Orders" }, { key: "weight", label: "Weight" }, { key: "messages", label: "Messages" },
  { key: "documents", label: "Documents / ID" }, { key: "billing", label: "Billing" }, { key: "admin", label: "Admin" },
];

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const todayStr = () => { const d = new Date(); return `${MONTHS[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}`; };
const nowTime = () => { const d = new Date(); return d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" }); };
const initialsOf = (s: string) => s.split(/\s+/).filter(Boolean).map((w) => w[0]).slice(0, 2).join("").toUpperCase();

interface WeightEntry { date: string; weight: number; source: string; note: string }
interface DoseEntry { date: string; dose: string; status: string; provider: string; note: string }
interface NoteEntry { author: string; type: string; text: string; at: string }
interface AuditEntry { time: string; user: string; action: string; area: string; device: string }

export default function PatientDetailPage() {
  const params = useParams<{ id: string }>();
  const patient = usePatients((s) => s.patients.find((p) => p.id === params.id));
  const updatePatient = usePatients((s) => s.update);
  const addEmail = useEmails((s) => s.add);

  const [tab, setTab] = useState<TabKey>("summary");
  const [msgOpen, setMsgOpen] = useState(false);
  const [orderOpen, setOrderOpen] = useState(false);
  const [rxOpen, setRxOpen] = useState(false);
  const [modal, setModal] = useState<null | "note" | "dose" | "profile" | "id">(null);

  const extra = useMemo(() => (patient ? getPatientExtra(patient) : null), [patient]);

  const [weights, setWeights] = useState<WeightEntry[]>(() =>
    extra ? extra.weightLog.map((w, i) => ({ date: extra.weightDates[i] || `Pt ${i + 1}`, weight: w, source: i === 0 ? "Intake" : "Tracked", note: i === 0 ? "Starting weight" : "" })) : []
  );
  const [doseHistory, setDoseHistory] = useState<DoseEntry[]>(() =>
    extra ? extra.prescriptions.map((rx) => ({ date: rx.prescribed, dose: rx.dose, status: rx.status, provider: rx.prescribedBy, note: "Prescribed" })) : []
  );
  const [notes, setNotes] = useState<NoteEntry[]>([]);
  const [audit, setAudit] = useState<AuditEntry[]>([
    { time: `Today ${nowTime()}`, user: "Admin", action: "Opened chart", area: "Summary", device: "Browser" },
  ]);
  const [intakeStatus, setIntakeStatus] = useState("Needs Review");
  const [decisionNote, setDecisionNote] = useState("");
  const [doseField, setDoseField] = useState("");
  const [doseNote, setDoseNote] = useState("");
  const [noteType, setNoteType] = useState("Admin Note");
  const [noteText, setNoteText] = useState("");
  const [newWeight, setNewWeight] = useState("");
  const [weightNote, setWeightNote] = useState("");
  const [msgBox, setMsgBox] = useState("");
  const [msgList, setMsgList] = useState<{ kind: string; intent: "blue" | "purple"; title: string; sub: string }[]>([
    { kind: "Email", intent: "blue", title: "Intake received", sub: "Sent · Opened" },
    { kind: "SMS", intent: "purple", title: "Portal login link", sub: "Delivered" },
  ]);
  const [profile, setProfile] = useState(() => ({ name: patient?.name || "", email: patient?.email || "", phone: patient?.phone || "" }));

  if (!patient || !extra) {
    return (
      <div className="px-5 py-5">
        <Link href="/patients" className="btn btn-ghost btn-sm">← Back to patients</Link>
        <div className="bg-surface border border-border rounded-2xl mt-4 p-12 text-center">
          <div className="text-[36px] opacity-40 mb-2">🔍</div>
          <h2>Patient not found</h2>
          <div className="text-[12px] text-ink-muted mt-1">No patient with ID <span className="font-mono">{params.id}</span></div>
        </div>
        <Toast />
      </div>
    );
  }

  const pid = patient.id;
  const logAudit = (action: string, area = "Chart") => setAudit((a) => [{ time: `Now`, user: "Admin", action, area, device: "Browser" }, ...a]);

  const intakeIncomplete = !!patient.intakeProgress && patient.intakeProgress !== "Completed";
  const hasRx = doseHistory.length > 0;
  const idVerified = extra.idVerified;
  const reviewNeeded = !intakeIncomplete && intakeStatus === "Needs Review";
  const lost = Math.max(0, patient.wtStart - patient.wt);
  const pctLost = patient.wtStart > 0 ? ((lost / patient.wtStart) * 100).toFixed(1) : "0";
  const remaining = Math.max(0, patient.wt - (extra.goalWt ?? patient.wt));
  const nextAction = intakeIncomplete ? "Finish intake" : reviewNeeded ? "Review" : "Refill";
  const currentWeight = weights.length ? weights[weights.length - 1].weight : patient.wt;
  const bmiFor = (w: number) => (patient.heightIn ? Math.round((w / (patient.heightIn * patient.heightIn)) * 703 * 10) / 10 : patient.bmi);

  const addWeight = () => {
    const w = parseFloat(newWeight);
    if (!w || w < 60 || w > 700) { toast("Enter a valid weight"); return; }
    setWeights((arr) => [...arr, { date: todayStr(), weight: w, source: "Manual", note: weightNote || "Manual entry" }]);
    updatePatient(pid, { wt: w, bmi: bmiFor(w) });
    logAudit(`Added weight ${w} lb`, "Weight");
    toast("Weight added");
    setNewWeight(""); setWeightNote("");
  };
  const sendMessage = () => {
    if (!msgBox.trim()) { toast("Write a message first"); return; }
    addEmail({ folder: "sent", direction: "out", fromName: "DripVitals Care", fromEmail: "care@dripvitals.com", to: patient.email, toName: patient.name, subject: "Message from your care team", html: `<p>${msgBox.trim()}</p>`, status: "sent", read: true, starred: false, createdAt: new Date().toISOString() });
    setMsgList((l) => [{ kind: "Email", intent: "blue", title: "Outbound message", sub: msgBox.trim().slice(0, 48) }, ...l]);
    setMsgBox(""); logAudit("Sent patient message", "Messages"); toast("Message sent");
  };
  const insertTemplate = (kind: "weight" | "refill") => {
    setMsgBox(kind === "weight"
      ? `Hi ${patient.first}, please log into your portal and update your current weight before your next refill review.`
      : `Hi ${patient.first}, your refill review is coming up — please complete your follow-up check-in so your provider can review your next refill.`);
    toast("Template inserted");
  };
  const saveNote = () => {
    if (!noteText.trim()) { toast("Write a note"); return; }
    setNotes((n) => [{ author: "Admin", type: noteType, text: noteText.trim(), at: "Now" }, ...n]);
    logAudit("Added chart note", "Notes"); toast("Note added"); setNoteText(""); setModal(null);
  };
  const saveDose = () => {
    if (!doseField) { toast("Pick a dose"); return; }
    updatePatient(pid, { dose: doseField });
    setDoseHistory((d) => [{ date: todayStr(), dose: doseField, status: "updated", provider: patient.provider, note: doseNote || "Dose updated" }, ...d]);
    logAudit(`Changed dose to ${doseField}`, "Treatment"); toast("Dose updated"); setDoseNote(""); setModal(null);
  };
  const saveProfile = () => {
    updatePatient(pid, { name: profile.name, email: profile.email, phone: profile.phone });
    logAudit("Edited patient profile", "Profile"); toast("Profile saved"); setModal(null);
  };
  const decideIntake = (decision: "Approved" | "Info requested" | "Denied") => {
    setIntakeStatus(decision); logAudit(`Intake ${decision}`, "Intake"); toast(`Intake ${decision.toLowerCase()}`);
  };

  return (
    <div className="px-5 py-5 text-[14px]">
      <Link href="/patients" className="text-[12.5px] text-ink-muted font-semibold hover:text-brand-dk inline-flex items-center gap-1.5 mb-3">← Patients</Link>

      <section className="flex items-start gap-4 flex-wrap mb-4">
        <div className="w-[58px] h-[58px] rounded-2xl flex items-center justify-center text-white font-extrabold text-[20px] shrink-0" style={{ background: "linear-gradient(135deg,var(--color-brand),var(--color-brand-dk))" }}>{initialsOf(patient.name)}</div>
        <div className="min-w-0">
          <h1>{patient.name}</h1>
          <div className="flex items-center gap-2 flex-wrap text-[12px] text-ink-muted mt-1">
            <span className="font-mono">{patient.id}</span><Dot /><span>{patient.age}{patient.gender === "Other" ? "" : patient.gender}</span><Dot /><span>{patient.state}</span><Dot /><span>{patient.plan}</span><Dot /><span>{patient.email}</span>
          </div>
          <div className="flex items-center gap-1.5 flex-wrap mt-2">
            <Pill intent={patient.status === "active" ? "green" : "muted"}>{patient.status}</Pill>
            <Pill intent="purple">{patient.plan}</Pill>
            {reviewNeeded && <Pill intent="amber">Needs Review</Pill>}
            <Pill intent={idVerified ? "blue" : "muted"}>{idVerified ? "ID Verified" : "ID Pending"}</Pill>
          </div>
        </div>
        <div className="flex gap-2 flex-wrap ml-auto">
          <button className="btn btn-primary btn-sm" onClick={() => setTab("intake")}>Review Intake</button>
          <button className="btn btn-ghost btn-sm" onClick={() => setMsgOpen(true)}>Message</button>
          <button className="btn btn-ghost btn-sm" onClick={() => setRxOpen(true)}>Create Rx</button>
          <button className="btn btn-ghost btn-sm" onClick={() => setModal("note")}>Add Note</button>
        </div>
      </section>

      <section className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-2.5 mb-4">
        <Metric label="Starting Weight" value={`${patient.wtStart} lb`} sub="Baseline intake" />
        <Metric label="Current Weight" value={`${currentWeight} lb`} sub={`Updated ${weights.length ? weights[weights.length - 1].date : "—"}`} color="text-green" />
        <Metric label="Total Lost" value={`${Math.round((patient.wtStart - currentWeight) * 10) / 10} lb`} sub={`${pctLost}% body weight`} color="text-green" />
        <Metric label="Goal Weight" value={`${extra.goalWt} lb`} sub={`${remaining} lb remaining`} />
        <Metric label="Next Refill" value={patient.nextRefill} sub="Follow-up required" />
        <Metric label="Next Action" value={nextAction} sub="Care workflow" color="text-brand" />
      </section>

      <nav className="flex gap-0.5 border-b border-border mb-4 overflow-x-auto">
        {TABS.map((t) => (
          <button key={t.key} onClick={() => setTab(t.key)}
            className={`text-[12.5px] font-semibold px-3 py-2.5 whitespace-nowrap border-b-2 -mb-px ${tab === t.key ? "text-brand-dk border-brand" : "text-ink-muted border-transparent hover:text-ink-2"}`}>{t.label}</button>
        ))}
      </nav>

      <div className="grid gap-4" style={{ gridTemplateColumns: "minmax(0,1fr) 300px" }}>
        <div className="flex flex-col gap-4 min-w-0">

          {tab === "summary" && (<>
            <Card title="Patient Summary" sub="Demographics, clinical flags, treatment, ID, and order state." action={<button className="btn btn-ghost btn-sm" onClick={() => { setProfile({ name: patient.name, email: patient.email, phone: patient.phone }); setModal("profile"); }}>Edit Profile</button>}>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <Info k="Phone" v={patient.phone} /><Info k="State" v={patient.state} /><Info k="Program" v={patient.plan} /><Info k="Provider" v={patient.provider} />
                <Info k="Allergies" v={patient.allergies || "None reported"} /><Info k="Risk" v={extra.riskLabel} /><Info k="Rx Status" v={hasRx ? "Active" : "Signature needed"} /><Info k="Payment" v={patient.sub} />
              </div>
            </Card>
            <div className="grid md:grid-cols-2 gap-4">
              <Card title="Current Workflow" sub="What's stuck right now.">
                {reviewNeeded ? <AlertBox tone="amber" icon="!" title="Provider review needed" body="Intake submitted. Review medication history before creating an Rx." />
                  : <AlertBox tone="green" icon="✓" title="Review complete" body="Provider review is done for this patient." />}
                <AlertBox tone={idVerified ? "green" : "amber"} icon={idVerified ? "✓" : "!"} title={idVerified ? "ID verified" : "ID not verified"} body={idVerified ? "Name, DOB, and state match the uploaded license." : "Government ID still needs verification."} />
                <AlertBox tone={patient.status === "active" ? "green" : "amber"} icon={patient.status === "active" ? "✓" : "!"} title={patient.status === "active" ? "Payment active" : "Payment inactive"} body={`Plan: ${patient.sub}`} />
              </Card>
              <Card title="Refill Readiness" sub="Required before next shipment.">
                <SideRow k="Payment active" v={patient.status === "active" ? "Complete" : "Needed"} ok={patient.status === "active"} />
                <SideRow k="Weight updated" v={weights.length > 1 ? "Complete" : "Needed"} ok={weights.length > 1} />
                <SideRow k="Follow-up form" v="Needed" ok={false} />
                <SideRow k="Provider approval" v={intakeStatus === "Approved" ? "Complete" : "Needed"} ok={intakeStatus === "Approved"} />
              </Card>
            </div>
            {notes.length > 0 && (
              <Card title="Recent Notes" sub="Notes added on this chart.">
                {notes.map((n, i) => (
                  <div key={i} className="border-b border-surface-3 last:border-none py-2.5 first:pt-0">
                    <div className="flex items-center justify-between"><div><strong className="text-[12.5px]">{n.author}</strong><div className="text-[11px] text-ink-muted">{n.type} · {n.at}</div></div><Pill intent="blue">New</Pill></div>
                    <div className="text-[12px] mt-1">{n.text}</div>
                  </div>
                ))}
              </Card>
            )}
          </>)}

          {tab === "intake" && (
            <Card title="Intake Review" sub="Approve, request more info, or deny." action={
              <div className="flex gap-2"><button className="btn btn-primary btn-sm" onClick={() => decideIntake("Approved")}>Approve</button><button className="btn btn-ghost btn-sm" onClick={() => decideIntake("Info requested")}>Request Info</button><button className="btn btn-danger btn-sm" onClick={() => decideIntake("Denied")}>Deny</button></div>}>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
                <Info k="Submitted" v={patient.since} /><Info k="Completion" v={intakeIncomplete ? patient.intakeProgress || "In progress" : "100%"} /><Info k="Risk" v={extra.riskLabel} /><Info k="Status" v={intakeStatus} />
              </div>
              <div className="grid md:grid-cols-2 gap-5">
                <div>
                  <h3>Medical questionnaire</h3>
                  <table className="w-full text-[12.5px] mt-2">
                    <tbody>
                      <Qr k="Starting weight" v={`${patient.wtStart} lb`} /><Qr k="Goal weight" v={`${extra.goalWt} lb`} />
                      <Qr k="Prior GLP-1 use" v={patient.priorGLP1 ? "Yes" : "No prior use"} /><Qr k="Allergies" v={patient.allergies || "None reported"} />
                      <Qr k="Contraindications" v="None reported on intake" />
                    </tbody>
                  </table>
                </div>
                <div>
                  <h3>Provider decision note</h3>
                  <textarea value={decisionNote} onChange={(e) => setDecisionNote(e.target.value)} placeholder="Add provider decision note…" className="w-full mt-2 border border-border rounded-[9px] p-3 text-[12.5px] min-h-[120px] bg-surface" />
                  <button className="btn btn-primary btn-sm mt-2" onClick={() => { logAudit("Saved decision note", "Intake"); toast("Decision note saved"); }}>Save Decision Note</button>
                </div>
              </div>
            </Card>
          )}

          {tab === "treatment" && (
            <Card title="Treatment Plan" sub="Dose, medication, status, and refill plan." action={
              <div className="flex gap-2"><button className="btn btn-ghost btn-sm" onClick={() => { setDoseField(patient.dose); setModal("dose"); }}>Change Dose</button><button className="btn btn-primary btn-sm" onClick={() => { setIntakeStatus("Approved"); toast("Treatment approved"); logAudit("Approved treatment", "Treatment"); }}>Approve Treatment</button></div>}>
              <div className="flex gap-4 items-center bg-surface-2 border border-border rounded-2xl p-4 mb-4 flex-wrap">
                <div className="w-[60px] h-[60px] rounded-2xl bg-brand-soft flex items-center justify-center text-[26px]">💉</div>
                <div className="min-w-0">
                  <h3 className="text-[18px]">{patient.plan}</h3>
                  <div className="flex gap-1.5 mt-1"><Pill intent="purple">Weight Loss</Pill><Pill intent={intakeStatus === "Approved" ? "green" : "amber"}>{intakeStatus === "Approved" ? "Approved" : "Pending approval"}</Pill></div>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-3">
                    <Info k="Current dose" v={patient.dose} /><Info k="Route" v="Injection" /><Info k="Refills" v="2 planned" /><Info k="Next refill" v={patient.nextRefill} />
                  </div>
                </div>
              </div>
              <table className="w-full text-[12.5px]">
                <thead><tr className="bg-surface-2">{["Date", "Dose", "Status", "Provider", "Note"].map((h) => <th key={h} className="text-left text-[10px] uppercase tracking-wide text-ink-muted font-bold px-3 py-2 border-b border-border">{h}</th>)}</tr></thead>
                <tbody>
                  {doseHistory.map((d, i) => (
                    <tr key={i} className="border-b border-border last:border-none"><td className="px-3 py-2">{d.date}</td><td className="px-3 py-2 font-semibold">{d.dose}</td><td className="px-3 py-2"><Pill intent={d.status === "active" ? "green" : "blue"}>{d.status}</Pill></td><td className="px-3 py-2">{d.provider}</td><td className="px-3 py-2 text-ink-muted">{d.note}</td></tr>
                  ))}
                  {doseHistory.length === 0 && <tr><td colSpan={5} className="px-3 py-6 text-center text-ink-muted">No dose history yet.</td></tr>}
                </tbody>
              </table>
            </Card>
          )}

          {tab === "orders" && (
            <Card title="Patient Orders" sub="Current order plus history for this patient." action={<button className="btn btn-primary btn-sm" onClick={() => setOrderOpen(true)}>Create Order</button>}>
              {extra.orders.length === 0 && <div className="text-ink-muted text-[12.5px] py-6 text-center">No orders yet.</div>}
              {extra.orders.map((o) => (
                <div key={o.id} className="grid items-center gap-3 py-3 border-b border-surface-3 last:border-none" style={{ gridTemplateColumns: "1.1fr 1.4fr auto 1.2fr auto" }}>
                  <div><strong className="font-mono text-[12.5px]">{o.id}</strong><div className="text-[11px] text-ink-muted">{o.placedAt}</div></div>
                  <div><strong className="text-[12.5px]">{o.treatmentName}</strong><div className="text-[11px] text-ink-muted">{o.medSub}</div></div>
                  <Pill intent={o.shipmentStatus === "delivered" ? "green" : o.paid ? "blue" : "amber"}>{o.shipmentStatus}</Pill>
                  <div><strong className="text-[12px]">{o.price}</strong><div className="text-[11px] text-ink-muted">{o.pharmacy}</div></div>
                  <button className="btn btn-ghost btn-xs" onClick={() => toast(`Order ${o.id}`)}>Open</button>
                </div>
              ))}
            </Card>
          )}

          {tab === "weight" && (
            <Card title="Weight Progress" sub="Add updated weight and track progress over time.">
              <div className="grid md:grid-cols-[180px_1fr] gap-5 items-start">
                <div className="bg-surface-2 border border-border rounded-2xl p-4 text-center">
                  <div className="text-[11px] text-ink-muted">Current Weight</div>
                  <div className="text-[34px] font-extrabold leading-none my-1">{currentWeight}<span className="text-[15px] text-ink-muted font-bold"> lb</span></div>
                  <Pill intent="green">↓ {Math.round((patient.wtStart - currentWeight) * 10) / 10} lb from start</Pill>
                </div>
                <div>
                  <WeightChart weights={weights} />
                  <div className="flex gap-2 mt-3 flex-wrap">
                    <input value={newWeight} onChange={(e) => setNewWeight(e.target.value)} type="number" placeholder="New weight, e.g. 176" className="flex-1 min-w-[140px] border border-border rounded-[9px] px-3 py-2 text-[12.5px] bg-surface" />
                    <input value={weightNote} onChange={(e) => setWeightNote(e.target.value)} placeholder="Note, e.g. Week 5 check-in" className="flex-1 min-w-[140px] border border-border rounded-[9px] px-3 py-2 text-[12.5px] bg-surface" />
                    <button className="btn btn-primary btn-sm" onClick={addWeight}>Add Weight</button>
                  </div>
                </div>
              </div>
              <table className="w-full text-[12.5px] mt-4">
                <thead><tr className="bg-surface-2">{["Date", "Weight", "Change", "BMI", "Source", "Note"].map((h) => <th key={h} className="text-left text-[10px] uppercase tracking-wide text-ink-muted font-bold px-3 py-2 border-b border-border">{h}</th>)}</tr></thead>
                <tbody>
                  {weights.slice().reverse().map((w, i, arr) => {
                    const prev = arr[i + 1];
                    const change = prev ? Math.round((w.weight - prev.weight) * 10) / 10 : 0;
                    return <tr key={i} className="border-b border-border last:border-none"><td className="px-3 py-2">{w.date}</td><td className="px-3 py-2 font-semibold">{w.weight} lb</td><td className={`px-3 py-2 ${change < 0 ? "text-green" : change > 0 ? "text-red" : "text-ink-muted"}`}>{change === 0 ? "—" : `${change > 0 ? "+" : ""}${change}`}</td><td className="px-3 py-2">{bmiFor(w.weight)}</td><td className="px-3 py-2">{w.source}</td><td className="px-3 py-2 text-ink-muted">{w.note}</td></tr>;
                  })}
                </tbody>
              </table>
            </Card>
          )}

          {tab === "messages" && (
            <Card title="Messages" sub="Send messages and use quick templates." action={
              <div className="flex gap-2"><button className="btn btn-ghost btn-sm" onClick={() => insertTemplate("weight")}>Weight Request</button><button className="btn btn-ghost btn-sm" onClick={() => insertTemplate("refill")}>Refill Reminder</button></div>}>
              <div className="flex flex-col gap-2 mb-3">
                {msgList.map((m, i) => (
                  <div key={i} className="flex items-center gap-3 border border-border rounded-[10px] px-3 py-2.5"><Pill intent={m.intent}>{m.kind}</Pill><div className="min-w-0 flex-1"><strong className="text-[12.5px]">{m.title}</strong><div className="text-[11px] text-ink-muted truncate">{m.sub}</div></div><button className="btn btn-ghost btn-xs" onClick={() => setMsgOpen(true)}>View</button></div>
                ))}
              </div>
              <textarea value={msgBox} onChange={(e) => setMsgBox(e.target.value)} placeholder={`Write a message to ${patient.first}…`} className="w-full border border-border rounded-[9px] p-3 text-[12.5px] min-h-[90px] bg-surface" />
              <div className="flex gap-2 mt-2"><button className="btn btn-primary btn-sm" onClick={sendMessage}>Send Message</button><button className="btn btn-ghost btn-sm" onClick={() => setMsgOpen(true)}>Open message center</button></div>
            </Card>
          )}

          {tab === "documents" && (
            <Card title="Documents & ID" sub="ID, consent forms, intake PDFs, prescriptions, and invoices." action={<button className="btn btn-ghost btn-sm" onClick={() => setModal("id")}>View ID</button>}>
              <div className="grid md:grid-cols-2 gap-5">
                <div className="flex gap-3">
                  <div className="w-[96px] h-[64px] rounded-xl bg-surface-3 border border-border flex items-center justify-center text-[24px] shrink-0">🪪</div>
                  <div>
                    <h3 className="text-[14px]">{patient.state} Driver License</h3>
                    <div className="text-[11px] text-ink-muted">Uploaded {patient.since} · {idVerified ? "Name, DOB & state match profile." : "Pending verification."}</div>
                    <div className="flex gap-1.5 mt-1.5"><Pill intent={idVerified ? "green" : "amber"}>{idVerified ? "Verified" : "Pending"}</Pill><Pill intent="blue">Front Image</Pill></div>
                    <label className="btn btn-ghost btn-sm mt-2 cursor-pointer">Upload / Replace ID<input type="file" accept="image/*" className="hidden" onChange={() => { toast("ID image selected"); logAudit("Selected replacement ID", "Documents"); }} /></label>
                  </div>
                </div>
                <div className="flex flex-col gap-2">
                  {extra.documents.map((d, i) => (
                    <div key={i} className="flex items-center gap-3 border border-border rounded-[10px] px-3 py-2.5"><div className="min-w-0 flex-1"><strong className="text-[12px] truncate block">{d.name}</strong><div className="text-[11px] text-ink-muted">{d.type} · {d.date} · {d.size}</div></div><button className="btn btn-ghost btn-xs" onClick={() => toast(`Open ${d.name}`)}>Open</button></div>
                  ))}
                  {extra.documents.length === 0 && <div className="text-ink-muted text-[12px] py-4 text-center">No documents yet.</div>}
                </div>
              </div>
            </Card>
          )}

          {tab === "billing" && (
            <Card title="Billing" sub="Invoices, subscription, and payment method." action={<button className="btn btn-ghost btn-sm" onClick={() => toast("Update payment")}>Update Payment</button>}>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
                <Info k="Subscription" v={patient.plan} /><Info k="Payment Method" v="Card on file" /><Info k="Billing Status" v={patient.status === "active" ? "Active" : "Inactive"} /><Info k="Next Charge" v={patient.nextRefill} />
              </div>
              <table className="w-full text-[12.5px]">
                <thead><tr className="bg-surface-2">{["Invoice", "Date", "Plan", "Amount", "Status"].map((h) => <th key={h} className="text-left text-[10px] uppercase tracking-wide text-ink-muted font-bold px-3 py-2 border-b border-border">{h}</th>)}</tr></thead>
                <tbody>
                  {extra.invoices.map((inv) => (
                    <tr key={inv.id} className="border-b border-border last:border-none"><td className="px-3 py-2 font-mono text-[11.5px]">{inv.id}</td><td className="px-3 py-2">{inv.date}</td><td className="px-3 py-2">{inv.plan}</td><td className="px-3 py-2 font-bold">{inv.amount}</td><td className="px-3 py-2"><Pill intent="green">{inv.status}</Pill></td></tr>
                  ))}
                  {extra.invoices.length === 0 && <tr><td colSpan={5} className="px-3 py-6 text-center text-ink-muted">No invoices yet.</td></tr>}
                </tbody>
              </table>
            </Card>
          )}

          {tab === "admin" && (
            <Card title="Admin / Audit Log" sub="Internal activity and compliance trail." action={<button className="btn btn-ghost btn-sm" onClick={() => toast("Export log")}>Export Log</button>}>
              <table className="w-full text-[12.5px]">
                <thead><tr className="bg-surface-2">{["Time", "User", "Action", "Area", "Device"].map((h) => <th key={h} className="text-left text-[10px] uppercase tracking-wide text-ink-muted font-bold px-3 py-2 border-b border-border">{h}</th>)}</tr></thead>
                <tbody>{audit.map((a, i) => (<tr key={i} className="border-b border-border last:border-none"><td className="px-3 py-2 whitespace-nowrap">{a.time}</td><td className="px-3 py-2">{a.user}</td><td className="px-3 py-2">{a.action}</td><td className="px-3 py-2">{a.area}</td><td className="px-3 py-2 text-ink-muted">{a.device}</td></tr>))}</tbody>
              </table>
            </Card>
          )}
        </div>

        <aside className="flex flex-col gap-4">
          <Card title="Next action">
            <p className="text-[12px] text-ink-muted mb-3">{intakeIncomplete ? "Patient is still completing intake." : reviewNeeded ? "Review intake and medication history before creating a prescription." : "Patient is active — keep refills and check-ins on track."}</p>
            <button className="btn btn-primary w-full" onClick={() => setTab(intakeIncomplete ? "intake" : reviewNeeded ? "intake" : "weight")}>{nextAction}</button>
          </Card>
          <Card title="Clinical snapshot">
            <SideRow k="Start weight" v={`${patient.wtStart} lb`} />
            <SideRow k="Current weight" v={`${currentWeight} lb`} ok />
            <SideRow k="Total lost" v={`${Math.round((patient.wtStart - currentWeight) * 10) / 10} lb`} ok />
            <SideRow k="ID status" v={idVerified ? "Verified" : "Pending"} ok={idVerified} />
            <SideRow k="Refill due" v={patient.nextRefill} />
          </Card>
          <Card title="Safety flags">
            {patient.allergies && patient.allergies !== "None" ? <AlertBox tone="amber" icon="!" title="Allergies on file" body={patient.allergies} /> : <AlertBox tone="green" icon="✓" title="No allergies" body="None reported on intake." />}
            <AlertBox tone="green" icon="✓" title="Consent complete" body="Telehealth consent on file." />
            <AlertBox tone={idVerified ? "green" : "amber"} icon={idVerified ? "✓" : "!"} title={idVerified ? "ID verified" : "ID pending"} body={idVerified ? "Identity confirmed." : "Verification needed."} />
          </Card>
          <Card title="Quick actions">
            <div className="grid grid-cols-2 gap-2">
              <button className="btn btn-ghost btn-sm" onClick={() => setTab("weight")}>Add Weight</button>
              <button className="btn btn-ghost btn-sm" onClick={() => setMsgOpen(true)}>Message</button>
              <button className="btn btn-ghost btn-sm" onClick={() => setRxOpen(true)}>Create Rx</button>
              <button className="btn btn-ghost btn-sm" onClick={() => setModal("note")}>Add Note</button>
              <button className="btn btn-ghost btn-sm" onClick={() => setModal("id")}>View ID</button>
              <button className="btn btn-ghost btn-sm" onClick={() => setOrderOpen(true)}>Order</button>
            </div>
          </Card>
        </aside>
      </div>

      <NewOrderModal patient={patient} open={orderOpen} onClose={() => setOrderOpen(false)} />
      <NewPrescriptionModal patient={patient} open={rxOpen} onClose={() => setRxOpen(false)} />
      <PatientMessageCenter patient={patient} open={msgOpen} onClose={() => setMsgOpen(false)} />

      {modal === "note" && (
        <Modal title="Add Chart Note" onClose={() => setModal(null)} onSave={saveNote} saveLabel="Add Note">
          <label className="text-[11px] font-bold uppercase tracking-wide text-ink-muted">Note type</label>
          <select value={noteType} onChange={(e) => setNoteType(e.target.value)} className="w-full border border-border rounded-[9px] px-3 py-2 text-[12.5px] bg-surface mt-1 mb-3">{["Admin Note", "Provider Note", "Support Note", "Billing Note"].map((o) => <option key={o}>{o}</option>)}</select>
          <label className="text-[11px] font-bold uppercase tracking-wide text-ink-muted">Note</label>
          <textarea value={noteText} onChange={(e) => setNoteText(e.target.value)} placeholder="Write chart note…" className="w-full border border-border rounded-[9px] p-3 text-[12.5px] min-h-[100px] bg-surface mt-1" />
        </Modal>
      )}
      {modal === "dose" && (
        <Modal title="Change Dose" onClose={() => setModal(null)} onSave={saveDose} saveLabel="Update Dose">
          <label className="text-[11px] font-bold uppercase tracking-wide text-ink-muted">New dose</label>
          <select value={doseField} onChange={(e) => setDoseField(e.target.value)} className="w-full border border-border rounded-[9px] px-3 py-2 text-[12.5px] bg-surface mt-1 mb-3">{["0.25 mg weekly", "0.5 mg weekly", "1.0 mg weekly", "1.7 mg weekly", "2.4 mg weekly"].map((o) => <option key={o}>{o}</option>)}</select>
          <label className="text-[11px] font-bold uppercase tracking-wide text-ink-muted">Reason / note</label>
          <textarea value={doseNote} onChange={(e) => setDoseNote(e.target.value)} placeholder="Reason for dose change…" className="w-full border border-border rounded-[9px] p-3 text-[12.5px] min-h-[80px] bg-surface mt-1" />
        </Modal>
      )}
      {modal === "profile" && (
        <Modal title="Edit Patient Profile" onClose={() => setModal(null)} onSave={saveProfile} saveLabel="Save Profile">
          <div className="grid gap-2">
            <input value={profile.name} onChange={(e) => setProfile({ ...profile, name: e.target.value })} placeholder="Name" className="border border-border rounded-[9px] px-3 py-2 text-[12.5px] bg-surface" />
            <input value={profile.email} onChange={(e) => setProfile({ ...profile, email: e.target.value })} placeholder="Email" className="border border-border rounded-[9px] px-3 py-2 text-[12.5px] bg-surface" />
            <input value={profile.phone} onChange={(e) => setProfile({ ...profile, phone: e.target.value })} placeholder="Phone" className="border border-border rounded-[9px] px-3 py-2 text-[12.5px] bg-surface" />
          </div>
        </Modal>
      )}
      {modal === "id" && (
        <Modal title="Patient ID" onClose={() => setModal(null)} onSave={() => { toast("ID verified"); setModal(null); }} saveLabel="Mark Verified">
          <div className="flex gap-3">
            <div className="w-[200px] h-[126px] rounded-xl bg-surface-3 border border-border flex items-center justify-center text-[40px] shrink-0">🪪</div>
            <div className="text-[12px] text-ink-muted leading-relaxed">
              <h3 className="text-[14px] text-ink mb-1">{patient.state} Driver License</h3>
              Status: {idVerified ? "Verified" : "Pending"}<br />Name: {patient.name}<br />State: {patient.state}<br />Gov ID: {extra.govId}
              <div className="flex gap-1.5 mt-2"><Pill intent={idVerified ? "green" : "amber"}>{idVerified ? "Verified" : "Pending"}</Pill><Pill intent="blue">Front image on file</Pill></div>
            </div>
          </div>
        </Modal>
      )}

      <Toast />
    </div>
  );
}

function Dot() { return <span className="w-1 h-1 rounded-full bg-border inline-block" />; }
function Metric({ label, value, sub, color = "text-ink" }: { label: string; value: string; sub: string; color?: string }) {
  return (
    <div className="bg-surface border border-border rounded-2xl px-4 py-3">
      <div className="text-[10px] font-bold uppercase tracking-wide text-ink-muted">{label}</div>
      <div className={`text-[22px] font-extrabold tracking-tight leading-none mt-1 ${color}`}>{value}</div>
      <div className="text-[11px] text-ink-muted mt-0.5">{sub}</div>
    </div>
  );
}
function Card({ title, sub, action, children }: { title: string; sub?: string; action?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="bg-surface border border-border rounded-2xl">
      <div className="flex items-start justify-between gap-3 px-4 py-3.5 border-b border-border">
        <div><h2>{title}</h2>{sub && <div className="text-[12px] text-ink-muted mt-0.5">{sub}</div>}</div>
        {action}
      </div>
      <div className="p-4">{children}</div>
    </div>
  );
}
function Info({ k, v }: { k: string; v: string }) {
  return <div><div className="text-[10px] uppercase tracking-wide text-ink-muted font-bold">{k}</div><strong className="text-[12.5px] font-semibold">{v}</strong></div>;
}
function Qr({ k, v }: { k: string; v: string }) {
  return <tr className="border-b border-surface-3 last:border-none"><td className="py-1.5 pr-3 font-semibold align-top w-[42%]">{k}</td><td className="py-1.5 text-ink-2">{v}</td></tr>;
}
function AlertBox({ tone, icon, title, body }: { tone: "green" | "amber" | "red"; icon: string; title: string; body: string }) {
  const cls = tone === "green" ? "bg-green-soft text-green" : tone === "amber" ? "bg-amber-soft text-amber" : "bg-red-soft text-red";
  return (
    <div className="flex gap-2.5 items-start py-2 first:pt-0">
      <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[11px] font-bold shrink-0 ${cls}`}>{icon}</span>
      <div><strong className="text-[12.5px]">{title}</strong><div className="text-[11.5px] text-ink-muted">{body}</div></div>
    </div>
  );
}
function SideRow({ k, v, ok }: { k: string; v: string; ok?: boolean }) {
  return <div className="flex items-center justify-between py-[5px] text-[12px] border-b border-surface-3 last:border-none"><span className="text-ink-muted">{k}</span><span className={`font-semibold ${ok === undefined ? "text-ink" : ok ? "text-green" : "text-amber"}`}>{v}</span></div>;
}
function Modal({ title, children, onClose, onSave, saveLabel }: { title: string; children: React.ReactNode; onClose: () => void; onSave: () => void; saveLabel: string }) {
  return (
    <>
      <div className="fixed inset-0 z-[60] bg-[rgba(28,40,60,.32)]" onClick={onClose} />
      <div className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-[61] w-[460px] max-w-[calc(100vw-32px)] bg-surface border border-border rounded-2xl shadow-2xl flex flex-col max-h-[88vh]">
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-border"><h3 className="text-[15px] font-extrabold">{title}</h3><button onClick={onClose} className="text-[18px] text-ink-muted hover:text-ink leading-none">✕</button></div>
        <div className="p-5 overflow-y-auto">{children}</div>
        <div className="flex justify-end gap-2 px-5 py-3.5 border-t border-border"><button className="btn btn-ghost btn-sm" onClick={onClose}>Cancel</button><button className="btn btn-primary btn-sm" onClick={onSave}>{saveLabel}</button></div>
      </div>
    </>
  );
}
function WeightChart({ weights }: { weights: WeightEntry[] }) {
  if (weights.length < 2) return <div className="h-[130px] rounded-xl bg-surface-2 border border-border flex items-center justify-center text-ink-muted text-[12px]">Add a weight to see the trend.</div>;
  const vals = weights.map((w) => w.weight);
  const min = Math.min(...vals) - 2, max = Math.max(...vals) + 2;
  const W = 520, H = 120;
  const pts = weights.map((w, i) => { const x = (i / (weights.length - 1)) * W; const y = H - ((w.weight - min) / (max - min || 1)) * (H - 12) - 6; return [x, y] as const; });
  const line = pts.map((p, i) => `${i === 0 ? "M" : "L"}${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(" ");
  const area = `${line} L${W},${H} L0,${H} Z`;
  return (
    <div className="rounded-xl bg-surface-2 border border-border p-3">
      <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" className="w-full h-[120px]">
        <path d={area} fill="var(--color-brand-soft)" />
        <path d={line} fill="none" stroke="var(--color-brand)" strokeWidth={2.5} strokeLinejoin="round" strokeLinecap="round" />
        {pts.map((p, i) => <circle key={i} cx={p[0]} cy={p[1]} r={3} fill="var(--color-brand-dk)" />)}
      </svg>
    </div>
  );
}
