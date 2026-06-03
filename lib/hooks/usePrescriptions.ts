"use client";

import { create } from "@/lib/hooks/zustand-shim";
import type { Prescription, RxStatusFull } from "@/lib/types";
import { PRESCRIPTIONS as SEED } from "@/lib/data/prescriptions";

interface PrescriptionsState {
  prescriptions: Prescription[];
  add: (rx: Omit<Prescription, "id">) => Prescription;
  setStatus: (id: string, status: RxStatusFull) => void;
  sendRefill: (id: string) => void;
  renew: (id: string) => Prescription | null;
  cancel: (id: string) => void;
  remove: (id: string) => void;
}

let nextSequence = 442;
function nextId(): string {
  return `RX-${String(nextSequence++).padStart(5, "0")}`;
}

export const usePrescriptions = create<PrescriptionsState>((set, get) => ({
  prescriptions: SEED,
  add: (input) => {
    const created: Prescription = { id: nextId(), ...input };
    set((s) => ({ prescriptions: [created, ...s.prescriptions] }));
    return created;
  },
  setStatus: (id, status) => {
    set((s) => ({
      prescriptions: s.prescriptions.map((r) => (r.id === id ? { ...r, status } : r)),
    }));
  },
  sendRefill: (id) => {
    set((s) => ({
      prescriptions: s.prescriptions.map((r) => {
        if (r.id !== id) return r;
        const newRefills = Math.max(0, r.refillsRemaining - 1);
        return { ...r, refillsRemaining: newRefills, status: "filled" as const };
      }),
    }));
  },
  renew: (id) => {
    const existing = get().prescriptions.find((r) => r.id === id);
    if (!existing) return null;
    const today = new Date();
    const months = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
    const dateStr = `${months[today.getMonth()]} ${today.getDate()}, ${today.getFullYear()}`;
    const dateOrdered = parseInt(`${today.getFullYear()}${String(today.getMonth() + 1).padStart(2, "0")}${String(today.getDate()).padStart(2, "0")}`, 10);
    const created: Prescription = {
      ...existing,
      id: nextId(),
      refillsRemaining: 2,
      prescribedDate: dateStr,
      prescribedAt: dateOrdered,
      status: "pending",
    };
    set((s) => ({ prescriptions: [created, ...s.prescriptions] }));
    return created;
  },
  cancel: (id) => {
    set((s) => ({
      prescriptions: s.prescriptions.map((r) => (r.id === id ? { ...r, status: "denied" as const } : r)),
    }));
  },
  remove: (id) => {
    set((s) => ({ prescriptions: s.prescriptions.filter((r) => r.id !== id) }));
  },
}));
