import type { Interval, Subscription } from "./types";
export const money = (c: number) => (c / 100).toLocaleString("en-US", { style: "currency", currency: "USD" });
export function advance(dateISO: string, interval: Interval): string {
  const d = new Date(dateISO); d.setMonth(d.getMonth() + (interval === "quarterly" ? 3 : 1)); return d.toISOString();
}
export function monthlyValue(s: Subscription): number {
  if (s.status === "canceled" || s.status === "paused") return 0;
  return s.interval === "quarterly" ? Math.round(s.amountCents / 3) : s.amountCents;
}
