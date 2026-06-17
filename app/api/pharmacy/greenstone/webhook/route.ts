import { gsTrackerStage } from "@/lib/pharmacy/greenstoneTypes";
import { appendPharmacyEvent } from "@/lib/pharmacy/events";

export const dynamic = "force-dynamic";

/**
 * 5Axis Pharmacy webhooks (order_status_changed, fill_created,
 * shipping_label_created, local_pickup_ready, order_held, order_hold_released,
 * pull_live_requested, order_action_applied).
 *
 * 5Axis authenticates by sending the raw shared secret as the entire
 * `Authorization` header value (NO "Bearer" prefix). Set GREENSTONE_WEBHOOK_SECRET
 * to the value you handed them, and give them this URL:
 *   https://app.dripvitals.com/api/pharmacy/greenstone/webhook
 */
export async function POST(req: Request) {
  const secret = process.env.GREENSTONE_WEBHOOK_SECRET;
  if (secret) {
    const provided = req.headers.get("authorization") || "";
    if (provided !== secret) return new Response("unauthorized", { status: 401 });
  }

  try {
    const b = (await req.json()) as Record<string, unknown>;
    const status = (b.new_status as string) || (b.status as string) || undefined;
    await appendPharmacyEvent({
      id: "PE-" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
      connector: "greenstone",
      event: (b.event as string) || "unknown",
      orderId: b.order_id as string | number | undefined,
      internalOrderId: b.internal_order_id as string | undefined,
      status,
      stage: gsTrackerStage(status),
      trackingNumber: b.tracking_number as string | undefined,
      trackingUrl: b.tracking_url as string | undefined,
      comment: (b.comment as string) || (b.reason as string) || undefined,
      at: new Date().toISOString(),
    });
  } catch { /* ack regardless so 5Axis doesn't retry forever */ }

  return Response.json({ ok: true });
}
