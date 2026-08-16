import { recordEmailEvent } from "@/lib/farming/track";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

// SendGrid Event Webhook — email delivery/bounce for farming campaigns.
// Setup: SendGrid → Settings → Mail Settings → Event Webhook → point at this URL
// (delivered, bounce, dropped events). Opens/clicks are tracked by our own pixel
// + redirect, so we only consume delivery/failure here. Correlated by recipient
// address to the contact's most recent campaign.
// Optional shared-secret gate: set FARMING_WEBHOOK_SECRET and append ?key=<secret>.
export async function POST(req: Request) {
  const secret = process.env.FARMING_WEBHOOK_SECRET;
  if (secret && new URL(req.url).searchParams.get("key") !== secret) {
    return new Response("unauthorized", { status: 401 });
  }
  try {
    const events = await req.json();
    if (Array.isArray(events)) {
      for (const e of events) {
        const email = String(e?.email || "");
        const ev = String(e?.event || "").toLowerCase();
        if (!email) continue;
        if (ev === "delivered") await recordEmailEvent(email, "delivered");
        else if (ev === "bounce" || ev === "dropped" || ev === "blocked") await recordEmailEvent(email, "bounced");
      }
    }
  } catch { /* ack anyway so SendGrid doesn't retry forever */ }
  return new Response("ok", { status: 200 });
}
