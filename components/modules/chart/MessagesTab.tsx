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
import type { Patient, PatientExtra } from "@/lib/types";

type Channel = "chat" | "sms" | "email";
const META: Record<Channel, { label: string; icon: string; verb: string }> = {
  chat: { label: "Portal", icon: "💬", verb: "Send message" },
  sms: { label: "SMS", icon: "📲", verb: "Send text" },
  email: { label: "Email", icon: "✉️", verb: "Send email" },
};

const norm = (p: string) => "+" + (p || "").replace(/[^\d]/g, "").replace(/^1?/, "1");
const esc = (s: string) => (s || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const timeNow = () => new Date().toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
function fmt(iso: string) {
  const d = new Date(iso); if (isNaN(d.getTime())) return "";
  const today = new Date(); const sameDay = d.toDateString() === today.toDateString();
  return sameDay ? d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })
                 : d.toLocaleDateString([], { month: "short", day: "numeric" }) + " · " + d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}

interface Item { key: string; channel: Channel; dir: "in" | "out"; text: string; subject?: string; ts: number; tlabel: string; status?: string; }

export function MessagesTab({ patient }: { patient: Patient; extra: PatientExtra }) {
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
  const channels = useMemo<Channel[]>(() => [...(canChat ? ["chat"] as Channel[] : []), ...(canSms ? ["sms"] as Channel[] : []), ...(canEmail ? ["email"] as Channel[] : [])], [canChat, canSms, canEmail]);

  const [channel, setChannel] = useState<Channel>("chat");
  const ch: Channel = channels.includes(channel) ? channel : (channels[0] || "chat");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [busy, setBusy] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  const phoneNorm = norm(patient.phone);
  const emailLc = (patient.email || "").toLowerCase();

  // Keep the conversation live: pull portal chat + inbound SMS while open.
  useEffect(() => {
    let alive = true;
    async function tick() {
      pullChat(patient.id).catch(() => {});
      try {
        const r = await fetch("/api/sms/messages", { cache: "no-store" });
        const d = await r.json();
        if (alive && d?.ok && Array.isArray(d.messages)) {
          [...d.messages].reverse().forEach((m: { sid: string; from: string; body: string; receivedAt: string }) => {
            if (m?.from && m?.body) ingestInbound(m.sid, m.from, m.body, m.receivedAt);
          });
          if (d.statuses) applyStatuses(d.statuses);
        }
      } catch { /* ignore */ }
    }
    tick();
    const iv = setInterval(tick, 8000);
    return () => { alive = false; clearInterval(iv); };
  }, [patient.id, ingestInbound, applyStatuses]);

  const items = useMemo<Item[]>(() => {
    const out: Item[] = [];
    const thread = threads.find((t) => t.patientId === patient.id || t.id === phoneNorm);
    if (thread) thread.messages.forEach((m, i) => out.push({ key: `sms-${thread.id}-${m.id || i}`, channel: "sms", dir: m.direction, text: m.body, ts: Date.parse(m.createdAt) || 0, tlabel: fmt(m.createdAt), status: m.status }));
    if (emailLc) emails.filter((e) => (e.to || "").toLowerCase() === emailLc || (e.fromEmail || "").toLowerCase() === emailLc)
      .forEach((e) => out.push({ key: `em-${e.id}`, channel: "email", dir: e.direction, text: e.preview || "", subject: e.subject, ts: Date.parse(e.createdAt) || 0, tlabel: fmt(e.createdAt), status: e.status }));
    const msgs = records[patient.id]?.messages || [];
    const base = Date.now() - msgs.length * 1000; // chat lacks real timestamps; cluster as most-recent in order
    msgs.forEach((m, i) => out.push({ key: `chat-${m.id || i}`, channel: "chat", dir: m.from === "care" ? "out" : "in", text: m.text, ts: base + i * 1000, tlabel: m.time || "" }));
    return out.sort((a, b) => a.ts - b.ts);
  }, [threads, emails, records, patient.id, phoneNorm, emailLc]);

  useEffect(() => { const el = scrollRef.current; if (el) el.scrollTop = el.scrollHeight; }, [items.length]);

  async function send() {
    const text = body.trim();
    if (!text || busy) return;
    if (ch === "sms" && !patient.phone) { toast("No phone number on file"); return; }
    if (ch === "email" && !patient.email) { toast("No email address on file"); return; }
    setBusy(true);
    try {
      if (ch === "chat") {
        sendChat(patient.id, { from: "care", text, time: timeNow() });
        setBody("");
      } else if (ch === "sms") {
        const r = await sendSms({ to: patient.phone, body: text });
        if (r.ok) { startThread(patient.name, patient.phone, patient.id); addOutgoing(phoneNorm, text, "sent"); setBody(""); }
        else toast("⚠️ " + (r.error || "Couldn't send text"));
      } else {
        const subj = subject.trim() || "Message from your care team";
        const html = `<div style="font-family:Arial,Helvetica,sans-serif;font-size:15px;color:#15181c;line-height:1.6">${esc(text).replace(/\n/g, "<br>")}</div>`;
        const r = await sendEmail({ to: patient.email, toName: patient.name, subject: subj, html });
        if (r.ok) {
          addEmail({ folder: "sent", direction: "out", fromName: "DripVitals Care", fromEmail: "care@dripvitals.com", to: patient.email, toName: patient.name, subject: subj, html, status: "sent", read: true, createdAt: new Date().toISOString() } as Parameters<typeof addEmail>[0]);
          setBody(""); setSubject("");
        } else toast("⚠️ " + (r.error || "Couldn't send email"));
      }
    } finally { setBusy(false); }
  }

  const noChannels = channels.length === 0;

  return (
    <div className="flex flex-col" style={{ height: "calc(100vh - 270px)", minHeight: 420 }}>
      {/* Timeline */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto bg-surface-2 border border-border rounded-xl p-4 space-y-2.5">
        {items.length === 0 ? (
          <div className="h-full flex items-center justify-center text-center text-ink-muted text-[13px]">
            No messages yet. Start the conversation below — by portal message, text, or email.
          </div>
        ) : items.map((m) => (
          <div key={m.key} className={`flex ${m.dir === "out" ? "justify-end" : "justify-start"}`}>
            <div className={`max-w-[76%] rounded-2xl px-3.5 py-2 ${m.dir === "out" ? "bg-brand text-white" : "bg-surface border border-border text-ink"}`}>
              <div className={`flex items-center gap-1.5 text-[10px] font-semibold mb-1 ${m.dir === "out" ? "text-white/80" : "text-ink-muted"}`}>
                <span>{META[m.channel].icon} {META[m.channel].label}</span>
                <span>·</span>
                <span>{m.dir === "out" ? "Sent" : "Received"}</span>
                {m.tlabel && <><span>·</span><span>{m.tlabel}</span></>}
                {m.status && m.dir === "out" && <><span>·</span><span className="capitalize">{m.status}</span></>}
              </div>
              {m.subject && <div className={`text-[12.5px] font-bold mb-0.5 ${m.dir === "out" ? "text-white" : "text-ink"}`}>{m.subject}</div>}
              <div className="text-[13px] whitespace-pre-wrap break-words">{m.text}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Composer */}
      <div className="mt-3 bg-surface border border-border rounded-xl p-3">
        {noChannels ? (
          <div className="text-[13px] text-ink-muted py-2 text-center">Your role doesn’t include permission to message patients.</div>
        ) : (
          <>
            <div className="flex items-center gap-2 mb-2.5">
              {channels.map((c) => (
                <button key={c} onClick={() => setChannel(c)}
                  className={`text-[12.5px] font-semibold px-3.5 py-1.5 rounded-full ${ch === c ? "bg-brand text-white" : "bg-surface-3 text-ink-muted"}`}>
                  {META[c].icon} {META[c].label}
                </button>
              ))}
              <div className="flex-1" />
              <div className="text-[11.5px] text-ink-muted">
                {ch === "chat" ? "→ Patient portal & app"
                  : ch === "sms" ? (patient.phone ? `→ ${patient.phone}` : "No phone on file")
                  : (patient.email ? `→ ${patient.email}` : "No email on file")}
              </div>
            </div>
            {ch === "email" && (
              <input className="fi mb-2" value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="Subject (optional)" />
            )}
            <div className="flex gap-2 items-end">
              <textarea
                className="fta flex-1"
                rows={ch === "email" ? 4 : 2}
                value={body}
                onChange={(e) => setBody(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) { e.preventDefault(); send(); } }}
                placeholder={ch === "chat" ? "Type a secure portal message…" : ch === "sms" ? "Type a text message…" : "Type your email…"}
              />
              <button className="btn btn-primary" onClick={send} disabled={!body.trim() || busy}>
                {busy ? "Sending…" : META[ch].verb}
              </button>
            </div>
            {ch === "sms" && <div className="text-[11px] text-ink-muted mt-1.5">{body.length} characters{body.length > 160 ? ` · ${Math.ceil(body.length / 153)} segments` : ""}</div>}
          </>
        )}
      </div>
    </div>
  );
}
