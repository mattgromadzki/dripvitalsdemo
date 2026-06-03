import type { Plan } from "@/lib/subscriptions/types";
export const PLANS: Plan[] = [
  { id: "plan-sema-m", name: "Semaglutide — Monthly", med: "Compounded Semaglutide", interval: "monthly", amountCents: 29900 },
  { id: "plan-sema-q", name: "Semaglutide — Quarterly", med: "Compounded Semaglutide", interval: "quarterly", amountCents: 79900 },
  { id: "plan-tirz-m", name: "Tirzepatide — Monthly", med: "Compounded Tirzepatide", interval: "monthly", amountCents: 39900 },
  { id: "plan-tirz-q", name: "Tirzepatide — Quarterly", med: "Compounded Tirzepatide", interval: "quarterly", amountCents: 109900 },
];
