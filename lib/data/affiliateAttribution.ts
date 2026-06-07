import type { Affiliate, Patient } from "@/lib/types";

/**
 * Affiliate attribution + tracking helpers.
 *
 * Patients aren't stored with an explicit referral source in the seed data, so
 * attribution here is DETERMINISTIC and stable: each patient maps to at most one
 * affiliate via a hash of their id against the affiliate roster (sorted by id so
 * the mapping is independent of insertion order). ~20% of patients are treated
 * as organic/unattributed. This gives every affiliate a stable, disjoint set of
 * real patient records to show by name. When a real referral field is added to
 * Patient later, `attributedPatients` should prefer it over the hash fallback.
 */

function hash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return Math.abs(h);
}

export function attributedPatients(affiliate: Affiliate, allAffiliates: Affiliate[], patients: Patient[]): Patient[] {
  const roster = [...allAffiliates].sort((a, b) => a.id.localeCompare(b.id));
  if (roster.length === 0) return [];
  // Cumulative-weight buckets keyed by conversion volume — bigger affiliates win
  // a proportionally larger share of patients (realistic), deterministic per id.
  const weights = roster.map((a) => Math.max(1, a.conversionsAllTime));
  const total = weights.reduce((s, w) => s + w, 0);
  return patients.filter((p) => {
    const h = hash(p.id);
    if (h % 10 < 1) return false; // ~10% organic / unattributed
    let r = (h % 100000) / 100000 * total;
    let pick = roster[0];
    for (let i = 0; i < roster.length; i++) {
      if (r < weights[i]) { pick = roster[i]; break; }
      r -= weights[i];
    }
    return pick.id === affiliate.id;
  });
}

// Affiliate links point at the public marketing site (where prospective patients
// land and sign up), NOT app.dripvitals.com which hosts the EMR.
const BASE = "https://dripvitals.com";

/** The unique referral link assigned to an affiliate (carries their code). */
export function referralLink(a: Affiliate): string {
  return `${BASE}/r/${a.code}`;
}

/** UTM-tagged campaign link variant. */
export function campaignLink(a: Affiliate): string {
  return `${BASE}/?utm_source=affiliate&utm_medium=referral&utm_campaign=${encodeURIComponent(a.code)}`;
}

export interface VisitEvent {
  id: string;
  whenIso: string;
  whenLabel: string;
  landing: string;
  device: "Mobile" | "Desktop" | "Tablet";
  source: string;
  converted: boolean;
}

const LANDINGS = ["/", "/glp-1", "/pricing", "/how-it-works", "/quiz"];
const DEVICES: VisitEvent["device"][] = ["Mobile", "Mobile", "Desktop", "Tablet"];
const SOURCES = ["Instagram", "TikTok", "Direct link", "YouTube", "Email", "Podcast"];

/**
 * Deterministic recent click/visit feed for an affiliate — synthesized from
 * their id + 30-day numbers so the tracking view looks like real attribution
 * data (timestamped clicks landing on pages, some converting to signups).
 */
export function recentVisits(a: Affiliate, count = 10): VisitEvent[] {
  const clicks = a.clickThroughs30d ?? 0;
  const convRate = clicks > 0 ? Math.min(0.5, (a.conversions30d ?? 0) / clicks) : 0;
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const out: VisitEvent[] = [];
  for (let i = 0; i < count; i++) {
    const h = hash(`${a.id}:${i}`);
    const daysAgo = i * 2 + (h % 2);
    const d = new Date();
    d.setDate(d.getDate() - daysAgo);
    d.setHours(8 + (h % 12), (h >> 3) % 60, 0, 0);
    out.push({
      id: `${a.id}-v${i}`,
      whenIso: d.toISOString(),
      whenLabel: `${months[d.getMonth()]} ${d.getDate()}, ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`,
      landing: LANDINGS[h % LANDINGS.length],
      device: DEVICES[h % DEVICES.length],
      source: SOURCES[h % SOURCES.length],
      converted: (h % 100) / 100 < convRate,
    });
  }
  return out;
}
