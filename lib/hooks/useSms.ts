"use client";
import { create } from "@/lib/hooks/zustand-shim";
import type { SmsThread, SmsMessage, SmsStatus } from "@/lib/sms/types";

const SEED: SmsThread[] = [
  { id: "+17863708570", name: "Matthew Gromadzki", phone: "+17863708570", patientId: "PT-0001", unread: 0, messages: [
    { id: "m1", direction: "out", body: "Hi Matthew, this is DripVitals 👋 Reply to this text to test two-way SMS — your reply should appear here within a few seconds.", status: "delivered", createdAt: "2026-06-03T12:00:00Z" },
  ] },
  { id: "+13055550112", name: "Sarah Lin", phone: "+1 (305) 555-0112", patientId: "PT-1042", unread: 2, messages: [
    { id: "m1", direction: "out", body: "Welcome to DripVitals, Sarah! Reply here anytime with questions.", status: "delivered", createdAt: "2026-05-31T15:00:00Z" },
    { id: "m2", direction: "in", body: "Thanks! Do I take the first dose in the morning?", status: "received", createdAt: "2026-06-01T13:18:00Z" },
    { id: "m3", direction: "in", body: "Also, when does my order ship?", status: "received", createdAt: "2026-06-01T13:19:00Z" },
  ] },
  { id: "+13055550148", name: "James Carter", phone: "+1 (305) 555-0148", patientId: "PT-1039", unread: 0, messages: [
    { id: "m1", direction: "out", body: "DripVitals: your order has shipped! Track it in your portal.", status: "delivered", createdAt: "2026-05-28T18:00:00Z" },
    { id: "m2", direction: "in", body: "Got it, thank you!", status: "received", createdAt: "2026-05-28T18:42:00Z" },
  ] },
  { id: "+13055550177", name: "Maria Gomez", phone: "+1 (305) 555-0177", patientId: "PT-1051", unread: 0, messages: [
    { id: "m1", direction: "out", body: "Hi Maria, your Tirzepatide refill is due around Jun 8. We'll ship automatically.", status: "sent", createdAt: "2026-05-30T10:05:00Z" },
  ] },
];

interface State {
  threads: SmsThread[];
  seq: number;
  startThread: (name: string, phone: string, patientId?: string) => string;
  addOutgoing: (threadId: string, body: string, status: SmsStatus, providerId?: string) => void;
  addIncoming: (threadId: string, body: string) => void;
  ingestInbound: (sid: string, from: string, body: string, createdAt: string) => void;
  applyStatuses: (map: Record<string, string>) => void;
  markRead: (threadId: string) => void;
}
const norm = (p: string) => "+" + p.replace(/[^\d]/g, "").replace(/^1?/, "1");

export const useSms = create<State>((set) => ({
  threads: SEED,
  seq: 100,
  startThread: (name, phone, patientId) => {
    const id = norm(phone);
    set((s) => s.threads.some((t) => t.id === id) ? {} : { threads: [{ id, name: name || phone, phone, patientId, unread: 0, messages: [] }, ...s.threads] });
    return id;
  },
  addOutgoing: (threadId, body, status, providerId) => set((s) => ({
    threads: s.threads.map((t) => t.id === threadId ? { ...t, messages: [...t.messages, { id: "s" + s.seq, direction: "out", body, status, providerId, createdAt: new Date().toISOString() } as SmsMessage] } : t),
    seq: s.seq + 1,
  })),
  addIncoming: (threadId, body) => set((s) => ({
    threads: s.threads.map((t) => t.id === threadId ? { ...t, unread: t.unread + 1, messages: [...t.messages, { id: "s" + s.seq, direction: "in", body, status: "received", createdAt: new Date().toISOString() } as SmsMessage] } : t),
    seq: s.seq + 1,
  })),
  markRead: (threadId) => set((s) => ({ threads: s.threads.map((t) => t.id === threadId ? { ...t, unread: 0 } : t) })),

  // Update outgoing messages' delivery status from Twilio status callbacks,
  // matched by the Twilio MessageSid stored as providerId.
  applyStatuses: (map) => set((s) => {
    if (!map || Object.keys(map).length === 0) return {};
    let any = false;
    const threads = s.threads.map((t) => {
      let changed = false;
      const messages = t.messages.map((m) => {
        const next = m.direction === "out" && m.providerId ? map[m.providerId] : undefined;
        if (next && next !== m.status) { changed = true; any = true; return { ...m, status: next as SmsMessage["status"] }; }
        return m;
      });
      return changed ? { ...t, messages } : t;
    });
    return any ? { threads } : {};
  }),

  // Merge a webhook-received reply into the right thread (matched by phone),
  // creating a thread if none exists. De-duplicated by Twilio MessageSid so
  // repeated polls don't add the same message twice.
  ingestInbound: (sid, from, body, createdAt) => set((s) => {
    const id = norm(from);
    const msg: SmsMessage = { id: sid, direction: "in", body, status: "received", providerId: sid, createdAt };
    const existing = s.threads.find((t) => t.id === id);
    if (existing) {
      if (existing.messages.some((m) => m.id === sid || m.providerId === sid)) return {}; // already have it
      return { threads: s.threads.map((t) => t.id === id ? { ...t, unread: t.unread + 1, messages: [...t.messages, msg] } : t) };
    }
    return { threads: [{ id, name: from, phone: from, unread: 1, messages: [msg] }, ...s.threads] };
  }),
}));
