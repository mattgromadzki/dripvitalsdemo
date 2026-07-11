"use client";

import { useState, useEffect, useMemo, useRef } from "react";
import { createPortal } from "react-dom";
import type { ReactNode } from "react";
import { toast } from "@/lib/hooks/useToast";
import { useTreatmentsIntake, monthlyEquivalent } from "@/lib/hooks/useTreatmentsIntake";
import { usePatientAuth } from "@/lib/hooks/usePatientAuth";
import { usePatients } from "@/lib/hooks/usePatients";
import type { BaskQuestion, BaskTreatment, BaskBillingCycle } from "@/lib/types/treatmentsIntake";
import { disqualifierReason } from "@/lib/clinical/glp1Screening";
import { consentsFor } from "@/lib/legal/documents";
import { fetchSuggestions, cleanStreet } from "@/lib/usps/autocomplete";
import { compressImageFile } from "@/lib/images/idImage";
import type { AddressSuggestion } from "@/lib/usps/types";

function nowStamp(): string {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;
}

// Full state names with their 2-letter value (value stays the abbr for downstream routing).
const US_STATES: { abbr: string; name: string }[] = [
  ["AL","Alabama"],["AK","Alaska"],["AZ","Arizona"],["AR","Arkansas"],["CA","California"],["CO","Colorado"],["CT","Connecticut"],["DE","Delaware"],["DC","District of Columbia"],["FL","Florida"],["GA","Georgia"],["HI","Hawaii"],["ID","Idaho"],["IL","Illinois"],["IN","Indiana"],["IA","Iowa"],["KS","Kansas"],["KY","Kentucky"],["LA","Louisiana"],["ME","Maine"],["MD","Maryland"],["MA","Massachusetts"],["MI","Michigan"],["MN","Minnesota"],["MS","Mississippi"],["MO","Missouri"],["MT","Montana"],["NE","Nebraska"],["NV","Nevada"],["NH","New Hampshire"],["NJ","New Jersey"],["NM","New Mexico"],["NY","New York"],["NC","North Carolina"],["ND","North Dakota"],["OH","Ohio"],["OK","Oklahoma"],["OR","Oregon"],["PA","Pennsylvania"],["RI","Rhode Island"],["SC","South Carolina"],["SD","South Dakota"],["TN","Tennessee"],["TX","Texas"],["UT","Utah"],["VT","Vermont"],["VA","Virginia"],["WA","Washington"],["WV","West Virginia"],["WI","Wisconsin"],["WY","Wyoming"],
].map(([abbr, name]) => ({ abbr, name }));

// Sentinel answer for a required upload the patient chose to send later.
export const SUBMIT_LATER = "__SUBMIT_LATER__";

// Format a phone number as (305) 555-0123.
function formatPhone(s: string): string {
  const d = (s || "").replace(/\D/g, "").slice(0, 10);
  if (d.length < 4) return d;
  if (d.length < 7) return `(${d.slice(0, 3)}) ${d.slice(3)}`;
  return `(${d.slice(0, 3)}) ${d.slice(3, 6)}-${d.slice(6)}`;
}

// Detect a "full legal name" question (rendered as First + Last boxes).
const isFullNameQ = (q: BaskQuestion) => q.type === "text" && /name/i.test(q.text) && /(full|legal)/i.test(q.text);

type PatientStage = "welcome" | "question" | "treatment" | "disqualified" | "checkout" | "success";

function renderShell(opts: {
  children: ReactNode;
  hideBack?: boolean;
  mounted: boolean;
  onBack: () => void;
  flowPct: number;
  formName?: string;
}): ReactNode {
  if (!opts.mounted) return null;
  return createPortal(
    <div className="dv-patient">
      <div className="dv-header">
        {opts.hideBack ? <span /> : (
          <button className="dv-back" onClick={opts.onBack}>
            <span className="dv-back-icon">‹</span> Back
          </button>
        )}
        <div style={{ textAlign: "center" }}>
          <div className="dv-logo">DripVitals</div>
          {opts.formName && (
            <div style={{ fontSize: 11, color: "var(--dv-muted)", letterSpacing: 0.4, marginTop: 2, textTransform: "uppercase", fontWeight: 500 }}>
              {opts.formName}
            </div>
          )}
        </div>
        <span />
      </div>
      <div className="dv-progress">
        <div className="dv-progress-track"><div className="dv-progress-fill" style={{ width: `${opts.flowPct}%` }} /></div>
      </div>
      <div className="dv-main">{opts.children}</div>
    </div>,
    document.body
  );
}

/** Shared patient intake flow — used by the admin Preview and the public /intake-form/[slug] route. */
type IntakeAddr = { line1: string; line2: string; city: string; state: string; zip: string };

// Address step with type-ahead suggestions (same Smarty-backed source the
// patient portal uses). Controlled internally so picking a suggestion can fill
// city / state / ZIP in one tap. Degrades to plain typing if lookup is offline.
function IntakeAddressField({ initial, onChange }: { initial: IntakeAddr; onChange: (a: IntakeAddr) => void }) {
  const [addr, setAddr] = useState<IntakeAddr>(initial);
  const [sug, setSug] = useState<AddressSuggestion[]>([]);
  const [showSug, setShowSug] = useState(false);
  const tRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  function update(patch: Partial<IntakeAddr>) {
    const next = { ...addr, ...patch };
    setAddr(next);
    onChange(next);
  }
  function onStreet(v: string) {
    update({ line1: v });
    if (tRef.current) clearTimeout(tRef.current);
    if (v.trim().length < 3) { setSug([]); setShowSug(false); return; }
    tRef.current = setTimeout(async () => {
      const r = await fetchSuggestions(v, addr.state || undefined);
      setSug(r); setShowSug(r.length > 0);
    }, 180);
  }
  function pick(s: AddressSuggestion) {
    const next: IntakeAddr = { ...addr, line1: cleanStreet(s.street), city: s.city, state: s.state, zip: s.zip };
    setAddr(next); onChange(next); setShowSug(false); setSug([]);
  }

  return (
    <div className="dv-fields">
      <div style={{ position: "relative" }}>
        <div className="dv-field-label">Street address</div>
        <div className="dv-input-wrap">
          <input className="dv-input" value={addr.line1} autoComplete="off" placeholder="Start typing your address…"
            onChange={(e) => onStreet(e.target.value)}
            onFocus={() => { if (sug.length) setShowSug(true); }}
            onBlur={() => setTimeout(() => setShowSug(false), 150)} />
        </div>
        {showSug && sug.length > 0 && (
          <div style={{ position: "absolute", zIndex: 60, left: 0, right: 0, top: "100%", marginTop: 4, background: "#fff", border: "1px solid var(--dv-border, #dde3e8)", borderRadius: 10, boxShadow: "0 12px 32px rgba(20,30,50,.18)", overflow: "hidden" }}>
            {sug.map((s, i) => (
              <button type="button" key={i} onMouseDown={() => pick(s)} style={{ display: "block", width: "100%", textAlign: "left", padding: "10px 12px", fontSize: 13.5, background: "transparent", border: "none", borderBottom: i < sug.length - 1 ? "1px solid var(--dv-border, #eef1f4)" : "none", cursor: "pointer" }}>
                <span style={{ fontWeight: 600 }}>{s.street}</span>
                <span style={{ color: "var(--dv-muted, #5b6b78)" }}>, {s.city}, {s.state} {s.zip}</span>
              </button>
            ))}
          </div>
        )}
      </div>
      <div>
        <div className="dv-field-label">Apartment / Suite (optional)</div>
        <div className="dv-input-wrap">
          <input className="dv-input" value={addr.line2} autoComplete="off" placeholder="Apt 4B" onChange={(e) => update({ line2: e.target.value })} />
        </div>
      </div>
      <div className="dv-field-row">
        <div>
          <div className="dv-field-label">City</div>
          <div className="dv-input-wrap">
            <input className="dv-input" value={addr.city} autoComplete="off" onChange={(e) => update({ city: e.target.value })} />
          </div>
        </div>
        <div>
          <div className="dv-field-label">State</div>
          <div className="dv-input-wrap">
            <select className="dv-input" value={addr.state} onChange={(e) => update({ state: e.target.value })}>
              <option value="" disabled>Select state…</option>
              {US_STATES.map((s) => <option key={s.abbr} value={s.abbr}>{s.name}</option>)}
            </select>
          </div>
        </div>
      </div>
      <div>
        <div className="dv-field-label">ZIP Code</div>
        <div className="dv-input-wrap">
          <input className="dv-input" value={addr.zip} autoComplete="off" onChange={(e) => update({ zip: e.target.value })} />
        </div>
      </div>
    </div>
  );
}

export function PatientIntakeFlow({ formId, onExit, live = false, onComplete, onLead, onProgress }: { formId: number; onExit: () => void; live?: boolean; onComplete?: (clientId: number, treatmentId: number | null) => void; onLead?: (info: { first: string; last: string; phone: string; email: string }) => void; onProgress?: (info: { stage: string; step: number; total: number }) => void }) {
  const treatments   = useTreatmentsIntake((s) => s.treatments);
  const addClient    = useTreatmentsIntake((s) => s.addClient);
  const updateClient = useTreatmentsIntake((s) => s.updateClient);
  const deleteClient = useTreatmentsIntake((s) => s.deleteClient);

  // Portal mounting flag for SSR safety
  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);

  // CAPTURE FORM ON MOUNT — useState initializer runs ONCE per mount and pulls
  // the latest forms array directly from the store via getState(). This is the
  // most direct possible read: no hook, no subscription, no cache. After this,
  // `form` is locked in for the duration of this preview session. The session
  // key on the parent's wrapper div forces a fresh mount each time the user
  // opens preview, so this re-captures with the latest data every time.
  const [form] = useState(() => {
    const latestForms = useTreatmentsIntake.getState().forms;
    return latestForms.find((x) => x.id === formId);
  });

  // ─── Patient-flow state ─────────────────────────────────────────────
  const [stage, setStage] = useState<PatientStage>("question");
  // step indexes into the FILTERED question list (sections excluded)
  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState<Record<number, string | number | string[]>>({});
  const [disqReason, setDisqReason] = useState("");
  const [selectedTxId, setSelectedTxId] = useState<number | null>(null);

  const [leadId, setLeadId] = useState<number | null>(null);

  // Success-screen password creation (option 1). Sets the patient's portal
  // password for the email captured during intake.
  const setPortalPassword = usePatientAuth((s) => s.resetPassword);
  const [pw, setPw] = useState("");
  const [pw2, setPw2] = useState("");
  const [pwSaved, setPwSaved] = useState(false);
  const [pwErr, setPwErr] = useState("");
  async function handleSetPassword() {
    setPwErr("");
    if (pw.length < 8) { setPwErr("Use at least 8 characters."); return; }
    if (pw !== pw2) { setPwErr("Passwords don't match."); return; }
    const email = (useTreatmentsIntake.getState().clients.find((c) => c.id === leadId)?.email || "").trim();
    if (!email) { setPwErr("We couldn't find your email — we'll send you a link to set it."); return; }
    const res = await setPortalPassword(email, pw, usePatients.getState().patients);
    if (!res.ok) { setPwErr(res.error || "Couldn't set password here — check the link we emailed you."); return; }
    setPwSaved(true);
  }

  // Checkout state
  const [coCardNum,  setCoCardNum]  = useState("");
  const [coCardExp,  setCoCardExp]  = useState("");
  const [coCardCvc,  setCoCardCvc]  = useState("");
  const [coCardName, setCoCardName] = useState("");
  const [coAddr, setCoAddr] = useState({ line1: "", apt: "", city: "", state: "", zip: "" });
  const [legalAck, setLegalAck] = useState<Record<string, boolean>>({});

  // Which consents apply right now — GLP-1 treatments add the GLP-1-specific
  // informed consent; other treatments (NAD+, peptides) get only the base set.
  const activeConsents = useMemo(() => {
    const tx = treatments.find((t) => t.id === selectedTxId);
    return consentsFor({ treatmentName: tx?.name, medication: tx?.med, formName: form?.name });
  }, [treatments, selectedTxId, form]);
  const [payProvider, setPayProvider] = useState<{ provider: string; ready: boolean } | null>(null);
  useEffect(() => {
    let alive = true;
    fetch("/api/payments/config").then((r) => r.json()).then((c) => { if (alive) setPayProvider({ provider: c.provider, ready: !!c.ready }); }).catch(() => {});
    return () => { alive = false; };
  }, []);
  const isStripe = payProvider?.provider === "stripe" && payProvider.ready;
  const isCorepay = payProvider?.provider === "corepay" && payProvider.ready;
  const isHosted = isStripe || isCorepay; // card collected on the provider's secure page

  // Acknowledge / accordion state per question (keyed by question id)
  const [accOpen, setAccOpen] = useState<Record<number, boolean>>({});
  const [ackChecked, setAckChecked] = useState<Record<number, boolean>>({});

  // Lead row gets created on welcome screen so abandons are visible to admin
  useEffect(() => {
    if (!form) return;
    const lead = addClient({
      first: "", last: "", email: "", phone: "",
      formId: form.id, formName: form.name, formSlug: form.slug,
      treatmentId: null, status: "in_progress", startedAt: nowStamp(), paidAt: null,
      address: { line1: "", apt: "", city: "", state: "", zip: "" },
      lastFour: null, cardBrand: null, reminders: [], answers: {},
    });
    setLeadId(lead.id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Report progress to the host so the CRM can track where the patient is.
  useEffect(() => {
    if (live && onProgress) onProgress({ stage, step, total: totalQ });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stage, step]);

  // Sync answers → zustand AFTER state commits (debounced via React batching).
  // Splitting this out of commitAnswer prevents the side effect from running
  // inside the setAnswers updater (which can cause re-render interleaving and
  // input focus loss).
  useEffect(() => {
    if (leadId !== null) updateClient(leadId, { answers });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [answers, leadId]);

  if (!form) return null;

  // Compute visibleQs INLINE on every render — no useMemo. This guarantees
  // the patient view always reflects the latest question order from zustand,
  // even after the admin reorders questions in FormEditor.
  // Name + email + phone are shown together on one card (the patient's details).
  // Anchor the combined card on the earliest involved question; hide the rest.
  const contactGroup = (() => {
    const emailQ = form.questions.find((q) => q.type === "email" || (q.type === "text" && /e-?mail/i.test(q.text)));
    const phoneQ = form.questions.find((q) => q.type === "phone" || (q.type === "text" && /phone/i.test(q.text)));
    const nameQ = form.questions.find((q) => isFullNameQ(q));
    const involved = [nameQ, emailQ, phoneQ].filter(Boolean) as BaskQuestion[];
    if (involved.length < 2) return null;
    const anchor = involved.reduce((a, b) => (form.questions.indexOf(a) <= form.questions.indexOf(b) ? a : b));
    const hideIds = involved.map((q) => q.id).filter((id) => id !== anchor.id);
    return { anchorId: anchor.id, nameId: nameQ?.id ?? null, emailId: emailQ?.id ?? null, phoneId: phoneQ?.id ?? null, hideIds };
  })();

  const hasAddressQ = form.questions.some((q) => q.type === "address");
  const visibleQs = form.questions.filter((q) =>
    q.type !== "section" &&
    !(contactGroup && contactGroup.hideIds.includes(q.id)) &&
    // ZIP is captured inside the address step, so a standalone ZIP question is
    // redundant whenever the form also has an address question — hide it.
    !(hasAddressQ && q.type === "text" && /\bzip\b|postal/i.test(q.text)),
  );
  const totalQ = visibleQs.length;

  // Fraction of overall flow complete: welcome 2%, each Q step adds, treatment 90%, checkout 95%
  const flowPct = (() => {
    if (stage === "welcome") return 2;
    if (stage === "question") return Math.round(5 + ((step + 1) / Math.max(totalQ, 1)) * 80);
    if (stage === "treatment") return 90;
    if (stage === "checkout") return 95;
    if (stage === "disqualified") return 100;
    if (stage === "success") return 100;
    return 0;
  })();

  // ─── Helpers ─────────────────────────────────────────────────────────
  function finalizeAndExit() {
    if (leadId !== null) {
      const lead = useTreatmentsIntake.getState().clients.find((c) => c.id === leadId);
      if (lead && lead.status === "in_progress") {
        if (lead.treatmentId) {
          updateClient(leadId, { status: "unpaid" });
        } else if (!lead.first && !lead.last) {
          deleteClient(leadId);
        } else {
          updateClient(leadId, { status: "unpaid" });
        }
      }
    }
    onExit();
  }

  // When the patient finishes the form, scan their answers for any text/email
  // questions whose label looks like contact info (name, email, phone, zip),
  // and push those values to the lead record so the admin sees a populated
  // client row. This replaces the old hardcoded "Contact info" step — now
  // admins control contact collection by adding (or not adding) questions
  // in the form builder.
  function extractContactFromAnswers() {
    if (leadId === null) return;
    if (!form) return;
    const patch: Partial<{ first: string; last: string; email: string; phone: string; address: { line1: string; apt: string; city: string; state: string; zip: string } }> = {};
    let zipFromAnswer = "";

    for (const q of form.questions) {
      const lbl = (q.text || "").toLowerCase();
      const raw = answers[q.id];
      if (typeof raw !== "string" || !raw.trim()) continue;
      const v = raw.trim();
      // Bundled personal info → JSON {first,last,email,phone}
      if (q.type === "personal_info") {
        try { const o = JSON.parse(v); patch.first = (o.first || "").trim(); patch.last = (o.last || "").trim(); patch.email = (o.email || "").trim(); patch.phone = (o.phone || "").trim(); } catch { /* ignore */ }
        continue;
      }
      // Full shipping address (now the source of ZIP, since the standalone
      // ZIP question is hidden whenever an address question is present).
      if (q.type === "address") {
        try { const o = JSON.parse(v); patch.address = { line1: o.line1 || "", apt: o.line2 || o.apt || "", city: o.city || "", state: o.state || "", zip: o.zip || "" }; } catch { /* ignore */ }
        continue;
      }
      if (lbl.includes("full") && lbl.includes("name")) {
        if (v.startsWith("{")) {
          try { const o = JSON.parse(v); patch.first = (o.first || "").trim(); patch.last = (o.last || "").trim(); } catch { /* ignore */ }
        } else {
          const parts = v.split(/\s+/);
          patch.first = parts[0] || "";
          patch.last = parts.slice(1).join(" ") || "";
        }
      } else if (lbl.includes("first") && lbl.includes("name")) {
        patch.first = v;
      } else if (lbl.includes("last") && lbl.includes("name")) {
        patch.last = v;
      } else if (lbl.includes("email") || (q.type === "text" && v.includes("@"))) {
        patch.email = v;
      } else if (lbl.includes("phone") || lbl.includes("mobile") || lbl.includes("cell")) {
        patch.phone = v;
      } else if (lbl.includes("zip") || lbl.includes("postal")) {
        zipFromAnswer = v;
      }
    }

    if (zipFromAnswer && !patch.address) {
      patch.address = { line1: "", apt: "", city: "", state: "", zip: zipFromAnswer };
    }

    if (Object.keys(patch).length > 0) {
      updateClient(leadId, patch);
    }

    // As soon as we have an email + a name, tell the host so it can pre-create
    // (and then keep updating) the CRM patient profile mid-intake.
    if (live && onLead) {
      const lead = useTreatmentsIntake.getState().clients.find((c) => c.id === leadId);
      const first = (patch.first ?? lead?.first ?? "").trim();
      const last = (patch.last ?? lead?.last ?? "").trim();
      const email = (patch.email ?? lead?.email ?? "").trim();
      const phone = (patch.phone ?? lead?.phone ?? "").trim();
      if (email && (first || last)) onLead({ first, last, phone, email });
    }
  }

  function commitAnswer(qid: number, value: string | number | string[]) {
    // PURE state update — no side effects. The zustand sync runs in a
    // useEffect below, which fires AFTER React commits the state.
    // Side effects inside a state updater cause React to re-enter the
    // render phase mid-keystroke and can interfere with controlled inputs.
    setAnswers((prev) => ({ ...prev, [qid]: value }));
  }

  function checkDisqualifier(q: BaskQuestion, v: string | number | string[] | undefined): string | null {
    return disqualifierReason(q, v);
  }

  function goNext() {
    const q = visibleQs[step];
    if (q) {
      // Required check
      if (q.required) {
        const v = answers[q.id];
        if (v === undefined || v === "" || (Array.isArray(v) && v.length === 0)) {
          toast("This question is required");
          return;
        }
        // BMI questions need both weight AND height — check the calculated BMI value
        if (q.type === "bmi" && typeof v === "string") {
          try {
            const parsed = JSON.parse(v);
            if (!parsed.bmi || parsed.bmi <= 0) {
              toast("Please enter both your weight and height");
              return;
            }
          } catch {
            toast("Please enter both your weight and height");
            return;
          }
        }
      }
      // For consent-style questions (impact:qualify + checkbox), require the ack box
      if (q.impact === "qualify" && q.type === "checkbox" && !ackChecked[q.id]) {
        toast("Please acknowledge before continuing");
        return;
      }
      // Bundled personal info card validates all four fields
      if (q.type === "personal_info") {
        let pi = { first: "", last: "", email: "", phone: "" };
        try { pi = { ...pi, ...JSON.parse(String(answers[q.id] || "{}")) }; } catch { /* ignore */ }
        if (!pi.first.trim() || !pi.last.trim()) { toast("Please enter your first and last name"); return; }
        if (!pi.email.trim() || !pi.email.includes("@")) { toast("Please enter a valid email"); return; }
        if (pi.phone.replace(/\D/g, "").length < 10) { toast("Please enter a valid phone number"); return; }
      }
      // Combined details card validates name + email + phone together
      if (contactGroup && q.id === contactGroup.anchorId) {
        if (contactGroup.nameId != null) {
          try { const o = JSON.parse(String(answers[contactGroup.nameId] || "{}")); if (!(o.first || "").trim() || !(o.last || "").trim()) { toast("Please enter your first and last name"); return; } }
          catch { toast("Please enter your first and last name"); return; }
        }
        if (contactGroup.emailId != null) { const em = String(answers[contactGroup.emailId] || "").trim(); if (!em || !em.includes("@")) { toast("Please enter a valid email"); return; } }
        if (contactGroup.phoneId != null) { const ph = String(answers[contactGroup.phoneId] || "").replace(/\D/g, ""); if (ph.length < 10) { toast("Please enter a valid phone number"); return; } }
      } else if (isFullNameQ(q)) {
        try { const o = JSON.parse(String(answers[q.id] || "{}")); if (!(o.first || "").trim() || !(o.last || "").trim()) { toast("Please enter your first and last name"); return; } }
        catch { toast("Please enter your first and last name"); return; }
      }
      // DOB needs all three boxes
      if (q.type === "date") {
        try { const o = JSON.parse(String(answers[q.id] || "{}")); if (!o.m || !o.d || !o.y || String(o.y).length < 4) { toast("Please enter your full date of birth"); return; } }
        catch { toast("Please enter your full date of birth"); return; }
      }
      // Disqualifier
      const reason = checkDisqualifier(q, answers[q.id]);
      if (reason) {
        setDisqReason(reason);
        setStage("disqualified");
        if (leadId !== null) updateClient(leadId, { status: "disqualified", disqReason: reason });
        return;
      }
    }
    extractContactFromAnswers();
    if (step + 1 >= totalQ) {
      // Finished all questions — move to treatment selection.
      setStage("treatment");
    } else {
      setStep(step + 1);
    }
  }

  function goPrev() {
    if (stage === "question") {
      if (step === 0) { finalizeAndExit(); return; }
      setStep(step - 1); return;
    }
    if (stage === "treatment")      { setStage("question"); setStep(totalQ - 1); return; }
    if (stage === "checkout")       { setStage("treatment"); return; }
    if (stage === "disqualified")   { setStage("question"); return; }
  }

  function pickOption(q: BaskQuestion, value: string) {
    // Single-choice / yes-no — auto-advance after selection
    commitAnswer(q.id, value);
    const reason = checkDisqualifier(q, value);
    if (reason) {
      setDisqReason(reason);
      setStage("disqualified");
      if (leadId !== null) updateClient(leadId, { status: "disqualified", disqReason: reason });
      return;
    }
    setTimeout(() => {
      extractContactFromAnswers();
      if (step + 1 >= totalQ) {
        setStage("treatment");
      } else {
        setStep(step + 1);
      }
    }, 180);
  }

  function toggleMulti(q: BaskQuestion, value: string) {
    const arr = Array.isArray(answers[q.id]) ? (answers[q.id] as string[]) : [];
    const idx = arr.indexOf(value);
    const next = idx >= 0 ? arr.filter((_, i) => i !== idx) : [...arr, value];
    commitAnswer(q.id, next);
  }

  function completeIntake() {
    if (selectedTxId === null) return;
    if (leadId !== null) updateClient(leadId, { treatmentId: selectedTxId });
    const lead = useTreatmentsIntake.getState().clients.find((c) => c.id === leadId);
    setCoCardName((`${lead?.first || ""} ${lead?.last || ""}`).trim());

    // Pre-fill the shipping address from anything the patient already entered
    // in the intake (an address question, plus ZIP / state questions).
    if (form) {
      const next = { line1: "", apt: "", city: "", state: "", zip: "" };
      let found = false;
      for (const q of form.questions) {
        const raw = answers[q.id];
        if (q.type === "address" && typeof raw === "string" && raw.startsWith("{")) {
          try { const o = JSON.parse(raw); next.line1 = o.line1 || ""; next.apt = o.line2 || o.apt || ""; next.city = o.city || ""; next.state = o.state || ""; next.zip = o.zip || ""; found = true; } catch { /* ignore */ }
        } else if (q.type === "state" && typeof raw === "string" && raw) { next.state = raw; found = true; }
        else if (/zip|postal/i.test(q.text) && typeof raw === "string" && raw) { next.zip = raw; found = true; }
      }
      if (found) setCoAddr((prev) => ({ ...prev, ...Object.fromEntries(Object.entries(next).filter(([, v]) => v)) }));
    }
    setStage("checkout");
  }

  function submitPayment() {
    // Hosted-redirect providers (Stripe Checkout, NetValve Hosted Payment Page):
    // the card is collected on the provider's PCI-compliant page, never here.
    if (isHosted && leadId !== null) {
      if (!coAddr.line1 || !coAddr.city || !coAddr.state || !coAddr.zip) { toast("Please complete your shipping address"); return; }
      if (!activeConsents.every((d) => legalAck[d.id])) { toast("Please review and agree to the consent documents to continue"); return; }
      const lead = useTreatmentsIntake.getState().clients.find((c) => c.id === leadId);
      const tx = treatments.find((t) => t.id === selectedTxId);
      updateClient(leadId, { status: "paid", paidAt: nowStamp(), address: coAddr });
      if (live) onComplete?.(leadId, selectedTxId);
      const endpoint = isStripe ? "/api/stripe/checkout" : "/api/payments/checkout";
      const payload = {
        email: lead?.email,
        firstName: lead?.first,
        lastName: lead?.last,
        name: `${lead?.first || ""} ${lead?.last || ""}`.trim(),
        phone: lead?.phone,
        planName: tx?.name,
        price: tx?.price,
        interval: tx?.billing,
        treatmentId: selectedTxId,
        clientOrderId: `lead_${leadId}`,
        address: { line1: coAddr.line1, city: coAddr.city, state: coAddr.state, zip: coAddr.zip, countryCode: "US" },
      };
      fetch(endpoint, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) })
        .then((r) => r.json())
        .then((j) => { if (j.ok && j.url) window.location.href = j.url; else toast("⚠️ " + (j.error || "Couldn't start secure checkout")); })
        .catch(() => toast("⚠️ Couldn't start secure checkout"));
      return;
    }
    if (coCardNum.length < 13) { toast("Please enter a valid card number"); return; }
    if (coCardExp.replace(/\D/g, "").length < 4) { toast("Please enter expiration as MM/YY"); return; }
    if (coCardCvc.length < 3) { toast("Please enter a valid CVC"); return; }
    if (!coCardName.trim()) { toast("Please enter the name on the card"); return; }
    if (!coAddr.line1 || !coAddr.city || !coAddr.state || !coAddr.zip) { toast("Please complete your shipping address"); return; }
    if (!activeConsents.every((d) => legalAck[d.id])) { toast("Please review and agree to the consent documents to continue"); return; }
    if (leadId !== null) {
      const lastFour = coCardNum.slice(-4);
      const brand = coCardNum[0] === "4" ? "Visa"
                  : (coCardNum[0] === "5" || coCardNum[0] === "2") ? "Mastercard"
                  : coCardNum[0] === "3" ? "Amex"
                  : coCardNum[0] === "6" ? "Discover" : "Card";
      updateClient(leadId, { status: "paid", paidAt: nowStamp(), lastFour, cardBrand: brand, address: coAddr });
      if (live) onComplete?.(leadId, selectedTxId);
    }
    setStage("success");
  }

  function formatCardNum(s: string) { return s.replace(/\D/g, "").slice(0, 16).replace(/(\d{4})(?=\d)/g, "$1 "); }

  // ─── Portal wrapper renders to body so the overlay covers the EMR shell ──
  // ─── Render helpers ──────────────────────────────────────────────────
  // NOTE: Shell is NOT defined inline here. Defining a component inside
  // another component creates a brand-new component type on every render,
  // which causes React to unmount the entire portal subtree on every keystroke
  // (and the input loses focus). Instead we call the module-level
  // renderShell() as a plain function — it returns JSX without ever creating
  // a new component identity.
  const shell = (children: ReactNode, hideBack?: boolean) =>
    renderShell({ children, hideBack, mounted, onBack: goPrev, flowPct, formName: form?.name });

  // ════════════════════════════════════════════════════════════════════
  // WELCOME
  // ════════════════════════════════════════════════════════════════════
  if (stage === "welcome") {
    return shell(<>
        <div className="dv-welcome-title">Let&apos;s see if you qualify</div>
        <div className="dv-welcome-lead">
          This intake takes about 3 minutes. Your answers help our medical team match you with the right{" "}
          {form.name.toLowerCase().includes("nad") ? "wellness" : "treatment"} plan.
        </div>
        <div className="dv-welcome-meta">
          <div className="dv-welcome-meta-item">⏱ ~3 minutes</div>
          <div className="dv-welcome-meta-item">📝 {totalQ} questions</div>
          <div className="dv-welcome-meta-item">🔒 HIPAA secure</div>
        </div>
        <button className="dv-btn-primary" onClick={() => { setStage("question"); setStep(0); }}>Start intake</button>
        {!live && (
          <div style={{ textAlign: "center", marginTop: 18 }}>
            <button
              onClick={finalizeAndExit}
              style={{ background: "none", border: "none", color: "var(--dv-muted)", cursor: "pointer", textDecoration: "underline", fontSize: 12 }}
            >
              ← Back to admin
            </button>
          </div>
        )}
      </>, true);
  }

  // ════════════════════════════════════════════════════════════════════
  // QUESTION PAGES
  // ════════════════════════════════════════════════════════════════════
  if (stage === "question") {
    const q = visibleQs[step];
    if (!q) { setStage("treatment"); return null; }
    const a = answers[q.id];

    const isConsent = q.impact === "qualify" && q.type === "checkbox";

    // ─── Consent / acknowledge variant ──────────────────────────────
    if (isConsent) {
      const consentText = (q.options || [])
        .map((o) => typeof o === "string" ? o : o.label)
        .join("\n\n");
      return shell(<>
          <div className="dv-question">{q.text}</div>
          {q.helper && <div className="dv-helper">{q.helper}</div>}
          <div className={`dv-acc${accOpen[q.id] ? " open" : ""}`} style={{ marginTop: 8 }}>
            <button className="dv-acc-head" onClick={() => setAccOpen((p) => ({ ...p, [q.id]: !p[q.id] }))}>
              <span className="dv-acc-title">Please read carefully</span>
              <span className="dv-acc-chev">⌄</span>
            </button>
            {accOpen[q.id] && <div className="dv-acc-body">{consentText}</div>}
          </div>
          <label className={`dv-ack-row${ackChecked[q.id] ? " checked" : ""}`} onClick={() => {
            const next = !ackChecked[q.id];
            setAckChecked((p) => ({ ...p, [q.id]: next }));
            // Commit a sentinel answer so the required check passes
            commitAnswer(q.id, next ? (q.options || []).map((o) => typeof o === "string" ? o : o.label) : []);
          }}>
            <div className="dv-ack-box" />
            <span>I acknowledge that I have read and understood the above information</span>
          </label>
          <button className="dv-btn-primary" onClick={goNext} disabled={!ackChecked[q.id]}>Next</button>
        </>);
    }

    // ─── Standard question by type ──────────────────────────────────
    let body: ReactNode = null;
    let usesNext = true; // shows the Next button at bottom

    if (q.type === "personal_info") {
      // Single bundled card: First, Last, Email, Phone (stored as JSON)
      let pi = { first: "", last: "", email: "", phone: "" };
      try { if (typeof a === "string" && a.startsWith("{")) pi = { ...pi, ...JSON.parse(a) }; } catch { /* ignore */ }
      const patchPI = (field: "first" | "last" | "email" | "phone", v: string) => commitAnswer(q.id, JSON.stringify({ ...pi, [field]: v }));
      body = (
        <div className="dv-fields">
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            <div>
              <div className="dv-field-label">First name</div>
              <div className="dv-input-wrap"><input key={`${q.id}-first`} className="dv-input" defaultValue={pi.first} onChange={(e) => patchPI("first", e.target.value)} autoComplete="off" placeholder="First" /></div>
            </div>
            <div>
              <div className="dv-field-label">Last name</div>
              <div className="dv-input-wrap"><input key={`${q.id}-last`} className="dv-input" defaultValue={pi.last} onChange={(e) => patchPI("last", e.target.value)} autoComplete="off" placeholder="Last" /></div>
            </div>
          </div>
          <div>
            <div className="dv-field-label">Email address</div>
            <div className="dv-input-wrap"><input key={`${q.id}-em`} className="dv-input" type="email" defaultValue={pi.email} onChange={(e) => patchPI("email", e.target.value)} autoComplete="off" placeholder="you@example.com" /></div>
          </div>
          <div>
            <div className="dv-field-label">Phone number</div>
            <div className="dv-input-wrap"><input key={`${q.id}-ph`} className="dv-input" type="tel" defaultValue={pi.phone} autoComplete="off" placeholder="(305) 555-0123"
              onChange={(e) => patchPI("phone", e.target.value)}
              onBlur={(e) => { const f = formatPhone(e.target.value); e.target.value = f; patchPI("phone", f); }} /></div>
          </div>
        </div>
      );
    } else if (contactGroup && q.id === contactGroup.anchorId) {
      // Combined details card: First, Last, Email, Phone — all on one page
      let nm = { first: "", last: "" };
      if (contactGroup.nameId != null) {
        const raw = answers[contactGroup.nameId];
        try { if (typeof raw === "string" && raw.startsWith("{")) nm = { ...nm, ...JSON.parse(raw) }; } catch { /* ignore */ }
      }
      const patchName = (field: "first" | "last", v: string) => { if (contactGroup.nameId != null) commitAnswer(contactGroup.nameId, JSON.stringify({ ...nm, [field]: v })); };
      const emailVal = contactGroup.emailId != null ? ((answers[contactGroup.emailId] as string) || "") : "";
      const phoneVal = contactGroup.phoneId != null ? ((answers[contactGroup.phoneId] as string) || "") : "";
      body = (
        <div className="dv-fields">
          {contactGroup.nameId != null && (
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
              <div>
                <div className="dv-field-label">First name</div>
                <div className="dv-input-wrap">
                  <input key={`${contactGroup.nameId}-first`} className="dv-input" defaultValue={nm.first} onChange={(e) => patchName("first", e.target.value)} autoComplete="off" placeholder="First" />
                </div>
              </div>
              <div>
                <div className="dv-field-label">Last name</div>
                <div className="dv-input-wrap">
                  <input key={`${contactGroup.nameId}-last`} className="dv-input" defaultValue={nm.last} onChange={(e) => patchName("last", e.target.value)} autoComplete="off" placeholder="Last" />
                </div>
              </div>
            </div>
          )}
          {contactGroup.emailId != null && (
            <div>
              <div className="dv-field-label">Email address</div>
              <div className="dv-input-wrap">
                <input key={`${contactGroup.emailId}-em`} className="dv-input" type="email" defaultValue={emailVal} onChange={(e) => commitAnswer(contactGroup.emailId as number, e.target.value)} autoComplete="off" placeholder="you@example.com" />
              </div>
            </div>
          )}
          {contactGroup.phoneId != null && (
            <div>
              <div className="dv-field-label">Phone number</div>
              <div className="dv-input-wrap">
                <input key={`${contactGroup.phoneId}-ph`} className="dv-input" type="tel" defaultValue={phoneVal} autoComplete="off" placeholder="(305) 555-0123"
                  onChange={(e) => commitAnswer(contactGroup.phoneId as number, e.target.value)}
                  onBlur={(e) => { const f = formatPhone(e.target.value); e.target.value = f; commitAnswer(contactGroup.phoneId as number, f); }} />
              </div>
            </div>
          )}
        </div>
      );
    } else if (isFullNameQ(q)) {
      // Lone full-name question → First + Last boxes (stored as JSON {first,last})
      let nm = { first: "", last: "" };
      try { if (typeof a === "string" && a.startsWith("{")) nm = { ...nm, ...JSON.parse(a) }; } catch { /* ignore */ }
      const patchName = (field: "first" | "last", v: string) => commitAnswer(q.id, JSON.stringify({ ...nm, [field]: v }));
      body = (
        <div className="dv-fields">
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            <div>
              <div className="dv-field-label">First name</div>
              <div className="dv-input-wrap">
                <input key={`${q.id}-first`} className="dv-input" defaultValue={nm.first} onChange={(e) => patchName("first", e.target.value)} autoComplete="off" placeholder="First" />
              </div>
            </div>
            <div>
              <div className="dv-field-label">Last name</div>
              <div className="dv-input-wrap">
                <input key={`${q.id}-last`} className="dv-input" defaultValue={nm.last} onChange={(e) => patchName("last", e.target.value)} autoComplete="off" placeholder="Last" />
              </div>
            </div>
          </div>
        </div>
      );
    } else if (q.type === "yesno") {
      usesNext = false;
      body = (
        <div className="dv-options">
          <button className={`dv-option${a === "No"  ? " sel" : ""}`} onClick={() => pickOption(q, "No")}>
            <span className="dv-option-text">No</span>
          </button>
          <button className={`dv-option${a === "Yes" ? " sel" : ""}`} onClick={() => pickOption(q, "Yes")}>
            <span className="dv-option-text">Yes</span>
          </button>
        </div>
      );
    } else if (q.type === "multiple") {
      usesNext = false;
      body = (
        <div className="dv-options">
          {(q.options || []).map((o, i) => {
            const lbl = typeof o === "string" ? o : o.label;
            return (
              <button key={i} className={`dv-option${a === lbl ? " sel" : ""}`} onClick={() => pickOption(q, lbl)}>
                <span className="dv-option-text">{lbl}</span>
              </button>
            );
          })}
        </div>
      );
    } else if (q.type === "checkbox") {
      const arr = Array.isArray(a) ? a as string[] : [];
      body = (
        <div className="dv-options">
          {(q.options || []).map((o, i) => {
            const lbl = typeof o === "string" ? o : o.label;
            const sel = arr.includes(lbl);
            return (
              <button key={i} className={`dv-option${sel ? " sel" : ""}`} onClick={() => toggleMulti(q, lbl)}>
                <span className="dv-option-text">{lbl}</span>
                <span className="dv-option-check" />
              </button>
            );
          })}
        </div>
      );
    } else if (q.type === "text") {
      body = (
        <div className="dv-fields">
          <div>
            <div className="dv-input-wrap">
              <input key={q.id} className="dv-input" type="text" defaultValue={(a as string) || ""} onChange={(e) => commitAnswer(q.id, e.target.value)} autoComplete="off" placeholder="Type your answer…" />
            </div>
          </div>
        </div>
      );
    } else if (q.type === "number") {
      // Detect weight/height-style numeric questions for a unit suffix
      const lower = q.text.toLowerCase();
      const unit = lower.includes("lb") || lower.includes("weight") ? "lbs"
                 : lower.includes("inch") || lower.includes("height") ? "in"
                 : lower.includes("year") ? "yrs"
                 : "";
      body = (
        <div className="dv-fields">
          <div>
            <div className="dv-field-label">Your answer</div>
            <div className="dv-input-wrap">
              <input key={q.id} className={`dv-input${unit ? " has-unit" : ""}`} type="number" defaultValue={(a as string) || ""} onChange={(e) => commitAnswer(q.id, e.target.value)} autoComplete="off" placeholder="Enter a number" />
              {unit && <span className="dv-input-unit">{unit}</span>}
            </div>
          </div>
        </div>
      );
    } else if (q.type === "date") {
      // Date of birth → Month / Day / Year boxes, stored as JSON {m,d,y}
      let dob = { m: "", d: "", y: "" };
      try { if (typeof a === "string" && a.startsWith("{")) dob = { ...dob, ...JSON.parse(a) }; } catch { /* ignore */ }
      const patchDob = (field: "m" | "d" | "y", v: string) => commitAnswer(q.id, JSON.stringify({ ...dob, [field]: v }));
      const MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
      body = (
        <div className="dv-fields">
          <div>
            <div className="dv-field-label">Date of birth</div>
            <div style={{ display: "grid", gridTemplateColumns: "1.4fr 1fr 1fr", gap: 10 }}>
              <div className="dv-input-wrap">
                <select key={`${q.id}-m`} className="dv-input" defaultValue={dob.m} onChange={(e) => patchDob("m", e.target.value)}>
                  <option value="" disabled>Month</option>
                  {MONTHS.map((nm, i) => <option key={nm} value={String(i + 1).padStart(2, "0")}>{nm}</option>)}
                </select>
              </div>
              <div className="dv-input-wrap">
                <input key={`${q.id}-d`} className="dv-input" type="number" min={1} max={31} defaultValue={dob.d} onChange={(e) => patchDob("d", e.target.value.replace(/\D/g, "").slice(0, 2))} autoComplete="off" placeholder="Day" />
              </div>
              <div className="dv-input-wrap">
                <input key={`${q.id}-y`} className="dv-input" type="number" min={1900} max={new Date().getFullYear()} defaultValue={dob.y} onChange={(e) => patchDob("y", e.target.value.replace(/\D/g, "").slice(0, 4))} autoComplete="off" placeholder="Year" />
              </div>
            </div>
          </div>
        </div>
      );
    } else if (q.type === "scale") {
      body = (
        <>
          <div className="dv-scale">
            {[1,2,3,4,5,6,7,8,9,10].map((n) => (
              <button key={n} className={`dv-scale-btn${a == n ? " sel" : ""}`} onClick={() => commitAnswer(q.id, n)}>{n}</button>
            ))}
          </div>
          <div className="dv-scale-labels"><span>Not motivated</span><span>Extremely</span></div>
        </>
      );
    } else if (q.type === "long_text") {
      body = (
        <div className="dv-fields">
          <div>
            <div className="dv-input-wrap">
              <textarea key={q.id} className="dv-input" rows={5} defaultValue={(a as string) || ""} onChange={(e) => commitAnswer(q.id, e.target.value)} placeholder="Type your answer…" style={{ resize: "vertical", minHeight: 120, fontFamily: "inherit" }} />
            </div>
          </div>
        </div>
      );
    } else if (q.type === "dropdown") {
      body = (
        <div className="dv-fields">
          <div>
            <div className="dv-input-wrap">
              <select key={q.id} className="dv-input" defaultValue={(a as string) || ""} onChange={(e) => commitAnswer(q.id, e.target.value)}>
                <option value="" disabled>Select an option…</option>
                {(q.options || []).map((o, i) => {
                  const lbl = typeof o === "string" ? o : o.label;
                  return <option key={i} value={lbl}>{lbl}</option>;
                })}
              </select>
            </div>
          </div>
        </div>
      );
    } else if (q.type === "state") {
      body = (
        <div className="dv-fields">
          <div>
            <div className="dv-field-label">Your state</div>
            <div className="dv-input-wrap">
              <select key={q.id} className="dv-input" defaultValue={(a as string) || ""} onChange={(e) => commitAnswer(q.id, e.target.value)}>
                <option value="" disabled>Select your state…</option>
                {US_STATES.map((s) => <option key={s.abbr} value={s.abbr}>{s.name}</option>)}
              </select>
            </div>
          </div>
        </div>
      );
    } else if (q.type === "rating") {
      const rating = typeof a === "number" ? a : parseInt(a as string) || 0;
      body = (
        <div className="dv-options" style={{ flexDirection: "row", justifyContent: "center", gap: 12, padding: "20px 0" }}>
          {[1,2,3,4,5].map((n) => (
            <button
              key={n}
              onClick={() => commitAnswer(q.id, n)}
              style={{
                background: "transparent",
                border: "none",
                fontSize: 42,
                cursor: "pointer",
                color: rating >= n ? "#f59e0b" : "#d4d8dd",
                padding: 4,
                lineHeight: 1,
              }}
              aria-label={`${n} star${n === 1 ? "" : "s"}`}
            >
              ★
            </button>
          ))}
        </div>
      );
    } else if (q.type === "email") {
      body = (
        <div className="dv-fields">
          <div>
            <div className="dv-field-label">Email address</div>
            <div className="dv-input-wrap">
              <input key={q.id} className="dv-input" type="email" defaultValue={(a as string) || ""} onChange={(e) => commitAnswer(q.id, e.target.value)} autoComplete="off" placeholder="you@example.com" />
            </div>
          </div>
        </div>
      );
    } else if (q.type === "phone") {
      body = (
        <div className="dv-fields">
          <div>
            <div className="dv-field-label">Phone number</div>
            <div className="dv-input-wrap">
              <input key={q.id} className="dv-input" type="tel" defaultValue={(a as string) || ""} onChange={(e) => commitAnswer(q.id, e.target.value)} autoComplete="off" placeholder="(555) 123-4567" />
            </div>
          </div>
        </div>
      );
    } else if (q.type === "address") {
      // Address is stored as a JSON string ({line1, line2, city, state, zip})
      let parsed: IntakeAddr = { line1: "", line2: "", city: "", state: "", zip: "" };
      try { if (typeof a === "string" && a) parsed = { ...parsed, ...JSON.parse(a) }; } catch { /* ignore */ }
      body = (
        <IntakeAddressField key={q.id} initial={parsed} onChange={(addr) => commitAnswer(q.id, JSON.stringify(addr))} />
      );
    } else if (q.type === "signature") {
      // Lightweight signature input — captures the typed name as a "drawn"
      // signature in a cursive style. Real signature pads need <canvas>; we
      // ship a text-as-signature approach for this build.
      body = (
        <div className="dv-fields">
          <div>
            <div className="dv-field-label">Type your full name to sign</div>
            <div className="dv-input-wrap">
              <input
                key={q.id}
                className="dv-input"
                defaultValue={(a as string) || ""}
                onChange={(e) => commitAnswer(q.id, e.target.value)}
                autoComplete="off"
                placeholder="Your name"
                style={{ fontFamily: "'Brush Script MT', cursive", fontSize: 22 }}
              />
            </div>
            <div style={{ fontSize: 11, color: "var(--dv-muted)", marginTop: 6 }}>
              By typing your name, you are providing a legally-binding electronic signature.
            </div>
          </div>
        </div>
      );
    } else if (q.type === "bmi") {
      // BMI Calculator — weight + height inputs with live BMI calculation
      // Answer stored as a JSON object so it carries weight, height, units,
      // calculated BMI, and category for downstream use (rules, SOAP notes).
      let ans: Record<string, unknown> | null = null;
      if (typeof a === "string" && a.startsWith("{")) {
        try { ans = JSON.parse(a); } catch { ans = null; }
      }
      const unit: "imperial" | "metric" = (ans?.unit === "metric") ? "metric" : "imperial";
      const wLbs = (ans?.weightLbs as string) ?? "";
      const wKg  = (ans?.weightKg  as string) ?? "";
      const hFt  = (ans?.heightFt  as string) ?? "";
      const hIn  = (ans?.heightIn  as string) ?? "";
      const hCm  = (ans?.heightCm  as string) ?? "";

      // Compute live BMI from the current values
      let bmiVal: number | null = null;
      if (unit === "imperial") {
        const wn = parseFloat(String(wLbs));
        const ftN = parseFloat(String(hFt)) || 0;
        const inN = parseFloat(String(hIn)) || 0;
        const totalIn = ftN * 12 + inN;
        if (wn > 0 && totalIn > 0) bmiVal = (wn / (totalIn * totalIn)) * 703;
      } else {
        const wn = parseFloat(String(wKg));
        const cm = parseFloat(String(hCm));
        if (wn > 0 && cm > 0) {
          const m = cm / 100;
          bmiVal = wn / (m * m);
        }
      }
      const bmiNum = bmiVal !== null ? Math.round(bmiVal * 10) / 10 : null;
      const cat = bmiNum === null ? null
        : bmiNum < 18.5 ? { name: "Underweight",       cls: "low",    desc: "A BMI below 18.5 means GLP-1 medications may not be appropriate." }
        : bmiNum < 25   ? { name: "Normal weight",     cls: "normal", desc: "Your BMI is in the healthy range." }
        : bmiNum < 30   ? { name: "Overweight",        cls: "elev",   desc: "A BMI of 27+ with comorbidity typically qualifies for GLP-1." }
        : bmiNum < 35   ? { name: "Class 1 Obesity",   cls: "obese",  desc: "A BMI of 30+ typically qualifies for GLP-1 medications." }
        : bmiNum < 40   ? { name: "Class 2 Obesity",   cls: "obese",  desc: "A BMI of 30+ typically qualifies for GLP-1 medications." }
        :                 { name: "Class 3 Obesity",   cls: "obese",  desc: "A BMI of 30+ typically qualifies for GLP-1 medications." };

      const writeBmi = (patch: Record<string, unknown>) => {
        const next = {
          unit,
          weightLbs: wLbs, weightKg: wKg,
          heightFt: hFt,   heightIn: hIn, heightCm: hCm,
          ...patch,
        };
        // Recompute BMI on commit so it's always stored alongside raw inputs
        let bmi: number | null = null;
        if (next.unit === "imperial") {
          const wn = parseFloat(String(next.weightLbs));
          const ftN = parseFloat(String(next.heightFt)) || 0;
          const inN = parseFloat(String(next.heightIn)) || 0;
          const totalIn = ftN * 12 + inN;
          if (wn > 0 && totalIn > 0) bmi = (wn / (totalIn * totalIn)) * 703;
        } else {
          const wn = parseFloat(String(next.weightKg));
          const cm = parseFloat(String(next.heightCm));
          if (wn > 0 && cm > 0) { const m = cm/100; bmi = wn / (m*m); }
        }
        const bmiR = bmi !== null ? Math.round(bmi * 10) / 10 : null;
        commitAnswer(q.id, JSON.stringify({ ...next, bmi: bmiR }));
      };

      body = (
        <>
          <div className="dv-unit-toggle">
            <button
              type="button"
              className={unit === "imperial" ? "active" : ""}
              onClick={() => writeBmi({ unit: "imperial" })}
            >Imperial (lbs / ft+in)</button>
            <button
              type="button"
              className={unit === "metric" ? "active" : ""}
              onClick={() => writeBmi({ unit: "metric" })}
            >Metric (kg / cm)</button>
          </div>

          <div className="dv-bmi-fields">
            <div className="dv-bmi-row">
              <div className="dv-bmi-row-label">Current weight</div>
              <div className="dv-bmi-input-grp">
                {unit === "imperial" ? (
                  <div className="dv-bmi-input-wrap">
                    <input
                      key={`${q.id}-w-imp`}
                      className="dv-bmi-input"
                      type="number"
                      inputMode="decimal"
                      defaultValue={wLbs as string}
                      onChange={(e) => writeBmi({ weightLbs: e.target.value })}
                      placeholder="0"
                      autoComplete="off"
                    />
                    <span className="dv-bmi-unit">lbs</span>
                  </div>
                ) : (
                  <div className="dv-bmi-input-wrap">
                    <input
                      key={`${q.id}-w-met`}
                      className="dv-bmi-input"
                      type="number"
                      inputMode="decimal"
                      defaultValue={wKg as string}
                      onChange={(e) => writeBmi({ weightKg: e.target.value })}
                      placeholder="0"
                      autoComplete="off"
                    />
                    <span className="dv-bmi-unit">kg</span>
                  </div>
                )}
              </div>
            </div>

            <div className="dv-bmi-row">
              <div className="dv-bmi-row-label">Height</div>
              <div className="dv-bmi-input-grp">
                {unit === "imperial" ? (
                  <>
                    <div className="dv-bmi-input-wrap">
                      <input
                        key={`${q.id}-h-ft`}
                        className="dv-bmi-input"
                        type="number"
                        inputMode="decimal"
                        defaultValue={hFt as string}
                        onChange={(e) => writeBmi({ heightFt: e.target.value })}
                        placeholder="0"
                        autoComplete="off"
                      />
                      <span className="dv-bmi-unit">ft</span>
                    </div>
                    <div className="dv-bmi-input-wrap">
                      <input
                        key={`${q.id}-h-in`}
                        className="dv-bmi-input"
                        type="number"
                        inputMode="decimal"
                        defaultValue={hIn as string}
                        onChange={(e) => writeBmi({ heightIn: e.target.value })}
                        placeholder="0"
                        autoComplete="off"
                      />
                      <span className="dv-bmi-unit">in</span>
                    </div>
                  </>
                ) : (
                  <div className="dv-bmi-input-wrap">
                    <input
                      key={`${q.id}-h-cm`}
                      className="dv-bmi-input"
                      type="number"
                      inputMode="decimal"
                      defaultValue={hCm as string}
                      onChange={(e) => writeBmi({ heightCm: e.target.value })}
                      placeholder="0"
                      autoComplete="off"
                    />
                    <span className="dv-bmi-unit">cm</span>
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className={`dv-bmi-result${bmiNum === null ? " empty" : ""}`}>
            <div className="dv-bmi-result-left">
              <div className="dv-bmi-result-label">Your BMI</div>
              <div className={`dv-bmi-result-value${bmiNum === null ? " empty" : ""}`}>
                {bmiNum === null ? "—" : bmiNum.toFixed(1)}
              </div>
            </div>
            <div className="dv-bmi-result-right">
              {cat ? (
                <>
                  <div className={`dv-bmi-category ${cat.cls}`}>{cat.name}</div>
                  <div className="dv-bmi-desc">{cat.desc}</div>
                </>
              ) : (
                <div className="dv-bmi-desc">Enter your weight and height to see your BMI.</div>
              )}
            </div>
          </div>
        </>
      );
    } else if (q.type === "file") {
      const deferred = a === SUBMIT_LATER;
      const hasFile = typeof a === "string" && a && !deferred;
      const isIdQuestion = /\b(id|identity|licen[sc]e|passport|government)\b/i.test(q.text);
      body = (
        <div className="dv-fields">
          <div>
            <div className="dv-field-label">Upload a file</div>
            <label
              style={{
                display: "block", padding: "32px 18px", textAlign: "center",
                background: "#f9fafb", border: "2px dashed #cbd5e1", borderRadius: 12,
                cursor: "pointer", color: "var(--dv-muted)",
              }}
            >
              <input
                key={q.id}
                type="file"
                style={{ display: "none" }}
                onChange={async (e) => {
                  const file = e.target.files?.[0];
                  if (!file) return;
                  if (file.type.startsWith("image/")) {
                    try { const img = await compressImageFile(file, { maxDim: 1500, quality: 0.8 }); commitAnswer(q.id, img.dataUrl); }
                    catch { commitAnswer(q.id, file.name); }
                  } else {
                    commitAnswer(q.id, file.name);
                  }
                }}
              />
              <div style={{ fontSize: 32, marginBottom: 6 }}>📎</div>
              {hasFile ? (
                (a as string).startsWith("data:image") ? (
                  <div>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={a as string} alt="Uploaded" style={{ maxHeight: 120, borderRadius: 8, margin: "0 auto 6px", display: "block" }} />
                    <div style={{ fontSize: 12.5, fontWeight: 600, color: "var(--dv-ink)" }}>Image uploaded ✓ — tap to replace</div>
                  </div>
                ) : (
                  <div style={{ fontSize: 13, fontWeight: 600, color: "var(--dv-ink)" }}>{a as string}</div>
                )
              ) : deferred ? (
                <div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: "var(--dv-ink)" }}>You chose to submit this later ✓</div>
                  <div style={{ fontSize: 11.5, marginTop: 4 }}>Tap here to upload it now instead</div>
                </div>
              ) : (
                <>
                  <div style={{ fontSize: 13, fontWeight: 600, color: "var(--dv-ink)" }}>Click to upload</div>
                  <div style={{ fontSize: 11, marginTop: 4 }}>PNG, JPG, PDF up to 10MB</div>
                </>
              )}
            </label>
            {isIdQuestion && !hasFile && !deferred && (
              <button
                type="button"
                onClick={() => commitAnswer(q.id, SUBMIT_LATER)}
                style={{ marginTop: 10, width: "100%", padding: "11px", background: "transparent", border: "1.5px solid #cbd5e1", borderRadius: 10, fontSize: 13, fontWeight: 600, color: "var(--dv-muted)", cursor: "pointer" }}
              >
                I&rsquo;ll submit my ID later
              </button>
            )}
            {isIdQuestion && (deferred || !hasFile) && (
              <div style={{ fontSize: 11, color: "var(--dv-muted)", marginTop: 8, textAlign: "center" }}>
                A government-issued ID is required before a provider can prescribe — you can send it after checkout, but it may delay your review.
              </div>
            )}
          </div>
        </div>
      );
    }

    return shell(<>
        <div className="dv-question">{contactGroup && q.id === contactGroup.anchorId ? "Let's start with your details" : q.text}</div>
        {q.helper && !(contactGroup && q.id === contactGroup.anchorId) && <div className="dv-helper">{q.helper}</div>}
        {body}
        {usesNext && <button className="dv-btn-primary" onClick={goNext}>Next</button>}
      </>);
  }

  // ════════════════════════════════════════════════════════════════════
  // DISQUALIFIED
  // ════════════════════════════════════════════════════════════════════
  if (stage === "disqualified") {
    return shell(<>
        <div className="dv-disq-title">We&apos;re sorry, but you don&apos;t qualify for {form.name.toLowerCase().includes("nad") ? "this treatment" : "GLP-1 treatments"}.</div>
        <div className="dv-disq-helper">
          Based on your answers ({disqReason}). Explore more personalized treatments designed with you in mind—click below to see what&apos;s available.
        </div>
        <button className="dv-btn-primary" onClick={finalizeAndExit}>Next</button>
      </>);
  }

  // ════════════════════════════════════════════════════════════════════
  // TREATMENT SELECT
  // ════════════════════════════════════════════════════════════════════
  if (stage === "treatment") {
    const txs = form.treatmentIds
      .map((id) => treatments.find((t) => t.id === id))
      .filter((t): t is BaskTreatment => !!t && t.active);

    if (txs.length === 0) {
      return shell(<>
          <div className="dv-question">You qualify — but no treatments are assigned</div>
          <div className="dv-helper">Your provider needs to assign treatment plans to this intake form before clients can complete the flow.</div>
          <button className="dv-btn-primary" onClick={finalizeAndExit}>← Back to admin</button>
        </>);
    }

    return shell(<>
        <div className="dv-question">Choose your treatment plan</div>
        <div className="dv-helper">Based on your answers, you&apos;re eligible for the plans below. All plans include physician oversight and prescription delivery.</div>
        <div className="dv-tx-cards">
          {txs.map((t) => {
            const isSel = selectedTxId === t.id;
            const priceNum  = parseFloat(t.price.replace(/[$,]/g, "")) || 0;
            const durMonths = parseInt(t.duration, 10) || 1;
            const perMonth  = durMonths > 1 ? Math.round(priceNum / durMonths) : 0;
            const cadenceText = ({
              monthly:       "Billed monthly",
              quarterly:     `Billed every 3 months · $${perMonth}/mo`,
              "semi-annual": `Billed every 6 months · $${perMonth}/mo`,
              annual:        durMonths === 12 ? "Billed monthly for 12 months" : `Billed annually · $${perMonth}/mo`,
              "one-time":    "One-time payment",
            } as Record<BaskBillingCycle, string>)[t.billing] || `Billed ${t.billing}`;

            const compareNum = parseFloat((t.compare || "").replace(/[$,]/g, "")) || 0;
            const savePct = compareNum > priceNum && compareNum > 0
              ? Math.round((1 - priceNum / compareNum) * 100)
              : 0;

            return (
              <div className="dv-tx-card-wrap" key={t.id}>
                {t.featured && <div className="dv-tx-ribbon">⭐ Best Value</div>}
                <button
                  className={`dv-tx-card${isSel ? " sel" : ""}`}
                  onClick={() => setSelectedTxId(t.id)}
                  type="button"
                >
                  <div className="dv-tx-head">
                    <div
                      className="dv-tx-thumb"
                      style={t.thumbnail ? { background: `#fff center/cover no-repeat url(${t.thumbnail})` } : undefined}
                    >
                      {!t.thumbnail && (t.icon || "💊")}
                    </div>
                    <div className="dv-tx-body">
                      <div>
                        <div className="dv-tx-name">{t.name}</div>
                        <div className="dv-tx-meta">
                          {t.med}{t.strength ? ` · ${t.strength}` : ""}{t.freq ? ` · ${t.freq}` : ""}
                        </div>
                      </div>
                      <div className="dv-tx-price-row">
                        <div>
                          {(() => {
                            const mo = monthlyEquivalent(t.price, t.duration);
                            const period = ({ quarterly: "every 3 months", "semi-annual": "every 6 months", annual: "annually" } as Record<string, string>)[t.billing];
                            return (
                              <>
                                <div className="dv-tx-price">{mo ?? (t.billing === "monthly" ? `${t.price}/mo` : t.price)}</div>
                                <div className="dv-tx-billing-note">{mo && period ? `Billed as ${t.price} ${period}` : cadenceText}</div>
                              </>
                            );
                          })()}
                        </div>
                        <div style={{ textAlign: "right" }}>
                          {t.compare && <div className="dv-tx-compare">{t.compare} retail</div>}
                          {savePct > 0 && <div className="dv-tx-save">SAVE {savePct}%</div>}
                        </div>
                      </div>
                    </div>
                  </div>
                  {t.includes.length > 0 && (
                    <div className="dv-tx-tail">
                      <div className="dv-tx-includes">
                        {t.includes.slice(0, 4).map((inc, j) => (
                          <div className="dv-tx-inc-item" key={j}>
                            <span className="dv-tx-check">✓</span>
                            <span>{inc}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </button>
              </div>
            );
          })}
        </div>
        <button className="dv-btn-primary" disabled={selectedTxId === null} onClick={completeIntake}>{selectedTxId !== null ? "Continue to checkout" : "Select a plan to continue"}</button>
      </>);
  }

  // ════════════════════════════════════════════════════════════════════
  // CHECKOUT — Redesigned payment page (v5) styled after MDexam reference
  // ════════════════════════════════════════════════════════════════════
  if (stage === "checkout") {
    const tx = treatments.find((t) => t.id === selectedTxId);
    if (!tx) { finalizeAndExit(); return null; }

    // Pull personalized data: first name from lead, supply cadence text,
    // and a goal weight if the form has any "weight loss goal" questions.
    const lead = leadId !== null ? useTreatmentsIntake.getState().clients.find((c) => c.id === leadId) : null;
    const firstName = (lead?.first || "").trim();
    const headingName = firstName
      ? `${firstName}${firstName.endsWith("s") ? "'" : "'s"} Care Plan`
      : "Your Care Plan";

    const durMonths = parseInt(tx.duration, 10) || 1;
    const supplyText = durMonths === 1
      ? "1-Month Supply Shipped Monthly"
      : `${durMonths}-Month Supply Shipped ${tx.billing === "monthly" ? "Monthly" : tx.billing === "quarterly" ? "Quarterly" : "Periodically"}`;

    // Try to derive a target-weight bullet from the patient's answers
    const allQs = form?.questions || [];
    let goalLine = "";
    for (const q of allQs) {
      const lbl = (q.text || "").toLowerCase();
      const a = answers[q.id];
      if (typeof a !== "string" || !a) continue;
      if (lbl.includes("weight loss goal") || (lbl.includes("goal") && (lbl.includes("lbs") || lbl.includes("weight")))) {
        goalLine = `Goal: ${a}`;
        break;
      }
    }

    return shell(<>
        <h1 className="dv-plan-heading">{headingName}</h1>

        {/* ─── Plan summary card with floating thumbnail ─── */}
        <div className="dv-plan-card-wrap">
          <div className="dv-plan-card">
            <div className="dv-plan-name">{tx.med}{tx.strength ? ` ${tx.strength}` : ""}</div>
            <div className="dv-plan-meta">{tx.name}</div>

            <div className="dv-plan-bullets">
              <div className="dv-plan-bullet">
                <span className="dv-plan-bullet-icon">💉</span>
                <span>{supplyText}</span>
              </div>
              {goalLine && (
                <div className="dv-plan-bullet">
                  <span className="dv-plan-bullet-icon">🎯</span>
                  <span>{goalLine}</span>
                </div>
              )}
              <div className="dv-plan-bullet">
                <span className="dv-plan-bullet-icon">🛡</span>
                <span>Full Refund if Not Qualified</span>
              </div>
            </div>
          </div>

          {/* Floating product thumbnail (sticks out past card edge) */}
          <div
            className="dv-plan-thumb"
            style={tx.thumbnail ? { background: `#fff center/cover no-repeat url(${tx.thumbnail})` } : undefined}
          >
            {!tx.thumbnail && (tx.icon || "💉")}
            {!tx.thumbnail && (
              <div className="dv-plan-thumb-label">
                Compounded<br />
                {tx.med}<br />
                <span style={{ fontSize: 7.5, opacity: 0.85 }}>{tx.strength || "1 mg/2 mL"}</span>
              </div>
            )}
          </div>
        </div>

        {/* ─── Shipping address the patient entered earlier ─── */}
        {(coAddr.line1 || coAddr.zip) && (() => {
          const stName = US_STATES.find((s) => s.abbr === coAddr.state)?.name || coAddr.state;
          return (
            <>
              <h2 className="dv-section-h">Shipping Address</h2>
              <div style={{ background: "var(--dv-card)", border: "1px solid var(--dv-border)", borderRadius: 12, padding: "12px 14px", marginBottom: 14, fontSize: 13, color: "var(--dv-ink)", lineHeight: 1.5 }}>
                {(firstName || lead?.last) && <div style={{ fontWeight: 700 }}>{`${firstName} ${lead?.last || ""}`.trim()}</div>}
                {coAddr.line1 && <div>{coAddr.line1}{coAddr.apt ? `, ${coAddr.apt}` : ""}</div>}
                <div>{[coAddr.city, stName, coAddr.zip].filter(Boolean).join(", ")}</div>
                <div style={{ fontSize: 11, color: "var(--dv-muted)", marginTop: 5 }}>📦 Your medication ships here after a provider approves your treatment.</div>
              </div>
            </>
          );
        })()}

        {/* ─── Payment Method ─── */}
        {isHosted ? (
          <div style={{ background: "var(--dv-card)", border: "1px solid var(--dv-border)", borderRadius: 12, padding: "14px 16px", margin: "8px 0 4px", fontSize: 13, color: "var(--dv-ink)", lineHeight: 1.5 }}>
            <div style={{ fontWeight: 700, marginBottom: 4 }}>🔒 Secure payment</div>
            You&apos;ll enter your card details on the next screen, hosted securely by {isStripe ? "Stripe" : "our payment provider"}. Your card is never stored on our servers.
          </div>
        ) : (
        <>
        <h2 className="dv-section-h">Payment Method</h2>
        <div className="dv-pay-fields">
          <div className="dv-input-wrap">
            <input className="dv-input" placeholder="Name on card" value={coCardName} onChange={(e) => setCoCardName(e.target.value)} />
          </div>
          <div className="dv-input-wrap">
            <input className="dv-input" placeholder="Card number" maxLength={19} value={formatCardNum(coCardNum)} onChange={(e) => setCoCardNum(e.target.value.replace(/\D/g, "").slice(0, 16))} />
          </div>
          <div className="dv-field-row">
            <div className="dv-input-wrap">
              <input className="dv-input" placeholder="MM / YY" maxLength={7} value={coCardExp} onChange={(e) => {
                let cleaned = e.target.value.replace(/\D/g, "").slice(0, 4);
                if (cleaned.length >= 3) cleaned = cleaned.slice(0, 2) + " / " + cleaned.slice(2);
                else if (cleaned.length === 2) cleaned = cleaned + " / ";
                setCoCardExp(cleaned);
              }} />
            </div>
            <div className="dv-input-wrap">
              <input className="dv-input" placeholder="CVV" maxLength={4} value={coCardCvc} onChange={(e) => setCoCardCvc(e.target.value.replace(/\D/g, ""))} />
            </div>
          </div>
        </div>

        {/* ─── Billing Address ─── */}
        <h2 className="dv-section-h">Billing Address</h2>
        <div className="dv-pay-fields">
          <div className="dv-input-wrap">
            <input className="dv-input" placeholder="Street address" value={coAddr.line1} onChange={(e) => setCoAddr({ ...coAddr, line1: e.target.value })} />
          </div>
          <div className="dv-input-wrap">
            <input className="dv-input" placeholder="Apartment / Suite (optional)" value={coAddr.apt} onChange={(e) => setCoAddr({ ...coAddr, apt: e.target.value })} />
          </div>
          <div className="dv-field-row">
            <div className="dv-input-wrap" style={{ flex: 2 }}>
              <input className="dv-input" placeholder="City" value={coAddr.city} onChange={(e) => setCoAddr({ ...coAddr, city: e.target.value })} />
            </div>
            <div className="dv-input-wrap" style={{ flex: 1 }}>
              <select className="dv-input" value={coAddr.state} onChange={(e) => setCoAddr({ ...coAddr, state: e.target.value })}>
                <option value="" disabled>State</option>
                {US_STATES.map((s) => <option key={s.abbr} value={s.abbr}>{s.name}</option>)}
              </select>
            </div>
            <div className="dv-input-wrap" style={{ flex: 1 }}>
              <input className="dv-input" placeholder="ZIP" value={coAddr.zip} onChange={(e) => setCoAddr({ ...coAddr, zip: e.target.value })} />
            </div>
          </div>
        </div>
        </>
        )}

        {/* ─── Agreements ─── */}
        <h2 className="dv-section-h">Agreements</h2>
        <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 16 }}>
          {activeConsents.map((d) => (
            <label key={d.id} style={{ display: "flex", gap: 10, alignItems: "flex-start", fontSize: 13, color: "var(--dv-ink)", cursor: "pointer" }}>
              <input type="checkbox" checked={!!legalAck[d.id]} onChange={(e) => setLegalAck((x) => ({ ...x, [d.id]: e.target.checked }))} style={{ marginTop: 2, width: 16, height: 16, flexShrink: 0 }} />
              <span>I have read and agree to the <a href={`/legal/${d.slug}`} target="_blank" rel="noreferrer" style={{ color: "#3b7fc4", textDecoration: "underline" }}>{d.title}</a> <span style={{ color: "var(--dv-muted)" }}>({d.version})</span>.</span>
            </label>
          ))}
        </div>

        {/* ─── Total + CTA ─── */}
        <div className="dv-total-row">
          <span className="dv-total-lbl">Total today</span>
          <span className="dv-total-val">{tx.price}</span>
        </div>
        {monthlyEquivalent(tx.price, tx.duration) && (
          <div style={{ textAlign: "right", fontSize: 12.5, fontWeight: 700, color: "var(--blue, #4a8ec7)", marginTop: 2 }}>
            ≈ {monthlyEquivalent(tx.price, tx.duration)} over {tx.duration} months
          </div>
        )}

        <button className="dv-btn-primary" onClick={submitPayment} disabled={!activeConsents.every((d) => legalAck[d.id])} style={!activeConsents.every((d) => legalAck[d.id]) ? { opacity: 0.55, cursor: "not-allowed" } : undefined}>{isHosted ? "Continue to secure payment →" : "Complete purchase →"}</button>

        <div className="dv-trust">
          <span>🔒 256-bit SSL secured</span>·
          <span>No charge until doctor approves</span>·
          <span>Cancel anytime</span>
        </div>

        <div style={{ textAlign: "center", marginTop: 14 }}>
          <button onClick={finalizeAndExit} style={{ background: "none", border: "none", color: "var(--dv-muted)", cursor: "pointer", textDecoration: "underline", fontSize: 12 }}>← Back to admin (simulates abandoning)</button>
        </div>
      </>);
  }

  // ════════════════════════════════════════════════════════════════════
  // SUCCESS — "Thank you... here's what's next" with 3 step cards
  // ════════════════════════════════════════════════════════════════════
  if (stage === "success") {
    return shell(<>
        <div className="dv-question">Thank you for completing the quiz and placing your order. Here&apos;s what&apos;s next:</div>

        {live && (
          <div className="dv-fields" style={{ marginTop: 22, padding: 16, border: "1px solid var(--dv-border, #e6e9ef)", borderRadius: 12 }}>
            {pwSaved ? (
              <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 14, fontWeight: 600, color: "var(--dv-brand-dk, #166b57)" }}>
                ✓ Password set — you can now sign in to your patient portal anytime.
              </div>
            ) : (
              <>
                <div className="dv-question" style={{ fontSize: 17, marginBottom: 2 }}>Create your password</div>
                <div className="dv-helper" style={{ marginBottom: 4 }}>Set a password to access your patient portal and track your treatment. We&apos;ve also emailed you a link in case you&apos;d rather do it later.</div>
                <div>
                  <div className="dv-field-label">Password</div>
                  <div className="dv-input-wrap"><input className="dv-input" type="password" value={pw} onChange={(e) => setPw(e.target.value)} autoComplete="new-password" placeholder="At least 8 characters" /></div>
                </div>
                <div>
                  <div className="dv-field-label">Confirm password</div>
                  <div className="dv-input-wrap"><input className="dv-input" type="password" value={pw2} onChange={(e) => setPw2(e.target.value)} autoComplete="new-password" placeholder="Re-enter password" onKeyDown={(e) => { if (e.key === "Enter") handleSetPassword(); }} /></div>
                </div>
                {pwErr && <div style={{ color: "var(--dv-red, #c0392b)", fontSize: 13, fontWeight: 600 }}>{pwErr}</div>}
                <button className="dv-btn-primary" onClick={handleSetPassword} style={{ marginTop: 4 }}>Set password</button>
              </>
            )}
          </div>
        )}

        <div className="dv-success-list" style={{ marginTop: 28 }}>
          <div className="dv-success-step done">
            <div className="dv-success-step-body">
              <div className="dv-success-step-title">Wrapping up</div>
              <div className="dv-success-step-desc">Enter shipping &amp; payment details, verify your identity, and submit assessment.</div>
            </div>
            <div className="dv-success-step-img">📱</div>
          </div>
          <div className="dv-success-step pending">
            <div className="dv-success-step-body">
              <div className="dv-success-step-title">Provider review</div>
              <div className="dv-success-step-desc">A licensed provider reviews your health history and prescribes a treatment plan.</div>
            </div>
            <div className="dv-success-step-img">👨‍⚕️</div>
          </div>
          <div className="dv-success-step pending">
            <div className="dv-success-step-body">
              <div className="dv-success-step-title">If prescribed</div>
              <div className="dv-success-step-desc">Your card gets charged and your medication gets shipped right to your door for free.</div>
            </div>
            <div className="dv-success-step-img">📦</div>
          </div>
        </div>
        <button className="dv-btn-primary" onClick={onExit} style={{ marginTop: 32 }}>Go to Home</button>
      </>, true);
  }

  return null;
}
