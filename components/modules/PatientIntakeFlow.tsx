"use client";

import { useState, useEffect, useMemo } from "react";
import { createPortal } from "react-dom";
import type { ReactNode } from "react";
import { toast } from "@/lib/hooks/useToast";
import { useTreatmentsIntake } from "@/lib/hooks/useTreatmentsIntake";
import type { BaskQuestion, BaskTreatment, BaskBillingCycle } from "@/lib/types/treatmentsIntake";

function nowStamp(): string {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;
}

// Full state names with their 2-letter value (value stays the abbr for downstream routing).
const US_STATES: { abbr: string; name: string }[] = [
  ["AL","Alabama"],["AK","Alaska"],["AZ","Arizona"],["AR","Arkansas"],["CA","California"],["CO","Colorado"],["CT","Connecticut"],["DE","Delaware"],["DC","District of Columbia"],["FL","Florida"],["GA","Georgia"],["HI","Hawaii"],["ID","Idaho"],["IL","Illinois"],["IN","Indiana"],["IA","Iowa"],["KS","Kansas"],["KY","Kentucky"],["LA","Louisiana"],["ME","Maine"],["MD","Maryland"],["MA","Massachusetts"],["MI","Michigan"],["MN","Minnesota"],["MS","Mississippi"],["MO","Missouri"],["MT","Montana"],["NE","Nebraska"],["NV","Nevada"],["NH","New Hampshire"],["NJ","New Jersey"],["NM","New Mexico"],["NY","New York"],["NC","North Carolina"],["ND","North Dakota"],["OH","Ohio"],["OK","Oklahoma"],["OR","Oregon"],["PA","Pennsylvania"],["RI","Rhode Island"],["SC","South Carolina"],["SD","South Dakota"],["TN","Tennessee"],["TX","Texas"],["UT","Utah"],["VT","Vermont"],["VA","Virginia"],["WA","Washington"],["WV","West Virginia"],["WI","Wisconsin"],["WY","Wyoming"],
].map(([abbr, name]) => ({ abbr, name }));

// Format a phone number as (786) 370-8570.
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
export function PatientIntakeFlow({ formId, onExit, live = false, onComplete }: { formId: number; onExit: () => void; live?: boolean; onComplete?: (clientId: number, treatmentId: number | null) => void }) {
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

  // Checkout state
  const [coCardNum,  setCoCardNum]  = useState("");
  const [coCardExp,  setCoCardExp]  = useState("");
  const [coCardCvc,  setCoCardCvc]  = useState("");
  const [coCardName, setCoCardName] = useState("");
  const [coAddr, setCoAddr] = useState({ line1: "", apt: "", city: "", state: "", zip: "" });

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
  // Email + phone are shown together on one card. Find both, keep whichever
  // appears first as the combined card, and hide the other from the flow.
  const contactPair = (() => {
    const emailQ = form.questions.find((q) => q.type === "email" || (q.type === "text" && /email/i.test(q.text)));
    const phoneQ = form.questions.find((q) => q.type === "phone" || (q.type === "text" && /phone/i.test(q.text)));
    if (emailQ && phoneQ && emailQ.id !== phoneQ.id) {
      const keep = form.questions.indexOf(emailQ) <= form.questions.indexOf(phoneQ) ? emailQ : phoneQ;
      const hideId = keep.id === emailQ.id ? phoneQ.id : emailQ.id;
      return { emailId: emailQ.id, phoneId: phoneQ.id, keepId: keep.id, hideId };
    }
    return null;
  })();

  const visibleQs = form.questions.filter((q) => q.type !== "section" && !(contactPair && q.id === contactPair.hideId));
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
      // Full name → may be stored as JSON {first,last} (split boxes) or a plain string
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

    if (zipFromAnswer) {
      patch.address = { line1: "", apt: "", city: "", state: "", zip: zipFromAnswer };
    }

    if (Object.keys(patch).length > 0) {
      updateClient(leadId, patch);
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
    if (q.impact !== "disqualifier") return null;
    if (q.type === "yesno" && v === "Yes") return q.text;
    if (q.type === "checkbox" && Array.isArray(v)) {
      const hits = v.filter((val) => {
        const opt = (q.options || []).find((o) => (typeof o === "string" ? o : o.label) === val);
        return opt && typeof opt === "object" && opt.flag === "disq";
      });
      if (hits.length > 0) return hits.join(", ");
    }
    if (q.type === "date" && typeof v === "string" && v) {
      let dob: Date | null = null;
      if (v.startsWith("{")) {
        try { const o = JSON.parse(v); if (o.y && o.m && o.d) dob = new Date(+o.y, +o.m - 1, +o.d); } catch { dob = null; }
      } else { dob = new Date(v); }
      if (dob && !isNaN(dob.getTime())) {
        const age = (Date.now() - dob.getTime()) / (1000 * 60 * 60 * 24 * 365.25);
        if (age < 18) return "Under 18 years old";
      }
    }
    return null;
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
      // Split name needs both first AND last
      if (isFullNameQ(q)) {
        try { const o = JSON.parse(String(answers[q.id] || "{}")); if (!(o.first || "").trim() || !(o.last || "").trim()) { toast("Please enter your first and last name"); return; } }
        catch { toast("Please enter your first and last name"); return; }
      }
      // DOB needs all three boxes
      if (q.type === "date") {
        try { const o = JSON.parse(String(answers[q.id] || "{}")); if (!o.m || !o.d || !o.y || String(o.y).length < 4) { toast("Please enter your full date of birth"); return; } }
        catch { toast("Please enter your full date of birth"); return; }
      }
      // Combined contact card needs both email and phone
      if (contactPair && q.id === contactPair.keepId) {
        const em = String(answers[contactPair.emailId] || "").trim();
        const ph = String(answers[contactPair.phoneId] || "").replace(/\D/g, "");
        if (!em || !em.includes("@")) { toast("Please enter a valid email"); return; }
        if (ph.length < 10) { toast("Please enter a valid phone number"); return; }
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
    if (step + 1 >= totalQ) {
      // Finished all questions — extract contact info from answers into the
      // lead record before moving to treatment selection.
      extractContactFromAnswers();
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
      if (step + 1 >= totalQ) {
        extractContactFromAnswers();
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
    if (coCardNum.length < 13) { toast("Please enter a valid card number"); return; }
    if (coCardExp.replace(/\D/g, "").length < 4) { toast("Please enter expiration as MM/YY"); return; }
    if (coCardCvc.length < 3) { toast("Please enter a valid CVC"); return; }
    if (!coCardName.trim()) { toast("Please enter the name on the card"); return; }
    if (!coAddr.line1 || !coAddr.city || !coAddr.state || !coAddr.zip) { toast("Please complete your shipping address"); return; }
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

    if (contactPair && q.id === contactPair.keepId) {
      // Combined Email + Phone card
      const emailVal = (answers[contactPair.emailId] as string) || "";
      const phoneVal = (answers[contactPair.phoneId] as string) || "";
      body = (
        <div className="dv-fields">
          <div>
            <div className="dv-field-label">Email address</div>
            <div className="dv-input-wrap">
              <input key={`${contactPair.emailId}-em`} className="dv-input" type="email" defaultValue={emailVal} onChange={(e) => commitAnswer(contactPair.emailId, e.target.value)} autoComplete="off" placeholder="you@example.com" />
            </div>
          </div>
          <div>
            <div className="dv-field-label">Phone number</div>
            <div className="dv-input-wrap">
              <input key={`${contactPair.phoneId}-ph`} className="dv-input" type="tel" defaultValue={phoneVal} autoComplete="off" placeholder="(786) 370-8570"
                onChange={(e) => commitAnswer(contactPair.phoneId, e.target.value)}
                onBlur={(e) => { const f = formatPhone(e.target.value); e.target.value = f; commitAnswer(contactPair.phoneId, f); }} />
            </div>
          </div>
        </div>
      );
    } else if (isFullNameQ(q)) {
      // Full legal name → First + Last boxes (stored as JSON {first,last})
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
      let parsed: { line1: string; line2: string; city: string; state: string; zip: string } = { line1: "", line2: "", city: "", state: "", zip: "" };
      try { if (typeof a === "string" && a) parsed = { ...parsed, ...JSON.parse(a) }; } catch { /* ignore */ }
      function patchAddr(field: keyof typeof parsed, v: string) {
        const next = { ...parsed, [field]: v };
        commitAnswer(q.id, JSON.stringify(next));
      }
      body = (
        <div className="dv-fields">
          <div>
            <div className="dv-field-label">Street address</div>
            <div className="dv-input-wrap">
              <input key={`${q.id}-line1`} className="dv-input" defaultValue={parsed.line1} onChange={(e) => patchAddr("line1", e.target.value)} autoComplete="off" placeholder="123 Main St" />
            </div>
          </div>
          <div>
            <div className="dv-field-label">Apartment / Suite (optional)</div>
            <div className="dv-input-wrap">
              <input key={`${q.id}-line2`} className="dv-input" defaultValue={parsed.line2} onChange={(e) => patchAddr("line2", e.target.value)} autoComplete="off" placeholder="Apt 4B" />
            </div>
          </div>
          <div className="dv-field-row">
            <div>
              <div className="dv-field-label">City</div>
              <div className="dv-input-wrap">
                <input key={`${q.id}-city`} className="dv-input" defaultValue={parsed.city} onChange={(e) => patchAddr("city", e.target.value)} autoComplete="off" />
              </div>
            </div>
            <div>
              <div className="dv-field-label">State</div>
              <div className="dv-input-wrap">
                <select key={`${q.id}-state`} className="dv-input" defaultValue={parsed.state} onChange={(e) => patchAddr("state", e.target.value)}>
                  <option value="" disabled>Select state…</option>
                  {US_STATES.map((s) => <option key={s.abbr} value={s.abbr}>{s.name}</option>)}
                </select>
              </div>
            </div>
          </div>
          <div>
            <div className="dv-field-label">ZIP Code</div>
            <div className="dv-input-wrap">
              <input key={`${q.id}-zip`} className="dv-input" defaultValue={parsed.zip} onChange={(e) => patchAddr("zip", e.target.value)} autoComplete="off" />
            </div>
          </div>
        </div>
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
      const hasFile = typeof a === "string" && a;
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
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) commitAnswer(q.id, file.name);
                }}
              />
              <div style={{ fontSize: 32, marginBottom: 6 }}>📎</div>
              {hasFile ? (
                <div style={{ fontSize: 13, fontWeight: 600, color: "var(--dv-ink)" }}>{a as string}</div>
              ) : (
                <>
                  <div style={{ fontSize: 13, fontWeight: 600, color: "var(--dv-ink)" }}>Click to upload</div>
                  <div style={{ fontSize: 11, marginTop: 4 }}>PNG, JPG, PDF up to 10MB</div>
                </>
              )}
            </label>
          </div>
        </div>
      );
    }

    return shell(<>
        <div className="dv-question">{contactPair && q.id === contactPair.keepId ? "How can we reach you?" : q.text}</div>
        {q.helper && !(contactPair && q.id === contactPair.keepId) && <div className="dv-helper">{q.helper}</div>}
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
                          <div className="dv-tx-price">{t.price}</div>
                          <div className="dv-tx-billing-note">{cadenceText}</div>
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

        {/* ─── Total + CTA ─── */}
        <div className="dv-total-row">
          <span className="dv-total-lbl">Total today</span>
          <span className="dv-total-val">{tx.price}</span>
        </div>

        <button className="dv-btn-primary" onClick={submitPayment}>Complete purchase →</button>

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
