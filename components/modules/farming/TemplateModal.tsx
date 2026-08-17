"use client";

import { useEffect, useMemo, useState } from "react";
import { Modal } from "@/components/ui/Modal";
import { personalize, MERGE_TOKENS } from "@/lib/farming/personalize";
import type { FarmChannel, FarmTemplate } from "@/lib/types/farming";

interface Props {
  open: boolean;
  onClose: () => void;
  template?: FarmTemplate | null;      // null → add mode
  onSave: (t: FarmTemplate) => void;
  onDelete?: (id: string) => void;
}

const BLANK = { name: "", channel: "email" as FarmChannel, subject: "", body: "" };

export function TemplateModal({ open, onClose, template, onSave, onDelete }: Props) {
  const [f, setF] = useState(BLANK);
  const [err, setErr] = useState("");

  useEffect(() => {
    if (!open) return;
    setErr("");
    setF(template
      ? { name: template.name, channel: template.channel, subject: template.subject || "", body: template.body }
      : BLANK);
  }, [open, template]);

  const set = <K extends keyof typeof f>(k: K, v: (typeof f)[K]) => setF((s) => ({ ...s, [k]: v }));
  const insertToken = (t: string) => setF((s) => ({ ...s, body: `${s.body}{{${t}}}` }));
  const preview = useMemo(() => personalize(f.body, { firstName: "Jane", lastName: "Doe", company: "Acme", email: "jane@acme.com", phone: "+1 (305) 555-0100" }), [f.body]);

  function save() {
    if (!f.name.trim()) { setErr("Template name is required."); return; }
    if (!f.body.trim()) { setErr("Message body is required."); return; }
    if (f.channel === "email" && !f.subject.trim()) { setErr("Email templates need a subject."); return; }
    onSave({
      id: template?.id || "FTPL-" + Date.now().toString(36),
      name: f.name.trim(),
      channel: f.channel,
      subject: f.channel === "email" ? f.subject.trim() : undefined,
      body: f.body,
      createdAt: template?.createdAt || new Date().toISOString(),
    });
    onClose();
  }

  return (
    <Modal open={open} onClose={onClose} title={template ? "Edit template" : "New template"} icon="📝" width={640}
      footer={<>
        {template && onDelete && <button className="btn btn-ghost text-red" onClick={() => { onDelete(template.id); onClose(); }}>Delete</button>}
        <div className="flex-1" />
        <button className="btn btn-ghost" onClick={onClose}>Cancel</button>
        <button className="btn btn-primary" onClick={save}>{template ? "Save changes" : "Create template"}</button>
      </>}>
      {err && <div className="mb-3 px-3 py-2.5 rounded-md bg-red-soft text-red text-[12px] font-medium">⚠ {err}</div>}

      <div className="grid grid-cols-2 gap-3 mb-3">
        <div><label className="fl">Template name</label><input className="fi" value={f.name} onChange={(e) => set("name", e.target.value)} placeholder="e.g. GLP-1 Weight Loss" /></div>
        <div>
          <label className="fl">Channel</label>
          <div className="grid grid-cols-2 gap-2">
            {(["email", "sms"] as FarmChannel[]).map((ch) => (
              <button key={ch} type="button" onClick={() => set("channel", ch)}
                className={`py-2 rounded-md border text-[12.5px] font-semibold transition-colors ${f.channel === ch ? "bg-brand-soft border-brand text-brand-dk" : "bg-surface border-border text-ink-2 hover:border-border-2"}`}>
                {ch === "email" ? "📧 Email" : "📱 SMS"}
              </button>
            ))}
          </div>
        </div>
      </div>

      {f.channel === "email" && (
        <div className="mb-3"><label className="fl">Subject</label><input className="fi" value={f.subject} onChange={(e) => set("subject", e.target.value)} placeholder="Partnership idea for {{company}}" /></div>
      )}

      <div className="mb-1 flex items-center justify-between">
        <label className="fl !mb-0">Message {f.channel === "email" ? "(HTML)" : ""}</label>
        <div className="flex flex-wrap gap-1">
          {MERGE_TOKENS.map((t) => <button key={t} type="button" onClick={() => insertToken(t)} className="text-[10.5px] font-semibold px-1.5 py-0.5 rounded bg-surface-3 text-ink-2 hover:bg-brand-soft hover:text-brand-dk">{`{{${t}}}`}</button>)}
        </div>
      </div>
      <textarea className="fi min-h-[160px] resize-y font-mono text-[11.5px]" value={f.body} onChange={(e) => set("body", e.target.value)} placeholder={f.channel === "email" ? "<div>Hi {{firstName}}, …</div>" : "Hi {{firstName}}, …"} />

      {f.body.trim() && (
        <div className="mt-2 p-3 rounded-md bg-surface-2 border border-border">
          <div className="text-[10px] font-bold uppercase tracking-widest text-ink-muted mb-1">Preview · sample contact</div>
          {f.channel === "email" && /<[a-z][\s\S]*>/i.test(f.body)
            ? <div className="bg-white rounded-md border border-border max-h-[360px] overflow-auto" dangerouslySetInnerHTML={{ __html: preview }} />
            : <div className="text-[12.5px] whitespace-pre-wrap text-ink-2">{preview}</div>}
        </div>
      )}
    </Modal>
  );
}
