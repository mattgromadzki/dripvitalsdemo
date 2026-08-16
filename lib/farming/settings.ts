import "server-only";
import { readDomain } from "./serverStore";

/**
 * Farming module settings (small config blob, Redis domain "farming-settings").
 * Most important: the cold-outreach email SENDER, kept on a domain SEPARATE from
 * the clinical email.dripvitals.com so a farming blast can never damage the
 * reputation of patient/transactional mail.
 */
// One sending identity in the outreach pool. Spreading volume across several
// authenticated (sub)domains, each capped low, protects deliverability — the
// dispatcher round-robins recipients across the pool and honors each cap.
export interface FarmSender { name?: string; email: string; dailyCap?: number }

export interface FarmingSettings {
  // Legacy single-sender fields (still honored when `senders` is empty).
  fromName?: string;
  fromEmail?: string;
  dailyCap?: number;
  // Preferred: a pool of senders.
  senders?: FarmSender[];
  // When set (ISO date, YYYY-MM-DD), each sender's cap RAMPS from ~13%→100% of
  // its target over WARMUP_STEPS days — new-domain/IP warm-up.
  warmupStart?: string;
}

// Dedicated cold-outreach domain (NOT the clinical dripvitals.com / email.dripvitals.com).
export const DEFAULT_FARMING_FROM_NAME = "DripVitals";
export const DEFAULT_FARMING_FROM_EMAIL = "outreach@dripvitals.net";

// Fraction of a sender's target cap allowed on day N of warm-up (1-based).
// Reaches full on day 6; e.g. a 1,500 cap climbs ~200→400→700→1000→1250→1500.
export const WARMUP_STEPS = [0.13, 0.27, 0.47, 0.67, 0.83, 1];

export async function getFarmingSettings(): Promise<FarmingSettings> {
  return (await readDomain<FarmingSettings>("farming-settings")) || {};
}

// Warm-up multiplier for today given the ramp start date. 1 = no ramp / done.
export function rampFraction(warmupStart?: string, todayMs = Date.now()): number {
  if (!warmupStart) return 1;
  const start = Date.parse(`${warmupStart}T00:00:00Z`);
  if (!Number.isFinite(start)) return 1;
  const day = Math.floor((todayMs - start) / 86_400_000) + 1; // 1-based day since start
  if (day <= 0) return WARMUP_STEPS[0];
  if (day > WARMUP_STEPS.length) return 1;
  return WARMUP_STEPS[day - 1];
}

export interface ResolvedSender { from: string; key: string; cap: number } // cap = today's effective cap; 0 = unlimited

// Build the active sender pool with each sender's EFFECTIVE cap for today
// (target × warm-up fraction). Falls back to the legacy single sender.
export function resolveSenders(s: FarmingSettings, todayMs = Date.now()): ResolvedSender[] {
  const frac = rampFraction(s.warmupStart, todayMs);
  const pool: FarmSender[] = (s.senders && s.senders.length)
    ? s.senders
    : [{ name: s.fromName, email: (s.fromEmail || "").trim() || process.env.FARMING_EMAIL_FROM || DEFAULT_FARMING_FROM_EMAIL, dailyCap: s.dailyCap }];
  return pool
    .filter((x) => x.email && x.email.trim())
    .map((x) => {
      const target = Math.max(0, Math.floor(Number(x.dailyCap) || 0));
      const cap = target > 0 ? Math.max(50, Math.round((target * frac) / 50) * 50) : 0; // round to 50; keep ≥50 during ramp
      const name = (x.name ?? s.fromName ?? DEFAULT_FARMING_FROM_NAME).trim();
      const email = x.email.trim();
      return { from: name ? `${name} <${email}>` : email, key: email.toLowerCase(), cap };
    });
}

/**
 * Resolved RFC5322 "from" for outreach email. Prefers the in-app setting, then
 * the FARMING_EMAIL_FROM env var, then the dripvitals.net default — never falls
 * back to the clinical sender.
 */
export function resolveFrom(s: FarmingSettings): string {
  // If FARMING_EMAIL_FROM already includes a display name (e.g. "X <a@b>"), use it verbatim.
  if (!s.fromEmail && process.env.FARMING_EMAIL_FROM && /<[^>]+>/.test(process.env.FARMING_EMAIL_FROM)) {
    return process.env.FARMING_EMAIL_FROM;
  }
  const email = (s.fromEmail || "").trim() || process.env.FARMING_EMAIL_FROM || DEFAULT_FARMING_FROM_EMAIL;
  const name = (s.fromName || DEFAULT_FARMING_FROM_NAME).trim();
  return name ? `${name} <${email}>` : email;
}
export async function getFarmingFrom(): Promise<string> {
  return resolveFrom(await getFarmingSettings());
}

export function dailyCapOf(s: FarmingSettings): number {
  return Math.max(0, Math.floor(Number(s.dailyCap) || 0));
}
