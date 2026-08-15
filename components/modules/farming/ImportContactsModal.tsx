"use client";

import { useState } from "react";
import { Modal } from "@/components/ui/Modal";
import { parseCSV, parseXML, type RawRow } from "@/lib/leads/import";
import type { ContactInput } from "@/lib/hooks/useFarming";

interface Props {
  open: boolean;
  onClose: () => void;
  existing: { email: string; phone: string }[];  // for dedupe
  defaultGroupId?: string;                        // import straight into a group
  onImport: (rows: ContactInput[]) => void;
}

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");
function pick(row: RawRow, keys: string[]): string {
  for (const k of Object.keys(row)) if (keys.includes(norm(k))) { const v = (row[k] || "").trim(); if (v) return v; }
  return "";
}

// Fuzzy column mapping → contacts. Dedupes within the file by email/phone.
function rowsToContacts(rows: RawRow[]): { contacts: ContactInput[]; skipped: number } {
  const out: ContactInput[] = []; let skipped = 0; const seen = new Set<string>();
  for (const r of rows) {
    const first = pick(r, ["first", "firstname", "fname", "givenname"]);
    const last = pick(r, ["last", "lastname", "lname", "surname", "familyname"]);
    const full = pick(r, ["name", "fullname", "contact", "contactname"]);
    let firstName = first, lastName = last;
    if (!firstName && !lastName && full) { const parts = full.split(/\s+/); firstName = parts[0]; lastName = parts.slice(1).join(" "); }
    const email = pick(r, ["email", "emailaddress", "mail", "e"]);
    const phone = pick(r, ["phone", "mobile", "cell", "number", "phonenumber", "mobilephone", "tel", "telephone"]);
    const company = pick(r, ["company", "organization", "org", "business", "practice", "clinic"]);
    const title = pick(r, ["title", "role", "jobtitle", "position"]);
    if (!email && !phone) { skipped++; continue; }
    const key = (email || "").toLowerCase() || phone.replace(/[^\d]/g, "");
    if (!key || seen.has(key)) { skipped++; continue; }
    seen.add(key);
    out.push({ firstName: firstName || "", lastName: lastName || "", email, phone, company: company || undefined, title: title || undefined, source: "Import" });
  }
  return { contacts: out, skipped };
}

export function ImportContactsModal({ open, onClose, existing, defaultGroupId, onImport }: Props) {
  const [parsed, setParsed] = useState<ContactInput[]>([]);
  const [skipped, setSkipped] = useState(0);
  const [dupes, setDupes] = useState(0);
  const [fileName, setFileName] = useState("");
  const [err, setErr] = useState("");

  function reset() { setParsed([]); setSkipped(0); setDupes(0); setFileName(""); setErr(""); }
  function close() { reset(); onClose(); }

  function onFile(file: File) {
    setErr(""); setFileName(file.name);
    const reader = new FileReader();
    reader.onload = () => {
      const text = String(reader.result || "");
      const rows = /\.xml$/i.test(file.name) || text.trimStart().startsWith("<") ? parseXML(text) : parseCSV(text);
      if (!rows.length) { setErr("Couldn't read any rows. Expected a CSV or XML with a header row."); setParsed([]); return; }
      const { contacts, skipped } = rowsToContacts(rows);
      // Dedupe against the existing contact base.
      const existingKeys = new Set<string>();
      existing.forEach((e) => { if (e.email) existingKeys.add(e.email.toLowerCase()); if (e.phone) existingKeys.add(e.phone.replace(/[^\d]/g, "")); });
      let dupes = 0;
      const fresh = contacts.filter((c) => {
        const dup = (c.email && existingKeys.has(c.email.toLowerCase())) || (c.phone && existingKeys.has(c.phone.replace(/[^\d]/g, "")));
        if (dup) dupes++;
        return !dup;
      });
      setParsed(fresh); setSkipped(skipped); setDupes(dupes);
    };
    reader.readAsText(file);
  }

  function doImport() {
    if (!parsed.length) return;
    const withGroup = defaultGroupId ? parsed.map((c) => ({ ...c, groupIds: [defaultGroupId] })) : parsed;
    onImport(withGroup);
    close();
  }

  return (
    <Modal open={open} onClose={close} title="Import contacts" icon="📥" width={620}
      footer={<><button className="btn btn-ghost" onClick={close}>Cancel</button><button className="btn btn-primary" onClick={doImport} disabled={!parsed.length}>Import {parsed.length || ""} contact{parsed.length === 1 ? "" : "s"}</button></>}>
      <div className="text-[12.5px] text-ink-muted mb-3">Upload a CSV or XML. Columns are matched fuzzily (name/first/last, email, phone, company, title). Rows without an email or phone are skipped, and duplicates of existing contacts are excluded.</div>
      <label className="block border-2 border-dashed border-border rounded-xl p-6 text-center cursor-pointer hover:border-brand transition-colors">
        <input type="file" accept=".csv,.xml,.txt,text/csv,application/xml,text/xml" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) onFile(f); }} />
        <div className="text-[26px] mb-1">📄</div>
        <div className="text-[13px] font-semibold">{fileName || "Choose a CSV / XML file"}</div>
        <div className="text-[11px] text-ink-muted mt-0.5">or drag &amp; drop</div>
      </label>
      {err && <div className="mt-3 px-3 py-2.5 rounded-md bg-red-soft text-red text-[12px] font-medium">⚠ {err}</div>}
      {(parsed.length > 0 || skipped > 0 || dupes > 0) && !err && (
        <div className="mt-3">
          <div className="flex gap-3 text-[12px] mb-2">
            <span className="text-green font-semibold">{parsed.length} ready</span>
            {dupes > 0 && <span className="text-amber">{dupes} duplicate{dupes === 1 ? "" : "s"} skipped</span>}
            {skipped > 0 && <span className="text-ink-muted">{skipped} invalid skipped</span>}
          </div>
          {parsed.length > 0 && (
            <div className="border border-border rounded-lg overflow-hidden max-h-[220px] overflow-y-auto">
              <table className="w-full text-[12px] border-collapse">
                <thead className="bg-surface-2 sticky top-0"><tr>{["Name", "Email", "Phone", "Company"].map((h) => <th key={h} className="text-left px-3 py-2 font-bold text-[10px] uppercase tracking-wide text-ink-muted">{h}</th>)}</tr></thead>
                <tbody>
                  {parsed.slice(0, 50).map((c, i) => (
                    <tr key={i} className="border-t border-border">
                      <td className="px-3 py-1.5">{[c.firstName, c.lastName].filter(Boolean).join(" ") || "—"}</td>
                      <td className="px-3 py-1.5 text-ink-muted">{c.email || "—"}</td>
                      <td className="px-3 py-1.5 text-ink-muted">{c.phone || "—"}</td>
                      <td className="px-3 py-1.5 text-ink-muted">{c.company || "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {parsed.length > 50 && <div className="text-[11px] text-ink-muted px-3 py-1.5 bg-surface-2">+ {parsed.length - 50} more…</div>}
            </div>
          )}
        </div>
      )}
    </Modal>
  );
}
