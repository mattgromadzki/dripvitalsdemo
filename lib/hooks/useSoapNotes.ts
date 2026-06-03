"use client";

import { create } from "@/lib/hooks/zustand-shim";
import type { SoapNote, SoapNoteStatus } from "@/lib/types";
import { SOAP_NOTES as SEED } from "@/lib/data/soapNotes";

interface SoapNotesState {
  notes: SoapNote[];
  add: (note: Omit<SoapNote, "id">) => SoapNote;
  updateSection: (id: number, field: "s" | "o" | "a" | "p", value: string) => void;
  updateMeta: (id: number, patch: Partial<Pick<SoapNote, "type" | "provider" | "patientName" | "patientId">>) => void;
  sign: (id: number) => void;
  setStatus: (id: number, status: SoapNoteStatus) => void;
  remove: (id: number) => void;
}

let nextId = SEED.length + 1;

export const useSoapNotes = create<SoapNotesState>((set) => ({
  notes: SEED,
  add: (input) => {
    const id = nextId++;
    const created: SoapNote = { id, ...input };
    set((s) => ({ notes: [created, ...s.notes] }));
    return created;
  },
  updateSection: (id, field, value) => {
    set((s) => ({
      notes: s.notes.map((n) => (n.id === id ? { ...n, [field]: value } : n)),
    }));
  },
  updateMeta: (id, patch) => {
    set((s) => ({
      notes: s.notes.map((n) => (n.id === id ? { ...n, ...patch } : n)),
    }));
  },
  sign: (id) => {
    const now = new Date();
    const months = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
    const hh = now.getHours();
    const mm = String(now.getMinutes()).padStart(2, "0");
    const ampm = hh >= 12 ? "PM" : "AM";
    const hh12 = hh === 0 ? 12 : hh > 12 ? hh - 12 : hh;
    const signedAt = `${months[now.getMonth()]} ${now.getDate()}, ${now.getFullYear()} ${hh12}:${mm} ${ampm}`;
    set((s) => ({
      notes: s.notes.map((n) => (n.id === id ? { ...n, status: "signed" as const, signedAt } : n)),
    }));
  },
  setStatus: (id, status) => {
    set((s) => ({ notes: s.notes.map((n) => (n.id === id ? { ...n, status } : n)) }));
  },
  remove: (id) => {
    set((s) => ({ notes: s.notes.filter((n) => n.id !== id) }));
  },
}));
