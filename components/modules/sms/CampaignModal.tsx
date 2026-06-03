"use client";

import { useEffect, useState } from "react";
import { Modal } from "@/components/ui/Modal";
import { sendSms } from "@/lib/sms/client";
import { useSms } from "@/lib/hooks/useSms";

export interface Recipient { name: string; phone: string; firstName: string; patientId?: string }

const CAMPAIGN_TEMPLATES: { name: string; body: string }[] = [
  { name: "Patient offer", body: "Hi {{firstName}}! For a limited time, {{clinic}} is offering 20% off your next 3 months of treatment. Reply YES to claim." },
  { name: "Cold lead intro", body: "Hi {{firstName}}, this is {{clinic}} — medically-supervised GLP-1 weight loss from home, no clinic visits. Want to learn more? Reply YES." },
  { name: "Re-engage", body: "Hi {{firstName}}, we'd love to welcome you back to {{clinic}}. Reply YES for a special returning-patient offer." },
];

function personalize(body: string, r: Recipient): string {
  return body.replace(/\{\{(\w+)\}\}/g, (_, k) => (k === "firstName" ? r.firstName : k === "clinic" ? "DripVitals" : k === "med" ? "your treatment" : ""));
}

export function CampaignModal({ open, onClose, recipients, audienceLabel, onSent }: {
  open: boolean; onClose: () => void; recipients: Recipient[]; audienceLabel: string;
  onSent: (c: { name: string; audience: string; body: string; total: number; sent: number; failed: number }) => void;
}) {
  const startThread = useSms((s) => s.startThread);
  const addOutgoing = useSms((s) => s.addOutgoing);
  const [name, setName] = useState("");
  const [body, setBody] = useState("");
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState(0);
  const [result, setResult] = useState<{ sent: number; failed: number } | null>(null);

  useEffect(() => {
    if (open) { setName(`${audienceLabel} — ${new Date().toLocaleDateString("en-US", { month: "short", day: "numeric" })}`); setBody(""); setBusy(false); setProgress(0); setResult(null); }
  }, [open, audienceLabel]);

  const len = body.length, segs = Math.max(1, Math.ceil(len / 160));

  async function send() {
    if (!body.trim() || recipients.length === 0) return;
    setBusy(true); setProgress(0);
    let sent = 0, failed = 0;
    for (let i = 0; i < recipients.length; i++) {
      const r = recipients[i];
      const text = personalize(body, r);
      const res = await sendSms({ to: r.phone, body: text });
      if (res.ok) sent++; else failed++;
      const tid = startThread(r.name, r.phone, r.patientId);
      addOutgoing(tid, text, res.ok ? "sent" : "failed", res.id);
      setProgress(i + 1);
    }
    setBusy(false); setResult({ sent, failed });
    onSent({ name: name.trim() || audienceLabel, audience: audienceLabel, body, total: recipients.length, sent, failed });
  }

  const preview = recipients.slice(0, 6);

  return (
    <Modal open={open} onClose={onClose} title="New SMS Campaign" icon="📣" width={580}
      footer={result
        ? <button className="btn btn-primary" onClick={onClose}>Done</button>
        : <><button className="btn btn-ghost" onClick={onClose}>Cancel</button><button className="btn btn-primary" onClick={send} disabled={busy || recipients.length === 0 || !body.trim()}>{busy ? `Sending ${progress}/${recipients.length}…` : `Send to ${recipients.length}`}</button></>}>
      {result ? (
        <div className="text-center py-4">
          <div className="text-[40px] mb-2">✅</div>
          <div className="text-[16px] font-extrabold">Campaign sent</div>
          <div className="text-[13px] text-ink-2 mt-1">{result.sent} delivered{result.failed ? ` · ${result.failed} failed` : ""} · audience: {audienceLabel}</div>
        </div>
      ) : (
        <>
          <div className="mb-3 px-3 py-2 rounded-md bg-blue-soft text-blue text-[12px] font-medium">
            Audience: <b>{audienceLabel}</b> · {recipients.length} recipient{recipients.length === 1 ? "" : "s"}
          </div>
          <label className="fl">Campaign name</label>
          <input className="fi mb-2.5" value={name} onChange={(e) => setName(e.target.value)} />
          <label className="fl">Templates</label>
          <div className="flex flex-wrap gap-1.5 mb-2.5">
            {CAMPAIGN_TEMPLATES.map((t) => <button key={t.name} className="text-[11px] font-semibold bg-surface-3 text-ink-2 rounded-full px-2.5 py-1 hover:bg-brand-soft" onClick={() => setBody(t.body)}>{t.name}</button>)}
          </div>
          <label className="fl">Message</label>
          <textarea className="fi min-h-[120px] resize-y" value={body} onChange={(e) => setBody(e.target.value)} placeholder="Use {{firstName}} for personalization…" />
          <div className="text-[10.5px] text-ink-muted-2 mt-1 mb-2">{len} chars · {segs} segment{segs > 1 ? "s" : ""} · {`{{firstName}}`} and {`{{clinic}}`} are personalized per recipient.</div>
          {recipients.length > 0 && (
            <div className="text-[11.5px] text-ink-muted">
              <span className="font-semibold text-ink-2">Recipients:</span> {preview.map((r) => r.name).join(", ")}{recipients.length > preview.length ? ` +${recipients.length - preview.length} more` : ""}
            </div>
          )}
        </>
      )}
    </Modal>
  );
}
