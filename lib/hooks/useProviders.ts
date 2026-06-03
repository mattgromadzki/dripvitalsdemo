"use client";
import { create } from "@/lib/hooks/zustand-shim";

export interface Provider { id: string; name: string; npi: string; states: string[]; active: boolean; }

const SEED: Provider[] = [
  { id: "PR-1", name: "Dr. Maria Rivera", npi: "1234567890", active: true, states: ["FL","GA","TX","NY","CA","CO","AZ","WA","IL","PA","NC","MI","NJ","VA","MA","OH"] },
  { id: "PR-2", name: "Dr. James Park", npi: "2233445566", active: true, states: ["TX","OK","NM","LA","AR","CA","NV","KS","MO"] },
  { id: "PR-3", name: "Dr. Sarah Chen", npi: "3344556677", active: true, states: ["CA","OR","WA","NV","AZ","HI","ID","UT"] },
  { id: "PR-4", name: "Dr. Alan Brooks", npi: "4455667788", active: true, states: ["NY","NJ","CT","PA","MA","FL","RI","MD","DC"] },
];

interface State {
  providers: Provider[];
  seq: number;
  setStates: (id: string, states: string[]) => void;
  toggleActive: (id: string) => void;
  add: (name: string, npi: string, states: string[]) => void;
}
export const useProviders = create<State>((set) => ({
  providers: SEED,
  seq: 5,
  setStates: (id, states) => set((s) => ({ providers: s.providers.map((p) => p.id === id ? { ...p, states } : p) })),
  toggleActive: (id) => set((s) => ({ providers: s.providers.map((p) => p.id === id ? { ...p, active: !p.active } : p) })),
  add: (name, npi, states) => set((s) => ({ providers: [...s.providers, { id: "PR-" + s.seq, name, npi, states, active: true }], seq: s.seq + 1 })),
}));

export const ALL_STATES = ["AL","AK","AZ","AR","CA","CO","CT","DE","DC","FL","GA","HI","ID","IL","IN","IA","KS","KY","LA","ME","MD","MA","MI","MN","MS","MO","MT","NE","NV","NH","NJ","NM","NY","NC","ND","OH","OK","OR","PA","RI","SC","SD","TN","TX","UT","VT","VA","WA","WV","WI","WY"];
