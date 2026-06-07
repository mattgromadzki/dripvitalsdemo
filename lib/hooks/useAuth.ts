"use client";
import { create } from "@/lib/hooks/zustand-shim";

/**
 * Staff authentication. Credentials are verified server-side against hashed
 * passwords, and the session is a signed, HttpOnly cookie (see /api/auth/*).
 * Role-based access is enforced in the UI via lib/rbac/usePermission.
 */

export interface AuthUser { name: string; email: string; role: string; initials: string; }

function initialsOf(name: string) {
  const parts = (name || "").replace(/^(Dr\.?|Mr\.?|Ms\.?|Mrs\.?)\s+/i, "").split(/\s+/);
  return ((parts[0]?.[0] || "") + (parts[1]?.[0] || "")).toUpperCase() || "DV";
}

let hydrating = false;

interface AuthState {
  user: AuthUser | null;
  hydrated: boolean;
  hydrate: () => void;
  login: (email: string, password: string, code?: string) => Promise<{ ok: boolean; error?: string; twofa?: boolean; locked?: boolean }>;
  logout: () => Promise<void>;
  accountExists: (email: string) => boolean;
  requestReset: (email: string) => Promise<{ ok: boolean; devLink?: string }>;
  resetPassword: (email: string, newPassword: string, token: string) => Promise<{ ok: boolean; error?: string }>;
}

export const useAuth = create<AuthState>((set) => ({
  user: null,
  hydrated: false,

  hydrate: async () => {
    if (hydrating) return;
    hydrating = true;
    try {
      const r = await fetch("/api/auth/me", { cache: "no-store" });
      if (r.ok) {
        const d = await r.json();
        if (d?.user) { set({ user: { ...d.user, initials: initialsOf(d.user.name) }, hydrated: true }); return; }
      }
    } catch { /* ignore */ }
    set({ user: null, hydrated: true });
  },

  login: async (email, password, code) => {
    try {
      const r = await fetch("/api/auth/login", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email, password, code }) });
      const d = await r.json();
      if (d?.ok && d.user) { set({ user: { ...d.user, initials: initialsOf(d.user.name) }, hydrated: true }); return { ok: true }; }
      return { ok: false, error: d?.error, twofa: !!d?.twofa, locked: !!d?.locked };
    } catch { return { ok: false, error: "Network error — please try again." }; }
  },

  logout: async () => {
    set({ user: null });
    try { await fetch("/api/auth/logout", { method: "POST" }); } catch { /* ignore */ }
  },

  // Server decides whether to send a link; we never reveal whether an account exists.
  accountExists: () => true,
  requestReset: async (email) => {
    try {
      const r = await fetch("/api/auth/forgot", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email }) });
      const d = await r.json();
      return { ok: !!d?.ok, devLink: d?.devLink };
    } catch { return { ok: true }; }
  },

  resetPassword: async (email, newPassword, token) => {
    try {
      const r = await fetch("/api/auth/reset", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email, newPassword, token }) });
      const d = await r.json();
      return d?.ok ? { ok: true } : { ok: false, error: d?.error || "Could not reset password." };
    } catch { return { ok: false, error: "Network error — please try again." }; }
  },
}));

// Exposed for the login screen's "demo accounts" hint.
export const DEMO_ACCOUNTS = [
  { email: "maria@dripvitals.com", role: "Owner / Admin" },
  { email: "james@dripvitals.com", role: "Provider" },
  { email: "sarah@dripvitals.com", role: "Provider" },
  { email: "tasha@dripvitals.com", role: "Support" },
  { email: "leo@dripvitals.com", role: "Billing" },
];
