"use client";

import { create } from "@/lib/hooks/zustand-shim";
import type { BaskTreatment, BaskIntakeForm, BaskClient, BaskQuestion } from "@/lib/types/treatmentsIntake";
import { SEED_TREATMENTS, SEED_FORMS, SEED_CLIENTS } from "@/lib/data/treatmentsIntakeSeed";
import { useEffect, useState } from "react";

interface State {
  treatments: BaskTreatment[];
  forms:      BaskIntakeForm[];
  clients:    BaskClient[];

  // Treatments
  addTreatment:    (t: Omit<BaskTreatment, "id">) => BaskTreatment;
  updateTreatment: (id: number, patch: Partial<BaskTreatment>) => void;
  deleteTreatment: (id: number) => void;
  duplicateTreatment: (id: number) => void;

  // Forms
  addForm:    (f: Omit<BaskIntakeForm, "id">) => BaskIntakeForm;
  updateForm: (id: number, patch: Partial<BaskIntakeForm>) => void;
  deleteForm: (id: number) => void;

  // Questions inside a form
  addQuestion:       (formId: number, q: Omit<BaskQuestion, "id">) => BaskQuestion;
  updateQuestion:    (formId: number, qid: number, patch: Partial<BaskQuestion>) => void;
  deleteQuestion:    (formId: number, qid: number) => void;
  duplicateQuestion: (formId: number, qid: number) => void;
  moveQuestion:      (formId: number, fromIdx: number, toIdx: number) => void;

  // Treatment assignment on a form
  toggleAssign: (formId: number, txId: number) => void;

  // Qualification rules (per-form)
  toggleHardRule:   (formId: number, ruleId: string) => void;
  toggleDrugRule:   (formId: number, ruleId: string) => void;
  toggleReviewRule: (formId: number, ruleId: string) => void;

  // Clients
  addClient:     (c: Omit<BaskClient, "id">) => BaskClient;
  updateClient:  (id: number, patch: Partial<BaskClient>) => void;
  deleteClient:  (id: number) => void;
}

// ─── localStorage persistence ──────────────────────────────────────────
// v3 because the schema changed (new question types + rules on each form).
// Old v2 data is no longer compatible — admins will re-hydrate from SEED.
// v4: name/email/phone collapsed into a single "personal_info" question.
// v5: added anti-aging intake forms (NAD+ expanded, Sermorelin, Glutathione)
//     and treatments to SEED — bump forces a clean re-hydrate so they appear.
//     Old v4 data remains in localStorage (under the old key) and is untouched.
const LS_KEY = "dripvitals_treatments_v5";

// Only data fields are persisted. Action functions are NOT serialized —
// they're re-created at module load.
type PersistedShape = {
  treatments: BaskTreatment[];
  forms:      BaskIntakeForm[];
  clients:    BaskClient[];
};

function loadFromStorage(): PersistedShape | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(LS_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw);
    if (!data || typeof data !== "object") return null;
    if (!Array.isArray(data.treatments) || !Array.isArray(data.forms) || !Array.isArray(data.clients)) {
      return null;
    }
    return data as PersistedShape;
  } catch {
    return null;
  }
}

function saveToStorage(state: State) {
  if (typeof window === "undefined") return;
  try {
    const payload: PersistedShape = {
      treatments: state.treatments,
      forms:      state.forms,
      clients:    state.clients,
    };
    window.localStorage.setItem(LS_KEY, JSON.stringify(payload));
  } catch {
    // quota errors, private mode, etc. — silently ignore
  }
}

let nextTreatmentId = SEED_TREATMENTS.length + 1;
let nextFormId      = SEED_FORMS.length + 1;
let nextClientId    = SEED_CLIENTS.length + 1;
let nextQId         = 1000;

// After hydration we bump the id counters past any persisted records to
// prevent new items from colliding with existing ids.
function bumpIdCounters(data: PersistedShape) {
  const maxTx = data.treatments.reduce((m, t) => Math.max(m, t.id), 0);
  const maxFm = data.forms.reduce((m, f) => Math.max(m, f.id), 0);
  const maxCl = data.clients.reduce((m, c) => Math.max(m, c.id), 0);
  const maxQ  = data.forms.reduce((m, f) => f.questions.reduce((mm, q) => Math.max(mm, q.id), m), 0);
  nextTreatmentId = Math.max(nextTreatmentId, maxTx + 1);
  nextFormId      = Math.max(nextFormId,      maxFm + 1);
  nextClientId    = Math.max(nextClientId,    maxCl + 1);
  nextQId         = Math.max(nextQId,         maxQ  + 1);
}

export const useTreatmentsIntake = create<State>((set) => ({
  treatments: SEED_TREATMENTS,
  forms:      SEED_FORMS,
  clients:    SEED_CLIENTS,

  addTreatment: (t) => {
    const created: BaskTreatment = { id: nextTreatmentId++, ...t };
    set((s) => ({ treatments: [...s.treatments, created] }));
    return created;
  },
  updateTreatment: (id, patch) => set((s) => ({
    treatments: s.treatments.map((t) => (t.id === id ? { ...t, ...patch } : t)),
  })),
  deleteTreatment: (id) => set((s) => ({
    treatments: s.treatments.filter((t) => t.id !== id),
    forms: s.forms.map((f) => ({ ...f, treatmentIds: f.treatmentIds.filter((x) => x !== id) })),
  })),
  duplicateTreatment: (id) => set((s) => {
    const t = s.treatments.find((x) => x.id === id);
    if (!t) return {};
    const copy: BaskTreatment = {
      ...t, id: nextTreatmentId++, name: t.name + " (Copy)",
      active: false, featured: false, subscribers: 0, includes: [...t.includes],
    };
    return { treatments: [...s.treatments, copy] };
  }),

  addForm: (f) => {
    const created: BaskIntakeForm = { id: nextFormId++, ...f };
    set((s) => ({ forms: [...s.forms, created] }));
    return created;
  },
  updateForm: (id, patch) => set((s) => ({
    forms: s.forms.map((f) => (f.id === id ? { ...f, ...patch } : f)),
  })),
  deleteForm: (id) => set((s) => ({ forms: s.forms.filter((f) => f.id !== id) })),

  addQuestion: (formId, q) => {
    const created: BaskQuestion = { id: nextQId++, ...q };
    set((s) => ({
      forms: s.forms.map((f) => (f.id === formId ? { ...f, questions: [...f.questions, created] } : f)),
    }));
    return created;
  },
  updateQuestion: (formId, qid, patch) => set((s) => ({
    forms: s.forms.map((f) => f.id === formId
      ? { ...f, questions: f.questions.map((q) => (q.id === qid ? { ...q, ...patch } : q)) }
      : f),
  })),
  deleteQuestion: (formId, qid) => set((s) => ({
    forms: s.forms.map((f) => f.id === formId
      ? { ...f, questions: f.questions.filter((q) => q.id !== qid) }
      : f),
  })),
  duplicateQuestion: (formId, qid) => set((s) => ({
    forms: s.forms.map((f) => {
      if (f.id !== formId) return f;
      const idx = f.questions.findIndex((q) => q.id === qid);
      if (idx < 0) return f;
      const src = f.questions[idx];
      const copy: BaskQuestion = JSON.parse(JSON.stringify({ ...src, id: nextQId++, text: src.text + " (copy)" }));
      const next = [...f.questions];
      next.splice(idx + 1, 0, copy);
      return { ...f, questions: next };
    }),
  })),
  moveQuestion: (formId, fromIdx, toIdx) => set((s) => ({
    forms: s.forms.map((f) => {
      if (f.id !== formId) return f;
      const next = [...f.questions];
      const [moved] = next.splice(fromIdx, 1);
      next.splice(toIdx, 0, moved);
      return { ...f, questions: next };
    }),
  })),

  toggleAssign: (formId, txId) => set((s) => ({
    forms: s.forms.map((f) => {
      if (f.id !== formId) return f;
      const has = f.treatmentIds.includes(txId);
      return { ...f, treatmentIds: has ? f.treatmentIds.filter((x) => x !== txId) : [...f.treatmentIds, txId] };
    }),
  })),

  // Per-form rule toggles. We flip a rule's `active` flag in place.
  toggleHardRule: (formId, ruleId) => set((s) => ({
    forms: s.forms.map((f) => {
      if (f.id !== formId) return f;
      const rules = (f.hardRules || []).map((r) => r.id === ruleId ? { ...r, active: !r.active } : r);
      return { ...f, hardRules: rules };
    }),
  })),
  toggleDrugRule: (formId, ruleId) => set((s) => ({
    forms: s.forms.map((f) => {
      if (f.id !== formId) return f;
      const rules = (f.drugRules || []).map((r) => r.id === ruleId ? { ...r, active: !r.active } : r);
      return { ...f, drugRules: rules };
    }),
  })),
  toggleReviewRule: (formId, ruleId) => set((s) => ({
    forms: s.forms.map((f) => {
      if (f.id !== formId) return f;
      const rules = (f.reviewRules || []).map((r) => r.id === ruleId ? { ...r, active: !r.active } : r);
      return { ...f, reviewRules: rules };
    }),
  })),

  addClient: (c) => {
    const created: BaskClient = { id: nextClientId++, ...c };
    set((s) => ({ clients: [...s.clients, created] }));
    return created;
  },
  updateClient: (id, patch) => set((s) => ({
    clients: s.clients.map((c) => (c.id === id ? { ...c, ...patch } : c)),
  })),
  deleteClient: (id) => set((s) => ({ clients: s.clients.filter((c) => c.id !== id) })),
}));

// ─── Hydration hook ────────────────────────────────────────────────────
// Call this once at the top of the treatments page (or any client component
// that gates the rest of the UI). On mount it:
//   1. Reads localStorage (if any) and applies the persisted treatments /
//      forms / clients to the zustand store.
//   2. Subscribes to store changes and writes back to localStorage on
//      every mutation.
//
// Initial SSR + client-first-render state stays as SEED so React's
// hydration matches; the persisted overlay applies AFTER mount.
//
// The returned `hydrated` flag flips to true once we've checked localStorage,
// so callers can show a loading skeleton if the SEED→persisted flash is
// visually distracting. (Most pages are fine without gating on it.)
let hydrationDone = false;

export function useHydrateTreatmentsStore() {
  const [hydrated, setHydrated] = useState(hydrationDone);

  useEffect(() => {
    if (hydrationDone) {
      setHydrated(true);
      return;
    }
    const persisted = loadFromStorage();
    if (persisted) {
      bumpIdCounters(persisted);
      useTreatmentsIntake.setState({
        treatments: persisted.treatments,
        forms:      persisted.forms,
        clients:    persisted.clients,
      });
    }
    hydrationDone = true;
    setHydrated(true);

    // Subscribe AFTER applying the persisted state so we don't immediately
    // overwrite localStorage on the first apply.
    const unsubscribe = useTreatmentsIntake.subscribe(() => {
      saveToStorage(useTreatmentsIntake.getState());
    });

    return unsubscribe;
  }, []);

  return hydrated;
}

// Reset the store to seed defaults, clear localStorage, AND overwrite the
// server-persisted copies. serverPersist pulls "intake-forms" / "treatments"
// from the server on every load and applies them over the seed, so resetting
// locally is not enough — we must replace the saved server copy too, and wait
// for that write to finish before the caller reloads the page.
export async function resetTreatmentsStoreToDefaults() {
  if (typeof window !== "undefined") {
    try { window.localStorage.removeItem(LS_KEY); } catch { /* ignore */ }
  }
  nextTreatmentId = SEED_TREATMENTS.length + 1;
  nextFormId      = SEED_FORMS.length + 1;
  nextClientId    = SEED_CLIENTS.length + 1;
  nextQId         = 1000;

  // Preserve uploaded treatment thumbnails. A "reset" restores the default
  // catalog *content*, but must NOT wipe pictures an operator uploaded via the
  // treatment editor. We read the current server copy, map id -> thumbnail, and
  // re-apply those thumbnails onto matching seed treatments before pushing, so
  // future content updates never delete existing pictures.
  let treatments: typeof SEED_TREATMENTS = SEED_TREATMENTS;
  if (typeof window !== "undefined") {
    try {
      const r = await fetch(`/api/store/treatments`, { cache: "no-store" });
      const d = await r.json();
      const current: Array<{ id: number; thumbnail?: string }> = Array.isArray(d?.data) ? d.data : [];
      const thumbById = new Map<number, string>();
      current.forEach((t) => { if (t && t.thumbnail) thumbById.set(t.id, t.thumbnail); });
      if (thumbById.size > 0) {
        treatments = SEED_TREATMENTS.map((t) =>
          thumbById.has(t.id) ? { ...t, thumbnail: thumbById.get(t.id) } : t,
        );
      }
    } catch { /* ignore — fall back to seed without thumbnails */ }
  }

  useTreatmentsIntake.setState({
    treatments,
    forms:      SEED_FORMS,
    clients:    SEED_CLIENTS,
  });
  if (typeof window !== "undefined") {
    const put = (domain: string, data: unknown) =>
      fetch(`/api/store/${domain}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ data }) });
    try {
      await Promise.all([
        put("intake-forms", SEED_FORMS),
        put("treatments", treatments),
      ]);
    } catch { /* ignore — local reset still applied */ }
  }
}

