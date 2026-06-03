import type { AddressSuggestion } from "@/lib/usps/types";

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
const STATE_CITY: Record<string, [string, string]> = {
  FL: ["Miami", "33101"], TX: ["Austin", "78701"], CA: ["Los Angeles", "90012"], NY: ["Brooklyn", "11201"],
  WA: ["Seattle", "98101"], CO: ["Denver", "80202"], GA: ["Atlanta", "30303"], IL: ["Chicago", "60601"],
  AZ: ["Phoenix", "85004"], NC: ["Charlotte", "28202"], OH: ["Columbus", "43215"], PA: ["Philadelphia", "19103"],
  MA: ["Boston", "02108"], NJ: ["Newark", "07102"], VA: ["Richmond", "23219"], MI: ["Detroit", "48226"],
};
const FALLBACK_CITIES: [string, string, string][] = [
  ["Miami", "FL", "33101"], ["Austin", "TX", "78701"], ["Denver", "CO", "80202"],
  ["Brooklyn", "NY", "11201"], ["Seattle", "WA", "98101"], ["Chicago", "IL", "60601"],
];
const SUFFIXES = ["St", "Ave", "Rd", "Dr", "Blvd", "Ln", "Way", "Ct"];
function hash(s: string): number { let h = 0; for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0; return h; }
function titleCase(s: string): string { return s.toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase()); }

function mockSuggest(q: string, state?: string): AddressSuggestion[] {
  const m = q.trim().match(/^(\d+)\s*(.*)$/);
  const num = m ? m[1] : String(100 + (hash(q) % 8900));
  const rawName = (m ? m[2] : q).replace(/\b(st|street|ave|avenue|rd|road|dr|drive|blvd|ln|way|ct)\b/gi, "").trim();
  const name = titleCase(rawName.split(/\s+/)[0] || "Main");
  const base = hash(q);

  const out: AddressSuggestion[] = [];
  const used = new Set<string>();
  for (let i = 0; i < 5; i++) {
    const suf = SUFFIXES[(base + i) % SUFFIXES.length];
    let city: string, st: string, zip: string;
    if (state && STATE_CITY[state]) { [city, zip] = STATE_CITY[state]; st = state; }
    else if (state) { city = "Springfield"; st = state; zip = String(10000 + ((base + i) % 89999)).padStart(5, "0"); }
    else { [city, st, zip] = FALLBACK_CITIES[(base + i) % FALLBACK_CITIES.length]; }
    const numI = i === 0 ? num : String(parseInt(num, 10) + i * 2);
    const street = `${numI} ${name} ${suf}`;
    if (used.has(street + st)) continue;
    used.add(street + st);
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
