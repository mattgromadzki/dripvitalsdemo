"use client";

import { useState } from "react";
import { usePatients } from "@/lib/hooks/usePatients";
import { EMAIL_TEMPLATES, applyTemplate } from "@/lib/email/templates";
import { sendEmail } from "@/lib/email/client";
import { RichTextEditor } from "./RichTextEditor";
import type { EmailMessage, Attachment } from "@/lib/email/types";

export interface ComposeInit { to?: string; toName?: string; subject?: string; html?: string; templateId?: string; replaceId?: string }

export function ComposeWindow({ init, onClose, onResult }: {
  init: ComposeInit; onClose: () => void;
  onResult: (msg: Omit<EmailMessage, "id" | "preview">, replaceId?: string) => void;
}) {
  const patients = usePatients((s) => s.patients);
  const [patientId, setPatientId] = useState("");
  const [to, setTo] = useState(init.to || "");
  const [toName, setToName] = useState(init.toName || "");
  const [templateId, setTemplateId] = useState(init.templateId || "");
  const [subject, setSubject] = useState(init.subject || "");
  const [html, setHtml] = useState(init.html || "");
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [min, setMin] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  function varsFor(pid: string): Record<string, string> {
    const p = patients.find((x) => x.id === pid);
    return { firstName: p?.first || (toName.split(" ")[0] || "there"), lastName: p?.last || "", fullName: p?.name || toName, med: p?.plan || "your medication", dose: p?.dose || "", nextRefill: p?.nextRefill || "your next refill date", clinic: "DripVitals" };
  }
  function pickPatient(pid: string) {
    setPatientId(pid);
    const p = patients.find((x) => x.id === pid);
    if (p) { setTo(p.email); setToName(p.name); }
    if (templateId) { const t = EMAIL_TEMPLATES.find((x) => x.id === templateId); if (t) { const r = applyTemplate(t, varsFor(pid)); setSubject(r.subject); setHtml(r.html); } }
  }
  function pickTemplate(tid: string) {
    setTemplateId(tid);
    const t = EMAIL_TEMPLATES.find((x) => x.id === tid);
    if (t) { const r = applyTemplate(t, varsFor(patientId)); setSubject(r.subject); setHtml(r.html); }
  }
  function attach() { const n = window.prompt("Attachment file name (mock)", "document.pdf"); if (n) setAttachments((a) => [...a, { name: n, sizeKb: Math.round(40 + Math.random() * 800) }]); }

  function base(): Omit<EmailMessage, "id" | "preview" | "folder" | "status"> {
    return { direction: "out", fromName: "DripVitals Care", fromEmail: "care@dripvitals.com", to: to.trim(), toName, subject, html, templateId: templateId || undefined, starred: false, read: true, attachments: attachments.length ? attachments : undefined, createdAt: new Date().toISOString() };
  }
  async function send() {
    if (!to.trim()) { setErr("A recipient is required."); return; }
    if (!subject.trim()) { setErr("A subject is required."); return; }
    setBusy(true); setErr("");
    const res = await sendEmail({ to: to.trim(), toName, subject, html, templateId: templateId || undefined });
    setBusy(false);
    if (!res.ok) { setErr(res.error || "Failed to send."); return; }
    onResult({ ...base(), folder: "sent", status: "sent", providerId: res.id }, init.replaceId);
    onClose();
  }
  function saveDraft() {
    if (!to.trim() && !subject.trim()) { onClose(); return; }
    onResult({ ...base(), folder: "drafts", status: "draft" }, init.replaceId);
    onClose();
  }

  return (
    <div className={`fixed right-5 bottom-0 z-50 w-[560px] max-w-[calc(100vw-2rem)] bg-surface border border-border rounded-t-xl shadow-2xl flex flex-col ${min ? "h-11" : "h-[600px] max-h-[calc(100vh-2rem)]"}`}>
      <div className="flex items-center justify-between px-3.5 h-11 bg-ink text-white rounded-t-xl shrink-0 cursor-pointer" onClick={() => setMin(!min)}>
        <span className="text-[13px] font-semibold truncate">{subject || "New message"}</span>
        <div className="flex items-center gap-2.5 text-white/80">
          <button onClick={(e) => { e.stopPropagation(); setMin(!min); }} title="Minimize" className="hover:text-white">—</button>
          <button onClick={(e) => { e.stopPropagation(); onClose(); }} title="Close" className="hover:text-white">✕</button>
        </div>
      </div>

      {!min && (
        <div className="flex flex-col flex-1 min-h-0 p-3">
          {err && <div className="mb-2 px-3 py-2 rounded-md bg-red-soft text-red text-[12px] font-medium">⚠ {err}</div>}
          <div className="grid grid-cols-2 gap-2 mb-2">
            <select className="fsel" value={patientId} onChange={(e) => pickPatient(e.target.value)}>
              <option value="">Patient…</option>
              {patients.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
            <select className="fsel" value={templateId} onChange={(e) => pickTemplate(e.target.value)}>
              <option value="">Template…</option>
              {EMAIL_TEMPLATES.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
            </select>
          </div>
          <input className="fi mb-2" value={to} onChange={(e) => setTo(e.target.value)} placeholder="To" />
          <input className="fi mb-2" value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="Subject" />
          <div className="flex-1 min-h-0 mb-2">
            <RichTextEditor value={html} onChange={setHtml} minHeight={220} />
          </div>
          {attachments.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mb-2">
              {attachments.map((a, i) => (
                <span key={i} className="inline-flex items-center gap-1 text-[11px] bg-surface-2 border border-border rounded-md px-2 py-1">
                  📎 {a.name} <button onClick={() => setAttachments((x) => x.filter((_, j) => j !== i))} className="text-ink-muted hover:text-red">✕</button>
                </span>
              ))}
            </div>
          )}
          <div className="flex items-center gap-2 shrink-0">
            <button className="btn btn-primary" onClick={send} disabled={busy}>{busy ? "Sending…" : "Send"}</button>
            <button className="btn btn-ghost" onClick={attach} title="Attach">📎</button>
            <div className="flex-1" />
            <button className="btn btn-ghost btn-sm" onClick={saveDraft}>Save draft</button>
          </div>
        </div>
      )}
    </div>
  );
}
