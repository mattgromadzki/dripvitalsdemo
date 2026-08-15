import "server-only";
import crypto from "crypto";

// Signed, tamper-proof opt-out tokens for one-click email unsubscribe links.
// token = base64url(HMAC-SHA256(contactId)) — mirrors lib/auth/serverCrypto's
// signing so no new secret is introduced. The link carries the contact id in
// the clear; the token proves it wasn't forged/edited by the recipient.
const SECRET = process.env.AUTH_SECRET || "dripvitals-dev-secret-change-me";

function b64url(buf: Buffer): string {
  return buf.toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export function signOptOut(contactId: string): string {
  return b64url(crypto.createHmac("sha256", SECRET).update(`optout:${contactId}`).digest());
}

export function verifyOptOut(contactId: string, token: string): boolean {
  if (!contactId || !token) return false;
  const expected = signOptOut(contactId);
  try {
    return crypto.timingSafeEqual(Buffer.from(token), Buffer.from(expected));
  } catch {
    return false;
  }
}

// Open/click tracking tokens — same HMAC scheme, scoped to a (campaign, contact)
// pair so a leaked pixel URL can't be replayed against a different recipient.
export function signTrack(campaignId: string, contactId: string): string {
  return b64url(crypto.createHmac("sha256", SECRET).update(`track:${campaignId}:${contactId}`).digest());
}

export function verifyTrack(campaignId: string, contactId: string, token: string): boolean {
  if (!campaignId || !contactId || !token) return false;
  try {
    return crypto.timingSafeEqual(Buffer.from(token), Buffer.from(signTrack(campaignId, contactId)));
  } catch {
    return false;
  }
}
