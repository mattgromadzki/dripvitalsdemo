"use client";
import { create } from "@/lib/hooks/zustand-shim";

/**
 * DEMO authentication — runs entirely in the browser. There is no backend,
 * no real password hashing, and the "password reset" does not send email.
 * This exists to gate the demo EMR with a realistic login experience.
 * It is NOT secure and must be replaced with real auth before production.
 */

export interface AuthUser { name: string; email: string; role: string; initials: string; }

interface Account { name: string; email: string; role: string; password: string; }

// Seeded demo staff accounts (mirror the RBAC team). All use the same demo password.
const ACCOUNTS: Account[] = [
  { name: "Dr. Maria Rivera", email: "maria@dripvitals.com", role: "Owner / Admin", password: "demo1234" },
  { name: "Dr. James Park",   email: "james@dripvitals.com", role: "Provider",      password: "demo1234" },
  { name: "Dr. Sarah Chen",   email: "sarah@dripvitals.com", role: "Provider",      password: "demo1234" },
  { name: "Tasha Reed",       email: "tasha@dripvitals.com", role: "Support",       password: "demo1234" },
  { name: "Leo Martin",       email: "leo@dripvitals.com",   role: "Billing",       password: "demo1234" },
];

const LS_SESSION = "dv_auth_session";
const LS_OVERRIDES = "dv_auth_pw_overrides";

function readJSON<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try { const v = localStorage.getItem(key); return v ? (JSON.parse(v) as T) : fallback; } catch { return fallback; }
}
function writeJSON(key: string, val: unknown) {
  if (typeof window === "undefined") return;
  try { localStorage.setItem(key, JSON.stringify(val)); } catch { /* ignore */ }
}
function initialsOf(name: string) {
  const parts = name.replace(/^(Dr\.?|Mr\.?|Ms\.?|Mrs\.?)\s+/i, "").split(/\s+/);
  return ((parts[0]?.[0] || "") + (parts[1]?.[0] || "")).toUpperCase() || "DV";
}
function passwordFor(email: string, acct: Account) {
  const overrides = readJSON<Record<string, string>>(LS_OVERRIDES, {});
  return overrides[email] || acct.password;
}

interface AuthState {
  user: AuthUser | null;
  hydrated: boolean;
  hydrate: () => void;
  login: (email: string, password: string) => { ok: boolean; error?: string };
  logout: () => void;
  accountExists: (email: string) => boolean;
  requestReset: (email: string) => { ok: boolean };
  resetPassword: (email: string, newPassword: string) => { ok: boolean; error?: string };
}

export const useAuth = create<AuthState>((set) => ({
  user: null,
  hydrated: false,

  hydrate: () => set({ user: readJSON<AuthUser | null>(LS_SESSION, null), hydrated: true }),

  login: (email, password) => {
    const e = email.trim().toLowerCase();
    const acct = ACCOUNTS.find((a) => a.email.toLowerCase() === e);
    if (!acct) return { ok: false, error: "No account found with that email." };
    if (password !== passwordFor(acct.email, acct)) return { ok: false, error: "Incorrect password. (Demo password: demo1234)" };
    const user: AuthUser = { name: acct.name, email: acct.email, role: acct.role, initials: initialsOf(acct.name) };
    writeJSON(LS_SESSION, user);
    set({ user, hydrated: true });
    return { ok: true };
  },

  logout: () => {
    if (typeof window !== "undefined") { try { localStorage.removeItem(LS_SESSION); } catch { /* ignore */ } }
    set({ user: null });
  },

  accountExists: (email) => ACCOUNTS.some((a) => a.email.toLowerCase() === email.trim().toLowerCase()),

  requestReset: () => ({ ok: true }), // simulated — always succeeds (no email enumeration, no real email)

  resetPassword: (email, newPassword) => {
    const e = email.trim().toLowerCase();
    const acct = ACCOUNTS.find((a) => a.email.toLowerCase() === e);
    if (!acct) return { ok: false, error: "No account found with that email." };
    if (newPassword.length < 6) return { ok: false, error: "Password must be at least 6 characters." };
    const overrides = readJSON<Record<string, string>>(LS_OVERRIDES, {});
    overrides[acct.email] = newPassword;
    writeJSON(LS_OVERRIDES, overrides);
    return { ok: true };
  },
}));

// Exposed for the login screen's "demo credentials" hint.
export const DEMO_ACCOUNTS = ACCOUNTS.map((a) => ({ email: a.email, role: a.role }));
