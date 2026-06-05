"use client";

import { useMemo, useState } from "react";
import { Modal } from "@/components/ui/Modal";
import { toast } from "@/lib/hooks/useToast";
import { usePermission } from "@/lib/rbac/usePermission";
import { sendChat } from "@/lib/chat/client";
import { sendSms } from "@/lib/sms/client";
import { sendEmail } from "@/lib/email/client";
import type { Patient } from "@/lib/types";

type Channel = "chat" | "sms" | "email";
const META: Record<Channel, { label: string; icon: string }> = {
  chat: { label: "Chat", icon: "💬" },
  sms: { label: "SMS", icon: "📲" },
  email: { label: "Email", icon: "✉️" },
};

function esc(s: string) { return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;"); }

export function PatientContactComposer({ patient, open, onClose }: { patient: Patient; open: boolean; onClose: () => void }) {
  const canChat = usePermission("patients.edit");
  const canSms = usePermission("sms.send");
  const canEmail = usePermission("email.send");

  const channels = useMemo(() => {
    const c: Channel[] = [];
    if (canChat) c.push("chat");
    if (canSms) c.push("sms");
    if (canEmail) c.push("email");
    return c;
  }, [canChat, canSms, canEmail]);

  const [channel, setChannel] = useState<Channel>("chat");
  const active: Channel = channels.includes(channel) ? channel : (channels[0] || "chat");

  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [busy, setBusy] = useState(false);

  const phone = patient.phone || "";
  const email = patient.email || "";
  const recipient = active === "sms" ? phone : active === "email" ? email : "";
  const missing = (active === "sms" && !phone) || (active === "email" && !email);

  function reset() { setBody(""); setSubject(""); }
  function close() { reset(); onClose(); }

  async function send() {
    const text = body.trim();
    if (!text || missing || busy) return;
    setBusy(true);
    try {
      if (active === "chat") {
        sendChat(patient.id, { from: "care", text, time: "Just now" });
        toast("💬 Message sent to the patient");
        close();
      } else if (active === "sms") {
        const r = await sendSms({ to: phone, body: text });
        if (r.ok) { toast("📲 Text message sent"); close(); }
        else toast("⚠️ " + (r.error || "Couldn't send SMS"));
      } else {
        const subj = subject.trim() || "A message from your care team";
        const html = `<div style="font-family:Arial,Helvetica,sans-serif;font-size:15px;color:#15181c;line-height:1.6">${esc(text).replace(/\n/g, "<br>")}</div>`;
        const r = await sendEmail({ to: email, toName: patient.name, subject: subj, html });
        if (r.ok) { toast("✉️ Email sent"); close(); }
        else toast("⚠️ " + (r.error || "Couldn't send email"));
      }
    } finally { setBusy(false); }
  }

  const noChannels = channels.length === 0;

  return (
    <Modal open={open} onClose={close} title={`Message ${patient.first}`} icon="✉️" width={520}
      footer={!noChannels && (
        <>
          <button className="btn btn-ghost" onClick={close}>Cancel</button>
          <button className="btn btn-primary" onClick={send} disabled={!body.trim() || missing || busy}>
            {busy ? "Sending…" : `Send ${META[active].label}`}
          </button>
        </>
      )}
    >
      {noChannels ? (
        <div className="text-[13px] text-ink-muted py-4">Your role doesn’t include permission to message patients.</div>
      ) : (
        <>
          {/* Channel switch */}
          <div className="flex gap-2 mb-3">
            {channels.map((c) => (
              <button key={c} onClick={() => setChannel(c)}
                className={`text-[12.5px] font-semibold px-3.5 py-1.5 rounded-full ${active === c ? "bg-brand text-white" : "bg-surface-3 text-ink-muted"}`}>
                {META[c].icon} {META[c].label}
              </button>
            ))}
          </div>

          {/* Recipient */}
          <div className="text-[12px] text-ink-muted mb-2.5">
            {active === "chat"
              ? <>Delivered to <b className="text-ink">{patient.name}</b> in their patient portal &amp; app.</>
              : missing
                ? <span className="text-red">No {active === "sms" ? "phone number" : "email address"} on file for this patient.</span>
                : <>To <b className="text-ink font-mono">{recipient}</b></>}
          </div>

          {active === "email" && (
            <input className="fi mb-2.5" value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="Subject (optional)" />
          )}

          <textarea
            className="fta"
            rows={active === "email" ? 7 : 5}
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder={active === "chat" ? "Type a secure message…" : active === "sms" ? "Type a text message…" : "Type your email…"}
          />
          {active === "sms" && (
            <div className="text-[11px] text-ink-muted mt-1.5">{body.length} characters{body.length > 160 ? ` · ${Math.ceil(body.length / 153)} segments` : ""}</div>
          )}
        </>
      )}
    </Modal>
  );
}
