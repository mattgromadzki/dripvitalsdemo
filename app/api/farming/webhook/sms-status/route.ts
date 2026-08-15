import { verifyTwilioRequest } from "@/lib/sms/verifyTwilio";
import { recordDelivered, recordFailure } from "@/lib/farming/track";

export const dynamic = "force-dynamic";

// Twilio delivery-status callback for farming SMS. The dispatcher sets this as
// the StatusCallback with ?m=<campaignId>&c=<contactId>, so we know which
// campaign/recipient each status update belongs to. Twilio signs the full URL
// (query included), verified below.
export async function POST(req: Request) {
  const params: Record<string, string> = {};
  let status = "";
  try {
    const form = await req.formData();
    for (const [k, v] of form.entries()) params[k] = String(v);
    status = String(form.get("MessageStatus") || form.get("SmsStatus") || "").toLowerCase();
  } catch { /* ignore */ }

  if (!verifyTwilioRequest(req, params)) return new Response("Invalid signature.", { status: 403 });

  const url = new URL(req.url);
  const m = url.searchParams.get("m") || "";
  const c = url.searchParams.get("c") || "";
  if (m && c) {
    try {
      if (status === "delivered") await recordDelivered(m, c);
      else if (status === "undelivered" || status === "failed") await recordFailure(m, c);
    } catch { /* ignore */ }
  }
  return new Response("ok", { status: 200 });
}
