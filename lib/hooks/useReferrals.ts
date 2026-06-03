"use client";

import { create } from "@/lib/hooks/zustand-shim";
import type { Referral, Specialist, ReferralStatus } from "@/lib/types";
import { REFERRALS as REF_SEED, SPECIALISTS as SPEC_SEED } from "@/lib/data/referrals";

interface ReferralsState {
  referrals: Referral[];
  specialists: Specialist[];
  addReferral: (r: Omit<Referral, "id">) => Referral;
  setStatus: (id: string, status: ReferralStatus) => void;
  scheduleReferral: (id: string, scheduledDate: string) => void;
  completeReferral: (id: string, notes?: string) => void;
  cancelReferral: (id: string) => void;
  removeReferral: (id: string) => void;
}

let nextSeq = 20260030;
function nextId(): string {
  return `REF-${String(nextSeq++).slice(-5)}`;
}

function todayDisplay(): string {
  const d = new Date();
  const months = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
  return `${months[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}`;
}

export const useReferrals = create<ReferralsState>((set) => ({
  referrals: REF_SEED,
  specialists: SPEC_SEED,
  addReferral: (input) => {
    const created: Referral = { id: nextId(), ...input };
    set((s) => ({ referrals: [created, ...s.referrals] }));
    return created;
  },
  setStatus: (id, status) => {
    set((s) => ({
      referrals: s.referrals.map((r) => (r.id === id ? { ...r, status } : r)),
    }));
  },
  scheduleReferral: (id, scheduledDate) => {
    set((s) => ({
      referrals: s.referrals.map((r) =>
        r.id === id ? { ...r, status: "scheduled" as const, scheduledDate } : r
      ),
    }));
  },
  completeReferral: (id, notes) => {
    const today = todayDisplay();
    set((s) => ({
      referrals: s.referrals.map((r) =>
        r.id === id
          ? { ...r, status: "completed" as const, completedDate: today, appointmentNotes: notes || r.appointmentNotes }
          : r
      ),
    }));
  },
  cancelReferral: (id) => {
    set((s) => ({
      referrals: s.referrals.map((r) => (r.id === id ? { ...r, status: "cancelled" as const } : r)),
    }));
  },
  removeReferral: (id) => {
    set((s) => ({ referrals: s.referrals.filter((r) => r.id !== id) }));
  },
}));
