"use client";

import { create } from "@/lib/hooks/zustand-shim";
import type { Affiliate, AffiliateStatus, AffiliatePayout } from "@/lib/types";
import { AFFILIATES as SEED } from "@/lib/data/affiliates";

interface AffiliatesState {
  affiliates: Affiliate[];
  add: (a: Omit<Affiliate, "id">) => Affiliate;
  update: (id: string, patch: Partial<Omit<Affiliate, "id">>) => void;
  setStatus: (id: string, status: AffiliateStatus) => void;
  updateCommissionRate: (id: string, rate: number) => void;
  payCommission: (id: string, method: AffiliatePayout["method"], period: string) => AffiliatePayout | null;
  remove: (id: string) => void;
}

let nextSeq = SEED.length + 1;
function nextId(): string {
  return `AFF-${String(nextSeq++).padStart(3, "0")}`;
}

let payoutSeq = 1000;
function nextPayoutId(prefix: string): string {
  return `PO-${prefix}-${String(payoutSeq++).slice(-3)}`;
}

function todayDisplay(): string {
  const d = new Date();
  const months = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
  return `${months[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}`;
}

function mockTxId(method: AffiliatePayout["method"]): string {
  const seed = Math.random().toString(36).slice(2, 10);
  if (method === "Stripe Transfer") return `po_1Q${seed}`;
  if (method === "PayPal")           return `PAY-${seed.toUpperCase()}`;
  if (method === "Wire")             return `WIRE-${new Date().getFullYear()}-${seed.slice(0, 6).toUpperCase()}`;
  return `CHK-${seed.slice(0, 6).toUpperCase()}`;
}

export const useAffiliates = create<AffiliatesState>((set, get) => ({
  affiliates: SEED,
  add: (input) => {
    const created: Affiliate = { id: nextId(), ...input };
    set((s) => ({ affiliates: [created, ...s.affiliates] }));
    return created;
  },
  update: (id, patch) => {
    set((s) => ({ affiliates: s.affiliates.map((a) => (a.id === id ? { ...a, ...patch } : a)) }));
  },
  setStatus: (id, status) => {
    set((s) => ({
      affiliates: s.affiliates.map((a) => (a.id === id ? { ...a, status } : a)),
    }));
  },
  updateCommissionRate: (id, rate) => {
    set((s) => ({
      affiliates: s.affiliates.map((a) => (a.id === id ? { ...a, commissionRate: rate } : a)),
    }));
  },
  payCommission: (id, method, period) => {
    const aff = get().affiliates.find((a) => a.id === id);
    if (!aff || aff.commissionPending <= 0) return null;
    const prefix = aff.code.slice(0, 1).toUpperCase();
    const payout: AffiliatePayout = {
      id: nextPayoutId(prefix),
      date: todayDisplay(),
      amount: aff.commissionPending,
      period,
      method,
      reference: mockTxId(method),
    };
    set((s) => ({
      affiliates: s.affiliates.map((a) =>
        a.id === id
          ? {
              ...a,
              commissionPending: 0,
              commissionPaidAllTime: a.commissionPaidAllTime + payout.amount,
              payouts: [payout, ...a.payouts],
            }
          : a
      ),
    }));
    return payout;
  },
  remove: (id) => {
    set((s) => ({ affiliates: s.affiliates.filter((a) => a.id !== id) }));
  },
}));
