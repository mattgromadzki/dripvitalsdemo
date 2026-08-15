import "server-only";
import { readDomain } from "./serverStore";

/**
 * Farming module settings (small config blob, Redis domain "farming-settings").
 * Most important: the cold-outreach email SENDER, kept on a domain SEPARATE from
 * the clinical email.dripvitals.com so a farming blast can never damage the
 * reputation of patient/transactional mail.
 */
export interface FarmingSettings {
  fromName?: string;
  fromEmail?: string;
  dailyCap?: number; // max outreach EMAILS to send per day (0/undefined = no cap)
}

// Dedicated cold-outreach domain (NOT the clinical dripvitals.com / email.dripvitals.com).
export const DEFAULT_FARMING_FROM_NAME = "DripVitals";
export const DEFAULT_FARMING_FROM_EMAIL = "outreach@dripvitals.net";

export async function getFarmingSettings(): Promise<FarmingSettings> {
  return (await readDomain<FarmingSettings>("farming-settings")) || {};
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
