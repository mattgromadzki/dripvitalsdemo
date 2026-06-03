"use client";

import { create } from "@/lib/hooks/zustand-shim";
import type { PortalRecord, ShotEntry, WeightEntry, MsgEntry } from "@/lib/data/portalRecords";
import { emptyRecord } from "@/lib/data/portalRecords";

/* Browser-persisted store of per-patient portal records. The portal WRITES
   here (patient logs a shot / weight / message); Patient View READS here for
   the selected patient. Persisting to localStorage is what lets the two
   screens mirror each other across navigations and reloads in this prototype.
   Replace load()/save() with backend calls to make it a real live mirror. */
const KEY = "dv_portal_records_v2";

function load(): Record<string, PortalRecord> {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as Record<string, PortalRecord>) : {};
  } catch {
    return {};
  }
}
function save(records: Record<string, PortalRecord>) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(KEY, JSON.stringify(records));
  } catch {
    /* storage full / unavailable — non-fatal in the prototype */
  }
}

let seq = 0;
const uid = (prefix: string) => `${prefix}-${Date.now()}-${++seq}`;

interface PortalRecordsState {
  records: Record<string, PortalRecord>;
  hydrate: () => void;
  ensureSeeded: (pid: string, seed: PortalRecord) => void;
  addShot: (pid: string, entry: Omit<ShotEntry, "id">) => void;
  addWeight: (pid: string, entry: Omit<WeightEntry, "id">) => void;
  addMessage: (pid: string, entry: Omit<MsgEntry, "id">) => void;
  ingestRemote: (pid: string, msg: MsgEntry) => void;
}

export const usePortalRecords = create<PortalRecordsState>((set, get) => ({
  records: {},

  // Load persisted data (client only). Safe to call on every mount.
  hydrate: () => set({ records: load() }),

  // Seed a patient's record the first time we encounter them, then persist
  // so the other screen sees the same starting point.
  ensureSeeded: (pid, seed) => {
    const r = get().records;
    if (r[pid]) return;
    const next = { ...r, [pid]: seed };
    save(next);
    set({ records: next });
  },

  addShot: (pid, entry) => {
    const r = get().records;
    const rec = r[pid] ?? emptyRecord();
    const next = { ...r, [pid]: { ...rec, shots: [{ id: uid("shot"), ...entry }, ...rec.shots] } };
    save(next);
    set({ records: next });
  },

  addWeight: (pid, entry) => {
    const r = get().records;
    const rec = r[pid] ?? emptyRecord();
    const next = { ...r, [pid]: { ...rec, weights: [...rec.weights, { id: uid("wt"), ...entry }] } };
    save(next);
    set({ records: next });
  },

  addMessage: (pid, entry) => {
    const r = get().records;
    const rec = r[pid] ?? emptyRecord();
    const next = { ...r, [pid]: { ...rec, messages: [...rec.messages, { id: uid("msg"), ...entry }] } };
    save(next);
    set({ records: next });
  },

  // Merge a message that came from the shared server (by id), deduped so polls
  // and our own optimistic echoes don't create duplicates.
  ingestRemote: (pid, msg) => {
    const r = get().records;
    const rec = r[pid] ?? emptyRecord();
    if (rec.messages.some((m) => m.id === msg.id)) return;
    const next = { ...r, [pid]: { ...rec, messages: [...rec.messages, msg] } };
    save(next);
    set({ records: next });
  },
}));
