import type { Subscription } from "@/lib/subscriptions/types";

export interface TrendSeries {
  months: string[];        // short labels, oldest → newest (e.g. "Mar")
  revenue: number[];       // dollars collected per month (paid cycles − refunds)
  newSubs: number[];       // subscriptions started that month
  failedPayments: number[]; // failed billing cycles that month
}

const MONTH_ABBR = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const key = (d: Date) => `${d.getFullYear()}-${d.getMonth()}`;

/**
 * Derives real trend series from the subscription records — no synthetic data.
 * Revenue is actual money collected (paid billing cycles by date), newSubs comes
 * from each subscription's startedAt, and failedPayments from failed cycles. The
 * window is the trailing `monthsBack` calendar months ending with the current one.
 * Months with no matching records show 0 (honest — reflects the data that exists).
 */
export function deriveTrends(subs: Subscription[], monthsBack = 6): TrendSeries {
  const now = new Date();
  // Build the ordered month buckets (oldest → newest).
  const buckets: { k: string; label: string }[] = [];
  for (let i = monthsBack - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    buckets.push({ k: key(d), label: MONTH_ABBR[d.getMonth()] });
  }
  const idx = new Map(buckets.map((b, i) => [b.k, i]));
  const revenue = new Array(monthsBack).fill(0);
  const newSubs = new Array(monthsBack).fill(0);
  const failedPayments = new Array(monthsBack).fill(0);

  for (const s of subs) {
    // New subscription in its start month.
    if (s.startedAt) {
      const i = idx.get(key(new Date(s.startedAt)));
      if (i !== undefined) newSubs[i] += 1;
    }
    // Billing cycles: collected revenue (paid − refunded) and failed attempts.
    for (const c of s.cycles || []) {
      if (!c.date) continue;
      const i = idx.get(key(new Date(c.date)));
      if (i === undefined) continue;
      if (c.status === "paid") revenue[i] += c.amountCents / 100;
      else if (c.status === "refunded") revenue[i] -= c.amountCents / 100;
      else if (c.status === "failed") failedPayments[i] += 1;
    }
  }

  return { months: buckets.map((b) => b.label), revenue, newSubs, failedPayments };
}
