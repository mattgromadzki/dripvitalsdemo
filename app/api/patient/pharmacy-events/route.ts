import { getPatientSession } from "@/lib/auth/patientSession";
import { listPharmacyEvents } from "@/lib/pharmacy/events";

export const dynamic = "force-dynamic";

// Returns ONLY the signed-in patient's pharmacy fulfillment events, identified
// by the patient session cookie. Used by the patient portal's Shipments tab.
export async function GET(req: Request) {
  const s = getPatientSession(req);
  if (!s) return new Response(JSON.stringify({ ok: false }), { status: 401, headers: { "Content-Type": "application/json" } });

  const all = await listPharmacyEvents();
  const mine = all.filter(
    (e) => e?.patientId === s.pid || (e?.internalOrderId || "").startsWith(`DV-${s.pid}-`),
  );
  // Patient-safe projection (no internal ids / clinic data).
  const events = mine.map((e) => ({
    id: e.id,
    event: e.event,
    status: e.status,
    stage: e.stage,
    trackingNumber: e.trackingNumber,
    trackingUrl: e.trackingUrl,
    carrier: e.carrier,
    at: e.at,
  }));
  return Response.json({ ok: true, events });
}
