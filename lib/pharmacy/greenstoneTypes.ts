// 5Axis Pharmacy Orders API v2 (GreenstoneRX) — shared types + status mapping.

export const GS_STATUSES = [
  "TO_BE_FILLED", "PARTIAL_FILL", "COMPLETE_FILLED", "LABEL_CREATED",
  "SHIPPED_TO_CLINIC", "IN_SHIPPING", "ISSUE_IN_SHIPPING", "COMPLETED",
] as const;
export type GsStatus = (typeof GS_STATUSES)[number];

export interface GsScript {
  name: string;
  dispense_quantity: string;
  dispense_unit: string;
  sig?: string;
  doctor?: string;        // internal doctor ID from our system (required by 5Axis for some tokens)
  doctor_name: string;
  doctor_npi: string;
  number_refills?: number;
  date_prescribed: string; // YYYY-MM-DD
  daw?: string;
}
export interface GsAddress { address: string; line2?: string; city: string; state: string; zipCode: string }

// What the EMR passes in; the driver maps this to the 5Axis OrderDocument.
export interface GsOrderInput {
  internalOrderId?: string;
  internalCustomerId?: string;
  firstName: string;
  lastName: string;
  dob?: string;
  gender?: string;
  email?: string;
  phoneNumber?: string;
  address: GsAddress;
  scripts: GsScript[];
  deliveryType?: "direct" | "clinic";
}

export interface GsSubmitResult { ok: boolean; orderId?: number | string; message?: string; warnings?: string[]; error?: string; source: "greenstone" | "mock"; raw?: unknown }
export interface GsStatusResult { ok: boolean; orderId?: number | string; status?: string; trackingNumber?: string; trackingUrl?: string; document?: unknown; error?: string; source: "greenstone" | "mock" }

// Map a 5Axis status to the patient-facing tracker stage.
export function gsTrackerStage(status?: string): "requested" | "filling" | "ready" | "shipped" | "delivered" | "issue" {
  switch ((status || "").toUpperCase()) {
    case "TO_BE_FILLED": return "requested";
    case "PARTIAL_FILL":
    case "COMPLETE_FILLED": return "filling";
    case "LABEL_CREATED":
    case "SHIPPED_TO_CLINIC": return "ready";
    case "IN_SHIPPING": return "shipped";
    case "ISSUE_IN_SHIPPING": return "issue";
    case "COMPLETED": return "delivered";
    default: return "requested";
  }
}
