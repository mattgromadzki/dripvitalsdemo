"use client";

import { useMemo, useState } from "react";
import { Modal } from "@/components/ui/Modal";
import { toast } from "@/lib/hooks/useToast";
import { usePermission } from "@/lib/rbac/usePermission";
import { useTreatmentsIntake } from "@/lib/hooks/useTreatmentsIntake";
import { sendSms } from "@/lib/sms/client";
import { sendEmail } from "@/lib/email/client";
import type { Patient } from "@/lib/types";

function esc(s: string) { return (s || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;"); }
type Channel = "email" | "sms";

export function SendIntakeFormModal({ patient, open, onClose }: { patient: Patient; open: boolean; onClose: () => void }) {
  const forms = useTreatmentsIntake((s) => s.forms);
  const active = useMemo(() => forms.filter((f) => f.active), [forms]);
  const canSms = usePermission("sms.send");
  const canEmail = usePermission("email.send");
  const channels = useMemo<Channel[]>(() => [...(canEmail ? ["email"] as Channel[] : []), ...(canSms ? ["sms"] as Channel[] : [])], [canEmail, canSms]);

  const [channel, setChannel] = useState<Channel>("email");
  const active0 = active[0]?.id;
  const [formId, setFormId] = useState<number | "">(active0 ?? "");
  const [busy, setBusy] = useState(false);

  const ch: Channel = channels.includes(channel) ? channel : (channels[0] || "email");
  const form = active.find((f) => f.id === formId) || active[0];
  const origin = typeof window !== "undefined" ? window.location.origin : "";
  const link = form ? `${origin}/intake-form/${form.slug}?pid=${encodeURIComponent(patient.id)}` : "";

  const phone = patient.phone || "";
  const email = patient.email || "";
  const missing = (ch === "sms" && !phone) || (ch === "email" && !email);

  async function send() {
    if (!form || missing || busy) return;
    setBusy(true);
    try {
      if (ch === "sms") {
        const body = `Hi ${patient.first}, please complete your DripVitals intake form to get started: ${link}`;
        const r = await sendSms({ to: phone, body });
        if (r.ok) { toast("📲 Intake form sent by text"); onClose(); } else toast("⚠️ " + (r.error || "Couldn't send text"));
      } else {
        const subject = "Complete your DripVitals intake form";
        const html =
          `<div style="font-family:Arial,Helvetica,sans-serif;font-size:15px;color:#15181c;line-height:1.6">` +
          `<p>Hi ${esc(patient.first)},</p>` +
          `<p>Please complete your intake form to get started with DripVitals. It only takes a few minutes — you'll choose your treatment and check out at the end.</p>` +
          `<p style="margin:22px 0"><a href="${link}" style="display:inline-block;background:#3b7fc4;color:#ffffff;text-decoration:none;padding:11px 22px;border-radius:8px;font-weight:600">Start your intake form</a></p>` +
          `<p style="font-size:12px;color:#6b7890">Or paste this link into your browser:<br>${esc(link)}</p>` +
          `</div>`;
        const r = await sendEmail({ to: email, toName: patient.name, subject, html });
        if (r.ok) { toast("✉️ Intake form sent by email"); onClose(); } else toast("⚠️ " + (r.error || "Couldn't send email"));
      }
    } finally { setBusy(false); }
  }

  const noChannels = channels.length === 0;

  return (
    <Modal open={open} onClose={onClose} title={`Send intake form to ${patient.first}`} icon="📋" width={540}
      footer={!noChannels && active.length > 0 && (
        <>
          <button className="btn btn-ghost" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" onClick={send} disabled={!form || missing || busy}>
            {busy ? "Sending…" : ch === "sms" ? "Send by text" : "Send by email"}
          </button>
        </>
      )}
    >
      {noChannels ? (
        <div className="text-[13px] text-ink-muted py-4">Your role doesn’t include permission to send messages to patients.</div>
      ) : active.length === 0 ? (
        <div className="text-[13px] text-ink-muted py-4">No active intake forms. Create one under Settings → Treatments first.</div>
      ) : (
        <>
          <label className="fl">Intake form</label>
          <select className="fsel mb-3" value={formId} onChange={(e) => setFormId(e.target.value ? Number(e.target.value) : "")}>
            {active.map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}
          </select>

          <label className="fl">Send via</label>
          <div className="flex gap-2 mb-3">
            {channels.map((c) => (
              <button key={c} onClick={() => setChannel(c)}
                className={`text-[12.5px] font-semibold px-3.5 py-1.5 rounded-full ${ch === c ? "bg-brand text-white" : "bg-surface-3 text-ink-muted"}`}>
                {c === "email" ? "✉️ Email" : "📲 SMS"}
              </button>
            ))}
          </div>

          <div className="text-[12px] text-ink-muted mb-3">
            {missing
              ? <span className="text-red">No {ch === "sms" ? "phone number" : "email address"} on file for this patient.</span>
              : <>To <b className="text-ink font-mono">{ch === "sms" ? phone : email}</b></>}
          </div>

          <div className="bg-surface-2 border border-border rounded-lg p-3 text-[11.5px] text-ink-muted break-all">
            <div className="font-semibold text-ink-2 mb-1">Patient will receive this link:</div>
            {link}
          </div>
          <div className="text-[11.5px] text-ink-muted mt-2">
            The completed form attaches to this patient — no duplicate is created. They’ll choose a treatment and pay at the end.
          </div>
        </>
      )}
    </Modal>
  );
}
