import { greenstoneSubmit } from "@/lib/pharmacy/greenstone";
import type { GsOrderInput } from "@/lib/pharmacy/greenstoneTypes";
import { requireAuth } from "@/lib/auth/authorize";
import { appendPharmacyEvent } from "@/lib/pharmacy/events";

export async function POST(req: Request) {
  const gate = requireAuth(req);
  if (gate) return gate;

  let input: GsOrderInput;
  try { input = await req.json(); } catch { return Response.json({ ok: false, error: "Invalid JSON body.", source: "greenstone" }, { status: 400 }); }

  if (!input?.firstName || !input?.lastName || !input?.address || !Array.isArray(input?.scripts) || input.scripts.length === 0) {
    return Response.json({ ok: false, error: "Patient name, address, and at least one script are required.", source: "greenstone" }, { status: 400 });
  }
  const bad = input.scripts.find((s) => !s.name || !s.dispense_quantity || !s.dispense_unit || !s.doctor_name || !s.doctor_npi || !s.date_prescribed);
  if (bad) return Response.json({ ok: false, error: "Each script needs name, dispense_quantity, dispense_unit, doctor_name, doctor_npi, and date_prescribed.", source: "greenstone" }, { status: 400 });

  const result = await greenstoneSubmit(input);

  // Seed an initial fulfillment event so the patient chart shows the GreenstoneRX
  // order id and "received" status right away — webhook events layer on top.
  if (result.ok) {
    try {
      await appendPharmacyEvent({
        id: "PE-" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
        connector: "greenstone",
        event: "order_submitted",
        orderId: result.orderId,
        internalOrderId: input.internalOrderId,
        patientId: input.internalCustomerId,
        patientName: [input.firstName, input.lastName].filter(Boolean).join(" ").trim() || undefined,
        medication: input.scripts.map((s) => s.name).filter(Boolean).join(", ") || undefined,
        status: "TO_BE_FILLED",
        stage: "requested",
        at: new Date().toISOString(),
      });
    } catch { /* non-fatal: chart still works off webhook events */ }
  }

  return Response.json(result, { status: result.ok ? 200 : 502 });
}
