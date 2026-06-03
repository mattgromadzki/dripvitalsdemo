"use client";

import { useMemo, useState } from "react";
import { Pill } from "@/components/ui/Pill";
import { Modal } from "@/components/ui/Modal";
import { Toast } from "@/components/ui/Toast";
import { toast } from "@/lib/hooks/useToast";
import { usePatients } from "@/lib/hooks/usePatients";
import { useLeads } from "@/lib/hooks/useLeads";
import { useAutomations } from "@/lib/hooks/useAutomations";
import { TRIGGERS, triggerLabel, delayLabel, personalize, type Automation, type Step, type RunEvent, type TriggerId, type Channel } from "@/lib/automations/types";
import { sendEmail } from "@/lib/email/client";
import { sendSms } from "@/lib/sms/client";

const fmt = (iso: string) => new Date(iso).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
const blankStep = (): Step => ({ id: "s" + Math.random().toString(36).slice(2, 7), delayDays: 0, channel: "email", subject: "", body: "" });

export default function AutomationsPage() {
  const patients = usePatients((s) => s.patients);
  const leads = useLeads((s) => s.leads);
  const automations = useAutomations((s) => s.automations);
  const enrollments = useAutomations((s) => s.enrollments);
  const toggle = useAutomations((s) => s.toggle);
  const upsert = useAutomations((s) => s.upsert);
  const remove = useAutomations((s) => s.remove);
  const newId = useAutomations((s) => s.newId);
  const addEnrollment = useAutomations((s) => s.addEnrollment);

  const [tab, setTab] = useState<"automations" | "activity">("automations");
  const [editor, setEditor] = useState<Automation | null>(null);
  const [runFor, setRunFor] = useState<Automation | null>(null);
  const [runType, setRunType] = useState<"patient" | "lead">("patient");
  const [runId, setRunId] = useState("");
  const [running, setRunning] = useState(false);

  const stats = useMemo(() => {
    let sent = 0, scheduled = 0;
    enrollments.forEach((e) => e.events.forEach((ev) => { if (ev.status === "sent") sent++; if (ev.status === "scheduled") scheduled++; }));
    return { active: automations.filter((a) => a.enabled).length, enrolled: enrollments.length, sent, scheduled };
  }, [automations, enrollments]);

  function openNew() { setEditor({ id: newId(), name: "", trigger: "patient_created", enabled: true, steps: [blankStep()], createdAt: new Date().toISOString() }); }
  function saveEditor() { if (!editor) return; if (!editor.name.trim()) { toast("Name required"); return; } if (editor.steps.length === 0) { toast("Add at least one step"); return; } upsert(editor); setEditor(null); toast("Automation saved"); }

  async function runTest() {
    if (!runFor) return;
    const p = runType === "patient" ? patients.find((x) => x.id === runId) : null;
    const l = runType === "lead" ? leads.find((x) => x.id === runId) : null;
    if (!p && !l) { toast("Choose a recipient"); return; }
    const name = p?.name || l?.name || "Recipient";
    const vars = { firstName: p?.first || name.split(" ")[0], clinic: "DripVitals", med: p?.plan || "your treatment" } as Record<string, string>;
    const email = p?.email || l?.email; const phone = p?.phone || l?.phone;
    setRunning(true);
    const events: RunEvent[] = [];
    for (const step of runFor.steps) {
      const at = new Date(); at.setDate(at.getDate() + step.delayDays);
      const detail = step.channel === "email" ? personalize(step.subject || "(no subject)", vars) : personalize(step.body, vars).slice(0, 60);
      if (step.delayDays === 0) {
        if (step.channel === "email") {
          if (!email) { events.push({ stepId: step.id, channel: "email", when: "Immediately", status: "skipped", at: at.toISOString(), detail: "No email on file" }); continue; }
          const res = await sendEmail({ to: email, subject: personalize(step.subject || "", vars), html: personalize(step.body, vars).split("\n").map((l) => l || "&nbsp;").join("<br>") });
          events.push({ stepId: step.id, channel: "email", when: "Immediately", status: res.ok ? "sent" : "failed", at: at.toISOString(), detail });
        } else {
          if (!phone) { events.push({ stepId: step.id, channel: "sms", when: "Immediately", status: "skipped", at: at.toISOString(), detail: "No phone on file" }); continue; }
          const res = await sendSms({ to: phone, body: personalize(step.body, vars) });
          events.push({ stepId: step.id, channel: "sms", when: "Immediately", status: res.ok ? "sent" : "failed", at: at.toISOString(), detail });
        }
      } else {
        events.push({ stepId: step.id, channel: step.channel, when: delayLabel(step.delayDays), status: "scheduled", at: at.toISOString(), detail });
      }
    }
    addEnrollment({ automationId: runFor.id, automationName: runFor.name, recipientName: name, startedAt: new Date().toISOString(), events });
    setRunning(false); setRunFor(null); setRunId(""); setTab("activity");
    toast(`Enrolled ${name} in “${runFor.name}”`);
  }

  const KPI = ({ label, value }: { label: string; value: string }) => <div className="bg-surface border border-border rounded-2xl px-4 py-3 min-w-[130px]"><div className="text-[22px] font-extrabold leading-none">{value}</div><div className="text-[11px] text-ink-muted mt-1.5">{label}</div></div>;
  const chIcon = (c: Channel) => (c === "email" ? "✉️" : "📲");

  return (
    <div className="px-7 py-6 text-[14px]">
      <div className="flex items-center gap-3 mb-4 flex-wrap">
        <div><h1 className="text-[21px] font-extrabold tracking-tight">Automations</h1><div className="text-[12px] text-ink-muted mt-0.5">Event-triggered Email + SMS journeys</div></div>
        <div className="flex gap-2"><button onClick={() => setTab("automations")} className={`text-[12.5px] font-semibold px-3.5 py-1.5 rounded-full ${tab === "automations" ? "bg-brand text-white" : "bg-surface-3 text-ink-muted"}`}>Automations</button><button onClick={() => setTab("activity")} className={`text-[12.5px] font-semibold px-3.5 py-1.5 rounded-full ${tab === "activity" ? "bg-brand text-white" : "bg-surface-3 text-ink-muted"}`}>Activity</button></div>
        <div className="flex-1" /><button className="btn btn-primary btn-sm" onClick={openNew}>＋ New automation</button>
      </div>

      <div className="flex flex-wrap gap-2.5 mb-4"><KPI label="Active automations" value={String(stats.active)} /><KPI label="Enrollments" value={String(stats.enrolled)} /><KPI label="Messages sent" value={String(stats.sent)} /><KPI label="Scheduled" value={String(stats.scheduled)} /></div>

      {tab === "automations" ? (
        <div className="grid grid-cols-2 gap-3">
          {automations.map((a) => (
            <div key={a.id} className="bg-surface border border-border rounded-xl p-4">
              <div className="flex items-center gap-2 mb-1.5">
                <span className="font-bold text-[14px]">{a.name}</span>
                <div className="flex-1" />
                <label className="flex items-center gap-1.5 text-[11px] cursor-pointer"><input type="checkbox" checked={a.enabled} onChange={() => toggle(a.id)} />{a.enabled ? <span className="text-green font-semibold">On</span> : <span className="text-ink-muted">Off</span>}</label>
              </div>
              <div className="mb-2"><Pill intent="purple" dot>⚡ {triggerLabel(a.trigger)}</Pill></div>
              <div className="space-y-1 mb-3">
                {a.steps.map((st, i) => <div key={st.id} className="flex items-center gap-2 text-[12px] text-ink-2"><span className="text-ink-muted w-4">{i + 1}.</span><span>{chIcon(st.channel)}</span><span className="text-ink-muted">{delayLabel(st.delayDays)} ·</span><span className="truncate">{st.channel === "email" ? st.subject : st.body}</span></div>)}
              </div>
              <div className="flex gap-2"><button className="btn btn-ghost btn-sm" onClick={() => setEditor(a)}>Edit</button><button className="btn btn-ghost btn-sm" onClick={() => { setRunFor(a); setRunType("patient"); setRunId(""); }}>▶ Run test</button><div className="flex-1" /><button className="btn btn-ghost btn-sm text-red" onClick={() => { remove(a.id); toast("Deleted"); }}>Delete</button></div>
            </div>
          ))}
        </div>
      ) : (
        <div className="bg-surface border border-border rounded-xl overflow-hidden">
          {enrollments.length === 0 ? <div className="px-4 py-12 text-center text-ink-muted text-[12px]">No activity yet. Run a test on an automation to enroll someone.</div> : enrollments.map((e) => (
            <div key={e.id} className="px-4 py-3 border-b border-border last:border-none">
              <div className="flex items-center gap-2 mb-1.5"><span className="font-semibold text-[13px]">{e.recipientName}</span><span className="text-ink-muted text-[12px]">· {e.automationName}</span><div className="flex-1" /><span className="text-[11px] text-ink-muted">{fmt(e.startedAt)}</span></div>
              <div className="space-y-1">
                {e.events.map((ev, i) => (
                  <div key={i} className="flex items-center gap-2 text-[12px]">
                    <span>{chIcon(ev.channel)}</span>
                    <span className="text-ink-muted w-[90px]">{ev.when}</span>
                    <Pill intent={ev.status === "sent" ? "green" : ev.status === "scheduled" ? "blue" : ev.status === "failed" ? "red" : "muted"}>{ev.status}</Pill>
                    <span className="truncate text-ink-2">{ev.detail}</span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Builder */}
      {editor && (
        <Modal open={!!editor} onClose={() => setEditor(null)} title={editor.name ? "Edit automation" : "New automation"} icon="⚡" width={640}
          footer={<><button className="btn btn-ghost" onClick={() => setEditor(null)}>Cancel</button><button className="btn btn-primary" onClick={saveEditor}>Save automation</button></>}>
          <div className="grid grid-cols-2 gap-3 mb-3">
            <div><label className="fl">Name</label><input className="fi" value={editor.name} onChange={(e) => setEditor({ ...editor, name: e.target.value })} placeholder="e.g. Welcome series" /></div>
            <div><label className="fl">Trigger</label><select className="fsel w-full" value={editor.trigger} onChange={(e) => setEditor({ ...editor, trigger: e.target.value as TriggerId })}>{TRIGGERS.map((t) => <option key={t.id} value={t.id}>{t.label}</option>)}</select></div>
          </div>
          <label className="flex items-center gap-2 text-[12.5px] mb-3 cursor-pointer"><input type="checkbox" checked={editor.enabled} onChange={(e) => setEditor({ ...editor, enabled: e.target.checked })} /> Enabled</label>
          <div className="text-[10px] uppercase tracking-wide text-ink-muted font-bold mb-1.5">Steps</div>
          {editor.steps.map((st, i) => (
            <div key={st.id} className="border border-border rounded-lg p-2.5 mb-2">
              <div className="flex items-center gap-2 mb-1.5">
                <span className="text-[12px] font-bold">Step {i + 1}</span>
                <select className="fsel" value={st.channel} onChange={(e) => setEditor({ ...editor, steps: editor.steps.map((x) => x.id === st.id ? { ...x, channel: e.target.value as Channel } : x) })}><option value="email">Email</option><option value="sms">SMS</option></select>
                <span className="text-[11px] text-ink-muted">Delay</span>
                <input type="number" min={0} className="fi w-16 py-1" value={st.delayDays} onChange={(e) => setEditor({ ...editor, steps: editor.steps.map((x) => x.id === st.id ? { ...x, delayDays: Math.max(0, parseInt(e.target.value) || 0) } : x) })} />
                <span className="text-[11px] text-ink-muted">days</span>
                <div className="flex-1" /><button className="text-ink-muted-2 hover:text-red text-[12px]" onClick={() => setEditor({ ...editor, steps: editor.steps.filter((x) => x.id !== st.id) })}>✕</button>
              </div>
              {st.channel === "email" && <input className="fi mb-1.5" value={st.subject || ""} onChange={(e) => setEditor({ ...editor, steps: editor.steps.map((x) => x.id === st.id ? { ...x, subject: e.target.value } : x) })} placeholder="Subject" />}
              <textarea className="fi min-h-[60px] resize-y" value={st.body} onChange={(e) => setEditor({ ...editor, steps: editor.steps.map((x) => x.id === st.id ? { ...x, body: e.target.value } : x) })} placeholder="Message — use {{firstName}}, {{clinic}}" />
            </div>
          ))}
          <button className="btn btn-ghost btn-sm" onClick={() => setEditor({ ...editor, steps: [...editor.steps, blankStep()] })}>＋ Add step</button>
        </Modal>
      )}

      {/* Run test */}
      {runFor && (
        <Modal open={!!runFor} onClose={() => setRunFor(null)} title={`Run test — ${runFor.name}`} icon="▶" width={440}
          footer={<><button className="btn btn-ghost" onClick={() => setRunFor(null)}>Cancel</button><button className="btn btn-primary" onClick={runTest} disabled={running}>{running ? "Running…" : "Enroll & run"}</button></>}>
          <div className="text-[12px] text-ink-muted mb-3">Immediate steps send now (via your Email/SMS providers); later steps are scheduled.</div>
          <div className="flex gap-2 mb-2.5">
            <button onClick={() => { setRunType("patient"); setRunId(""); }} className={`text-[12px] font-semibold px-3 py-1.5 rounded-full ${runType === "patient" ? "bg-brand text-white" : "bg-surface-3 text-ink-muted"}`}>Patient</button>
            <button onClick={() => { setRunType("lead"); setRunId(""); }} className={`text-[12px] font-semibold px-3 py-1.5 rounded-full ${runType === "lead" ? "bg-brand text-white" : "bg-surface-3 text-ink-muted"}`}>Lead</button>
          </div>
          <select className="fsel w-full" value={runId} onChange={(e) => setRunId(e.target.value)}>
            <option value="">— choose —</option>
            {(runType === "patient" ? patients.map((p) => ({ id: p.id, name: p.name })) : leads.map((l) => ({ id: l.id, name: l.name }))).map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
          </select>
        </Modal>
      )}
      <Toast />
    </div>
  );
}
