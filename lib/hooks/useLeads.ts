"use client";
import { create } from "@/lib/hooks/zustand-shim";

export type LeadStage = "new" | "contacted" | "consult" | "converted" | "lost";
export interface Lead { id: string; name: string; phone: string; email?: string; tag?: string; source?: string; stage?: LeadStage; createdAt: string; }

export const STAGES: { key: LeadStage; label: string }[] = [
  { key: "new", label: "New" }, { key: "contacted", label: "Contacted" }, { key: "consult", label: "Consult booked" }, { key: "converted", label: "Converted" }, { key: "lost", label: "Lost" },
];

const SEED: Lead[] = [
  { id: "LD-2001", name: "Olivia Brooks", phone: "+1 (305) 555-0210", email: "olivia.b@example.com", tag: "Cold", source: "Instagram", stage: "new", createdAt: "2026-05-29T10:00:00Z" },
  { id: "LD-2002", name: "Daniel Reyes", phone: "+1 (786) 555-0144", tag: "Cold", source: "Webinar", stage: "contacted", createdAt: "2026-05-30T10:00:00Z" },
  { id: "LD-2003", name: "Priya Nair", phone: "+1 (305) 555-0388", email: "priya.n@example.com", tag: "Warm", source: "Referral", stage: "consult", createdAt: "2026-05-31T10:00:00Z" },
  { id: "LD-2004", name: "Marcus Lee", phone: "+1 (954) 555-0125", tag: "Cold", source: "Google Ads", stage: "new", createdAt: "2026-06-01T10:00:00Z" },
  { id: "LD-2005", name: "Jenna Pruitt", phone: "+1 (561) 555-0166", email: "jenna.p@example.com", tag: "Hot", source: "Referral", stage: "converted", createdAt: "2026-05-26T10:00:00Z" },
  { id: "LD-2006", name: "Carl West", phone: "+1 (305) 555-0199", tag: "Cold", source: "TikTok", stage: "lost", createdAt: "2026-05-24T10:00:00Z" },
];

interface State {
  leads: Lead[];
  seq: number;
  add: (l: Omit<Lead, "id" | "createdAt">) => Lead;
  addMany: (items: Omit<Lead, "id" | "createdAt">[]) => number;
  remove: (id: string) => void;
  setStage: (id: string, stage: LeadStage) => void;
}
export const useLeads = create<State>((set) => ({
  leads: SEED,
  seq: 2007,
  add: (input) => {
    let created: Lead = { id: "LD-0", createdAt: "", ...input };
    set((s) => { created = { stage: "new", ...input, id: "LD-" + s.seq, createdAt: new Date().toISOString() }; return { leads: [created, ...s.leads], seq: s.seq + 1 }; });
    return created;
  },
  addMany: (items) => {
    let n = 0;
    set((s) => { let seq = s.seq; const made = items.map((i) => ({ stage: "new" as LeadStage, ...i, id: "LD-" + seq++, createdAt: new Date().toISOString() })); n = made.length; return { leads: [...made, ...s.leads], seq }; });
    return n;
  },
  remove: (id) => set((s) => ({ leads: s.leads.filter((l) => l.id !== id) })),
  setStage: (id, stage) => set((s) => ({ leads: s.leads.map((l) => l.id === id ? { ...l, stage } : l) })),
}));
