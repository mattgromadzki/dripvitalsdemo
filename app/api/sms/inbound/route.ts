import { addInbound } from "@/lib/sms/inboundStore";
import { verifyTwilioRequest } from "@/lib/sms/verifyTwilio";

/**
 * Twilio "A message comes in" webhook target.
 * Configure this URL on your Twilio number:
 *   Phone Numbers → (your number) → Messaging configuration →
 *   "A message comes in" → Webhook → https://<your-app>/api/sms/inbound  (HTTP POST)
 *
 * Twilio POSTs application/x-www-form-urlencoded fields: From, To, Body, MessageSid, ...
 * Requests are verified with the X-Twilio-Signature header.
 */
export async function POST(req: Request) {
  let from = "", to = "", body = "", sid = "";
  const params: Record<string, string> = {};
  try {
    const form = await req.formData();
    for (const [k, v] of form.entries()) params[k] = String(v);
    from = String(form.get("From") || "");
    to = String(form.get("To") || "");
    body = String(form.get("Body") || "");
    sid = String(form.get("MessageSid") || form.get("SmsSid") || "in_" + Date.now());
  } catch {
    // ignore parse errors; we still return valid TwiML below
  }

  if (!verifyTwilioRequest(req, params)) {
    return new Response("Invalid Twilio signature.", { status: 403 });
  }

  if (from && body) {
    try { await addInbound({ sid, from, to, body, receivedAt: new Date().toISOString() }); }
    catch (e) { console.error("Failed to store inbound SMS:", e); }
  }

  // Return empty TwiML so Twilio doesn't send a default/error reply.
  // To auto-reply, swap the empty <Response/> for:
  //   <Response><Message>Thanks! A team member will reply shortly.</Message></Response>
  return new Response('<?xml version="1.0" encoding="UTF-8"?><Response></Response>', {
    status: 200,
    headers: { "Content-Type": "text/xml" },
  });
}

// Visiting the URL in a browser (GET) just shows a hint instead of a 405.
export async function GET() {
  return new Response(
    "DripVitals SMS inbound webhook is live. Point your Twilio number's \"A message comes in\" webhook here using HTTP POST.",
    { status: 200, headers: { "Content-Type": "text/plain" } }
  );
}
