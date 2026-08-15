"use client";

import { useEffect, useMemo, useState } from "react";
import { Modal } from "@/components/ui/Modal";
import { personalize, MERGE_TOKENS } from "@/lib/farming/personalize";
import { FARM_STATUSES } from "@/lib/types/farming";
import type { FarmContact, FarmGroup, FarmChannel, FarmAudience, FarmStatus, AudienceKind } from "@/lib/types/farming";

export interface ComposerSubmit {
  name: string; channel: FarmChannel; subject?: string; body: string;
  audience: FarmAudience; throttlePerMin: number;
  mode: "draft" | "send" | "schedule"; scheduledAt?: string;
}

interface Props {
  open: boolean;
  onClose: () => void;
  groups: FarmGroup[];
  contacts: FarmContact[];
  initialSelectionIds?: string[];   // pre-fill audience = current bulk selection
  onSubmit: (data: ComposerSubmit) => void;
}

// Client mirror of the server audience resolver (for the live recipient count).
function resolveAudience(contacts: FarmContact[], channel: FarmChannel, a: FarmAudience): FarmContact[] {
  let list = contacts;
  if (a.kind === "group") { const g = new Set(a.groupIds || []); list = contacts.filter((c) => c.groupIds.some((x) => g.has(x))); }
  else if (a.kind === "status") { const st = new Set(a.statuses || []); list = contacts.filter((c) => st.has(c.status)); }
  else if (a.kind === "selection") { const ids = new Set(a.contactIds || []); list = contacts.filter((c) => ids.has(c.id)); }
  return list.filter((c) => !c.optedOut && (channel === "email" ? !!c.email : !!c.phone));
}

export function CampaignComposer({ open, onClose, groups, contacts, initialSelectionIds, onSubmit }: Props) {
  const [name, setName] = useState("");
  const [channel, setChannel] = useState<FarmChannel>("email");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [kind, setKind] = useState<AudienceKind>("all");
  const [groupIds, setGroupIds] = useState<string[]>([]);
  const [statuses, setStatuses] = useState<FarmStatus[]>([]);
  const [throttle, setThrottle] = useState(30);
  const [scheduledLocal, setScheduledLocal] = useState("");
  const [err, setErr] = useState("");

  useEffect(() => {
    if (!open) return;
    setErr(""); setName(""); setChannel("email"); setSubject(""); setBody("");
    setThrottle(30); setScheduledLocal("");
    if (initialSelectionIds && initialSelectionIds.length) { setKind("selection"); }
    else { setKind("all"); }
    setGroupIds([]); setStatuses([]);
  }, [open, initialSelectionIds]);

  const audience: FarmAudience = useMemo(() => {
    if (kind === "group") return { kind, groupIds };
    if (kind === "status") return { kind, statuses };
    if (kind === "selection") return { kind, contactIds: initialSelectionIds || [] };
    return { kind: "all" };
  }, [kind, groupIds, statuses, initialSelectionIds]);

  const recipients = useMemo(() => resolveAudience(contacts, channel, audience), [contacts, channel, audience]);
  const preview = useMemo(() => (recipients[0] ? personalize(body, recipients[0]) : personalize(body, { firstName: "Jane", lastName: "Doe", company: "Acme" })), [body, recipients]);

  const toggleGroup = (id: string) => setGroupIds((g) => g.includes(id) ? g.filter((x) => x !== id) : [...g, id]);
  const toggleStatus = (s: FarmStatus) => setStatuses((st) => st.includes(s) ? st.filter((x) => x !== s) : [...st, s]);
  const insertToken = (t: string) => setBody((b) => `${b}{{${t}}}`);

  function submit(mode: ComposerSubmit["mode"]) {
    if (!name.trim()) { setErr("Campaign name is required."); return; }
    if (!body.trim()) { setErr("Message body is required."); return; }
    if (channel === "email" && !subject.trim()) { setErr("Email campaigns need a subject line."); return; }
    if (kind === "group" && !groupIds.length) { setErr("Pick at least one group."); return; }
    if (kind === "status" && !statuses.length) { setErr("Pick at least one status."); return; }
    if (!recipients.length) { setErr("This audience resolves to 0 reachable contacts (after opt-outs and missing " + (channel === "email" ? "emails" : "phones") + ")."); return; }
    let scheduledAt: string | undefined;
    if (mode === "schedule") {
      if (!scheduledLocal) { setErr("Pick a date & time to schedule."); return; }
      const when = new Date(scheduledLocal);
      if (isNaN(when.getTime())) { setErr("Invalid schedule time."); return; }
      scheduledAt = when.toISOString();
    }
    onSubmit({ name: name.trim(), channel, subject: channel === "email" ? subject.trim() : undefined, body: body.trim(), audience, throttlePerMin: throttle, mode, scheduledAt });
    onClose();
  }

  const AudBtn = ({ k, label }: { k: AudienceKind; label: string }) => (
    <button type="button" onClick={() => setKind(k)} disabled={k === "selection" && !(initialSelectionIds && initialSelectionIds.length)}
      className={`text-[12px] font-semibold px-3 py-1.5 rounded-full border transition-colors disabled:opacity-40 ${kind === k ? "bg-brand text-white border-brand" : "bg-surface border-border text-ink-2 hover:border-border-2"}`}>{label}</button>
  );

  return (
    <Modal open={open} onClose={onClose} title="New campaign" icon="📣" width={640}
      footer={<>
        <button className="btn btn-ghost" onClick={onClose}>Cancel</button>
        <button className="btn btn-ghost" onClick={() => submit("draft")}>💾 Save draft</button>
        <button className="btn btn-ghost" onClick={() => submit("schedule")}>🕑 Schedule</button>
        <button className="btn btn-primary" onClick={() => submit("send")}>🚀 Send now</button>
      </>}>
      {err && <div className="mb-3 px-3 py-2.5 rounded-md bg-red-soft text-red text-[12px] font-medium">⚠ {err}</div>}

      <div className="grid grid-cols-2 gap-3 mb-3">
        <div><label className="fl">Campaign name</label><input className="fi" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Med spa intro — August" /></div>
        <div>
          <label className="fl">Channel</label>
          <div className="grid grid-cols-2 gap-2">
            {(["email", "sms"] as FarmChannel[]).map((ch) => (
              <button key={ch} type="button" onClick={() => setChannel(ch)}
                className={`py-2 rounded-md border text-[12.5px] font-semibold transition-colors ${channel === ch ? "bg-brand-soft border-brand text-brand-dk" : "bg-surface border-border text-ink-2 hover:border-border-2"}`}>
                {ch === "email" ? "📧 Email" : "📱 SMS"}
              </button>
            ))}
          </div>
        </div>
      </div>

      <label className="fl">Audience</label>
      <div className="flex flex-wrap gap-1.5 mb-2">
        <AudBtn k="all" label="All contacts" />
        <AudBtn k="group" label="By group" />
        <AudBtn k="status" label="By status" />
        <AudBtn k="selection" label={`Current selection${initialSelectionIds?.length ? ` (${initialSelectionIds.length})` : ""}`} />
      </div>
      {kind === "group" && (
        <div className="flex flex-wrap gap-1.5 mb-2">
          {groups.length === 0 && <span className="text-[12px] text-ink-muted">No groups yet.</span>}
          {groups.map((g) => (
            <button key={g.id} type="button" onClick={() => toggleGroup(g.id)}
              className={`text-[11.5px] font-semibold px-2.5 py-1 rounded-full border ${groupIds.includes(g.id) ? "text-white border-transparent" : "bg-surface border-border text-ink-2"}`}
              style={groupIds.includes(g.id) ? { background: g.color } : undefined}>{g.name}</button>
          ))}
        </div>
      )}
      {kind === "status" && (
        <div className="flex flex-wrap gap-1.5 mb-2">
          {FARM_STATUSES.map((s) => (
            <button key={s.key} type="button" onClick={() => toggleStatus(s.key)}
              className={`text-[11.5px] font-semibold px-2.5 py-1 rounded-full border ${statuses.includes(s.key) ? "bg-brand text-white border-brand" : "bg-surface border-border text-ink-2"}`}>{s.label}</button>
          ))}
        </div>
      )}
      <div className="text-[12px] mb-3"><span className="font-bold text-brand-dk">{recipients.length}</span> <span className="text-ink-muted">reachable {channel === "email" ? "email" : "SMS"} recipient{recipients.length === 1 ? "" : "s"} (opt-outs &amp; missing {channel === "email" ? "emails" : "phones"} excluded)</span></div>

      {channel === "email" && (
        <div className="mb-3"><label className="fl">Subject</label><input className="fi" value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="Partnership idea for {{company}}" /></div>
      )}

      <div className="mb-1 flex items-center justify-between">
        <label className="fl !mb-0">Message</label>
        <div className="flex flex-wrap gap-1">
          {MERGE_TOKENS.map((t) => <button key={t} type="button" onClick={() => insertToken(t)} className="text-[10.5px] font-semibold px-1.5 py-0.5 rounded bg-surface-3 text-ink-2 hover:bg-brand-soft hover:text-brand-dk">{`{{${t}}}`}</button>)}
        </div>
      </div>
      <textarea className="fi min-h-[120px] resize-y" value={body} onChange={(e) => setBody(e.target.value)} placeholder={channel === "email" ? "Hi {{firstName}},\n\n…" : "Hi {{firstName}}, …"} />

      {body.trim() && (
        <div className="mt-2 p-3 rounded-md bg-surface-2 border border-border">
          <div className="text-[10px] font-bold uppercase tracking-widest text-ink-muted mb-1">Preview {recipients[0] ? `· ${[recipients[0].firstName, recipients[0].lastName].filter(Boolean).join(" ")}` : "· sample"}</div>
          <div className="text-[12.5px] whitespace-pre-wrap text-ink-2">{preview}</div>
          {channel === "sms" && <div className="text-[10.5px] text-ink-muted mt-1.5">+ "Txt STOP to opt out" appended automatically</div>}
          {channel === "email" && <div className="text-[10.5px] text-ink-muted mt-1.5">+ an unsubscribe link is appended to every email</div>}
        </div>
      )}

      <div className="grid grid-cols-2 gap-3 mt-3">
        <div><label className="fl">Throttle (sends/min)</label><input className="fi" type="number" min={1} max={60} value={throttle} onChange={(e) => setThrottle(Math.max(1, Math.min(60, parseInt(e.target.value, 10) || 1)))} /></div>
        <div><label className="fl">Schedule for (optional)</label><input className="fi" type="datetime-local" value={scheduledLocal} onChange={(e) => setScheduledLocal(e.target.value)} /></div>
      </div>
      <div className="text-[11px] text-ink-muted mt-1.5">Use <b>Send now</b> to start immediately, <b>Schedule</b> with a date/time above, or <b>Save draft</b> to finish later. Large lists send in throttled batches server-side.</div>
    </Modal>
  );
}
