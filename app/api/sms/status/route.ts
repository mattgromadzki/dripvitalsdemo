import { setStatus } from "@/lib/sms/inboundStore";

/**
 * Twilio delivery-status callback. The send route registers this URL as the
 * message's StatusCallback, so Twilio POSTs updates here as the message
 * progresses: queued → sent → delivered (or failed/undelivered).
 */
function mapStatus(s: string): string {
  switch ((s || "").toLowerCase()) {
    case "delivered":
    case "read": return "delivered";
    case "sent": return "sent";
    case "failed":
    case "undelivered": return "failed";
    case "queued":
    case "accepted":
    case "scheduled":
    case "sending": return "queued";
    default: return "sent";
  }
}

export async function POST(req: Request) {
  try {
    const form = await req.formData();
    const sid = String(form.get("MessageSid") || form.get("SmsSid") || "");
    const status = String(form.get("MessageStatus") || form.get("SmsStatus") || "");
    if (sid && status) await setStatus(sid, mapStatus(status));
  } catch (e) {
    console.error("SMS status callback error:", e);
  }
  return new Response(null, { status: 204 });
}

export async function GET() {
  return new Response("DripVitals SMS status callback is live (Twilio posts delivery updates here).", {
    status: 200, headers: { "Content-Type": "text/plain" },
  });
}
