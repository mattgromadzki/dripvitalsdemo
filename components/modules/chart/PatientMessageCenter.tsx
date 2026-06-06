"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { usePortalRecords } from "@/lib/hooks/usePortalRecords";
import { useSms } from "@/lib/hooks/useSms";
import { useEmails } from "@/lib/hooks/useEmails";
import { usePermission } from "@/lib/rbac/usePermission";
import { sendChat, pullChat } from "@/lib/chat/client";
import { sendSms } from "@/lib/sms/client";
import { sendEmail } from "@/lib/email/client";
import { toast } from "@/lib/hooks/useToast";
import type { Patient } from "@/lib/types";

type Channel = "chat" | "sms" | "email";
const META: Record<Channel, { label: string; icon: string; verb: string }> = {
  chat: { label: "Chat", icon: "💬", verb: "Send message" },
  sms: { label: "SMS", icon: "📲", verb: "Send text" },
  email: { label: "Email", icon: "✉️", verb: "Send email" },
};

const norm = (p: string) => "+" + (p || "").replace(/[^\d]/g, "").replace(/^1?/, "1");
const esc = (s: string) => (s || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const timeNow = () => new Date().toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
function fmt(iso: string) {
  const d = new Date(iso); if (isNaN(d.getTime())) return "";
  const sameDay = d.toDateString() === new Date().toDateString();
  return sameDay ? d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })
                 : d.toLocaleDateString([], { month: "short", day: "numeric" }) + " · " + d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}
function htmlToText(html: string) {
  return (html || "")
    .replace(/<br\s*\/?>/gi, "\n").replace(/<\/(p|div|li|h[1-6])>/gi, "\n")
    .replace(/<[^>]+>/g, "").replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">")
    .replace(/\n{3,}/g, "\n\n").trim();
}

export function PatientMessageCenter({ patient, open, onClose }: { patient: Patient; open: boolean; onClose: () => void }) {
  const records = usePortalRecords((s) => s.records);
  const threads = useSms((s) => s.threads);
  const emails = useEmails((s) => s.emails);
  const ingestInbound = useSms((s) => s.ingestInbound);
  const applyStatuses = useSms((s) => s.applyStatuses);
  const addOutgoing = useSms((s) => s.addOutgoing);
  const startThread = useSms((s) => s.startThread);
  const addEmail = useEmails((s) => s.add);

  const canChat = usePermission("patients.edit");
  const canSms = usePermission("sms.send");
  const canEmail = usePermission("email.send");
  const channels = useMemo<Channel[]>(() => [...(canEmail ? ["email"] as Channel[] : []), ...(canSms ? ["sms"] as Channel[] : []), ...(canChat ? ["chat"] as Channel[] : [])], [canEmail, canSms, canChat]);

  const [channel, setChannel] = useState<Channel>("email");
  const ch: Channel = channels.includes(channel) ? channel : (channels[0] || "email");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");           // sms / chat
  const [busy, setBusy] = useState(false);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const editorRef = useRef<HTMLDivElement>(null);  // email rich text
  const scrollRef = useRef<HTMLDivElement>(null);

  const phoneNorm = norm(patient.phone);
  const emailLc = (patient.email || "").toLowerCase();

  // Live: pull portal chat + inbound SMS while open.
  useEffect(() => {
    if (!open) return;
    let alive = true;
    async function tick() {
      pullChat(patient.id).catch(() => {});
      try {
        const r = await fetch("/api/sms/messages", { cache: "no-store" });
        const d = await r.json();
        if (alive && d?.ok && Array.isArray(d.messages)) {
          [...d.messages].reverse().forEach((m: { sid: string; from: string; body: string; receivedAt: string }) => { if (m?.from && m?.body) ingestInbound(m.sid, m.from, m.body, m.receivedAt); });
          if (d.statuses) applyStatuses(d.statuses);
        }
      } catch { /* ignore */ }
    }
    tick();
    const iv = setInterval(tick, 8000);
    return () => { alive = false; clearInterval(iv); };
  }, [open, patient.id, ingestInbound, applyStatuses]);

  // SMS thread + chat for this patient
  const smsThread = useMemo(() => threads.find((t) => t.patientId === patient.id || t.id === phoneNorm), [threads, patient.id, phoneNorm]);
  const chatMsgs = records[patient.id]?.messages || [];
  const patientEmails = useMemo(() => emails
    .filter((e) => (e.to || "").toLowerCase() === emailLc || (e.fromEmail || "").toLowerCase() === emailLc)
    .sort((a, b) => (Date.parse(a.createdAt) || 0) - (Date.parse(b.createdAt) || 0)), [emails, emailLc]);

  useEffect(() => { const el = scrollRef.current; if (el) el.scrollTop = el.scrollHeight; }, [ch, smsThread?.messages.length, chatMsgs.length, patientEmails.length, open]);

  function exec(cmd: string, val?: string) { document.execCommand(cmd, false, val); editorRef.current?.focus(); }

  async function send() {
    if (busy) return;
    if (ch === "email") {
      const html = (editorRef.current?.innerHTML || "").trim();
      const text = (editorRef.current?.textContent || "").trim();
      if (!text) return;
      if (!patient.email) { toast("No email address on file"); return; }
      setBusy(true);
      try {
        const subj = subject.trim() || "Message from your care team";
        const wrapped = `<div style="font-family:Arial,Helvetica,sans-serif;font-size:15px;color:#15181c;line-height:1.6">${html}</div>`;
        const r = await sendEmail({ to: patient.email, toName: patient.name, subject: subj, html: wrapped });
        if (r.ok) {
          addEmail({ folder: "sent", direction: "out", fromName: "DripVitals Care", fromEmail: "care@dripvitals.com", to: patient.email, toName: patient.name, subject: subj, html: wrapped, status: "sent", read: true, createdAt: new Date().toISOString() } as Parameters<typeof addEmail>[0]);
          if (editorRef.current) editorRef.current.innerHTML = ""; setSubject("");
        } else toast("⚠️ " + (r.error || "Couldn't send email"));
      } finally { setBusy(false); }
      return;
    }
    const text = body.trim();
    if (!text) return;
    setBusy(true);
    try {
      if (ch === "chat") { sendChat(patient.id, { from: "care", text, time: timeNow() }); setBody(""); }
      else {
        if (!patient.phone) { toast("No phone number on file"); return; }
        const r = await sendSms({ to: patient.phone, body: text });
        if (r.ok) { startThread(patient.name, patient.phone, patient.id); addOutgoing(phoneNorm, text, "sent"); setBody(""); }
        else toast("⚠️ " + (r.error || "Couldn't send text"));
      }
    } finally { setBusy(false); }
  }

  if (!open) return null;
  const noChannels = channels.length === 0;
  const recipient = ch === "chat" ? "Patient portal & app" : ch === "sms" ? (patient.phone || "No phone on file") : (patient.email || "No email on file");

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center p-4" style={{ background: "rgba(15,20,30,0.55)" }} onMouseDown={onClose}>
      <div className="bg-surface rounded-2xl shadow-2xl w-full flex flex-col overflow-hidden" style={{ maxWidth: 980, width: "94vw", height: "88vh", maxHeight: 880 }} onMouseDown={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="px-5 py-3.5 border-b border-border flex items-center gap-3 flex-shrink-0">
          <span className="text-[22px]">✉️</span>
          <div>
            <div className="text-[15px] font-bold text-ink tracking-tight">Messages — {patient.name}</div>
            <div className="text-[11.5px] text-ink-muted">All conversations with this patient, in one place</div>
          </div>
          <button onClick={onClose} className="w-[30px] h-[30px] rounded-md bg-surface-3 hover:bg-red-soft hover:text-red flex items-center justify-center text-[13px] text-ink-muted ml-auto transition-colors">✕</button>
        </div>

        {noChannels ? (
          <div className="flex-1 flex items-center justify-center text-[13px] text-ink-muted">Your role doesn’t include permission to message patients.</div>
        ) : (
          <>
            {/* Channel tabs */}
            <div className="flex items-center gap-2 px-5 py-2.5 border-b border-border flex-shrink-0">
              {channels.map((c) => (
                <button key={c} onClick={() => setChannel(c)}
                  className={`text-[12.5px] font-semibold px-4 py-1.5 rounded-full ${ch === c ? "bg-brand text-white" : "bg-surface-3 text-ink-muted hover:text-ink"}`}>
                  {META[c].icon} {META[c].label}
                </button>
              ))}
              <div className="flex-1" />
              <div className="text-[11.5px] text-ink-muted">To <b className="text-ink font-mono">{recipient}</b></div>
            </div>

            {/* History */}
            <div ref={scrollRef} className="flex-1 overflow-y-auto bg-surface-2 px-5 py-4 space-y-2.5">
              {ch === "email" ? (
                patientEmails.length === 0 ? <Empty label="No emails with this patient yet." />
                : patientEmails.map((e) => {
                  const out = e.direction === "out"; const isOpen = expanded[e.id];
                  return (
                    <div key={e.id} className={`rounded-xl border border-border bg-surface px-4 py-3 ${out ? "" : "border-l-[3px] border-l-brand"}`}>
                      <div className="flex items-center gap-2 text-[11px] text-ink-muted mb-1">
                        <span className={`font-semibold ${out ? "text-ink-2" : "text-brand"}`}>{out ? "Sent to patient" : "From patient"}</span>
                        <span>·</span><span>{fmt(e.createdAt)}</span>
                        {out && e.status && <><span>·</span><span className="capitalize">{e.status}</span></>}
                      </div>
                      <div className="text-[13.5px] font-bold text-ink mb-1">{e.subject || "(no subject)"}</div>
                      <div className="text-[13px] text-ink-2 whitespace-pre-wrap break-words">{isOpen ? htmlToText(e.html) : (e.preview || htmlToText(e.html).slice(0, 140))}</div>
                      {htmlToText(e.html).length > 140 && (
                        <button className="text-[11.5px] text-brand font-semibold mt-1" onClick={() => setExpanded((x) => ({ ...x, [e.id]: !isOpen }))}>{isOpen ? "Show less" : "Read full email"}</button>
                      )}
                    </div>
                  );
                })
              ) : ch === "sms" ? (
                !smsThread || smsThread.messages.length === 0 ? <Empty label="No texts with this patient yet." />
                : smsThread.messages.map((m, i) => <Bubble key={m.id || i} out={m.direction === "out"} text={m.body} meta={`${fmt(m.createdAt)}${m.direction === "out" && m.status ? " · " + m.status : ""}`} />)
              ) : (
                chatMsgs.length === 0 ? <Empty label="No portal messages with this patient yet." />
                : chatMsgs.map((m, i) => <Bubble key={m.id || i} out={m.from === "care"} text={m.text} meta={m.time || ""} />)
              )}
            </div>

            {/* Composer */}
            <div className="border-t border-border px-5 py-3 flex-shrink-0 bg-surface">
              {ch === "email" && (
                <>
                  <input className="fi mb-2" value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="Subject (optional)" />
                  <div className="flex items-center gap-1 mb-2">
                    <ToolBtn label="B" title="Bold" bold onClick={() => exec("bold")} />
                    <ToolBtn label="I" title="Italic" italic onClick={() => exec("italic")} />
                    <ToolBtn label="U" title="Underline" underline onClick={() => exec("underline")} />
                    <span className="w-px h-4 bg-border mx-1" />
                    <ToolBtn label="• List" title="Bulleted list" onClick={() => exec("insertUnorderedList")} />
                    <ToolBtn label="1. List" title="Numbered list" onClick={() => exec("insertOrderedList")} />
                    <ToolBtn label="🔗 Link" title="Insert link" onClick={() => { const u = window.prompt("Link URL"); if (u) exec("createLink", u); }} />
                    <ToolBtn label="⨯ Clear" title="Clear formatting" onClick={() => exec("removeFormat")} />
                  </div>
                  <div
                    ref={editorRef}
                    contentEditable
                    suppressContentEditableWarning
                    className="fi"
                    style={{ minHeight: 160, maxHeight: 300, overflowY: "auto", textAlign: "left", whiteSpace: "pre-wrap" }}
                  />
                </>
              )}
              {ch !== "email" && (
                <textarea
                  className="fta"
                  rows={3}
                  value={body}
                  onChange={(e) => setBody(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) { e.preventDefault(); send(); } }}
                  placeholder={ch === "sms" ? "Type a text message…" : "Type a secure portal message…"}
                />
              )}
              <div className="flex items-center mt-2">
                <div className="text-[11px] text-ink-muted">
                  {ch === "sms" && `${body.length} characters${body.length > 160 ? ` · ${Math.ceil(body.length / 153)} segments` : ""}`}
                  {ch === "email" && "Rich text · formatting supported"}
                  {ch === "chat" && "Delivered to the patient portal & app"}
                </div>
                <div className="flex-1" />
                <button className="btn btn-ghost" onClick={onClose}>Close</button>
                <button className="btn btn-primary ml-2" onClick={send} disabled={busy}>{busy ? "Sending…" : META[ch].verb}</button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function Empty({ label }: { label: string }) {
  return <div className="h-full flex items-center justify-center text-center text-ink-muted text-[13px]">{label}</div>;
}
function Bubble({ out, text, meta }: { out: boolean; text: string; meta: string }) {
  return (
    <div className={`flex ${out ? "justify-end" : "justify-start"}`}>
      <div className={`max-w-[72%] rounded-2xl px-3.5 py-2 ${out ? "bg-brand text-white" : "bg-surface border border-border text-ink"}`}>
        <div className="text-[13.5px] whitespace-pre-wrap break-words">{text}</div>
        {meta && <div className={`text-[10px] mt-1 ${out ? "text-white/75" : "text-ink-muted"}`}>{meta}</div>}
      </div>
    </div>
  );
}
function ToolBtn({ label, title, onClick, bold, italic, underline }: { label: string; title: string; onClick: () => void; bold?: boolean; italic?: boolean; underline?: boolean }) {
  return (
    <button type="button" title={title} onMouseDown={(e) => { e.preventDefault(); onClick(); }}
      className="px-2 py-1 rounded-md text-[12px] text-ink-2 hover:bg-surface-3 transition-colors"
      style={{ fontWeight: bold ? 700 : 600, fontStyle: italic ? "italic" : "normal", textDecoration: underline ? "underline" : "none" }}>
      {label}
    </button>
  );
}
