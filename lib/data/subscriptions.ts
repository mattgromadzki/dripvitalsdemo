import type { Subscription, BillingCycle } from "@/lib/types";
import { PATIENTS } from "@/lib/data/patients";

function parseCycleAmount(sub: string): number {
  const match = sub.replace(/[^0-9.]/g, "");
  return parseFloat(match) || 0;
}

function parseCycle(sub: string): BillingCycle {
  if (sub.includes("/qtr"))  return "quarterly";
  if (sub.includes("/6mo")) return "semi-annual";
  if (sub.includes("/yr"))  return "annual";
  return "monthly";
}

function addToDate(base: Date, cycle: BillingCycle): Date {
  const d = new Date(base);
  if (cycle === "monthly")        d.setMonth(d.getMonth() + 1);
  else if (cycle === "quarterly") d.setMonth(d.getMonth() + 3);
  else if (cycle === "semi-annual") d.setMonth(d.getMonth() + 6);
  else if (cycle === "annual")    d.setFullYear(d.getFullYear() + 1);
  return d;
}

function fmtDate(d: Date): { display: string; ordered: number } {
  const months = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
  return {
    display: `${months[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}`,
    ordered: parseInt(`${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, "0")}${String(d.getDate()).padStart(2, "0")}`, 10),
  };
}

function parseStartDate(since: string): Date {
  // since is like "Jan 4, 2024"
  const months: Record<string, number> = {
    Jan: 0, Feb: 1, Mar: 2, Apr: 3, May: 4, Jun: 5,
    Jul: 6, Aug: 7, Sep: 8, Oct: 9, Nov: 10, Dec: 11,
  };
  const match = since.match(/^(\w+)\s+(\d+),?\s+(\d{4})$/);
  if (!match) return new Date(2024, 0, 1);
  return new Date(parseInt(match[3], 10), months[match[1]] ?? 0, parseInt(match[2], 10));
}

export const SUBSCRIPTIONS: Subscription[] = PATIENTS
  .filter((p) => p.sub !== "—" && p.status === "active")
  .map((p, idx) => {
    const amount = parseCycleAmount(p.sub);
    const cycle = parseCycle(p.sub);
    const startedDate = parseStartDate(p.since);

    // Calculate next payment date — find the next cycle boundary from now
    const now = new Date(2026, 4, 29); // May 29, 2026 anchor
    let next = startedDate;
    while (next <= now) {
      next = addToDate(next, cycle);
    }

    // Approximate payments completed
    let payments = 0;
    let cursor = parseStartDate(p.since);
    while (cursor <= now) {
      payments++;
      cursor = addToDate(cursor, cycle);
    }
    payments = Math.max(0, payments - 1);

    return {
      id: `sub_${p.id.toLowerCase().replace("-", "")}_${1000 + idx}`,
      patientName: p.name,
      patientId: p.id,
      patientColor: p.color,
      plan: p.plan,
      cycleAmount: amount,
      billingCycle: cycle,
      status: "active" as const,
      startedDate: fmtDate(startedDate).display,
      startedAt: fmtDate(startedDate).ordered,
      nextPaymentDate: fmtDate(next).display,
      nextPaymentAt: fmtDate(next).ordered,
      stripeId: `sub_1Q${Math.abs((idx * 7919) % 99999)
        .toString(36)
        .padStart(8, "0")}`,
      totalPaid: amount * payments,
      paymentsCount: payments,
    };
  });
