import type { Patient, PatientExtra } from "@/lib/types";

/* Shared per-patient portal records — the data a patient SEES and ENTERS in
   their portal, and that staff read back in Patient View. In this prototype
   it persists to the browser (see usePortalRecords); swapping that storage
   layer for a real backend turns this into a true cross-device live mirror. */
export interface ShotEntry {
  id: string;
  date: string;        // e.g. "2026-05-31" or "Week 8"
  medication: string;
  unit: string;        // mg / mL / units
  strength: string;    // e.g. "0.5"
  site: string;        // injection site
}
export interface WeightEntry {
  id: string;
  date: string;
  lbs: number;
}
export interface MsgAttachment {
  name: string;
  kind: "image" | "pdf";
  url: string; // data URL in this prototype
}
export interface MsgEntry {
  id: string;
  from: "patient" | "care";
  text: string;
  time: string;
  attachment?: MsgAttachment;
}
export interface PortalRecord {
  shots: ShotEntry[];     // newest first
  weights: WeightEntry[]; // oldest first
  messages: MsgEntry[];   // chronological
}

export function emptyRecord(): PortalRecord {
  return { shots: [], weights: [], messages: [] };
}

// Format a shot's date for display. ISO dates (YYYY-MM-DD) become "Sun, May 25";
// anything else is returned unchanged.
export function formatShotDate(d: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(d);
  if (!m) return d;
  const dt = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  return dt.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" });
}

// Build a patient's starting record from their EMR data, so both the portal
// and Patient View show real history immediately (new entries append to this).
export function seedRecordFromPatient(p: Patient, extra: PatientExtra): PortalRecord {
  const med = p.plan ? p.plan.split(" ").slice(-1)[0] : "Semaglutide";
  const strength = String(p.dose || "").replace(/[^0-9.]/g, "") || "0.5";
  const sites = ["Stomach - Upper Left", "Stomach - Upper Right", "Thigh - Left", "Thigh - Right", "Arm - Left"];

  const weeks = Math.min(6, Math.max(0, p.week || 0));
  const today = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  const isoDaysAgo = (days: number) => {
    const d = new Date(today);
    d.setDate(d.getDate() - days);
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  };
  // Weekly shots ending ~today (oldest first), then newest-first for display.
  const shots: ShotEntry[] = Array.from({ length: weeks }).map((_, i) => ({
    id: `seed-shot-${p.id}-${i}`,
    date: isoDaysAgo((weeks - 1 - i) * 7),
    medication: med,
    unit: "mg",
    strength,
    site: sites[i % sites.length],
  })).reverse();

  const weights: WeightEntry[] = (extra.weightLog || []).slice(-8).map((lbs, i) => ({
    id: `seed-wt-${p.id}-${i}`,
    date: `Week ${i + 1}`,
    lbs,
  }));

  const messages: MsgEntry[] = (extra.messages || []).map((m, i) => ({
    id: `seed-msg-${p.id}-${i}`,
    from: m.me ? "patient" : "care",
    text: m.text,
    time: m.time,
  }));

  return { shots, weights, messages };
}
