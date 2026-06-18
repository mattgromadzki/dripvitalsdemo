"use client";
import { create } from "@/lib/hooks/zustand-shim";
import type { Patient } from "@/lib/types";

/**
 * Patient-portal auth. Credentials are verified server-side and the session is a
 * signed, HttpOnly cookie (see /api/patient/*). The client patient list is used
 * only to resolve an id hint (and for the no-Upstash demo fallback) and for
 * friendly "no account" UX — it is never trusted for the session itself.
 */
function findByEmail(patients: Patient[], email: string): Patient | null {
  const e = email.trim().toLowerCase();
  return patients.find((p) => (p.email || "").toLowerCase() === e) || null;
}

interface PatientAuthState {
  patientId: string | null;
  hydrated: boolean;
  hydrate: () => Promise<void>;
  login: (email: string, password: string, patients: Patient[]) => Promise<{ ok: boolean; error?: string }>;
  logout: () => Promise<void>;
  accountExists: (email: string, patients: Patient[]) => boolean;
  requestReset: () => { ok: boolean };
  requestResetEmail: (email: string) => Promise<{ ok: boolean }>;
  confirmReset: (token: string, password: string) => Promise<{ ok: boolean; error?: string }>;
  resetPassword: (email: string, newPassword: string, patients: Patient[]) => Promise<{ ok: boolean; error?: string }>;
}

let hydrating = false;

export const usePatientAuth = create<PatientAuthState>((set) => ({
  patientId: null,
  hydrated: false,

  hydrate: async () => {
    if (hydrating) return;
    hydrating = true;
    try {
      const r = await fetch("/api/patient/me", { cache: "no-store" });
      if (r.ok) { const d = await r.json(); if (d?.patient?.id) { set({ patientId: d.patient.id, hydrated: true }); return; } }
    } catch { /* ignore */ }
    set({ patientId: null, hydrated: true });
  },

  login: async (email, password, patients) => {
    const p = findByEmail(patients, email); // id hint for the no-Upstash demo path
    try {
      const r = await fetch("/api/patient/login", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password, pidHint: p?.id, nameHint: p ? `${p.first} ${p.last}` : undefined }),
      });
      const d = await r.json();
      if (d?.ok && d.patient?.id) { set({ patientId: d.patient.id, hydrated: true }); return { ok: true }; }
      return { ok: false, error: d?.error || "Sign in failed." };
    } catch { return { ok: false, error: "Network error — please try again." }; }
  },

  logout: async () => {
    set({ patientId: null });
    try { await fetch("/api/patient/logout", { method: "POST" }); } catch { /* ignore */ }
  },

  accountExists: (email, patients) => !!findByEmail(patients, email),
  requestReset: () => ({ ok: true }),

  requestResetEmail: async (email) => {
    try { await fetch("/api/patient/reset/request", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email }) }); } catch { /* ignore */ }
    return { ok: true }; // always succeed (no account enumeration)
  },

  confirmReset: async (token, password) => {
    if (password.length < 8) return { ok: false, error: "Password must be at least 8 characters." };
    try {
      const r = await fetch("/api/patient/reset/confirm", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ token, password }) });
      const d = await r.json();
      if (d?.ok && d.patient?.id) { set({ patientId: d.patient.id, hydrated: true }); return { ok: true }; }
      return { ok: false, error: d?.error || "Could not reset password." };
    } catch { return { ok: false, error: "Network error — please try again." }; }
  },

  resetPassword: async (email, newPassword, patients) => {
    const p = findByEmail(patients, email);
    if (!p) return { ok: false, error: "No account found with that email." };
    if (newPassword.length < 8) return { ok: false, error: "Password must be at least 8 characters." };
    try {
      const r = await fetch("/api/patient/reset", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email, newPassword }) });
      const d = await r.json();
      return d?.ok ? { ok: true } : { ok: false, error: d?.error || "Could not reset password." };
    } catch { return { ok: false, error: "Network error — please try again." }; }
  },
}));
