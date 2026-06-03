"use client";
import { create } from "@/lib/hooks/zustand-shim";
import type { Subscription, SubStatus, BillingCycle } from "@/lib/subscriptions/types";
import { advance } from "@/lib/subscriptions/util";

const C = (id: string, daysAgo: number, amt: number, status: BillingCycle["status"]): BillingCycle => {
  const d = new Date(); d.setDate(d.getDate() - daysAgo);
  return { id, date: d.toISOString(), amountCents: amt, status, paymentId: status === "paid" ? "pay_" + id : undefined };
};
const future = (days: number) => { const d = new Date(); d.setDate(d.getDate() + days); return d.toISOString(); };
const past = (days: number) => { const d = new Date(); d.setDate(d.getDate() - days); return d.toISOString(); };

const SEED: Subscription[] = [
  { id: "SUB-7001", patientName: "Michael Gromadzki", planId: "plan-sema-m", planName: "Semaglutide — Monthly", med: "Compounded Semaglutide", interval: "monthly", amountCents: 29900, status: "active", startedAt: past(70), nextBillingDate: future(9), cardLast4: "4242", paymentToken: "mock-card-ok", failedAttempts: 0, cycles: [C("7001a", 40, 29900, "paid"), C("7001b", 10, 29900, "paid")] },
  { id: "SUB-7002", patientName: "Sarah Lin", planId: "plan-tirz-m", planName: "Tirzepatide — Monthly", med: "Compounded Tirzepatide", interval: "monthly", amountCents: 39900, status: "past_due", startedAt: past(45), nextBillingDate: past(2), cardLast4: "0002", paymentToken: "mock-decline", failedAttempts: 1, cycles: [C("7002a", 35, 39900, "paid"), C("7002b", 2, 39900, "failed")] },
  { id: "SUB-7003", patientName: "James Carter", planId: "plan-sema-q", planName: "Semaglutide — Quarterly", med: "Compounded Semaglutide", interval: "quarterly", amountCents: 79900, status: "active", startedAt: past(20), nextBillingDate: future(70), cardLast4: "1881", paymentToken: "mock-card-ok", failedAttempts: 0, cycles: [C("7003a", 20, 79900, "paid")] },
  { id: "SUB-7004", patientName: "Maria Gomez", planId: "plan-tirz-m", planName: "Tirzepatide — Monthly", med: "Compounded Tirzepatide", interval: "monthly", amountCents: 39900, status: "paused", startedAt: past(120), nextBillingDate: future(30), cardLast4: "7777", paymentToken: "mock-card-ok", failedAttempts: 0, cycles: [C("7004a", 90, 39900, "paid"), C("7004b", 60, 39900, "paid")] },
  { id: "SUB-7005", patientName: "Derek Olsen", planId: "plan-sema-m", planName: "Semaglutide — Monthly", med: "Compounded Semaglutide", interval: "monthly", amountCents: 29900, status: "trialing", startedAt: past(3), nextBillingDate: future(4), cardLast4: "4242", paymentToken: "mock-card-ok", failedAttempts: 0, cycles: [] },
];

interface State {
  subscriptions: Subscription[];
  seq: number;
  setStatus: (id: string, status: SubStatus) => void;
  recordCycle: (id: string, cycle: BillingCycle, opts: { advance?: boolean; failed?: boolean }) => void;
  updateCard: (id: string, last4: string, token: string) => void;
  add: (s: Omit<Subscription, "id" | "cycles" | "failedAttempts">) => void;
}
export const useSubscriptions = create<State>((set) => ({
  subscriptions: SEED,
  seq: 7006,
  setStatus: (id, status) => set((s) => ({ subscriptions: s.subscriptions.map((x) => x.id === id ? { ...x, status } : x) })),
  recordCycle: (id, cycle, opts) => set((s) => ({
    subscriptions: s.subscriptions.map((x) => {
      if (x.id !== id) return x;
      const failed = !!opts.failed;
      return {
        ...x,
        cycles: [cycle, ...x.cycles],
        failedAttempts: failed ? x.failedAttempts + 1 : 0,
        status: failed ? "past_due" : "active",
        nextBillingDate: !failed && opts.advance ? advance(x.nextBillingDate, x.interval) : x.nextBillingDate,
      };
    }),
  })),
  updateCard: (id, last4, token) => set((s) => ({ subscriptions: s.subscriptions.map((x) => x.id === id ? { ...x, cardLast4: last4, paymentToken: token } : x) })),
  add: (input) => set((s) => ({ subscriptions: [{ ...input, id: "SUB-" + s.seq, failedAttempts: 0, cycles: [] }, ...s.subscriptions], seq: s.seq + 1 })),
}));
