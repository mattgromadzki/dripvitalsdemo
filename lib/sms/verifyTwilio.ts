import crypto from "crypto";
import { getSmsCreds } from "@/lib/integrations/store";

/**
 * Validates Twilio's X-Twilio-Signature for an x-www-form-urlencoded webhook
 * (https://www.twilio.com/docs/usage/security#validating-requests).
 *
 * Behavior:
 *  - TWILIO_VALIDATE=0  → validation disabled (kill-switch), always allowed.
 *  - No auth token available → can't validate, allowed (prototype-safe).
 *  - Token present → signature must match, else rejected.
 */
export function verifyTwilioRequest(req: Request, params: Record<string, string>): boolean {
  if (process.env.TWILIO_VALIDATE === "0") return true;
  const token = getSmsCreds().authToken || process.env.TWILIO_AUTH_TOKEN;
  if (!token) return true;

  const sig = req.headers.get("x-twilio-signature");
  if (!sig) return false;

  // Reconstruct the exact public URL Twilio signed.
  const proto = req.headers.get("x-forwarded-proto") || "https";
  const host = req.headers.get("host") || "";
  let url: string;
  try { const u = new URL(req.url); url = `${proto}://${host}${u.pathname}${u.search}`; }
  catch { url = `${proto}://${host}`; }

  // URL + each (key + value) sorted by key, HMAC-SHA1 with the auth token, base64.
  let data = url;
  for (const k of Object.keys(params).sort()) data += k + params[k];
  const expected = crypto.createHmac("sha1", token).update(Buffer.from(data, "utf-8")).digest("base64");

  try { return crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected)); } catch { return false; }
}
