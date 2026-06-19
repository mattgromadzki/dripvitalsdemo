import { requireAuth } from "@/lib/auth/authorize";
import { appendPharmacyEvent } from "@/lib/pharmacy/events";

export const dynamic = "force-dynamic";

/**
 * Records an EMR-side void for a pharmacy order. This appends a "voided" event
 * to the shared pharmacy-events log so the chart/portal reflect it — it does
 * NOT transmit a cancellation to GreenstoneRX. Cancelling the actual fill must
 * be confirmed with the pharmacy (or wired to the 5Axis update_one operation
 * once that request shape + cancelled status value are confirmed).
 */
export async function POST(req: Request) {
  const gate = requireAuth(req);
  if (gate) return gate;

  let b: { patientId?: string; orderId?: string | number; internalOrderId?: string; patientName?: string; reason?: string };
  try { b = await req.json(); } catch { return Response.json({ ok: false, error: "Invalid JSON body." }, { status: 400 }); }

  if (!b.patientId && !b.internalOrderId && b.orderId == null) {
    return Response.json({ ok: false, error: "Need patientId, internalOrderId, or orderId." }, { status: 400 });
  }

  try {
    await appendPharmacyEvent({
      id: "PE-" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
      connector: "greenstone",
      event: "order_voided",
      orderId: b.orderId,
      internalOrderId: b.internalOrderId,
      patientId: b.patientId,
      patientName: b.patientName,
      status: "VOIDED",
      stage: "voided",
      comment: b.reason || "Voided in EMR — cancellation must be confirmed with the pharmacy.",
      at: new Date().toISOString(),
    });
  } catch {
    return Response.json({ ok: false, error: "Could not record void." }, { status: 500 });
  }

  return Response.json({ ok: true });
}
