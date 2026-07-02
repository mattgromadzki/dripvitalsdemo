import { Redis } from "@upstash/redis";
import { hashPassword, verifyPassword } from "@/lib/auth/serverCrypto";
import { listPatients, isPersistent } from "@/lib/crm/patients";

/**
 * Server-side patient credentials. Patients are the EMR patient records,
 * persisted via the CRM patient store (Postgres / `crm:patients:v1`) — the same
 * roster the EMR syncs to. Passwords are stored hashed in `patient:auth:v1`
 * (keyed by email); until a patient sets one, the shared demo password applies.
 *
 * When nothing is persisted (no Postgres or Upstash), patient records can't be
 * read server-side, so the login route falls back to a client-supplied id hint
 * + the demo password (a demo-only path). When persistence is present, lookups
 * are authoritative.
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
  return isPersistent();
}

export interface PatientRec { id: string; name: string; email: string; }

/** Authoritative lookup from the persisted patient roster (Postgres / Upstash). */
export async function findPatientByEmail(email: string): Promise<PatientRec | null> {
  const lc = email.trim().toLowerCase();
  let all: { id?: string; name?: string; email?: string }[] = [];
  try { all = await listPatients(); } catch { all = []; }
  const p = all.find((x) => (x?.email || "").toLowerCase() === lc);
  return p?.id ? { id: p.id, name: p.name || "Patient", email: p.email || lc } : null;
}

/**
 * True if the password matches the patient's own set password. The shared demo
 * password is ONLY accepted in demo mode (NEXT_PUBLIC_SEED_DEMO_DATA != "false").
 * In production (flag set to "false"), a patient who hasn't set a password cannot
 * sign in until they do so via the welcome / reset flow — so no real PHI is ever
 * reachable with a shared default credential.
 */
export async function verifyPatientPassword(email: string, password: string): Promise<boolean> {
  const r = redis();
  if (r) {
    const h = await r.hget(PW_KEY, email.trim().toLowerCase());
    if (h && typeof h === "string") return verifyPassword(password, h);
  }
  // No password set for this patient.
  const demoMode = process.env.NEXT_PUBLIC_SEED_DEMO_DATA !== "false";
  return demoMode ? password === DEMO_PW : false;
}

export async function setPatientPassword(email: string, newPassword: string): Promise<void> {
  const r = redis();
  if (r) await r.hset(PW_KEY, { [email.trim().toLowerCase()]: hashPassword(newPassword) });
}

/**
 * Emails (lowercased) of patients who have set their own portal password — i.e.
 * activated their login via the welcome / reset flow. A patient is "activated"
 * exactly when they have an entry in `patient:auth:v1`; everyone else is still on
 * the shared demo password and hasn't finished portal setup. Returns [] when no
 * Redis is configured (nothing is authoritative in that demo-only mode).
 */
export async function listActivatedEmails(): Promise<string[]> {
  const r = redis();
  if (!r) return [];
  try {
    const keys = await r.hkeys(PW_KEY);
    return Array.isArray(keys) ? keys.map((k) => String(k).trim().toLowerCase()) : [];
  } catch {
    return [];
  }
}
