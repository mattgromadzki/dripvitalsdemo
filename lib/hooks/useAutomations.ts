"use client";
import { create } from "@/lib/hooks/zustand-shim";
import type { Automation, Enrollment } from "@/lib/automations/types";

const SEED: Automation[] = [
  { id: "AUT-9001", name: "Welcome series", trigger: "patient_created", enabled: true, createdAt: "2026-05-20T10:00:00Z", steps: [
    { id: "s1", delayDays: 0, channel: "email", subject: "Welcome to {{clinic}}, {{firstName}}!", body: "Hi {{firstName}},\n\nWelcome to {{clinic}}! Your care team is reviewing your intake.\n\n— {{clinic}}" },
    { id: "s2", delayDays: 1, channel: "sms", body: "Hi {{firstName}}, it's {{clinic}} 👋 Reply here anytime with questions about your treatment." },
    { id: "s3", delayDays: 3, channel: "email", subject: "Getting started with your treatment", body: "Hi {{firstName}},\n\nA few tips to get the most from your program…\n\n— {{clinic}}" },
  ] },
  { id: "AUT-9002", name: "Abandoned intake", trigger: "intake_abandoned", enabled: true, createdAt: "2026-05-21T10:00:00Z", steps: [
    { id: "s1", delayDays: 0, channel: "sms", body: "Hi {{firstName}}, you're almost done! Finish your {{clinic}} intake to get started." },
    { id: "s2", delayDays: 1, channel: "email", subject: "Pick up where you left off", body: "Hi {{firstName}},\n\nYour intake is waiting — it only takes a couple minutes to complete.\n\n— {{clinic}}" },
  ] },
  { id: "AUT-9003", name: "Refill reminder", trigger: "refill_due", enabled: true, createdAt: "2026-05-22T10:00:00Z", steps: [
    { id: "s1", delayDays: 0, channel: "sms", body: "Hi {{firstName}}, your {{clinic}} refill is coming up. We'll ship it automatically — reply if anything changed." },
  ] },
  { id: "AUT-9004", name: "Win-back (canceled)", trigger: "subscription_canceled", enabled: false, createdAt: "2026-05-23T10:00:00Z", steps: [
    { id: "s1", delayDays: 2, channel: "email", subject: "We'd love to have you back", body: "Hi {{firstName}},\n\nCome back to {{clinic}} — here's a special returning-patient offer.\n\n— {{clinic}}" },
  ] },
  { id: "AUT-9005", name: "Cold lead nurture", trigger: "lead_added", enabled: true, createdAt: "2026-05-24T10:00:00Z", steps: [
    { id: "s1", delayDays: 0, channel: "sms", body: "Hi {{firstName}}, this is {{clinic}} — medically-supervised GLP-1 weight loss from home. Want to learn more? Reply YES." },
    { id: "s2", delayDays: 2, channel: "sms", body: "Hi {{firstName}}, still interested in {{clinic}}? We make it easy to get started — reply YES and we'll help." },
  ] },
];

interface State {
  automations: Automation[];
  enrollments: Enrollment[];
  seq: number;
  enrollSeq: number;
  toggle: (id: string) => void;
  upsert: (a: Automation) => void;
  remove: (id: string) => void;
  newId: () => string;
  addEnrollment: (e: Omit<Enrollment, "id">) => void;
}
export const useAutomations = create<State>((set, get) => ({
  automations: SEED,
  enrollments: [],
  seq: 9006,
  enrollSeq: 1,
  toggle: (id) => set((s) => ({ automations: s.automations.map((a) => a.id === id ? { ...a, enabled: !a.enabled } : a) })),
  upsert: (a) => set((s) => s.automations.some((x) => x.id === a.id) ? { automations: s.automations.map((x) => x.id === a.id ? a : x) } : { automations: [a, ...s.automations] }),
  remove: (id) => set((s) => ({ automations: s.automations.filter((a) => a.id !== id) })),
  newId: () => { const id = "AUT-" + get().seq; set((s) => ({ seq: s.seq + 1 })); return id; },
  addEnrollment: (e) => set((s) => ({ enrollments: [{ ...e, id: "ENR-" + s.enrollSeq }, ...s.enrollments], enrollSeq: s.enrollSeq + 1 })),
}));
