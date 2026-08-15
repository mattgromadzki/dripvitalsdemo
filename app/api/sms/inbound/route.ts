import { addInbound } from "@/lib/sms/inboundStore";
import { verifyTwilioRequest } from "@/lib/sms/verifyTwilio";
import { readDomain, writeDomain } from "@/lib/farming/serverStore";
import { recordReply } from "@/lib/farming/track";
import type { FarmContact } from "@/lib/types/farming";

const STOP_WORDS = new Set(["stop", "stopall", "unsubscribe", "cancel", "end", "quit"]);
const START_WORDS = new Set(["start", "unstop", "yes"]);
const digits = (p: string) => (p || "").replace(/[^\d]/g, "").slice(-10);

// Apply an SMS STOP/START keyword to the farming suppression list. Returns a
// confirmation string to reply with, or null if the message isn't an opt-out
// keyword (or no matching farming contact exists).
async function applyOptOutKeyword(from: string, body: string): Promise<string | null> {
  const word = (body || "").trim().toLowerCase().replace(/[^a-z]/g, "");
  const isStop = STOP_WORDS.has(word);
  const isStart = START_WORDS.has(word);
  if (!isStop && !isStart) return null;

  const fromKey = digits(from);
  if (!fromKey) return null;
  const contacts = (await readDomain<FarmContact[]>("farming-contacts")) || [];
  const matches = contacts.filter((c) => digits(c.phone) === fromKey);
  if (!matches.length) return null;

  for (const c of matches) {
    if (isStop) { c.optedOut = true; c.status = "unsubscribed"; c.optOutAt = new Date().toISOString(); c.optOutChannel = "sms"; }
    else { c.optedOut = false; c.optOutAt = undefined; c.optOutChannel = undefined; }
  }
  await writeDomain("farming-contacts", contacts);
  return isStop
    ? "You've been unsubscribed and won't receive further messages. Reply START to opt back in."
    : "You're re-subscribed and will receive messages again. Reply STOP to opt out.";
}

function twiml(message?: string): Response {
  const inner = message ? `<Message>${message.replace(/&/g, "&amp;").replace(/</g, "&lt;")}</Message>` : "";
  return new Response(`<?xml version="1.0" encoding="UTF-8"?><Response>${inner}</Response>`, {
    status: 200, headers: { "Content-Type": "text/xml" },
  });
}

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

  // Cold-outreach compliance: honor STOP/START keywords against the farming
  // suppression list, and confirm back to the sender. Non-keyword messages fall
  // through to the empty TwiML (no auto-reply), preserving patient messaging.
  if (from && body) {
    try {
      const reply = await applyOptOutKeyword(from, body);
      if (reply) return twiml(reply);
    } catch (e) { console.error("Failed to process opt-out keyword:", e); }
    // Non-keyword inbound from a farming contact = a reply → attribute it.
    try { await recordReply({ phone: from }); } catch (e) { console.error("Failed to record reply:", e); }
  }

  return twiml();
}

// Visiting the URL in a browser (GET) just shows a hint instead of a 405.
export async function GET() {
  return new Response(
    "DripVitals SMS inbound webhook is live. Point your Twilio number's \"A message comes in\" webhook here using HTTP POST.",
    { status: 200, headers: { "Content-Type": "text/plain" } }
  );
}
