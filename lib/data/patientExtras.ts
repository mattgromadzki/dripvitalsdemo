import type { Patient, PatientExtra } from "@/lib/types";

/**
 * Synthesizes the rich chart data (visits, labs, orders, etc.) for a patient.
 * In production this would come from your database. Here it's deterministic
 * per-patient so the chart looks consistent across renders.
 */
export function getPatientExtra(p: Patient): PatientExtra {
  // Stable pseudo-random based on patient ID — same patient gets same numbers
  const seed = p.id.charCodeAt(p.id.length - 1) + p.id.charCodeAt(p.id.length - 2);
  const goalWt = p.goalWt ?? Math.max(p.wt - 20, Math.round(p.wt * 0.85));
  const streakWeeks = Math.max(1, Math.min(p.week, (seed % 12) + 4));
  const riskScore = p.status === "active"
    ? 70 + (seed % 25)              // 70-94
    : p.status === "unpaid"
    ? 40 + (seed % 20)              // 40-59
    : 50 + (seed % 20);             // 50-69
  const riskLabel = riskScore >= 80 ? "Low" : riskScore >= 60 ? "Moderate" : "High";

  // Address — use the real captured address when present; synthesize only for
  // demo seed patients that have no address on file.
  const STREETS = ["Ocean Drive", "Bayview Ave", "Sunset Blvd", "Park St", "Coral Way", "Magnolia Ln"];
  const CITIES: Record<string, string> = { FL: "Miami", GA: "Atlanta", TX: "Austin", CA: "Los Angeles", NY: "New York" };
  const street = p.address || `${100 + (seed * 7) % 9900} ${STREETS[seed % STREETS.length]}`;
  const city = p.city || CITIES[p.state] || "Miami";
  const zip = p.zip || String(10000 + (seed * 131) % 89999).slice(0, 5);

  // Side effects — patients with "Urgent" tags get a moderate unresolved one
  const hasUrgent = (p.tags || []).some((t) => t.toLowerCase().startsWith("urgent"));
  const sideEffects = hasUrgent
    ? [
        { sx: "Severe nausea after dose increase", severity: "moderate" as const, resolved: false, date: "2026-05-08" },
        { sx: "Mild headache (week 2)",            severity: "mild"     as const, resolved: true,  date: "2026-02-12" },
      ]
    : p.week > 4
    ? [{ sx: "Mild nausea (week 1-2)", severity: "mild" as const, resolved: true, date: "2026-02-01" }]
    : [];

  // Visits — generate 4 representative visits scaled to patient week
  const visits = p.week > 0 ? [
    { date: p.lastVisit,    type: "Follow-up", provider: p.provider,    notes: "Routine check-in. Patient reports good adherence.", duration: 20 },
    { date: "Apr 7, 2026",  type: "Lab Review",provider: p.provider,    notes: "Reviewed quarterly bloodwork. A1C improving.",         duration: 15 },
    { date: "Mar 10, 2026", type: "Follow-up", provider: p.provider,    notes: "Adjusted dose schedule. Continued progress.",          duration: 25 },
    { date: p.since,        type: "Intake",    provider: p.provider,    notes: "Initial consultation. Started on GLP-1 protocol.",     duration: 45 },
  ] : [];

  // Labs — couple of recent panels
  const labs = p.week > 4 ? [
    { date: "Apr 7, 2026", name: "HbA1c",              value: (p.a1c || 6.5).toFixed(1) + "%", flag: (p.a1c && p.a1c > 7 ? "high" : "normal") as "normal" | "high", ordered_by: p.provider },
    { date: "Apr 7, 2026", name: "LDL Cholesterol",    value: String(110 + (seed % 60)) + " mg/dL", flag: ((110 + (seed % 60)) > 130 ? "high" : "normal") as "normal" | "high", ordered_by: p.provider },
    { date: "Apr 7, 2026", name: "Fasting Glucose",    value: String(85 + (seed % 30)) + " mg/dL", flag: "normal" as const, ordered_by: p.provider },
    { date: "Apr 7, 2026", name: "Thyroid Panel (TSH)",value: (1.5 + (seed % 5) * 0.3).toFixed(1) + " mIU/L", flag: "normal" as const, ordered_by: p.provider },
    { date: "Jan 20, 2026",name: "Comprehensive Metabolic Panel", value: "Within normal limits", flag: "normal" as const, ordered_by: p.provider },
  ] : [];

  // Prescriptions
  const prescriptions = p.dose !== "—" ? [
    { id: `RX-${p.id.slice(3)}A`, med: p.plan.split(" ").slice(-1)[0], dose: p.dose, refills: 2, prescribed: p.startDate, status: "active" as const, prescribedBy: p.provider },
  ] : [];

  // Orders — synthesize 2-4 orders based on week count
  const overdue = (p._refillDays || 0) < 0;
  const orders = p.week > 0 ? [
    {
      id: `ORD-${p.id.slice(3)}04`,
      treatmentName: p.plan, medSub: p.dose,
      placedAt: "May 28, 2026", qty: "1-mo supply", price: p.sub,
      pharmacy: "Partner Network FL",
      shipmentStatus: "paid" as const,
      paid: true, approved: false,
      address: `${street}, ${city}, ${p.state} ${zip}`,
    },
    {
      id: `ORD-${p.id.slice(3)}03`,
      treatmentName: p.plan, medSub: p.dose,
      placedAt: p.lastOrder, qty: "1-mo supply", price: p.sub,
      pharmacy: "Partner Network FL",
      shipmentStatus: overdue ? "delivered" as const : "in_transit" as const,
      tracking: overdue ? "1Z999AA10123456784" : "1Z999AA10123456785",
      eta: overdue ? "Delivered Apr 28" : "May 14, 2026",
      paid: true, approved: true,
      address: `${street}, ${city}, ${p.state} ${zip}`,
    },
    {
      id: `ORD-${p.id.slice(3)}02`,
      treatmentName: p.plan, medSub: p.dose,
      placedAt: "Apr 7, 2026", qty: "1-mo supply", price: p.sub,
      pharmacy: "Partner Network FL",
      shipmentStatus: "delivered" as const,
      tracking: "1Z999AA10123456783",
      eta: "Delivered Apr 12", paid: true, approved: true,
      address: `${street}, ${city}, ${p.state} ${zip}`,
    },
  ] : p.status === "unpaid" ? [
    {
      id: `ORD-${p.id.slice(3)}01`,
      treatmentName: "Pending qualification", medSub: "Awaiting payment",
      placedAt: p.since, qty: undefined, price: "$199",
      pharmacy: "—",
      shipmentStatus: "placed" as const,
      paid: false, approved: false,
    },
  ] : [];

  // ── Phase 1B synthesized data ──────────────────────────────────────────

  // Scheduled future visits (0-2 entries based on activity)
  const scheduledVisits = p.status === "active" ? [
    { id: `VIS-${p.id.slice(3)}1`, type: "Follow-up", time: "Tomorrow 10:00 AM", provider: p.provider, status: "scheduled" as const },
    ...(hasUrgent ? [{ id: `VIS-${p.id.slice(3)}2`, type: "Urgent: Side Effects Review", time: "Today 4:30 PM", provider: p.provider, status: "urgent" as const }] : []),
  ] : [];

  // SOAP notes — recent ones tied to past visits
  const soapNotes = p.week > 0 ? [
    { id: 100 + (seed % 100), type: "Follow-up Note", date: p.lastVisit, status: "signed" as const },
    { id: 101 + (seed % 100), type: "Intake Assessment", date: p.since, status: "signed" as const },
    ...(p.week > 10 ? [{ id: 102 + (seed % 100), type: "Progress Review", date: "Mar 10, 2026", status: "signed" as const }] : []),
  ] : [];

  // Weight log — synthesize a smooth descent from wtStart to wt
  const weeks = Math.max(1, p.week);
  const startW = p.wtStart || p.wt;
  const currentW = p.wt;
  const weightLog: number[] = [];
  const weightDates: string[] = [];
  const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  // Start at the program start, sample weekly up to current week
  const startDate = new Date(p.startDate || "2026-01-01");
  for (let w = 0; w <= weeks; w++) {
    const t = w / weeks;
    // Add slight noise so the curve isn't dead-straight
    const noise = (((seed * (w + 1)) % 17) - 8) * 0.15;
    const val = startW - (startW - currentW) * t + noise;
    weightLog.push(Math.round(val * 10) / 10);
    const d = new Date(startDate.getTime() + w * 7 * 86400000);
    weightDates.push(`${MONTHS[d.getMonth()]} ${d.getDate()}`);
  }

  // Milestones — earned at specific weight-loss thresholds
  const lostLbs = startW - currentW;
  const milestones: string[] = [];
  if (lostLbs >= 5)  milestones.push("First 5 lbs lost");
  if (lostLbs >= 10) milestones.push("10 lbs milestone");
  if (lostLbs >= 15) milestones.push("15 lbs milestone");
  if (lostLbs >= 20) milestones.push("20 lbs milestone");
  if (streakWeeks >= 8)  milestones.push("8-week injection streak");
  if (streakWeeks >= 12) milestones.push("12-week perfect adherence");

  // Weekly check-ins — last 4 weeks
  const weeklyCheckins: PatientExtra["weeklyCheckins"] = [];
  for (let i = 0; i < Math.min(4, weeks); i++) {
    const wk = weeks - i;
    const r = (seed + wk) % 5;
    weeklyCheckins.push({
      week: wk,
      nausea:   Math.max(1, Math.min(5, 2 + ((r * 3) % 3) - (i === 0 ? 0 : 1))),
      energy:   Math.max(1, Math.min(5, 3 + (r % 3))),
      appetite: Math.max(1, Math.min(5, 3 + ((r + 1) % 3))),
      mood:     Math.max(1, Math.min(5, 4 - ((r + 2) % 2))),
      adherence: (r + i) % 7 !== 0,
    });
  }

  // Messages — synthesize a short thread for active patients
  const messages: PatientExtra["messages"] = p.status === "active" ? [
    { from: p.first,      text: hasUrgent ? "Hi Dr. Rivera, I've been having severe nausea since increasing the dose. What should I do?" : "Quick question about timing my injection — is morning or evening better?", time: "2 days ago", me: false },
    { from: "Dr. Rivera", text: hasUrgent ? "I'm sorry to hear that. Let's reduce the dose back to your previous level and reassess in 2 weeks. I'll send a message to the pharmacy." : "Either works! Most patients find evening reduces nausea. Consistency matters most — pick one and stick with it.", time: "2 days ago", me: true },
    { from: p.first,      text: hasUrgent ? "Thank you. Should I skip this week's injection?" : "Got it, thanks!", time: "1 day ago", me: false },
    ...(hasUrgent ? [{ from: "Dr. Rivera", text: "Yes — skip this week, resume next week at the lower dose. Call the office if symptoms persist.", time: "1 day ago", me: true }] : []),
  ] : [];

  // Support tickets — most patients have 0-1
  const supportNotes = (seed % 3 === 0) ? [
    { agent: "Maria (Support)", date: "Apr 22, 2026", note: "Patient called regarding shipping delay. Order was rerouted; ETA pushed by 2 days. Patient OK with new arrival." },
  ] : [];

  // Invoice history — synthesize 3-6 invoices for active patients
  const invoices: PatientExtra["invoices"] = [];
  if (p.status === "active" && p.sub !== "—") {
    const months = Math.min(6, Math.floor(weeks / 4) + 1);
    for (let i = 0; i < months; i++) {
      const d = new Date();
      d.setMonth(d.getMonth() - i);
      invoices.push({
        id: `INV-${String(20260 - i).slice(0, 4)}-${String((seed * 13 + i) % 9999).padStart(4, "0")}`,
        date: `${MONTHS[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}`,
        amount: p.sub.replace(/\/.*$/, ""),
        plan: p.plan,
        status: "paid" as const,
      });
    }
  }

  // ── Phase 1C: Documents ────────────────────────────────────────────────
  // Documents — collected over time, synthesized from the patient's journey
  const documents: PatientExtra["documents"] = [];
  if (p.status !== "unpaid" && p.status !== "disqualified") {
    documents.push({ name: "Intake_Consent_Signed.pdf",        type: "Consent Form",     date: p.since,        size: "284 KB" });
    documents.push({ name: "Drivers_License_Front.jpg",        type: "ID Verification",  date: p.since,        size: "1.2 MB" });
    documents.push({ name: "Telehealth_Consent.pdf",           type: "Consent Form",     date: p.since,        size: "198 KB" });
  }
  if (p.week > 4) {
    documents.push({ name: "Lab_Report_Q1.pdf",                type: "Lab Report",       date: "Apr 7, 2026",  size: "412 KB" });
    documents.push({ name: `${p.plan.split(" ").slice(-1)[0]}_Rx_${p.id.slice(3)}.pdf`, type: "Prescription", date: p.startDate, size: "92 KB" });
  }
  if (p.week > 8) {
    documents.push({ name: "Progress_Photo_Wk8.jpg",           type: "Progress Photo",   date: "Mar 15, 2026", size: "2.4 MB" });
  }
  if (p.status === "active") {
    documents.push({ name: "Insurance_Card_Front.jpg",         type: "Insurance",        date: p.since,        size: "986 KB" });
  }

  // ── Phase 1C: Consent History ──────────────────────────────────────────
  const consentHistory: PatientExtra["consentHistory"] = [];
  if (p.status !== "disqualified") {
    const ip = `73.${(seed * 7) % 255}.${(seed * 11) % 255}.${(seed * 13) % 255}`;
    const device = ["iPhone (iOS 18)", "Android Phone", "MacBook Safari", "Windows Chrome"][seed % 4];
    consentHistory.push({ form: "Telehealth Consent",         signed: `${p.since} 10:24 AM`, ip, device });
    consentHistory.push({ form: "HIPAA Authorization",        signed: `${p.since} 10:25 AM`, ip, device });
    consentHistory.push({ form: "Financial Agreement",        signed: `${p.since} 10:26 AM`, ip, device });
    consentHistory.push({ form: "GLP-1 Risk Acknowledgment",  signed: `${p.since} 10:27 AM`, ip, device });
    consentHistory.push({ form: "Photo Release",              signed: `${p.since} 10:28 AM`, ip, device });
  }

  return {
    dob: p.dob || deriveDOB(p.age),
    gender: p.gender === "F" ? "Female" : p.gender === "M" ? "Male" : "Non-binary",
    careCoordinator: p.week === 0 ? "Unassigned" : ["Jordan Blake", "Taylor Nguyen", "Sam Rivera", "Casey Morgan", "Riley Chen"][seed % 5],
    lastLogin: p.week === 0 ? "Never" : ["Today, 9:14 AM", "Yesterday, 7:02 PM", "May 29, 2026", "May 27, 2026", "May 24, 2026"][seed % 5],
    govId: `***-**-${String(seed * 7).padStart(4, "0").slice(0, 4)}`,
    idVerified: p.status === "active" || p.status === "inactive",
    goalWt,
    streakWeeks,
    riskScore,
    riskLabel,
    sideEffects,
    address: { street, line2: p.apt || "", city, state: p.state, zip },
    insurance: p.status === "active" ? {
      carrier: ["BlueCross BlueShield", "Aetna", "United Healthcare", "Cigna"][seed % 4],
      memberId: `MEM${String(seed * 1337).slice(0, 9)}`,
      group: `GRP${(seed * 7) % 99999}`,
    } : undefined,
    emergencyContact: { name: "Family Contact", relationship: ["Spouse","Parent","Sibling"][seed % 3], phone: p.phone.replace(/\d{2}\)/, "00)") },
    visits, labs, prescriptions, orders,
    scheduledVisits, soapNotes,
    weightLog, weightDates, milestones, weeklyCheckins,
    messages, supportNotes, invoices,
    documents, consentHistory,
  };
}

function deriveDOB(age: number): string {
  if (!age) return "—";
  const year = 2026 - age;
  const m = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
  const month = m[(age * 7) % 12];
  const day = ((age * 13) % 28) + 1;
  return `${month} ${day}, ${year}`;
}
