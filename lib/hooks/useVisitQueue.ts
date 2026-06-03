"use client";

import { create } from "@/lib/hooks/zustand-shim";
import type { QueueVisit, QueueStatus } from "@/lib/types";
import { QUEUE_VISITS as SEED } from "@/lib/data/visits";

interface VisitQueueState {
  visits: QueueVisit[];
  add: (v: Omit<QueueVisit, "id">) => QueueVisit;
  updateStatus: (id: string, status: QueueStatus) => void;
  remove: (id: string) => void;
}

let nextId = 9;

export const useVisitQueue = create<VisitQueueState>((set) => ({
  visits: SEED,
  add: (input) => {
    const id = `V-${String(nextId++).padStart(3, "0")}`;
    const created: QueueVisit = { id, ...input };
    set((s) => ({ visits: [...s.visits, created] }));
    return created;
  },
  updateStatus: (id, status) => {
    set((s) => ({
      visits: s.visits.map((v) => (v.id === id ? { ...v, status } : v)),
    }));
  },
  remove: (id) => {
    set((s) => ({ visits: s.visits.filter((v) => v.id !== id) }));
  },
}));
