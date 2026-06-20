import type { FulfillmentOrder } from "@/lib/data/fulfillmentOrders";
import { WORKFLOW_META, type WorkflowStage } from "@/lib/data/orderWorkflow";

export const TL_LABELS = ["Order", "Paid", "Review", "Rx", "Pharm", "Ship"];

export interface Derived {
  isException: boolean; isDelivered: boolean; isShipping: boolean; atPharmacy: boolean; leftPharmacy: boolean;
  inReview: boolean; reviewed: boolean; isApproved: boolean; awaitingPay: boolean; payFailed: boolean;
  isPaid: boolean; rxSent: boolean; rxNeeded: boolean; preRx: boolean;
}

export function derive(o: FulfillmentOrder): Derived {
  const stage = WORKFLOW_META[o.status].stage;
  const inP = (s: WorkflowStage[]) => s.includes(stage);
  const isException = stage === "Exceptions";
  const isDelivered = o.status === "delivered";
  const isShipping = ["label_created", "shipped", "in_transit"].includes(o.status);
  const atPharmacy = stage === "Pharmacy";
  const leftPharmacy = stage === "Shipping";
  const inReview = stage === "Medical Review";
  const reviewed = inP(["Clinical Decision", "Payment", "Pharmacy", "Shipping"]);
  const isApproved = o.status === "approved" || inP(["Payment", "Pharmacy", "Shipping"]);
  const awaitingPay = o.status === "awaiting_payment";
  const payFailed = o.status === "payment_failed";
  const isPaid = o.status === "paid" || inP(["Pharmacy", "Shipping"]);
  const rxSent = inP(["Pharmacy", "Shipping"]);
  const preRx = !rxSent && !isException && !isDelivered;
  const rxNeeded = preRx;
  return { isException, isDelivered, isShipping, atPharmacy, leftPharmacy, inReview, reviewed, isApproved, awaitingPay, payFailed, isPaid, rxSent, rxNeeded, preRx };
}

export function timelineStates(d: Derived): ("done" | "current" | "need" | "")[] {
  return [
    "done",
    d.isPaid ? "done" : (d.awaitingPay || d.payFailed) ? "need" : "",
    d.reviewed ? "done" : d.inReview ? "current" : "",
    d.rxSent ? "done" : d.isApproved ? "need" : "",
    d.leftPharmacy ? "done" : d.atPharmacy ? "current" : "",
    d.isDelivered ? "done" : d.isShipping ? "current" : "",
  ];
}

export const initials = (s: string) => s.split(/\s+/).filter(Boolean).map((w) => w[0]).slice(0, 2).join("").toUpperCase();
export const medAbbr = (s: string) => s.split(/\s+/).filter(Boolean).map((w) => w[0]).slice(0, 2).join("").toUpperCase();
export const carrierFor = (o: FulfillmentOrder) => (o.tracking && o.tracking !== "—" ? "UPS" : "—");
export const methodFor = (o: FulfillmentOrder) => (/semaglutide|tirzepatide|glp|nad|sermorelin|testosterone/i.test(o.medication) ? "Cold-chain" : "Standard");
