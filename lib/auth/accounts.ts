import { Redis } from "@upstash/redis";
import { hashPassword, verifyPassword } from "@/lib/auth/serverCrypto";

export interface StaffAccount {
  email: string; name: string; role: string; pwd: string; active: boolean;
  totpSecret?: string;     // confirmed TOTP secret (base32) — 2FA enabled when present
  totpPending?: string;    // secret mid-enrollment, not yet confirmed
  backupCodes?: string[];  // hashed, single-use recovery codes
  failedAttempts?: number; // consecutive failed logins
  lockedUntil?: number;    // epoch ms; login blocked until then
}

export interface StaffAccountPublic {
  email: string; name: string; role: string; active: boolean;
  twofa: boolean; locked: boolean;
}

export const MAX_LOGIN_ATTEMPTS = 5;
export const LOCK_MINUTES = 15;

const KEY = "auth:staff:v1";
const mem = new Map<string, StaffAccount>();
let seeded = false;

// Seeded demo staff (mirror the RBAC team). All start with password "demo1234".
const DEMO = [
  { name: "Dr. Maria Rivera", email: "maria@dripvitals.com", role: "owner" },
  { name: "Dr. James Park", email: "james@dripvitals.com", role: "provider" },
  { name: "Dr. Sarah Chen", email: "sarah@dripvitals.com", role: "provider" },
  { name: "Tasha Reed", email: "tasha@dripvitals.com", role: "support" },
  { name: "Leo Martin", email: "leo@dripvitals.com", role: "billing" },
];

function redis(): Redis | null {
  const url = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) return null;
  return new Redis({ url, token });
}

function parse(v: unknown): StaffAccount | null {
  if (!v) return null;
  try { return typeof v === "string" ? JSON.parse(v) : (v as StaffAccount); } catch { return null; }
}

function demoEnabled(): boolean {
  return process.env.NEXT_PUBLIC_SEED_DEMO_DATA !== "false";
}

async function ensureSeeded(): Promise<void> {
  if (seeded) return;
  seeded = true;

  const ownerEmail = (process.env.OWNER_EMAIL || "").trim().toLowerCase();
  const ownerPwd = process.env.OWNER_PASSWORD || "";
  const ownerName = process.env.OWNER_NAME || "Owner";
  const demoOn = demoEnabled();
  const r = redis();

  if (r) {
    const all = (await r.hgetall<Record<string, unknown>>(KEY)) || {};
    const hadAccounts = Object.keys(all).length > 0;

    // Production bootstrap: create the real owner from env if it doesn't exist yet.
    if (ownerEmail && ownerPwd && !all[ownerEmail]) {
      await r.hset(KEY, { [ownerEmail]: JSON.stringify({ email: ownerEmail, name: ownerName, role: "owner", pwd: hashPassword(ownerPwd), active: true }) });
    }
    // When demo is OFF, purge any demo accounts that are still present.
    if (!demoOn) {
      const present = DEMO.map((d) => d.email).filter((e) => all[e]);
      if (present.length) await r.hdel(KEY, ...present);
    }
    // Seed demo accounts only when demo is ON and the store is empty.
    if (!hadAccounts && demoOn) {
      const map: Record<string, string> = {};
      for (const d of DEMO) map[d.email] = JSON.stringify({ ...d, pwd: hashPassword("demo1234"), active: true });
      await r.hset(KEY, map);
    }
    return;
  }

  // In-memory fallback (no Redis configured).
  if (ownerEmail && ownerPwd && !mem.has(ownerEmail)) {
    mem.set(ownerEmail, { email: ownerEmail, name: ownerName, role: "owner", pwd: hashPassword(ownerPwd), active: true });
  }
  if (!demoOn) for (const d of DEMO) mem.delete(d.email);
  if (!mem.size && demoOn) {
    for (const d of DEMO) mem.set(d.email, { ...d, pwd: hashPassword("demo1234"), active: true });
  }
}

export async function getByEmail(email: string): Promise<StaffAccount | null> {
  await ensureSeeded();
  const e = email.trim().toLowerCase();
  const r = redis();
  if (r) return parse(await r.hget(KEY, e));
  return mem.get(e) || null;
}

async function save(acct: StaffAccount): Promise<void> {
  const r = redis();
  if (r) await r.hset(KEY, { [acct.email]: JSON.stringify(acct) });
  else mem.set(acct.email, acct);
}

export async function setPassword(email: string, newPassword: string): Promise<boolean> {
  const acct = await getByEmail(email);
  if (!acct) return false;
  acct.pwd = hashPassword(newPassword);
  await save(acct);
  return true;
}

export async function upsertAccount(a: { email: string; name: string; role: string; password?: string; active?: boolean }): Promise<void> {
  const existing = await getByEmail(a.email);
  const acct: StaffAccount = {
    email: a.email.trim().toLowerCase(),
    name: a.name,
    role: a.role,
    pwd: a.password ? hashPassword(a.password) : (existing?.pwd || hashPassword("demo1234")),
    active: a.active ?? existing?.active ?? true,
  };
  await save(acct);
}

export async function listAccounts(): Promise<StaffAccountPublic[]> {
  await ensureSeeded();
  const r = redis();
  let all: StaffAccount[];
  if (r) {
    const h = await r.hgetall<Record<string, unknown>>(KEY);
    all = h ? Object.values(h).map(parse).filter((x): x is StaffAccount => !!x) : [];
  } else {
    all = Array.from(mem.values());
  }
  const now = Date.now();
  return all.map(({ email, name, role, active, totpSecret, lockedUntil }) => ({
    email, name, role, active, twofa: !!totpSecret, locked: (lockedUntil || 0) > now,
  }));
}

export async function createAccount(email: string, name: string, role: string, password: string): Promise<{ ok: boolean; error?: string }> {
  const e = email.trim().toLowerCase();
  if (!e.includes("@")) return { ok: false, error: "Enter a valid email address." };
  if (!name.trim()) return { ok: false, error: "Enter a name." };
  if ((password || "").length < 6) return { ok: false, error: "Temporary password must be at least 6 characters." };
  if (await getByEmail(e)) return { ok: false, error: "An account with that email already exists." };
  await save({ email: e, name: name.trim(), role, pwd: hashPassword(password), active: true });
  return { ok: true };
}

export async function setRole(email: string, role: string): Promise<boolean> {
  const a = await getByEmail(email);
  if (!a) return false;
  a.role = role; await save(a); return true;
}

export async function setActive(email: string, active: boolean): Promise<boolean> {
  const a = await getByEmail(email);
  if (!a) return false;
  a.active = active; await save(a); return true;
}

export async function deleteAccount(email: string): Promise<boolean> {
  const e = email.trim().toLowerCase();
  const r = redis();
  if (r) { await r.hdel(KEY, e); return true; }
  return mem.delete(e);
}

export function isPersistent(): boolean {
  return !!((process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL) && (process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN));
}

// ─── Login lockout ─────────────────────────────────────────────────────────
export function lockState(acct: StaffAccount | null): { locked: boolean; until: number } {
  const until = acct?.lockedUntil || 0;
  return { locked: until > Date.now(), until };
}

/** Record a failed attempt; locks the account once the threshold is reached. */
export async function recordFailedLogin(email: string): Promise<{ locked: boolean; until: number; remaining: number }> {
  const acct = await getByEmail(email);
  if (!acct) return { locked: false, until: 0, remaining: MAX_LOGIN_ATTEMPTS };
  const attempts = (acct.failedAttempts || 0) + 1;
  if (attempts >= MAX_LOGIN_ATTEMPTS) {
    acct.lockedUntil = Date.now() + LOCK_MINUTES * 60 * 1000;
    acct.failedAttempts = 0;
    await save(acct);
    return { locked: true, until: acct.lockedUntil, remaining: 0 };
  }
  acct.failedAttempts = attempts;
  await save(acct);
  return { locked: false, until: 0, remaining: MAX_LOGIN_ATTEMPTS - attempts };
}

/** Clear failures + any active lock (on successful login, or admin unlock). */
export async function clearLoginFailures(email: string): Promise<void> {
  const acct = await getByEmail(email);
  if (!acct) return;
  if (acct.failedAttempts || acct.lockedUntil) {
    acct.failedAttempts = 0; acct.lockedUntil = 0;
    await save(acct);
  }
}
export async function unlockAccount(email: string): Promise<boolean> {
  const acct = await getByEmail(email);
  if (!acct) return false;
  await clearLoginFailures(email);
  return true;
}

// ─── Two-factor (TOTP) ───────────────────────────────────────────────────────
export async function beginTotp(email: string, secret: string): Promise<boolean> {
  const a = await getByEmail(email); if (!a) return false;
  a.totpPending = secret; await save(a); return true;
}
export async function confirmTotp(email: string, hashedBackupCodes: string[]): Promise<boolean> {
  const a = await getByEmail(email); if (!a || !a.totpPending) return false;
  a.totpSecret = a.totpPending; a.totpPending = undefined; a.backupCodes = hashedBackupCodes;
  await save(a); return true;
}
export async function disableTotp(email: string): Promise<boolean> {
  const a = await getByEmail(email); if (!a) return false;
  a.totpSecret = undefined; a.totpPending = undefined; a.backupCodes = [];
  await save(a); return true;
}
/** Verify + consume a single-use backup code. */
export async function consumeBackupCode(email: string, normalizedCode: string): Promise<boolean> {
  const a = await getByEmail(email);
  if (!a || !a.backupCodes?.length || !normalizedCode) return false;
  const idx = a.backupCodes.findIndex((h) => verifyPassword(normalizedCode, h));
  if (idx < 0) return false;
  a.backupCodes.splice(idx, 1);
  await save(a);
  return true;
}
