"use client";

import { useRef, useState } from "react";
import { Modal } from "@/components/ui/Modal";
import { importChunk } from "@/lib/farming/contactsClient";
import type { ContactInput } from "@/lib/types/farming";

interface Props {
  open: boolean;
  onClose: () => void;
  defaultGroupId?: string;          // import straight into a group
  onDone: (summary: { inserted: number; duplicates: number; invalid: number }) => void;
}

const CHUNK = 5000; // rows per server insert
const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");
const HEADER_KEYS: Record<keyof RowMap, string[]> = {
  firstName: ["first", "firstname", "fname", "givenname"],
  lastName: ["last", "lastname", "lname", "surname", "familyname"],
  fullName: ["name", "fullname", "contact", "contactname"],
  email: ["email", "emailaddress", "mail", "e"],
  phone: ["phone", "mobile", "cell", "number", "phonenumber", "mobilephone", "tel", "telephone"],
  company: ["company", "organization", "org", "business", "practice", "clinic"],
  title: ["title", "role", "jobtitle", "position"],
};
interface RowMap { firstName: number; lastName: number; fullName: number; email: number; phone: number; company: number; title: number }

function mapHeader(header: string[]): RowMap {
  const idx = (keys: string[]) => header.findIndex((h) => keys.includes(norm(h)));
  return { firstName: idx(HEADER_KEYS.firstName), lastName: idx(HEADER_KEYS.lastName), fullName: idx(HEADER_KEYS.fullName), email: idx(HEADER_KEYS.email), phone: idx(HEADER_KEYS.phone), company: idx(HEADER_KEYS.company), title: idx(HEADER_KEYS.title) };
}
function toContact(cells: string[], m: RowMap): ContactInput | null {
  const at = (i: number) => (i >= 0 ? (cells[i] || "").trim() : "");
  let firstName = at(m.firstName), lastName = at(m.lastName);
  const full = at(m.fullName);
  if (!firstName && !lastName && full) { const p = full.split(/\s+/); firstName = p[0]; lastName = p.slice(1).join(" "); }
  const email = at(m.email), phone = at(m.phone);
  if (!email && !phone) return null;
  return { firstName, lastName, email, phone, company: at(m.company) || undefined, title: at(m.title) || undefined, source: "Import" };
}

// Streaming CSV row reader — constant memory regardless of file size.
async function* streamCsvRows(file: File): AsyncGenerator<string[]> {
  const reader = file.stream().getReader();
  const decoder = new TextDecoder();
  let field = "", inQ = false; let row: string[] = [];
  const push = () => { row.push(field); field = ""; };
  for (;;) {
    const { value, done } = await reader.read();
    const buf = value ? decoder.decode(value, { stream: !done }) : "";
    for (let i = 0; i < buf.length; i++) {
      const c = buf[i];
      if (inQ) { if (c === '"') { if (buf[i + 1] === '"') { field += '"'; i++; } else inQ = false; } else field += c; }
      else if (c === '"') inQ = true;
      else if (c === ",") push();
      else if (c === "\n") { push(); yield row; row = []; }
      else if (c !== "\r") field += c;
    }
    if (done) break;
  }
  if (field.length || row.length) { push(); yield row; }
}

export function ImportContactsModal({ open, onClose, defaultGroupId, onDone }: Props) {
  const [fileName, setFileName] = useState("");
  const [phase, setPhase] = useState<"idle" | "running" | "done" | "error">("idle");
  const [prog, setProg] = useState({ processed: 0, inserted: 0, duplicates: 0, invalid: 0 });
  const [err, setErr] = useState("");
  const cancelRef = useRef(false);

  function reset() { setFileName(""); setPhase("idle"); setProg({ processed: 0, inserted: 0, duplicates: 0, invalid: 0 }); setErr(""); cancelRef.current = false; }
  function close() { cancelRef.current = true; reset(); onClose(); }

  async function pushBatch(batch: ContactInput[], acc: typeof prog) {
    const res = await importChunk(batch, defaultGroupId);
    acc.inserted += res.inserted; acc.duplicates += res.duplicates; acc.invalid += res.invalid; acc.processed += batch.length;
    setProg({ ...acc });
  }

  async function runCsv(file: File, acc: typeof prog) {
    let header: RowMap | null = null; let batch: ContactInput[] = [];
    for await (const cells of streamCsvRows(file)) {
      if (cancelRef.current) return;
      if (cells.every((c) => c.trim() === "")) continue;
      if (!header) { header = mapHeader(cells.map((c) => c.trim())); continue; }
      const c = toContact(cells, header);
      if (!c) { acc.invalid++; continue; }
      batch.push(c);
      if (batch.length >= CHUNK) { await pushBatch(batch, acc); batch = []; }
    }
    if (batch.length) await pushBatch(batch, acc);
  }

  async function runXlsx(file: File, acc: typeof prog) {
    const XLSX = await import("xlsx");
    const wb = XLSX.read(await file.arrayBuffer(), { type: "array" });
    const sheet = wb.Sheets[wb.SheetNames[0]];
    const rows = XLSX.utils.sheet_to_json<string[]>(sheet, { header: 1, raw: false, defval: "" });
    if (!rows.length) throw new Error("The spreadsheet has no rows.");
    const header = mapHeader((rows[0] as string[]).map((c) => String(c).trim()));
    let batch: ContactInput[] = [];
    for (let i = 1; i < rows.length; i++) {
      if (cancelRef.current) return;
      const c = toContact((rows[i] as string[]).map((x) => String(x)), header);
      if (!c) { acc.invalid++; continue; }
      batch.push(c);
      if (batch.length >= CHUNK) { await pushBatch(batch, acc); batch = []; }
    }
    if (batch.length) await pushBatch(batch, acc);
  }

  async function onFile(file: File) {
    setErr(""); setFileName(file.name); setPhase("running"); cancelRef.current = false;
    const acc = { processed: 0, inserted: 0, duplicates: 0, invalid: 0 };
    try {
      if (/\.xlsx?$/i.test(file.name)) await runXlsx(file, acc);
      else await runCsv(file, acc);
      if (cancelRef.current) return;
      setPhase("done"); onDone(acc);
    } catch (e) {
      setErr(String(e instanceof Error ? e.message : e)); setPhase("error");
    }
  }

  return (
    <Modal open={open} onClose={close} title="Import contacts" icon="📥" width={560}
      footer={<button className="btn btn-ghost" onClick={close}>{phase === "done" ? "Close" : "Cancel"}</button>}>
      <div className="text-[12.5px] text-ink-muted mb-3">
        Upload a <b>CSV</b> or <b>XLSX</b>. Columns are matched fuzzily (name/first/last, email, phone, company, title). Duplicate emails are skipped server-side. CSV streams in constant memory — best for very large lists (millions); XLSX is loaded fully, so keep those under a few hundred thousand rows.
      </div>
      {phase === "idle" && (
        <label className="block border-2 border-dashed border-border rounded-xl p-6 text-center cursor-pointer hover:border-brand transition-colors">
          <input type="file" accept=".csv,.xlsx,.xls,.txt,text/csv" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) onFile(f); }} />
          <div className="text-[26px] mb-1">📄</div>
          <div className="text-[13px] font-semibold">Choose a CSV / XLSX file</div>
          {defaultGroupId && <div className="text-[11px] text-brand-dk mt-1">Imported into the selected group</div>}
        </label>
      )}
      {(phase === "running" || phase === "done") && (
        <div className="p-4 rounded-lg bg-surface-2 border border-border">
          <div className="text-[13px] font-semibold mb-2">{fileName}</div>
          <div className="flex gap-4 text-[13px] mb-2">
            <span className="text-green font-bold">{prog.inserted.toLocaleString()} <span className="font-normal text-ink-muted">added</span></span>
            <span className="text-amber">{prog.duplicates.toLocaleString()} <span className="text-ink-muted">dupes</span></span>
            {prog.invalid > 0 && <span className="text-ink-muted">{prog.invalid.toLocaleString()} skipped</span>}
          </div>
          <div className="text-[12px] text-ink-muted">{phase === "running" ? `Importing… ${prog.processed.toLocaleString()} rows processed` : `✓ Done — ${prog.processed.toLocaleString()} rows processed`}</div>
          {phase === "running" && <div className="mt-2 h-1.5 bg-surface-3 rounded-full overflow-hidden"><div className="h-full bg-brand rounded-full animate-pulse" style={{ width: "100%" }} /></div>}
        </div>
      )}
      {err && <div className="mt-3 px-3 py-2.5 rounded-md bg-red-soft text-red text-[12px] font-medium">⚠ {err}</div>}
    </Modal>
  );
}
