import type { UspsValidateInput, UspsValidateResult, UspsStandardized } from "@/lib/usps/types";
import { STATE_CITY_ZIP } from "@/lib/usps/stateZip";

/* ────────────────────────────────────────────────────────────────────────
   USPS Addresses API v3 — server-side validation.

   To go live, set these environment variables (e.g. in .env.local):
     USPS_CLIENT_ID       = your USPS app consumer key
     USPS_CLIENT_SECRET   = your USPS app consumer secret
     USPS_BASE_URL        = https://apis.usps.com/addresses/v3      (optional)
     USPS_TOKEN_URL       = https://apis.usps.com/oauth2/v3/token   (optional)

   When the credentials are present, this route fetches an OAuth2
   client-credentials token (cached until it expires) and calls
   GET /address. When they are absent (e.g. this sandbox), it falls back to a
   realistic MOCK so the signup flow is fully demoable. The OAuth secret never
   leaves the server — the browser only ever talks to this endpoint.
   ──────────────────────────────────────────────────────────────────────── */

const BASE = process.env.USPS_BASE_URL || "https://apis.usps.com/addresses/v3";
const TOKEN_URL = process.env.USPS_TOKEN_URL || "https://apis.usps.com/oauth2/v3/token";
const ID = process.env.USPS_CLIENT_ID;
const SECRET = process.env.USPS_CLIENT_SECRET;

let tokenCache: { token: string; exp: number } | null = null;

async function getToken(): Promise<string> {
  if (tokenCache && tokenCache.exp > Date.now() + 30_000) return tokenCache.token;
  const body = new URLSearchParams({ grant_type: "client_credentials", client_id: ID!, client_secret: SECRET!, scope: "addresses" });
  const r = await fetch(TOKEN_URL, { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body });
  if (!r.ok) throw new Error("token");
  const j = await r.json();
  tokenCache = { token: j.access_token, exp: Date.now() + (j.expires_in ?? 3600) * 1000 };
  return tokenCache.token;
}

function changedFrom(input: UspsValidateInput, std: UspsStandardized): boolean {
  const norm = (s?: string) => (s || "").trim().toUpperCase();
  return norm(input.streetAddress) !== norm(std.streetAddress)
    || (!!input.city && norm(input.city) !== norm(std.city))
    || (!!input.ZIPCode && input.ZIPCode.trim() !== std.ZIPCode);
}

function classify(dpv: string | null, changed: boolean): { status: UspsValidateResult["status"]; message: string } {
  if (dpv === "Y") return changed ? { status: "corrected", message: "Address standardized to USPS format." } : { status: "verified", message: "Address verified — deliverable by USPS." };
  if (dpv === "D" || dpv === "S") return { status: "needs_secondary", message: "This address is missing or has an unconfirmed apartment, suite, or unit number." };
  return { status: "unverified", message: "We couldn't confirm this is a deliverable address." };
}

// ── Real USPS call ────────────────────────────────────────────────────────
async function uspsValidate(input: UspsValidateInput): Promise<UspsValidateResult> {
  const token = await getToken();
  const qs = new URLSearchParams();
  qs.set("streetAddress", input.streetAddress);
  if (input.secondaryAddress) qs.set("secondaryAddress", input.secondaryAddress);
  if (input.city) qs.set("city", input.city);
  qs.set("state", input.state);
  if (input.ZIPCode) qs.set("ZIPCode", input.ZIPCode);

  const r = await fetch(`${BASE}/address?${qs.toString()}`, { headers: { Authorization: `Bearer ${token}`, Accept: "application/json" } });
  if (!r.ok) {
    let msg = "USPS could not match this address.";
    try { const e = await r.json(); msg = e?.error?.message || msg; } catch { /* ignore */ }
    return { status: "unverified", dpv: "N", address: null, corrections: [], warnings: [], vacant: false, changed: false, message: msg, source: "usps" };
  }
  const j = await r.json();
  const a = j.address || {};
  const info = j.additionalInfo || {};
  const std: UspsStandardized = {
    streetAddress: a.streetAddress || input.streetAddress,
    secondaryAddress: a.secondaryAddress || input.secondaryAddress,
    city: a.city || input.city || "",
    state: a.state || input.state,
    ZIPCode: a.ZIPCode || input.ZIPCode || "",
    ZIPPlus4: a.ZIPPlus4 || undefined,
  };
  const dpv: string | null = info.DPVConfirmation ?? null;
  const changed = changedFrom(input, std);
  const { status, message } = classify(dpv, changed);
  return {
    status, dpv: (dpv as UspsValidateResult["dpv"]) ?? null, address: std,
    corrections: Array.isArray(j.corrections) ? j.corrections.map((c: { text: string }) => c.text).filter(Boolean) : [],
    warnings: Array.isArray(j.warnings) ? j.warnings : [],
    vacant: info.vacant === "Y", changed, message, source: "usps",
  };
}

// ── Mock (no credentials) ───────────────────────────────────────────────
const ABBR: Record<string, string> = {
  STREET: "ST", AVENUE: "AVE", AVE: "AVE", ROAD: "RD", DRIVE: "DR", BOULEVARD: "BLVD", LANE: "LN",
  COURT: "CT", CIRCLE: "CIR", PLACE: "PL", TERRACE: "TER", HIGHWAY: "HWY", PARKWAY: "PKWY",
  APARTMENT: "APT", APT: "APT", SUITE: "STE", STE: "STE", UNIT: "UNIT", BUILDING: "BLDG",
  NORTH: "N", SOUTH: "S", EAST: "E", WEST: "W", NORTHEAST: "NE", NORTHWEST: "NW", SOUTHEAST: "SE", SOUTHWEST: "SW",
};
function standardizeStreet(s: string): string {
  return s.trim().toUpperCase().replace(/[.,]/g, "").split(/\s+/).map((w) => ABBR[w] || w).join(" ");
}
function hash(s: string): number {
  let h = 0; for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0; return h;
}
function mockValidate(input: UspsValidateInput): UspsValidateResult {
  const street = (input.streetAddress || "").trim();
  const state = (input.state || "").trim().toUpperCase();
  const cityIn = (input.city || "").trim();
  let zip = (input.ZIPCode || "").replace(/\D/g, "").slice(0, 5);

  if (!street || !/\d/.test(street)) {
    return { status: "unverified", dpv: "N", address: null, corrections: ["Enter a street number and name, e.g. \"123 Main St\"."], warnings: [], vacant: false, changed: false, message: "We couldn't find that address — check the street number.", source: "mock" };
  }
  if (!cityIn && !zip) {
    return { status: "unverified", dpv: "N", address: null, corrections: ["Add a city or a ZIP code."], warnings: [], vacant: false, changed: false, message: "Enter a city or a ZIP code so we can match the address.", source: "mock" };
  }

  const std = standardizeStreet(street);
  const h = hash(std + cityIn.toUpperCase() + state + zip);
  // Fill a blank ZIP with the state's real metro prefix + street-varied digits.
  if (!zip) {
    const rep = STATE_CITY_ZIP[state]?.zip;
    zip = rep ? rep.slice(0, 3) + String(h % 100).padStart(2, "0") : String(10000 + (h % 89999)).padStart(5, "0");
  }
  const city = (cityIn || STATE_CITY_ZIP[state]?.city || "Springfield").toUpperCase();

  const hasSecondary = !!(input.secondaryAddress && input.secondaryAddress.trim()) || /\b(APT|STE|UNIT|#)\b/.test(std);
  const needsSecondary = !hasSecondary && h % 4 === 0; // ~25% of multi-unit-looking addresses
  const vacant = h % 11 === 0;

  // No fabricated ZIP+4 — only a real provider can supply an accurate one.
  const address: UspsStandardized = { streetAddress: std, secondaryAddress: input.secondaryAddress?.trim() || undefined, city, state, ZIPCode: zip, ZIPPlus4: undefined };
  const changed = changedFrom(input, address);

  const corrections: string[] = [];
  const warnings: string[] = [];
  let dpv: UspsValidateResult["dpv"];
  let status: UspsValidateResult["status"];
  let message: string;

  if (needsSecondary) {
    dpv = "D"; status = "needs_secondary"; message = "This address is missing an apartment, suite, or unit number.";
    corrections.push("Add an apartment, suite, or unit number to match an exact delivery point.");
  } else {
    dpv = "Y"; status = changed ? "corrected" : "verified";
    message = changed ? "Address standardized to USPS format." : "Address verified — deliverable by USPS.";
  }
  if (vacant) warnings.push("USPS currently lists this address as vacant.");

  return { status, dpv, address, corrections, warnings, vacant, changed, message, source: "mock" };
}

export async function POST(req: Request) {
  let input: UspsValidateInput;
  try { input = await req.json(); } catch { return Response.json({ status: "error", message: "Invalid request body." }, { status: 400 }); }
  if (!input?.streetAddress || !input?.state) {
    return Response.json({ status: "error", dpv: null, address: null, corrections: [], warnings: [], vacant: false, changed: false, message: "Street address and state are required.", source: ID && SECRET ? "usps" : "mock" } satisfies UspsValidateResult);
  }
  try {
    const result = ID && SECRET ? await uspsValidate(input) : mockValidate(input);
    return Response.json(result);
  } catch {
    return Response.json({ status: "error", dpv: null, address: null, corrections: [], warnings: [], vacant: false, changed: false, message: "The address service is temporarily unavailable.", source: ID && SECRET ? "usps" : "mock" } satisfies UspsValidateResult);
  }
}
