import crypto from "crypto";

/**
 * Patient-portal session — a signed, HttpOnly cookie (`dv_patient`), kept separate
 * from the staff session (`dv_session`). Same HMAC scheme as staff tokens.
 */
const SECRET = process.env.AUTH_SECRET || "dripvitals-dev-secret-change-me";

export interface PatientClaims { pid: string; email: string; name: string; exp: number; v?: number; }

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

/* ── Session revocation (versioning) ────────────────────────────────────────
   Tokens are stateless, so to invalidate a leaked/compromised session we keep a
   per-patient session VERSION in Redis. Tokens carry the version they were
   issued with; a bumped version makes every previously issued token invalid.
   Incident kill-switch: /api/admin/revoke-patient-sessions. */
import { Redis } from "@upstash/redis";
function sessRedis(): Redis | null {
  const url = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) return null;
  return new Redis({ url, token });
}
const VER_KEY = (pid: string) => `patient:sessver:${pid}`;

export async function getPatientSessionVersion(pid: string): Promise<number> {
  const r = sessRedis();
  if (!r) return 0;
  try { const v = await r.get(VER_KEY(pid)); return typeof v === "number" ? v : parseInt(String(v || "0"), 10) || 0; } catch { return 0; }
}
export async function bumpPatientSessionVersion(pid: string): Promise<number> {
  const r = sessRedis();
  if (!r) return 0;
  try { return await r.incr(VER_KEY(pid)); } catch { return 0; }
}
/** Full check: signature + expiry + version. Use in data-bearing endpoints. */
export async function getVerifiedPatientSession(req: Request): Promise<PatientClaims | null> {
  const claims = getPatientSession(req);
  if (!claims) return null;
  const current = await getPatientSessionVersion(claims.pid);
  if ((claims.v ?? 0) !== current) return null; // revoked
  return claims;
}
