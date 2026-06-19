import { requireAuth } from "@/lib/auth/authorize";
import { appendPharmacyEvent } from "@/lib/pharmacy/events";
import { greenstoneCancel } from "@/lib/pharmacy/greenstone";

export const dynamic = "force-dynamic";

/**
 * Cancel a GreenstoneRX order. Transmits an update_one (status → CANCELLED) to
 * 5Axis, and only records the cancellation in the chart/portal event log when
 * the pharmacy confirms (success:1). If the pharmacy rejects (e.g. the order is
 * too far along), the error is surfaced and nothing is marked cancelled, so the
 * chart never shows a cancellation the pharmacy didn't actually accept.
 */
export async function POST(req: Request) {
  const gate = requireAuth(req);
  if (gate) return gate;

  let b: { patientId?: string; orderId?: string | number; internalOrderId?: string; patientName?: string; reason?: string };
  try { b = await req.json(); } catch { return Response.json({ ok: false, error: "Invalid JSON body." }, { status: 400 }); }

  if (b.orderId == null && !b.internalOrderId) {
    return Response.json({ ok: false, error: "Need the pharmacy order_id or internal_order_id to cancel." }, { status: 400 });
  }

  // Transmit the cancellation to GreenstoneRX first.
  const result = await greenstoneCancel({ order_id: b.orderId ?? undefined, internal_order_id: b.internalOrderId });
  if (!result.ok) {
    return Response.json({ ok: false, error: result.error || "Pharmacy did not accept the cancellation." }, { status: 502 });
  }

  // Confirmed — record it so the chart + portal reflect the cancelled state.
  try {
    await appendPharmacyEvent({
      id: "PE-" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
      connector: "greenstone",
      event: "order_cancelled",
      orderId: b.orderId ?? result.orderId,
      internalOrderId: b.internalOrderId,
      patientId: b.patientId,
      patientName: b.patientName,
      status: "CANCELLED",
      stage: "cancelled",
      comment: (b.reason || "Cancelled by clinic") + (result.source === "mock" ? " (mock — no live token)" : " — confirmed by GreenstoneRX"),
      at: new Date().toISOString(),
    });
  } catch { /* event log write failed but the pharmacy cancel succeeded */ }

  return Response.json({ ok: true, source: result.source, message: result.message });
}
