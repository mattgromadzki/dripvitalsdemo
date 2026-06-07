import crypto from "crypto";

/**
 * Patient-portal session — a signed, HttpOnly cookie (`dv_patient`), kept separate
 * from the staff session (`dv_session`). Same HMAC scheme as staff tokens.
 */
const SECRET = process.env.AUTH_SECRET || "dripvitals-dev-secret-change-me";

export interface PatientClaims { pid: string; email: string; name: string; exp: number; }

function b64url(buf: Buffer | string): string {
  return Buffer.from(buf).toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export function signPatientToken(claims: PatientClaims): string {
  const payload = b64url(JSON.stringify(claims));
  const sig = b64url(crypto.createHmac("sha256", SECRET).update(payload).digest());
  return `${payload}.${sig}`;
}

export function verifyPatientToken(token: string): PatientClaims | null {
  if (!token || !token.includes(".")) return null;
  const [payload, sig] = token.split(".");
  const expected = b64url(crypto.createHmac("sha256", SECRET).update(payload).digest());
  try { if (!crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) return null; } catch { return null; }
  try {
    const claims = JSON.parse(Buffer.from(payload.replace(/-/g, "+").replace(/_/g, "/"), "base64").toString()) as PatientClaims;
    if (!claims.exp || claims.exp < Date.now()) return null;
    return claims;
  } catch { return null; }
}

export function getPatientSession(req: Request): PatientClaims | null {
  const c = req.headers.get("cookie") || "";
  const m = c.match(/(?:^|; )dv_patient=([^;]+)/);
  const token = m ? decodeURIComponent(m[1]) : null;
  return token ? verifyPatientToken(token) : null;
}

export const PATIENT_COOKIE = "dv_patient";
