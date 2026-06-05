import type { AddressSuggestion } from "@/lib/usps/types";
import { STATE_CITY_ZIP, FALLBACK_STATES } from "@/lib/usps/stateZip";

/* ────────────────────────────────────────────────────────────────────────
   Address autocomplete (type-ahead). USPS itself has no autocomplete, so this
   uses a dedicated provider. Smarty US Autocomplete Pro is wired here.

   To go live, set:
     SMARTY_AUTH_ID      = your Smarty auth-id
     SMARTY_AUTH_TOKEN   = your Smarty auth-token
   (Or swap in Google Places / Lob / Melissa by editing realSuggest below.)

   Without credentials (e.g. this sandbox) it returns a realistic MOCK so the
   dropdown is fully demoable. The provider key never reaches the browser —
   the form only ever calls this route. Pair this with /api/validate-address:
   suggest as they type here, then standardize/confirm the pick via USPS.
   ──────────────────────────────────────────────────────────────────────── */

const SMARTY_ID = process.env.SMARTY_AUTH_ID;
const SMARTY_TOKEN = process.env.SMARTY_AUTH_TOKEN;

// ── Real provider: Smarty US Autocomplete Pro ─────────────────────────────
async function realSuggest(q: string, state?: string): Promise<AddressSuggestion[]> {
  const qs = new URLSearchParams({ search: q, "auth-id": SMARTY_ID!, "auth-token": SMARTY_TOKEN!, max_results: "5" });
  if (state) qs.set("include_only_states", state);
  const r = await fetch(`https://us-autocomplete-pro.api.smarty.com/lookup?${qs.toString()}`, { headers: { Accept: "application/json" } });
  if (!r.ok) return [];
  const j = await r.json();
  const list = Array.isArray(j.suggestions) ? j.suggestions : [];
  return list.map((s: { street_line: string; secondary?: string; city: string; state: string; zipcode: string }) => ({
    street: s.street_line,
    secondary: s.secondary || undefined,
    city: s.city,
    state: s.state,
    zip: s.zipcode,
    text: `${s.street_line}${s.secondary ? " " + s.secondary : ""}, ${s.city}, ${s.state} ${s.zipcode}`,
  }));
}

// ── Mock ──────────────────────────────────────────────────────────────────
const SUFFIXES = ["St", "Ave", "Rd", "Dr", "Blvd", "Ln", "Way", "Ct"];
function hash(s: string): number { let h = 0; for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0; return h; }
const DIRECTIONALS = new Set(["N", "S", "E", "W", "NE", "NW", "SE", "SW", "US"]);
function caseToken(t: string): string {
  const up = t.toUpperCase();
  if (DIRECTIONALS.has(up)) return up;                 // keep directionals upper: SW, NE
  if (/^\d+(st|nd|rd|th)$/i.test(t)) return t.toLowerCase(); // ordinals: 3rd, 1st
  if (/^\d+$/.test(t)) return t;                        // plain numbers
  return t.charAt(0).toUpperCase() + t.slice(1).toLowerCase();
}
function formatStreet(s: string): string {
  return s.trim().split(/\s+/).filter(Boolean).map(caseToken).join(" ");
}
const SUFFIX_RE = /\b(st|street|ave|avenue|rd|road|dr|drive|blvd|ln|lane|way|ct|court|pl|place|ter|terrace|cir|circle|hwy|pkwy)\.?$/i;

function mockSuggest(q: string, state?: string): AddressSuggestion[] {
  // Split an optional leading house number from the rest of the street, and
  // KEEP the full street the user typed (e.g. "SW 3rd St") instead of mangling it.
  const m = q.trim().match(/^(\d+)\s+(.+)$/);
  const num = m ? parseInt(m[1], 10) : 100 + (hash(q) % 8900);
  const rawStreet = (m ? m[2] : q).trim();
  const hasSuffix = SUFFIX_RE.test(rawStreet);
  const baseStreet = formatStreet(rawStreet);
  const base = hash(q);

  function loc(i: number): [string, string, string] {
    if (state && STATE_CITY_ZIP[state]) { const { city, zip } = STATE_CITY_ZIP[state]; return [city, state, zip]; }
    if (state) return ["Springfield", state, "00000"]; // unrecognized state code
    const fb = FALLBACK_STATES[(base + i) % FALLBACK_STATES.length];
    const { city, zip } = STATE_CITY_ZIP[fb];
    return [city, fb, zip];
  }

  const out: AddressSuggestion[] = [];
  const used = new Set<string>();
  for (let i = 0; i < 5; i++) {
    // If the street already has a suffix, mirror the typed address first, then
    // offer nearby house numbers. If not, offer the street with a few suffixes.
    const street = hasSuffix
      ? `${i === 0 ? num : num + i * 2} ${baseStreet}`
      : `${num} ${baseStreet} ${SUFFIXES[(base + i) % SUFFIXES.length]}`;
    const [city, st, zip] = loc(i);
    const key = street + st;
    if (used.has(key)) continue;
    used.add(key);
    out.push({ street, city, state: st, zip, text: `${street}, ${city}, ${st} ${zip}` });
  }
  return out;
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const q = (searchParams.get("q") || "").trim();
  const state = searchParams.get("state") || undefined;
  if (q.length < 3) return Response.json({ suggestions: [] });
  try {
    const suggestions = SMARTY_ID && SMARTY_TOKEN ? await realSuggest(q, state) : mockSuggest(q, state);
    return Response.json({ suggestions, source: SMARTY_ID && SMARTY_TOKEN ? "smarty" : "mock" });
  } catch {
    return Response.json({ suggestions: [], source: "mock" });
  }
}
