"use client";

import { create } from "@/lib/hooks/zustand-shim";
import type { StaffMember, SecurityPolicy } from "@/lib/types";
import { STAFF as SEED, SECURITY_POLICIES as POLICY_SEED } from "@/lib/data/staff";

interface StaffState {
  staff: StaffMember[];
  policies: SecurityPolicy[];
  add: (member: Omit<StaffMember, "id">) => StaffMember;
  toggleActive: (id: string) => void;
  remove: (id: string) => void;
  togglePolicy: (id: string) => void;
}

let nextSeq = SEED.length + 1;
function nextId(): string {
  return `ST-${String(nextSeq++).padStart(3, "0")}`;
}

export const useStaff = create<StaffState>((set) => ({
  staff: SEED,
  policies: POLICY_SEED,
  add: (input) => {
    const created: StaffMember = { id: nextId(), ...input };
    set((s) => ({ staff: [created, ...s.staff] }));
    return created;
  },
  toggleActive: (id) => {
    set((s) => ({
      staff: s.staff.map((m) => (m.id === id ? { ...m, active: !m.active } : m)),
    }));
  },
  remove: (id) => {
    set((s) => ({ staff: s.staff.filter((m) => m.id !== id) }));
  },
  togglePolicy: (id) => {
    set((s) => ({
      policies: s.policies.map((p) => (p.id === id ? { ...p, enabled: !p.enabled } : p)),
    }));
  },
}));
