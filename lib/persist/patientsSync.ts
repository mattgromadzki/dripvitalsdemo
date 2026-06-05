"use client";

import { usePatients } from "@/lib/hooks/usePatients";
import type { Patient } from "@/lib/types";
import { registerPull, isVisible } from "@/lib/persist/syncTrigger";

/**
 * Keeps the patient roster in sync with the server, per-record:
 *  - pulls server patients in (intake-created + edits from other devices)
 *  - writes local edits back to the server (so they persist & don't get reverted)
 *
 * Per-record (not a whole-roster blob) so a patient device creating ONE patient
 * during intake can't overwrite the staff's full roster. An equality guard keyed
 * by patient id prevents write/apply feedback loops and stops the poll from
 * reverting a fresh local edit. Last-write-wins across devices.
 */
let started = false;
const lastById = new Map<string, string>();

export function startPatientsSync(pollMs = 5000): void {
  if (typeof window === "undefined" || started) return;
  started = true;
  const store = usePatients;

  // Baseline: treat the current (seed) roster as already-known so unedited demo
  // patients aren't pushed to the server — only real edits get written.
  for (const p of store.getState().patients) lastById.set(p.id, JSON.stringify(p));

  const applyServer = (p: Patient) => {
    const existing = store.getState().patients.find((x) => x.id === p.id);
    const merged = existing ? { ...existing, ...p } : p;
    const s = JSON.stringify(merged);
    if (lastById.get(p.id) === s) return;      // already in sync
    lastById.set(p.id, s);                      // set BEFORE upsert so write-back skips the echo
    store.getState().upsert(p);
  };

  const writeBack = () => {
    for (const p of store.getState().patients) {
      const s = JSON.stringify(p);
      if (lastById.get(p.id) === s) continue;   // unchanged since last known server state
      lastById.set(p.id, s);
      fetch("/api/crm/patients", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ patient: p }) }).catch(() => {});
    }
  };

  const pull = async () => {
    try {
      const r = await fetch("/api/crm/patients", { cache: "no-store" });
      const d = await r.json();
      if (Array.isArray(d?.patients)) (d.patients as Patient[]).forEach((p) => { if (p?.id) applyServer(p); });
    } catch { /* ignore */ }
  };

  // Hydrate first, THEN attach write-back (so applying server data doesn't echo),
  // then poll for other devices' edits.
  pull().then(() => store.subscribe(writeBack));
  registerPull(pull); // instant refresh when the tab regains focus
  setInterval(() => { if (isVisible()) pull(); }, pollMs);
}
