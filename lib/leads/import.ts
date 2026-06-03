"use client";

export interface RawRow { [k: string]: string }
export interface LeadInput { name: string; phone: string; email?: string; tag?: string; source?: string }

// ── CSV (RFC-4180-ish: quotes, commas, CRLF) ──────────────────────────────
export function parseCSV(text: string): RawRow[] {
  const rows: string[][] = [];
  let field = "", row: string[] = [], inQ = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQ) {
      if (c === '"') { if (text[i + 1] === '"') { field += '"'; i++; } else inQ = false; }
      else field += c;
    } else {
      if (c === '"') inQ = true;
      else if (c === ",") { row.push(field); field = ""; }
      else if (c === "\n") { row.push(field); rows.push(row); row = []; field = ""; }
      else if (c !== "\r") field += c;
    }
  }
  if (field.length || row.length) { row.push(field); rows.push(row); }
  const ne = rows.filter((r) => r.some((c) => c.trim() !== ""));
  if (!ne.length) return [];
  const headers = ne[0].map((h) => h.trim());
  return ne.slice(1).map((r) => { const o: RawRow = {}; headers.forEach((h, i) => (o[h] = (r[i] ?? "").trim())); return o; });
}

// ── XML (repeated lead/contact/record/row elements) ───────────────────────
export function parseXML(text: string): RawRow[] {
  let doc: Document;
  try { doc = new DOMParser().parseFromString(text, "application/xml"); } catch { return []; }
  if (doc.getElementsByTagName("parsererror").length) return [];
  const root = doc.documentElement;
  if (!root) return [];
  const names = ["lead", "contact", "record", "row", "customer", "person", "item"];
  let recs: Element[] = [];
  for (const n of names) {
    const f = Array.from(root.getElementsByTagName(n));
    if (f.length) { recs = f; break; }
  }
  if (!recs.length) recs = Array.from(root.children);
  return recs.map((rec) => {
    const o: RawRow = {};
    Array.from(rec.attributes).forEach((a) => (o[a.name] = a.value));
    Array.from(rec.children).forEach((ch) => (o[ch.tagName] = (ch.textContent || "").trim()));
    return o;
  });
}

// ── Map arbitrary columns → leads ─────────────────────────────────────────
const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");
function pick(row: RawRow, keys: string[]): string {
  for (const k of Object.keys(row)) if (keys.includes(norm(k))) { const v = (row[k] || "").trim(); if (v) return v; }
  return "";
}

export function rowsToLeads(rows: RawRow[]): { leads: LeadInput[]; skipped: number } {
  const out: LeadInput[] = []; let skipped = 0; const seen = new Set<string>();
  for (const r of rows) {
    const first = pick(r, ["first", "firstname", "fname", "givenname"]);
    const last = pick(r, ["last", "lastname", "lname", "surname", "familyname"]);
    let name = pick(r, ["name", "fullname", "contact", "contactname"]);
    if (!name) name = [first, last].filter(Boolean).join(" ").trim();
    const phone = pick(r, ["phone", "mobile", "cell", "number", "phonenumber", "mobilephone", "cellphone", "tel", "telephone", "mobilenumber"]);
    const email = pick(r, ["email", "emailaddress", "mail", "e"]);
    const tag = pick(r, ["tag", "status", "temperature", "type"]) || "Cold";
    const source = pick(r, ["source", "leadsource", "channel", "origin", "campaign", "referrer"]) || "Import";
    if (!phone) { skipped++; continue; }
    const key = phone.replace(/[^\d]/g, "");
    if (!key || seen.has(key)) { skipped++; continue; }
    seen.add(key);
    out.push({ name: name || phone, phone, email: email || undefined, tag, source });
  }
  return { leads: out, skipped };
}
