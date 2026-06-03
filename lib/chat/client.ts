"use client";

import { usePortalRecords } from "@/lib/hooks/usePortalRecords";
import type { MsgEntry } from "@/lib/data/portalRecords";

function newId() { return `msg-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`; }

/** Add a message locally (optimistic) AND persist it to the shared server so
 *  the other side (portal ↔ EMR) receives it. */
export function sendChat(pid: string, partial: Omit<MsgEntry, "id">): MsgEntry {
  const msg: MsgEntry = { id: newId(), ...partial };
  try { usePortalRecords.getState().ingestRemote(pid, msg); } catch { /* ignore */ }
  fetch("/api/chat/messages", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ pid, ...msg }),
  }).catch(() => { /* offline / transient — local copy still shown */ });
  return msg;
}

/** Pull one patient's thread from the server and merge new messages locally. */
export async function pullChat(pid: string): Promise<void> {
  try {
    const r = await fetch(`/api/chat/messages?pid=${encodeURIComponent(pid)}`, { cache: "no-store" });
    const d = await r.json();
    if (d?.ok && Array.isArray(d.messages)) {
      const ingest = usePortalRecords.getState().ingestRemote;
      d.messages.forEach((m: MsgEntry) => { if (m?.id && (m.text || m.attachment)) ingest(pid, { id: m.id, from: m.from, text: m.text, time: m.time, attachment: m.attachment }); });
    }
  } catch { /* ignore */ }
}

/** Pull ALL threads (used by the EMR so every patient's conversation + unread
 *  badge stays current, even ones not currently open). */
export async function pullAllChat(): Promise<void> {
  try {
    const r = await fetch(`/api/chat/messages`, { cache: "no-store" });
    const d = await r.json();
    if (d?.ok && Array.isArray(d.messages)) {
      const ingest = usePortalRecords.getState().ingestRemote;
      d.messages.forEach((m: MsgEntry & { pid?: string }) => {
        if (m?.pid && m?.id && (m.text || m.attachment)) ingest(m.pid, { id: m.id, from: m.from, text: m.text, time: m.time, attachment: m.attachment });
      });
    }
  } catch { /* ignore */ }
}
