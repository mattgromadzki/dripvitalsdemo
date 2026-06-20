import { lfSubmit } from "@/lib/pharmacy/lifefile";
import type { LFOrderBody } from "@/lib/pharmacy/lifefileTypes";
import { appendPharmacyEvent } from "@/lib/pharmacy/events";

export async function POST(req: Request) {
  let body: LFOrderBody;
  try { body = await req.json(); } catch { return Response.json({ ok: false, error: "Invalid JSON body.", source: "lifefile" }, { status: 400 }); }
  if (!body?.order?.patient || !Array.isArray(body?.order?.rxs) || body.order.rxs.length === 0) {
    return Response.json({ ok: false, error: "patient and at least one rx are required.", source: "lifefile" }, { status: 400 });
  }

  const result = await lfSubmit(body);

  // Seed an initial fulfillment event so Hallandale/LifeFile orders show up on the
  // Orders page right away — mirrors the GreenstoneRX path. Fully isolated: this
  // only runs in the LifeFile route and never touches the Greenstone flow.
  if (result.ok) {
    try {
      const ref = body.order.general?.referenceId;          // "DV-{patientId}-{ts}"
      let patientId: string | undefined;
      if (ref && ref.startsWith("DV-")) {
        const rest = ref.slice(3);
        const lastDash = rest.lastIndexOf("-");
        patientId = lastDash > 0 ? rest.slice(0, lastDash) : rest;
      }
      const p = body.order.patient;
      await appendPharmacyEvent({
        id: "PE-" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
        connector: "lifefile",
        event: "order_submitted",
        orderId: result.orderId,
        internalOrderId: ref,
        patientId,
        patientName: [p.firstName, p.lastName].filter(Boolean).join(" ").trim() || undefined,
        medication: body.order.rxs.map((r) => r.drugName).filter(Boolean).join(", ") || undefined,
        status: "TO_BE_FILLED",
        stage: "requested",
        at: new Date().toISOString(),
      });
    } catch { /* non-fatal: submit still succeeds */ }
  }

  return Response.json(result);
}
