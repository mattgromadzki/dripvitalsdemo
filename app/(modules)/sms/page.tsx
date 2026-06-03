"use client";

import { useMemo, useState } from "react";
import { Modal } from "@/components/ui/Modal";
import { Pill } from "@/components/ui/Pill";
import { Toast } from "@/components/ui/Toast";
import { toast } from "@/lib/hooks/useToast";
import { usePatients } from "@/lib/hooks/usePatients";
import { useSms } from "@/lib/hooks/useSms";
import { useLeads } from "@/lib/hooks/useLeads";
import { useCampaigns } from "@/lib/hooks/useCampaigns";
import { sendSms } from "@/lib/sms/client";
import { SMS_TEMPLATES, applySmsTemplate } from "@/lib/sms/templates";
import { CampaignModal, type Recipient } from "@/components/modules/sms/CampaignModal";
import { ImportLeadsModal } from "@/components/modules/sms/ImportLeadsModal";

const AV = ["#2f6df6", "#0e9f6e", "#7c3aed", "#f59e0b", "#ef4444", "#0ea5e9", "#db2777", "#14b8a6"];
function avatar(name: string) { let h = 0; for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) >>> 0; return { initial: (name.trim()[0] || "?").toUpperCase(), color: AV[h % AV.length] }; }
const time = (iso: string) => new Date(iso).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
const day = (iso: string) => { const d = new Date(iso), t = new Date(); return d.toDateString() === t.toDateString() ? "Today" : d.toLocaleDateString("en-US", { month: "short", day: "numeric" }); };
const tick = (s: string) => (s === "delivered" ? "✓✓" : s === "failed" ? "✕" : "✓");
type Tab = "conversations" | "contacts" | "campaigns";

export default function SmsPage() {
  const patients = usePatients((s) => s.patients);
  const threads = useSms((s) => s.threads);
  const startThread = useSms((s) => s.startThread);
  const addOutgoing = useSms((s) => s.addOutgoing);
  const markRead = useSms((s) => s.markRead);
  const leads = useLeads((s) => s.leads);
  const addLead = useLeads((s) => s.add);
  const removeLead = useLeads((s) => s.remove);
  const campaigns = useCampaigns((s) => s.campaigns);
  const addCampaign = useCampaigns((s) => s.add);

  const [tab, setTab] = useState<Tab>("conversations");

  // conversation state
  const [selId, setSelId] = useState<string | null>(threads[0]?.id ?? null);
  const [search, setSearch] = useState("");
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);

  // contacts/campaign state
  const [selPat, setSelPat] = useState<Set<string>>(new Set());
  const [selLead, setSelLead] = useState<Set<string>>(new Set());
  const [addOpen, setAddOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [lName, setLName] = useState(""); const [lPhone, setLPhone] = useState(""); const [lEmail, setLEmail] = useState(""); const [lTag, setLTag] = useState("Cold");
  const [campaign, setCampaign] = useState<{ recipients: Recipient[]; label: string } | null>(null);
  const [newMsgOpen, setNewMsgOpen] = useState(false);
  const [npPatient, setNpPatient] = useState(""); const [npPhone, setNpPhone] = useState(""); const [npName, setNpName] = useState("");

  const sel = selId ? threads.find((t) => t.id === selId) || null : null;
  const list = useMemo(() => threads.filter((t) => !search || t.name.toLowerCase().includes(search.toLowerCase()) || t.phone.includes(search)), [threads, search]);

  function open(id: string) { setSelId(id); markRead(id); }
  function varsFor(): Record<string, string> { const p = patients.find((x) => x.id === sel?.patientId); return { firstName: p?.first || sel?.name.split(" ")[0] || "there", med: p?.plan || "your medication", nextRefill: p?.nextRefill || "your next refill", clinic: "DripVitals" }; }
  async function send() {
    if (!sel || !draft.trim()) return;
    setSending(true); const text = draft.trim();
    const res = await sendSms({ to: sel.phone, body: text });
    addOutgoing(sel.id, text, res.ok ? "sent" : "failed", res.id);
    setSending(false); setDraft("");
    if (!res.ok) toast(res.error || "Failed to send");
  }
  function createThread() {
    const p = patients.find((x) => x.id === npPatient);
    const phone = (p?.phone || npPhone).trim(); const name = p?.name || npName || phone;
    if (!phone) { toast("Enter a phone number"); return; }
    const id = startThread(name, phone, p?.id);
    setNewMsgOpen(false); setNpPatient(""); setNpPhone(""); setNpName(""); setTab("conversations"); setSelId(id);
  }

  const patientRecips = (ids?: Set<string>): Recipient[] => patients.filter((p) => !ids || ids.has(p.id)).map((p) => ({ name: p.name, phone: p.phone, firstName: p.first, patientId: p.id }));
  const leadRecips = (ids?: Set<string>): Recipient[] => leads.filter((l) => !ids || ids.has(l.id)).map((l) => ({ name: l.name, phone: l.phone, firstName: l.name.split(" ")[0] }));
  function toggle(set: Set<string>, id: string, setter: (s: Set<string>) => void) { const n = new Set(set); n.has(id) ? n.delete(id) : n.add(id); setter(n); }
  const allPatSel = patients.length > 0 && selPat.size === patients.length;
  const allLeadSel = leads.length > 0 && selLead.size === leads.length;
  const selectedCount = selPat.size + selLead.size;

  function launchSelected() {
    const recipients = [...patientRecips(selPat), ...leadRecips(selLead)];
    if (recipients.length === 0) { toast("Select at least one contact"); return; }
    const label = `${selPat.size ? `${selPat.size} patient${selPat.size > 1 ? "s" : ""}` : ""}${selPat.size && selLead.size ? " + " : ""}${selLead.size ? `${selLead.size} lead${selLead.size > 1 ? "s" : ""}` : ""}`;
    setCampaign({ recipients, label });
  }
  function saveLead() { if (!lName.trim() || !lPhone.trim()) { toast("Name and phone required"); return; } addLead({ name: lName.trim(), phone: lPhone.trim(), email: lEmail.trim() || undefined, tag: lTag }); setAddOpen(false); setLName(""); setLPhone(""); setLEmail(""); setLTag("Cold"); toast("Lead added"); }

  const len = draft.length, segs = Math.max(1, Math.ceil(len / 160));
  const TabBtn = ({ t, label }: { t: Tab; label: string }) => <button onClick={() => setTab(t)} className={`text-[12.5px] font-semibold px-3.5 py-1.5 rounded-full ${tab === t ? "bg-brand text-white" : "bg-surface-3 text-ink-muted"}`}>{label}</button>;
  const Row = ({ checked, onToggle, name, sub, right }: { checked: boolean; onToggle: () => void; name: string; sub: string; right?: React.ReactNode }) => {
    const av = avatar(name);
    return (
      <div className="flex items-center gap-2.5 px-3 py-2 border-b border-border hover:bg-surface-2">
        <input type="checkbox" checked={checked} onChange={onToggle} />
        <div className="w-7 h-7 rounded-full flex items-center justify-center text-white text-[11px] font-bold shrink-0" style={{ background: av.color }}>{av.initial}</div>
        <div className="flex-1 min-w-0"><div className="text-[13px] font-semibold truncate">{name}</div><div className="text-[11px] text-ink-muted truncate">{sub}</div></div>
        {right}
      </div>
    );
  };

  return (
    <div className="px-5 py-4 text-[14px]">
      <div className="flex items-center gap-3 mb-3 flex-wrap">
        <h1 className="text-[20px] font-extrabold tracking-tight">SMS</h1>
        <div className="flex gap-2"><TabBtn t="conversations" label="Conversations" /><TabBtn t="contacts" label="Contacts" /><TabBtn t="campaigns" label="Campaigns" /></div>
        <div className="flex-1" />
        {tab === "conversations" && <button className="btn btn-primary btn-sm" onClick={() => setNewMsgOpen(true)}>✏️ New message</button>}
        {tab === "contacts" && <><button className="btn btn-ghost btn-sm" onClick={() => setImportOpen(true)}>📥 Import CSV/XML</button><button className="btn btn-primary btn-sm" onClick={() => setAddOpen(true)}>＋ Add lead</button></>}
      </div>

      {tab === "conversations" && (
        <div className="flex border border-border rounded-xl overflow-hidden bg-surface" style={{ height: "calc(100vh - 132px)", minHeight: 520 }}>
          <div className="w-[320px] shrink-0 border-r border-border flex flex-col">
            <div className="p-2 border-b border-border"><div className="flex items-center gap-2 bg-surface-2 border border-border rounded-lg px-2.5 py-1.5"><span className="text-ink-muted text-[13px]">🔍</span><input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search conversations" className="bg-transparent outline-none text-[12.5px] w-full" /></div></div>
            <div className="flex-1 overflow-y-auto">
              {list.map((t) => { const av = avatar(t.name); const last = t.messages[t.messages.length - 1]; return (
                <div key={t.id} onClick={() => open(t.id)} className={`px-3 py-2.5 border-b border-border cursor-pointer hover:bg-surface-2 ${selId === t.id ? "bg-brand-soft/60" : ""}`}>
                  <div className="flex gap-2.5">
                    <div className="w-9 h-9 rounded-full flex items-center justify-center text-white text-[13px] font-bold shrink-0" style={{ background: av.color }}>{av.initial}</div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2"><span className={`flex-1 truncate text-[13px] ${t.unread ? "font-extrabold" : "font-semibold"}`}>{t.name}</span>{last && <span className="text-[10.5px] text-ink-muted whitespace-nowrap">{day(last.createdAt)}</span>}</div>
                      <div className="flex items-center gap-2"><span className={`flex-1 truncate text-[12px] ${t.unread ? "text-ink-2 font-semibold" : "text-ink-muted"}`}>{last ? (last.direction === "out" ? "You: " : "") + last.body : "No messages yet"}</span>{t.unread > 0 && <span className="text-[10px] font-bold bg-brand text-white rounded-full px-1.5 min-w-[18px] text-center">{t.unread}</span>}</div>
                    </div>
                  </div>
                </div>); })}
              {list.length === 0 && <div className="px-4 py-10 text-center text-ink-muted text-[12px]">No conversations.</div>}
            </div>
          </div>
          <div className="flex-1 flex flex-col min-w-0">
            {sel ? (<>
              <div className="flex items-center gap-3 px-4 py-2.5 border-b border-border">
                <div className="w-9 h-9 rounded-full flex items-center justify-center text-white text-[13px] font-bold" style={{ background: avatar(sel.name).color }}>{avatar(sel.name).initial}</div>
                <div className="flex-1 min-w-0"><div className="font-bold text-[14px]">{sel.name}</div><div className="text-[11.5px] text-ink-muted">{sel.phone}{sel.patientId ? ` · ${sel.patientId}` : ""}</div></div>
                {sel.patientId && <a href={`/patients/${sel.patientId}`} className="btn btn-ghost btn-sm">Open chart →</a>}
              </div>
              <div className="flex-1 overflow-y-auto px-4 py-4 bg-surface-2/40 flex flex-col gap-2">
                {sel.messages.map((m) => (<div key={m.id} className={`max-w-[72%] ${m.direction === "out" ? "self-end items-end" : "self-start items-start"} flex flex-col`}><div className={`px-3 py-2 rounded-2xl text-[13px] leading-snug ${m.direction === "out" ? "bg-brand text-white rounded-br-sm" : "bg-surface border border-border rounded-bl-sm"}`}>{m.body}</div><div className="text-[10px] text-ink-muted mt-0.5 px-1">{time(m.createdAt)}{m.direction === "out" ? ` · ${tick(m.status)}` : ""}</div></div>))}
                {sel.messages.length === 0 && <div className="m-auto text-ink-muted text-[12px]">Start the conversation below.</div>}
              </div>
              <div className="border-t border-border p-2.5">
                <div className="flex items-center gap-1.5 mb-1.5 flex-wrap">{SMS_TEMPLATES.map((t) => <button key={t.id} className="text-[11px] font-semibold bg-surface-3 text-ink-2 rounded-full px-2.5 py-1 hover:bg-brand-soft" onClick={() => setDraft(applySmsTemplate(t, varsFor()))}>{t.name}</button>)}</div>
                <div className="flex items-end gap-2"><textarea value={draft} onChange={(e) => setDraft(e.target.value)} placeholder="Type a message…" rows={1} onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }} className="fi flex-1 resize-none max-h-32 min-h-[40px]" /><button className="btn btn-primary" onClick={send} disabled={sending || !draft.trim()}>{sending ? "…" : "Send"}</button></div>
                <div className="text-[10.5px] text-ink-muted-2 mt-1">{len} chars · {segs} segment{segs > 1 ? "s" : ""} · Enter to send</div>
              </div>
            </>) : <div className="flex-1 flex items-center justify-center text-center text-ink-muted"><div><div className="text-[40px] mb-2">📲</div><div className="text-[13px]">Select a conversation</div></div></div>}
          </div>
        </div>
      )}

      {tab === "contacts" && (
        <div>
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-surface border border-border rounded-xl overflow-hidden flex flex-col" style={{ height: "calc(100vh - 220px)", minHeight: 420 }}>
              <div className="flex items-center gap-2.5 px-3 py-2.5 border-b border-border bg-surface-2">
                <input type="checkbox" checked={allPatSel} onChange={() => setSelPat(allPatSel ? new Set() : new Set(patients.map((p) => p.id)))} />
                <span className="font-bold text-[13px]">Patients</span><Pill intent="blue">{patients.length}</Pill>
                <div className="flex-1" /><span className="text-[11px] text-ink-muted">{selPat.size} selected</span>
              </div>
              <div className="flex-1 overflow-y-auto">
                {patients.map((p) => <Row key={p.id} checked={selPat.has(p.id)} onToggle={() => toggle(selPat, p.id, setSelPat)} name={p.name} sub={`${p.phone} · ${p.plan || "—"}`} />)}
              </div>
            </div>
            <div className="bg-surface border border-border rounded-xl overflow-hidden flex flex-col" style={{ height: "calc(100vh - 220px)", minHeight: 420 }}>
              <div className="flex items-center gap-2.5 px-3 py-2.5 border-b border-border bg-surface-2">
                <input type="checkbox" checked={allLeadSel} onChange={() => setSelLead(allLeadSel ? new Set() : new Set(leads.map((l) => l.id)))} />
                <span className="font-bold text-[13px]">Cold Leads</span><Pill intent="amber">{leads.length}</Pill>
                <div className="flex-1" /><span className="text-[11px] text-ink-muted">{selLead.size} selected</span>
              </div>
              <div className="flex-1 overflow-y-auto">
                {leads.map((l) => <Row key={l.id} checked={selLead.has(l.id)} onToggle={() => toggle(selLead, l.id, setSelLead)} name={l.name} sub={`${l.phone}${l.source ? ` · ${l.source}` : ""}`} right={<><Pill intent={l.tag === "Warm" ? "green" : "muted"}>{l.tag}</Pill><button className="ml-2 text-ink-muted-2 hover:text-red" title="Delete" onClick={() => removeLead(l.id)}>✕</button></>} />)}
                {leads.length === 0 && <div className="px-4 py-10 text-center text-ink-muted text-[12px]">No leads yet — add one.</div>}
              </div>
            </div>
          </div>
          <div className="sticky bottom-0 mt-3 flex items-center gap-3 bg-surface border border-border rounded-xl px-4 py-3 shadow-sm">
            <span className="text-[13px] font-semibold">{selectedCount} contact{selectedCount === 1 ? "" : "s"} selected</span>
            <span className="text-[11px] text-ink-muted">{selPat.size} patients · {selLead.size} leads</span>
            <div className="flex-1" />
            <button className="btn btn-ghost btn-sm" onClick={() => { setSelPat(new Set()); setSelLead(new Set()); }} disabled={!selectedCount}>Clear</button>
            <button className="btn btn-primary btn-sm" onClick={launchSelected} disabled={!selectedCount}>📣 Send campaign to selected</button>
          </div>
        </div>
      )}

      {tab === "campaigns" && (
        <div>
          <div className="flex flex-wrap gap-2.5 mb-4">
            <button className="bg-surface border border-border rounded-xl px-4 py-3 text-left hover:shadow-md" onClick={() => setCampaign({ recipients: patientRecips(), label: "All patients" })}>
              <div className="text-[13px] font-bold">📣 Patient offer campaign</div><div className="text-[11.5px] text-ink-muted mt-0.5">Send to all {patients.length} patients</div>
            </button>
            <button className="bg-surface border border-border rounded-xl px-4 py-3 text-left hover:shadow-md" onClick={() => setCampaign({ recipients: leadRecips(), label: "All leads" })}>
              <div className="text-[13px] font-bold">📣 Cold lead campaign</div><div className="text-[11.5px] text-ink-muted mt-0.5">Send to all {leads.length} cold leads</div>
            </button>
            <button className="bg-surface border border-border rounded-xl px-4 py-3 text-left hover:shadow-md" onClick={() => { setTab("contacts"); }}>
              <div className="text-[13px] font-bold">＋ Custom audience</div><div className="text-[11.5px] text-ink-muted mt-0.5">Pick contacts on the Contacts tab</div>
            </button>
          </div>
          <div className="bg-surface border border-border rounded-xl overflow-hidden">
            <div className="px-4 py-2.5 border-b border-border bg-surface-2 text-[11px] uppercase tracking-wide text-ink-muted font-bold">Sent campaigns</div>
            <table className="w-full border-collapse">
              <tbody>
                {campaigns.map((c) => (
                  <tr key={c.id} className="border-b border-border last:border-none">
                    <td className="px-4 py-3"><div className="font-semibold text-[13px]">{c.name}</div><div className="text-[11px] text-ink-muted">{c.audience} · {day(c.createdAt)}</div></td>
                    <td className="px-4 py-3 text-right whitespace-nowrap"><Pill intent="green" dot>{c.sent} sent</Pill>{c.failed > 0 && <span className="ml-2"><Pill intent="red">{c.failed} failed</Pill></span>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {campaign && <CampaignModal open={!!campaign} onClose={() => setCampaign(null)} recipients={campaign.recipients} audienceLabel={campaign.label} onSent={(c) => { addCampaign(c); }} />}
      <ImportLeadsModal open={importOpen} onClose={() => setImportOpen(false)} onImported={(n) => toast(`Imported ${n} lead${n === 1 ? "" : "s"}`)} />

      <Modal open={addOpen} onClose={() => setAddOpen(false)} title="Add cold lead" icon="＋" width={420}
        footer={<><button className="btn btn-ghost" onClick={() => setAddOpen(false)}>Cancel</button><button className="btn btn-primary" onClick={saveLead}>Add lead</button></>}>
        <label className="fl">Name *</label><input className="fi mb-2.5" value={lName} onChange={(e) => setLName(e.target.value)} placeholder="Full name" />
        <label className="fl">Phone *</label><input className="fi mb-2.5" value={lPhone} onChange={(e) => setLPhone(e.target.value)} placeholder="+1 (305) 555-0123" />
        <label className="fl">Email</label><input className="fi mb-2.5" value={lEmail} onChange={(e) => setLEmail(e.target.value)} placeholder="optional" />
        <label className="fl">Tag</label>
        <select className="fsel w-full" value={lTag} onChange={(e) => setLTag(e.target.value)}><option>Cold</option><option>Warm</option><option>Hot</option></select>
      </Modal>

      <Modal open={newMsgOpen} onClose={() => setNewMsgOpen(false)} title="New message" icon="✏️" width={440}
        footer={<><button className="btn btn-ghost" onClick={() => setNewMsgOpen(false)}>Cancel</button><button className="btn btn-primary" onClick={createThread}>Start conversation</button></>}>
        <label className="fl">Patient</label>
        <select className="fsel w-full mb-2.5" value={npPatient} onChange={(e) => { setNpPatient(e.target.value); const p = patients.find((x) => x.id === e.target.value); if (p) { setNpPhone(p.phone); setNpName(p.name); } }}><option value="">— choose a patient —</option>{patients.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</select>
        <label className="fl">Or enter a phone number</label><input className="fi mb-2.5" value={npPhone} onChange={(e) => setNpPhone(e.target.value)} placeholder="+1 (305) 555-0123" />
        <label className="fl">Name (optional)</label><input className="fi" value={npName} onChange={(e) => setNpName(e.target.value)} placeholder="Contact name" />
      </Modal>
      <Toast />
    </div>
  );
}
