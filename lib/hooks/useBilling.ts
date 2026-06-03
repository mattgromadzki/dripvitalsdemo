"use client";

import { create } from "@/lib/hooks/zustand-shim";
import type { Claim, PriorAuth, ClaimStatus, PriorAuthStatus } from "@/lib/types";
import { CLAIMS as CLAIM_SEED, PRIOR_AUTHS as PA_SEED } from "@/lib/data/billing";

interface BillingState {
  claims: Claim[];
  priorAuths: PriorAuth[];
  addClaim: (c: Omit<Claim, "id">) => Claim;
  setClaimStatus: (id: string, status: ClaimStatus) => void;
  resubmitClaim: (id: string) => void;
  removeClaim: (id: string) => void;
  setPaStatus: (id: string, status: PriorAuthStatus) => void;
}

let claimSeq = 200647;
function nextClaimId(): string {
  return `CLM-${String(claimSeq++).slice(-6)}`;
}

function nowYmd(): { display: string; ordered: number } {
  const d = new Date();
  const months = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
  return {
    display: `${months[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}`,
    ordered: parseInt(`${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, "0")}${String(d.getDate()).padStart(2, "0")}`, 10),
  };
}

export const useBilling = create<BillingState>((set) => ({
  claims: CLAIM_SEED,
  priorAuths: PA_SEED,
  addClaim: (input) => {
    const created: Claim = { id: nextClaimId(), ...input };
    set((s) => ({ claims: [created, ...s.claims] }));
    return created;
  },
  setClaimStatus: (id, status) => {
    set((s) => ({
      claims: s.claims.map((c) => (c.id === id ? { ...c, status } : c)),
    }));
  },
  resubmitClaim: (id) => {
    const today = nowYmd();
    set((s) => ({
      claims: s.claims.map((c) => {
        if (c.id !== id) return c;
        return {
          ...c,
          status: "pending" as const,
          submittedDate: today.display,
          submittedAt: today.ordered,
          denialCode: undefined,
          denialReason: undefined,
        };
      }),
    }));
  },
  removeClaim: (id) => {
    set((s) => ({ claims: s.claims.filter((c) => c.id !== id) }));
  },
  setPaStatus: (id, status) => {
    set((s) => ({
      priorAuths: s.priorAuths.map((p) => (p.id === id ? { ...p, status } : p)),
    }));
  },
}));
