"use client";

import { useState } from "react";
import { Modal } from "@/components/ui/Modal";
import { useLeads } from "@/lib/hooks/useLeads";
import { parseCSV, parseXML, rowsToLeads, type LeadInput } from "@/lib/leads/import";

export function ImportLeadsModal({ open, onClose, onImported }: { open: boolean; onClose: () => void; onImported: (n: number) => void }) {
  const leads = useLeads((s) => s.leads);
  const addMany = useLeads((s) => s.addMany);
  const [fileName, setFileName] = useState("");
  const [parsed, setParsed] = useState<LeadInput[] | null>(null);
  const [skipped, setSkipped] = useState(0);
  const [dupes, setDupes] = useState(0);
  const [err, setErr] = useState("");

  function reset() { setFileName(""); setParsed(null); setSkipped(0); setDupes(0); setErr(""); }

  function handleFile(file: File) {
    setErr(""); setFileName(file.name);
    const reader = new FileReader();
    reader.onload = () => {
      const text = String(reader.result || "");
      const isXml = file.name.toLowerCase().endsWith(".xml") || text.trim().startsWith("<");
      const rows = isXml ? parseXML(text) : parseCSV(text);
      const { leads: mapped, skipped: sk } = rowsToLeads(rows);
      if (rows.length === 0) { setErr("Couldn't read any rows. Check the file format."); setParsed(null); return; }
      const existing = new Set(leads.map((l) => l.phone.replace(/[^\d]/g, "")));
      const fresh: LeadInput[] = []; let dupe = 0;
      for (const m of mapped) { if (existing.has(m.phone.replace(/[^\d]/g, ""))) dupe++; else fresh.push(m); }
      setParsed(fresh); setSkipped(sk); setDupes(dupe);
      if (fresh.length === 0 && mapped.length === 0) setErr("No rows had a usable phone number.");
    };
    reader.onerror = () => setErr("Could not read the file.");
    reader.readAsText(file);
  }

  function doImport() {
    if (!parsed || parsed.length === 0) return;
    const n = addMany(parsed);
    onImported(n);
    reset(); onClose();
  }

  const preview = parsed?.slice(0, 8) || [];

  return (
    <Modal open={open} onClose={() => { reset(); onClose(); }} title="Import cold leads" icon="📥" width={620}
      footer={<><button className="btn btn-ghost" onClick={() => { reset(); onClose(); }}>Cancel</button><button className="btn btn-primary" onClick={doImport} disabled={!parsed || parsed.length === 0}>{parsed ? `Import ${parsed.length} lead${parsed.length === 1 ? "" : "s"}` : "Import"}</button></>}>
      <label className="flex flex-col items-center justify-center gap-1.5 border-2 border-dashed border-border rounded-xl py-7 cursor-pointer hover:bg-surface-2 mb-3">
        <span className="text-[28px]">📄</span>
        <span className="text-[13px] font-semibold">{fileName || "Choose a CSV or XML file"}</span>
        <span className="text-[11px] text-ink-muted">click to browse</span>
        <input type="file" accept=".csv,.xml,text/csv,text/xml,application/xml" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); }} />
      </label>

      {err && <div className="mb-3 px-3 py-2.5 rounded-md bg-red-soft text-red text-[12px] font-medium">⚠ {err}</div>}

      {parsed && (
        <>
          <div className="flex gap-2 mb-2.5 text-[12px]">
            <span className="font-semibold text-green">{parsed.length} ready</span>
            {dupes > 0 && <span className="text-ink-muted">· {dupes} already exist</span>}
            {skipped > 0 && <span className="text-ink-muted">· {skipped} skipped (no phone)</span>}
          </div>
          {preview.length > 0 && (
            <div className="border border-border rounded-lg overflow-hidden">
              <table className="w-full border-collapse text-[12px]">
                <thead><tr className="bg-surface-2">{["Name", "Phone", "Email", "Tag", "Source"].map((h) => <th key={h} className="text-left px-2.5 py-1.5 text-[10px] uppercase tracking-wide text-ink-muted font-bold border-b border-border">{h}</th>)}</tr></thead>
                <tbody>
                  {preview.map((l, i) => (
                    <tr key={i} className="border-b border-border last:border-none">
                      <td className="px-2.5 py-1.5 font-medium">{l.name}</td>
                      <td className="px-2.5 py-1.5">{l.phone}</td>
                      <td className="px-2.5 py-1.5 text-ink-muted">{l.email || "—"}</td>
                      <td className="px-2.5 py-1.5">{l.tag}</td>
                      <td className="px-2.5 py-1.5 text-ink-muted">{l.source}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {parsed.length > preview.length && <div className="px-2.5 py-1.5 text-[11px] text-ink-muted bg-surface-2">+{parsed.length - preview.length} more</div>}
            </div>
          )}
        </>
      )}

      <div className="mt-3 text-[10.5px] text-ink-muted-2">
        Recognized columns (any order, case-insensitive): <b>name</b> (or first/last), <b>phone</b> (or mobile/cell/number), email, tag, source. XML: repeated &lt;lead&gt;/&lt;contact&gt; elements. Rows without a phone are skipped; duplicates by phone are ignored.
      </div>
    </Modal>
  );
}
