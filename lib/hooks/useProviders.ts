"use client";
import { create } from "@/lib/hooks/zustand-shim";

export interface Provider { id: string; name: string; npi: string; states: string[]; active: boolean; }

const SEED: Provider[] = [
  // Default prescriber. Only states with a confirmed, active license belong here.
  { id: "PR-1", name: "Dr. Emmanuel Noel Tancinco", npi: "1639393895", active: true, states: ["FL"] },
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
