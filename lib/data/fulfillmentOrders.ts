import type { Patient } from "@/lib/types";
import { ALL_WORKFLOW_STATUSES, type WorkflowStatus, type WorkflowIntent } from "./orderWorkflow";

export interface FulfillmentOrder {
  id: string;
  patientId: string;
  patientName: string;
  medication: string;
  program: string;
  programIntent: WorkflowIntent;
  orderType: "New" | "Refill" | "Dose Increase";
  dose: string;
  qty: string;
  provider: string;
  state: string;
  pharmacy: string;
  status: WorkflowStatus;
  created: string;
  updated: string;
  tracking: string;
  total: string;
}

const PHARMACIES = ["DripVitals Compounding", "Empower", "Tailor Made", "Hallandale Rx", "Belmar Pharmacy"];
const QTY = ["1 vial · 4 wk", "1 vial", "10 mL", "10 tabs", "5 vials", "4 syringes"];
const UPDATED = ["2h ago", "18m ago", "1h ago", "Yesterday", "4h ago", "3h ago", "30m ago"];

function programFor(plan: string): { program: string; intent: WorkflowIntent } {
  const p = (plan || "").toLowerCase();
  if (p.includes("semaglutide") || p.includes("tirzepatide") || p.includes("glp")) return { program: "Weight Loss", intent: "blue" };
  if (p.includes("testosterone") || p.includes("trt")) return { program: "TRT", intent: "coral" };
  if (p.includes("sildenafil") || p.includes("tadalafil")) return { program: "ED", intent: "purple" };
  if (p.includes("nad")) return { program: "NAD+", intent: "teal" };
  if (p.includes("sermorelin")) return { program: "Sermorelin", intent: "pink" };
  if (p.includes("b12") || p.includes("vitamin")) return { program: "Vitamins", intent: "muted" };
  return { program: "Weight Loss", intent: "blue" };
}

function trackingFor(status: WorkflowStatus): string {
  switch (status) {
    case "label_created": return "UPS · Label created";
    case "shipped":       return "UPS · Shipped";
    case "in_transit":    return "FedEx · In transit";
    case "delivered":     return "Delivered";
    default:              return "—";
  }
}

// One order per patient, deterministically spread across the workflow so the
// table shows variety and every KPI has a believable count.
export function getFulfillmentOrders(patients: Patient[]): FulfillmentOrder[] {
  return patients.map((p, i) => {
    const seed = p.id.charCodeAt(p.id.length - 1) + p.id.charCodeAt(p.id.length - 2) + i;
    const status: WorkflowStatus = p.week <= 1 ? "awaiting_provider_review" : ALL_WORKFLOW_STATUSES[(seed + i) % ALL_WORKFLOW_STATUSES.length];
    const { program, intent } = programFor(p.plan);
    const orderType: FulfillmentOrder["orderType"] = p.week <= 1 ? "New" : seed % 7 === 0 ? "Dose Increase" : "Refill";
    return {
      id: `ORD-${10000 + i}`,
      patientId: p.id,
      patientName: p.name,
      medication: p.plan,
      program,
      programIntent: intent,
      orderType,
      dose: p.dose,
      qty: QTY[seed % QTY.length],
      provider: p.provider,
      state: p.state,
      pharmacy: PHARMACIES[seed % PHARMACIES.length],
      status,
      created: p.lastOrder || p.since,
      updated: UPDATED[seed % UPDATED.length],
      tracking: trackingFor(status),
      total: p.sub || "$199",
    };
  });
}

export function heightForPatient(id: string): string {
  const seed = id.charCodeAt(id.length - 1);
  const inches = 63 + (seed % 12); // 5'3" – 6'2"
  return `${Math.floor(inches / 12)}′ ${inches % 12}″`;
}
