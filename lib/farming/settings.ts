import "server-only";
import { readDomain } from "./serverStore";

/**
 * Farming module settings (small config blob, Redis domain "farming-settings").
 * Most important: the cold-outreach email SENDER, kept on a domain SEPARATE from
 * the clinical email.dripvitals.com so a farming blast can never damage the
 * reputation of patient/transactional mail.
 */
export interface FarmingSettings { fromName?: string; fromEmail?: string }

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
export async function getFarmingFrom(): Promise<string> {
  const s = await getFarmingSettings();
  const email = (s.fromEmail || "").trim() || process.env.FARMING_EMAIL_FROM || DEFAULT_FARMING_FROM_EMAIL;
  const name = (s.fromName || DEFAULT_FARMING_FROM_NAME).trim();
  // If FARMING_EMAIL_FROM already includes a display name (e.g. "X <a@b>"), use it verbatim.
  if (!s.fromEmail && process.env.FARMING_EMAIL_FROM && /<[^>]+>/.test(process.env.FARMING_EMAIL_FROM)) {
    return process.env.FARMING_EMAIL_FROM;
  }
  return name ? `${name} <${email}>` : email;
}
