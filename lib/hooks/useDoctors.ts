"use client";

import { create } from "@/lib/hooks/zustand-shim";
import type { Doctor, DoctorStateLicense } from "@/lib/types";
import { DOCTORS as SEED } from "@/lib/data/doctors";
import { seedList } from "@/lib/config/runtime";

interface DoctorsState {
  doctors: Doctor[];
  add: (input: Omit<Doctor, "id">) => Doctor;
  update: (id: string, patch: Partial<Doctor>) => void;
  remove: (id: string) => void;
  toggleActive: (id: string) => void;
  setLicenses: (id: string, licenses: DoctorStateLicense[]) => void;
}

let nextSeq = SEED.length + 1;
function nextId(): string {
  return `DOC-${String(nextSeq++).padStart(3, "0")}`;
}

export const useDoctors = create<DoctorsState>((set) => ({
  doctors: seedList(SEED),
  add: (input) => {
    const created: Doctor = { id: nextId(), ...input };
    set((s) => ({ doctors: [created, ...s.doctors] }));
    return created;
  },
  update: (id, patch) => {
    set((s) => ({
      doctors: s.doctors.map((d) => (d.id === id ? { ...d, ...patch } : d)),
    }));
  },
  remove: (id) => {
    set((s) => ({ doctors: s.doctors.filter((d) => d.id !== id) }));
  },
  toggleActive: (id) => {
    set((s) => ({
      doctors: s.doctors.map((d) => (d.id === id ? { ...d, active: !d.active } : d)),
    }));
  },
  setLicenses: (id, licenses) => {
    set((s) => ({
      doctors: s.doctors.map((d) => (d.id === id ? { ...d, licenses } : d)),
    }));
  },
}));

// ─── License status helpers ──────────────────────────────────────────────
// Anchor time at May 29 2026 (consistent with the rest of the prototype's
// seeded "today") so the static demo data shows realistic expiring/expired
// states even when the real wall-clock date drifts forward.
const DEMO_NOW = new Date("2026-05-29T00:00:00Z").getTime();
const DAY_MS = 86_400_000;
const NINETY_DAYS_MS = 90 * DAY_MS;

export type LicenseStatusKey = "expired" | "expiring" | "active" | "unknown";

export interface LicenseStatus {
  key:       LicenseStatusKey;
  label:     string;
  icon:      string;
  pillIntent: "red" | "amber" | "green" | "muted";
  daysUntil: number | null;
}

export function getLicenseStatus(lic: DoctorStateLicense): LicenseStatus {
  if (!lic.expDate) {
    return { key: "unknown", label: "No Date", icon: "?", pillIntent: "muted", daysUntil: null };
  }
  const expMs = new Date(lic.expDate + "T00:00:00Z").getTime();
  const daysUntil = Math.round((expMs - DEMO_NOW) / DAY_MS);
  if (expMs < DEMO_NOW)                   return { key: "expired",  label: "Expired",  icon: "✕", pillIntent: "red",   daysUntil };
  if (expMs < DEMO_NOW + NINETY_DAYS_MS)  return { key: "expiring", label: "Expiring", icon: "⚠", pillIntent: "amber", daysUntil };
  return                                  { key: "active",   label: "Active",   icon: "✓", pillIntent: "green", daysUntil };
}

export function formatLicenseExp(iso: string | undefined): string {
  if (!iso) return "—";
  const [y, m, d] = iso.split("-");
  if (!y || !m || !d) return iso;
  const months = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
  return `${months[parseInt(m, 10) - 1]} ${parseInt(d, 10)} ${y}`;
}

// Display label, e.g. "Dr. Sofia Rivera, MD" / "Jane Doe, NP".
export function doctorDisplayName(d: { first: string; last: string; title: string }): string {
  const name = `${d.first} ${d.last}`.trim();
  const usesDr = d.title === "MD" || d.title === "DO";
  return `${usesDr ? "Dr. " : ""}${name}, ${d.title}`;
}

// The doctor's state license matching a patient's state (case-insensitive), if any.
export function licenseForState(d: Doctor | null | undefined, state: string): DoctorStateLicense | undefined {
  if (!d || !state) return undefined;
  const s = state.trim().toUpperCase();
  return (d.licenses || []).find((l) => (l.state || "").trim().toUpperCase() === s);
}
