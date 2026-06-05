import { Redis } from "@upstash/redis";
import { hashPassword } from "@/lib/auth/serverCrypto";

export interface StaffAccount { email: string; name: string; role: string; pwd: string; active: boolean; }

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

async function ensureSeeded(): Promise<void> {
  if (seeded) return;
  seeded = true;
  const r = redis();
  if (r) {
    const all = await r.hgetall<Record<string, unknown>>(KEY);
    if (all && Object.keys(all).length) return; // already seeded
    const map: Record<string, string> = {};
    for (const d of DEMO) map[d.email] = JSON.stringify({ ...d, pwd: hashPassword("demo1234"), active: true });
    await r.hset(KEY, map);
  } else {
    if (mem.size) return;
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

export async function listAccounts(): Promise<Array<Omit<StaffAccount, "pwd">>> {
  await ensureSeeded();
  const r = redis();
  let all: StaffAccount[];
  if (r) {
    const h = await r.hgetall<Record<string, unknown>>(KEY);
    all = h ? Object.values(h).map(parse).filter((x): x is StaffAccount => !!x) : [];
  } else {
    all = Array.from(mem.values());
  }
  return all.map(({ email, name, role, active }) => ({ email, name, role, active }));
}

export function isPersistent(): boolean {
  return !!((process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL) && (process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN));
}
