"use client";
import { create } from "@/lib/hooks/zustand-shim";
import { DEFAULT_ROLE_PERMS } from "@/lib/rbac/permissions";

export interface Member { id: string; name: string; email: string; role: string; twoFactor: boolean; status: "active" | "invited" | "suspended"; lastActive: string; }

const SEED: Member[] = [
  { id: "U-1", name: "Dr. Maria Rivera", email: "maria@dripvitals.com", role: "owner", twoFactor: true, status: "active", lastActive: "2026-06-02T08:00:00Z" },
  { id: "U-2", name: "Dr. James Park", email: "james@dripvitals.com", role: "provider", twoFactor: true, status: "active", lastActive: "2026-06-01T17:30:00Z" },
  { id: "U-3", name: "Dr. Sarah Chen", email: "sarah@dripvitals.com", role: "provider", twoFactor: false, status: "active", lastActive: "2026-06-01T12:10:00Z" },
  { id: "U-4", name: "Tasha Reed", email: "tasha@dripvitals.com", role: "support", twoFactor: false, status: "active", lastActive: "2026-06-02T09:05:00Z" },
  { id: "U-5", name: "Leo Martin", email: "leo@dripvitals.com", role: "billing", twoFactor: true, status: "active", lastActive: "2026-05-31T15:00:00Z" },
  { id: "U-6", name: "New Hire", email: "newhire@dripvitals.com", role: "support", twoFactor: false, status: "invited", lastActive: "" },
];

interface State {
  rolePerms: Record<string, string[]>;
  members: Member[];
  seq: number;
  togglePerm: (role: string, key: string) => void;
  setRole: (id: string, role: string) => void;
  toggle2FA: (id: string) => void;
  setStatus: (id: string, status: Member["status"]) => void;
  invite: (name: string, email: string, role: string) => void;
}
export const useRbac = create<State>((set) => ({
  rolePerms: JSON.parse(JSON.stringify(DEFAULT_ROLE_PERMS)),
  members: SEED,
  seq: 7,
  togglePerm: (role, key) => set((s) => {
    const cur = s.rolePerms[role] || [];
    const next = cur.includes(key) ? cur.filter((k) => k !== key) : [...cur, key];
    return { rolePerms: { ...s.rolePerms, [role]: next } };
  }),
  setRole: (id, role) => set((s) => ({ members: s.members.map((m) => m.id === id ? { ...m, role } : m) })),
  toggle2FA: (id) => set((s) => ({ members: s.members.map((m) => m.id === id ? { ...m, twoFactor: !m.twoFactor } : m) })),
  setStatus: (id, status) => set((s) => ({ members: s.members.map((m) => m.id === id ? { ...m, status } : m) })),
  invite: (name, email, role) => set((s) => ({ members: [...s.members, { id: "U-" + s.seq, name, email, role, twoFactor: false, status: "invited", lastActive: "" }], seq: s.seq + 1 })),
}));
