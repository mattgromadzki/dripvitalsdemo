"use client";
import { create } from "@/lib/hooks/zustand-shim";

export interface PaidRecord { paymentId: string; last4?: string; brand?: string; amountCents: number; provider: string; at: string; }
interface State {
  byRef: Record<string, PaidRecord>;
  setPaid: (ref: string, rec: PaidRecord) => void;
}
export const usePayments = create<State>((set) => ({
  byRef: {},
  setPaid: (ref, rec) => set((s) => ({ byRef: { ...s.byRef, [ref]: rec } })),
}));
