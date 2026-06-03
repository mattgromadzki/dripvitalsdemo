"use client";

import { create } from "@/lib/hooks/zustand-shim";
import type { PortalRecord } from "@/lib/data/portalRecords";

/* Tracks, per patient, how many chat messages support has already seen.
   Persisted to localStorage so the sidebar badge survives navigation and
   mirrors across tabs (same mechanism as the portal records store). */
const KEY = "dv_chat_seen_v1";

function load(): Record<string, number> {
  if (typeof window === "undefined") return {};
  try { const r = window.localStorage.getItem(KEY); return r ? JSON.parse(r) : {}; } catch { return {}; }
}
function save(s: Record<string, number>) {
  if (typeof window === "undefined") return;
  try { window.localStorage.setItem(KEY, JSON.stringify(s)); } catch { /* non-fatal */ }
}

interface ChatReadsState {
  seen: Record<string, number>;
  hydrate: () => void;
  initMissing: (records: Record<string, PortalRecord>) => void;
  markSeen: (pid: string, count: number) => void;
}

export const useChatReads = create<ChatReadsState>((set) => ({
  seen: {},
  hydrate: () => set({ seen: load() }),
  // Establish a baseline for any patient we haven't tracked yet, so existing
  // history isn't counted as unread — only messages that arrive afterward are.
  initMissing: (records) => set((s) => {
    let changed = false;
    const next = { ...s.seen };
    for (const pid in records) {
      if (next[pid] == null) { next[pid] = records[pid].messages.length; changed = true; }
    }
    if (!changed) return {};
    save(next);
    return { seen: next };
  }),
  markSeen: (pid, count) => set((s) => {
    if (s.seen[pid] === count) return {};
    const next = { ...s.seen, [pid]: count };
    save(next);
    return { seen: next };
  }),
}));

export function unreadForPid(records: Record<string, PortalRecord>, seen: Record<string, number>, pid: string): number {
  const msgs = records[pid]?.messages ?? [];
  const base = seen[pid] ?? msgs.length;
  return msgs.slice(base).filter((m) => m.from === "patient").length;
}
export function unreadTotal(records: Record<string, PortalRecord>, seen: Record<string, number>): number {
  let t = 0;
  for (const pid in records) t += unreadForPid(records, seen, pid);
  return t;
}
