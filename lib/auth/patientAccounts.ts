import { Redis } from "@upstash/redis";
import { hashPassword, verifyPassword } from "@/lib/auth/serverCrypto";

/**
 * Server-side patient credentials. Patients are the EMR patient records
 * (in store:patients); their password is the shared demo password until they set
 * their own, which is stored hashed in `patient:auth:v1` (keyed by email).
 *
 * When Upstash isn't configured, patient records can't be read server-side, so
 * the login route falls back to a client-supplied id hint + the demo password
 * (clearly a demo-only path). With Upstash present, lookups are authoritative.
 */
const PW_KEY = "patient:auth:v1";
const DEMO_PW = "demo1234";

function redis(): Redis | null {
  const url = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) return null;
  return new Redis({ url, token });
}

export function patientAuthPersistent(): boolean {
  return !!redis();
}

export interface PatientRec { id: string; name: string; email: string; }

/** Authoritative lookup from the persisted patient roster (Upstash only). */
export async function findPatientByEmail(email: string): Promise<PatientRec | null> {
  const r = redis();
  if (!r) return null;
  const v = await r.get("store:patients");
  const arr = typeof v === "string" ? JSON.parse(v) : v;
  if (!Array.isArray(arr)) return null;
  const lc = email.trim().toLowerCase();
  const p = arr.find((x: { email?: string }) => (x?.email || "").toLowerCase() === lc) as { id?: string; name?: string; email?: string } | undefined;
  return p?.id ? { id: p.id, name: p.name || "Patient", email: p.email || lc } : null;
}

/** True if the password matches the patient's set password, or the demo password. */
export async function verifyPatientPassword(email: string, password: string): Promise<boolean> {
  const r = redis();
  if (r) {
    const h = await r.hget(PW_KEY, email.trim().toLowerCase());
    if (h && typeof h === "string") return verifyPassword(password, h);
  }
  return password === DEMO_PW; // no override set → demo password
}

export async function setPatientPassword(email: string, newPassword: string): Promise<void> {
  const r = redis();
  if (r) await r.hset(PW_KEY, { [email.trim().toLowerCase()]: hashPassword(newPassword) });
}
