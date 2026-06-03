export type SubStatus = "active" | "paused" | "canceled" | "past_due" | "trialing";
export type Interval = "monthly" | "quarterly";
export interface Plan { id: string; name: string; med: string; interval: Interval; amountCents: number; }
export interface BillingCycle { id: string; date: string; amountCents: number; status: "paid" | "failed" | "refunded"; paymentId?: string; }
export interface Subscription {
  id: string; patientId?: string; patientName: string;
  planId: string; planName: string; med: string; interval: Interval; amountCents: number;
  status: SubStatus; startedAt: string; nextBillingDate: string;
  cardLast4: string; paymentToken: string; failedAttempts: number;
  cycles: BillingCycle[];
}
