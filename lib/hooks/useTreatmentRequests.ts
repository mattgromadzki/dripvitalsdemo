"use client";

import { create } from "@/lib/hooks/zustand-shim";
import type { TreatmentRequest } from "@/lib/types";
import { TREATMENT_REQUESTS as SEED } from "@/lib/data/treatmentRequests";

interface TreatmentRequestsState {
  requests: TreatmentRequest[];
  add: (req: Omit<TreatmentRequest, "id">) => TreatmentRequest;
  approve: (id: string, approvedBy: string, notes?: string) => void;
  deny: (id: string, deniedBy: string, reason: string) => void;
  markPrescribed: (id: string, prescriptionId: string) => void;
  remove: (id: string) => void;
}

let nextSeq = SEED.length + 1;
function nextId(): string {
  return `TR-${String(nextSeq++).padStart(3, "0")}`;
}

function nowDisplay(): string {
  const d = new Date();
  const months = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
  const hour = d.getHours();
  const ampm = hour >= 12 ? "PM" : "AM";
  const hr12 = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour;
  return `${months[d.getMonth()]} ${d.getDate()} · ${hr12}:${String(d.getMinutes()).padStart(2,"0")} ${ampm}`;
}

function nowInt(): number {
  const d = new Date();
  return parseInt(
    `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, "0")}${String(d.getDate()).padStart(2, "0")}${String(d.getHours()).padStart(2, "0")}${String(d.getMinutes()).padStart(2, "0")}`,
    10
  );
}

export const useTreatmentRequests = create<TreatmentRequestsState>((set) => ({
  requests: SEED,
  add: (input) => {
    const created: TreatmentRequest = { id: nextId(), ...input };
    set((s) => ({ requests: [created, ...s.requests] }));
    return created;
  },
  approve: (id, approvedBy, notes) => {
    set((s) => ({
      requests: s.requests.map((r) =>
        r.id === id
          ? {
              ...r,
              status: "approved" as const,
              approvedBy,
              approvedAt: nowInt(),
              approvedDate: nowDisplay(),
              notes: notes ?? r.notes,
            }
          : r
      ),
    }));
  },
  deny: (id, deniedBy, reason) => {
    set((s) => ({
      requests: s.requests.map((r) =>
        r.id === id
          ? {
              ...r,
              status: "denied" as const,
              deniedBy,
              deniedAt: nowInt(),
              deniedReason: reason,
            }
          : r
      ),
    }));
  },
  markPrescribed: (id, prescriptionId) => {
    set((s) => ({
      requests: s.requests.map((r) =>
        r.id === id
          ? {
              ...r,
              status: "prescribed" as const,
              prescriptionId,
              prescribedAt: nowInt(),
              prescribedDate: nowDisplay(),
            }
          : r
      ),
    }));
  },
  remove: (id) => {
    set((s) => ({ requests: s.requests.filter((r) => r.id !== id) }));
  },
}));
