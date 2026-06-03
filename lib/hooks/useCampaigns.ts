"use client";
import { create } from "@/lib/hooks/zustand-shim";

export interface Campaign { id: string; name: string; audience: string; body: string; total: number; sent: number; failed: number; createdAt: string; }

const SEED: Campaign[] = [
  { id: "CMP-3001", name: "May patient refill offer", audience: "All patients", body: "Hi {{firstName}}! 20% off your next 3 months…", total: 8, sent: 8, failed: 0, createdAt: "2026-05-25T16:00:00Z" },
  { id: "CMP-3002", name: "Cold lead intro blast", audience: "All leads", body: "Hi {{firstName}}, this is DripVitals…", total: 4, sent: 4, failed: 0, createdAt: "2026-05-27T15:00:00Z" },
];

interface State {
  campaigns: Campaign[];
  seq: number;
  add: (c: Omit<Campaign, "id" | "createdAt">) => void;
}
export const useCampaigns = create<State>((set) => ({
  campaigns: SEED,
  seq: 3003,
  add: (input) => set((s) => ({ campaigns: [{ ...input, id: "CMP-" + s.seq, createdAt: new Date().toISOString() }, ...s.campaigns], seq: s.seq + 1 })),
}));
