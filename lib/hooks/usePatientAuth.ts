"use client";
import { create } from "@/lib/hooks/zustand-shim";
import type { Patient } from "@/lib/types";

/**
 * DEMO patient-portal auth — client-side only, no backend, no real email.
 * Accounts are the seeded EMR patients (matched by email); the demo password
 * is the same for all, with per-email overrides saved when a patient "resets".
 * Not secure — replace with real auth before production.
 */
const DEMO_PW = "demo1234";
const LS_SESSION = "dv_portal_session";
const LS_OVERRIDES = "dv_portal_pw_overrides";

function readJSON<T>(k: string, f: T): T {
  if (typeof window === "undefined") return f;
  try { const v = localStorage.getItem(k); return v ? (JSON.parse(v) as T) : f; } catch { return f; }
}
function writeJSON(k: string, v: unknown) {
  if (typeof window === "undefined") return;
  try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* ignore */ }
}
function findByEmail(patients: Patient[], email: string): Patient | null {
  const e = email.trim().toLowerCase();
  return patients.find((p) => (p.email || "").toLowerCase() === e) || null;
}

interface PatientAuthState {
  patientId: string | null;
  hydrated: boolean;
  hydrate: () => void;
  login: (email: string, password: string, patients: Patient[]) => { ok: boolean; error?: string };
  logout: () => void;
  accountExists: (email: string, patients: Patient[]) => boolean;
  requestReset: () => { ok: boolean };
  resetPassword: (email: string, newPassword: string, patients: Patient[]) => { ok: boolean; error?: string };
}

export const usePatientAuth = create<PatientAuthState>((set) => ({
  patientId: null,
  hydrated: false,

  hydrate: () => set({ patientId: readJSON<string | null>(LS_SESSION, null), hydrated: true }),

  login: (email, password, patients) => {
    const p = findByEmail(patients, email);
    if (!p) return { ok: false, error: "No account found with that email." };
    const overrides = readJSON<Record<string, string>>(LS_OVERRIDES, {});
    const pw = overrides[(p.email || "").toLowerCase()] || DEMO_PW;
    if (password !== pw) return { ok: false, error: "Incorrect password. (Demo password: demo1234)" };
    writeJSON(LS_SESSION, p.id);
    set({ patientId: p.id, hydrated: true });
    return { ok: true };
  },

  logout: () => {
    if (typeof window !== "undefined") { try { localStorage.removeItem(LS_SESSION); } catch { /* ignore */ } }
    set({ patientId: null });
  },

  accountExists: (email, patients) => !!findByEmail(patients, email),
  requestReset: () => ({ ok: true }),

  resetPassword: (email, newPassword, patients) => {
    const p = findByEmail(patients, email);
    if (!p) return { ok: false, error: "No account found with that email." };
    if (newPassword.length < 6) return { ok: false, error: "Password must be at least 6 characters." };
    const overrides = readJSON<Record<string, string>>(LS_OVERRIDES, {});
    overrides[(p.email || "").toLowerCase()] = newPassword;
    writeJSON(LS_OVERRIDES, overrides);
    return { ok: true };
  },
}));
