"use client";

import { useMemo, useState } from "react";
import type { ReactNode } from "react";
import { Pill } from "@/components/ui/Pill";
import { Toast } from "@/components/ui/Toast";
import { ConfirmModal } from "@/components/ui/ConfirmModal";
import { KpiCard, KpiGrid } from "@/components/ui/Kpi";
import { toast } from "@/lib/hooks/useToast";
import { useFarming } from "@/lib/hooks/useFarming";
import { FARM_STATUSES } from "@/lib/types/farming";
import type { FarmContact, FarmGroup, FarmCampaign, FarmStatus, CampaignStatus } from "@/lib/types/farming";
import { ContactModal } from "@/components/modules/farming/ContactModal";
import { GroupModal } from "@/components/modules/farming/GroupModal";
import { ImportContactsModal } from "@/components/modules/farming/ImportContactsModal";
import { CampaignComposer, type ComposerSubmit } from "@/components/modules/farming/CampaignComposer";

type Tab = "contacts" | "groups" | "campaigns";
const STATUS_META = Object.fromEntries(FARM_STATUSES.map((s) => [s.key, s])) as Record<FarmStatus, (typeof FARM_STATUSES)[number]>;
const CAMPAIGN_INTENT: Record<CampaignStatus, string> = { draft: "muted", scheduled: "amber", sending: "blue", sent: "green", paused: "amber", canceled: "red" };

async function campaignApi(id: string, action: string, extra: Record<string, unknown> = {}) {
  try {
    const r = await fetch(`/api/farming/campaigns/${id}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action, ...extra }) });
    return await r.json();
  } catch { return { ok: false, error: "Network error." }; }
}

export default function FarmingPage() {
  const contacts = useFarming((s) => s.contacts);
  const groups = useFarming((s) => s.groups);
  const campaigns = useFarming((s) => s.campaigns);
  const f = useFarming();

  const [tab, setTab] = useState<Tab>("contacts");

  // ── Contacts state ──────────────────────────────────────────────────────
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<FarmStatus | "all">("all");
  const [groupFilter, setGroupFilter] = useState<string>("all");
  const [showSuppressed, setShowSuppressed] = useState(false);
  const [sel, setSel] = useState<Set<string>>(new Set());
  const [contactModal, setContactModal] = useState<{ open: boolean; editing: FarmContact | null }>({ open: false, editing: null });
  const [importOpen, setImportOpen] = useState(false);
  const [deleteSel, setDeleteSel] = useState(false);

  // ── Group state ─────────────────────────────────────────────────────────
  const [groupModal, setGroupModal] = useState<{ open: boolean; editing: FarmGroup | null }>({ open: false, editing: null });
  const [groupDelete, setGroupDelete] = useState<FarmGroup | null>(null);

  // ── Campaign state ──────────────────────────────────────────────────────
  const [composerOpen, setComposerOpen] = useState(false);
  const [composerSelection, setComposerSelection] = useState<string[] | undefined>(undefined);
  const [campaignDelete, setCampaignDelete] = useState<FarmCampaign | null>(null);
  const [resultsFor, setResultsFor] = useState<FarmCampaign | null>(null);

  const groupById = useMemo(() => Object.fromEntries(groups.map((g) => [g.id, g])) as Record<string, FarmGroup>, [groups]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return contacts.filter((c) => {
      if (!showSuppressed && c.optedOut) return false;
      if (statusFilter !== "all" && c.status !== statusFilter) return false;
      if (groupFilter !== "all" && !c.groupIds.includes(groupFilter)) return false;
      if (q) {
        const hay = `${c.firstName} ${c.lastName} ${c.email} ${c.phone} ${c.company || ""}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [contacts, search, statusFilter, groupFilter, showSuppressed]);

  const kpis = useMemo(() => ({
    total: contacts.length,
    suppressed: contacts.filter((c) => c.optedOut).length,
    groups: groups.length,
    activeCampaigns: campaigns.filter((c) => c.status === "scheduled" || c.status === "sending").length,
    sent: campaigns.reduce((a, c) => a + (c.sent || 0), 0),
  }), [contacts, groups, campaigns]);

  const allShownSelected = filtered.length > 0 && filtered.every((c) => sel.has(c.id));
  const toggleSel = (id: string) => setSel((s) => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; });
  const clearSel = () => setSel(new Set());
  const selIds = () => [...sel];

  // ── Contacts: save / bulk / export ──────────────────────────────────────
  function saveContact(input: Parameters<typeof f.addContact>[0], id?: string) {
    if (id) { f.updateContact(id, input); toast("✓ Contact updated"); }
    else { f.addContact(input); toast("✓ Contact added"); }
  }
  function bulkAddGroup(groupId: string) { f.addToGroupMany(selIds(), groupId); toast(`✓ Added ${sel.size} to ${groupById[groupId]?.name}`); }
  function bulkMoveGroup(groupId: string) { f.moveToGroupMany(selIds(), groupId); toast(`✓ Moved ${sel.size} to ${groupById[groupId]?.name}`); }
  function bulkStatus(status: FarmStatus) { f.setStatusMany(selIds(), status); toast(`✓ Set ${sel.size} to ${STATUS_META[status].label}`); }
  function exportCsv(rows: FarmContact[]) {
    const header = ["First", "Last", "Email", "Phone", "Company", "Title", "Status", "Groups", "OptedOut", "Source", "Created"];
    const body = rows.map((c) => [c.firstName, c.lastName, c.email, c.phone, c.company || "", c.title || "", c.status, c.groupIds.map((g) => groupById[g]?.name || g).join("; "), c.optedOut ? "yes" : "no", c.source || "", c.createdAt].map((v) => `"${String(v).replace(/"/g, '""')}"`).join(","));
    const csv = [header.join(","), ...body].join("\n");
    const a = document.createElement("a");
    a.href = "data:text/csv;charset=utf-8," + encodeURIComponent(csv);
    a.download = `farming_contacts_${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    toast(`📥 Exported ${rows.length} contacts`);
  }

  // ── Campaigns: create + lifecycle ───────────────────────────────────────
  function submitComposer(data: ComposerSubmit) {
    if (data.mode === "draft") {
      f.addCampaign({ name: data.name, channel: data.channel, subject: data.subject, body: data.body, audience: data.audience, status: "draft", throttlePerMin: data.throttlePerMin });
      toast("💾 Draft saved");
      return;
    }
    // Send/Schedule: the server is authoritative (it creates + acts + tracks
    // progress). We don't write to the client store here — the version bump pulls
    // it back — so a debounced client write can't clobber the server's status.
    const id = "FCMP-" + Date.now().toString(36);
    const campaign: FarmCampaign = {
      id, name: data.name, channel: data.channel, subject: data.subject, body: data.body,
      audience: data.audience, status: "scheduled", scheduledAt: data.mode === "send" ? new Date().toISOString() : data.scheduledAt,
      throttlePerMin: data.throttlePerMin, createdAt: new Date().toISOString(),
      totalRecipients: 0, sent: 0, delivered: 0, failed: 0,
    };
    campaignApi(id, data.mode, { campaign, scheduledAt: campaign.scheduledAt, throttlePerMin: data.throttlePerMin }).then((res) => {
      if (!res?.ok) { toast("⚠️ " + (res?.error || "Couldn't start campaign")); return; }
      if (data.mode === "send") { const d = res.dispatch; toast(d ? `🚀 Sending — ${d.sent} sent${d.failed ? `, ${d.failed} failed` : ""} so far` : "🚀 Campaign started"); }
      else toast(`🕑 Scheduled for ${new Date(campaign.scheduledAt!).toLocaleString()}`);
    });
  }
  function campaignAction(c: FarmCampaign, action: "send" | "pause" | "resume" | "cancel") {
    campaignApi(c.id, action).then((res) => {
      if (!res?.ok) { toast("⚠️ " + (res?.error || "Action failed")); return; }
      toast(action === "send" ? "🚀 Sending…" : action === "pause" ? "⏸ Paused" : action === "resume" ? "▶ Resumed" : "🚫 Canceled");
    });
  }

  return (
    <div className="px-7 py-6 text-[14px]">
      <div className="flex items-start justify-between gap-4 mb-5 flex-wrap">
        <div>
          <h1 className="text-[22px] font-bold tracking-tight">Farming</h1>
          <div className="text-[12.5px] text-ink-muted mt-0.5">Cold outreach — a contact base separate from patients, with grouping, mass email/SMS, scheduling, and opt-out compliance.</div>
        </div>
      </div>

      <KpiGrid cols={4}>
        <KpiCard label="Contacts" value={kpis.total} icon="🌱" trend={`${kpis.groups} groups`} />
        <KpiCard label="Suppressed" value={kpis.suppressed} icon="🚫" iconBg="var(--color-red-soft)" iconColor="var(--color-red)" trend="opted out" trendColor="var(--color-red)" />
        <KpiCard label="Active campaigns" value={kpis.activeCampaigns} icon="📣" iconBg="var(--color-amber-soft)" iconColor="var(--color-amber)" trend={`${campaigns.length} total`} />
        <KpiCard label="Messages sent" value={kpis.sent} icon="📤" iconBg="var(--color-green-soft)" iconColor="var(--color-green)" trend="all campaigns" trendColor="var(--color-green)" />
      </KpiGrid>

      <div className="flex border-b-[1.5px] border-border mb-4 gap-1 overflow-x-auto mt-1">
        <TabBtn active={tab === "contacts"} onClick={() => setTab("contacts")}>Contacts <Count n={contacts.length} /></TabBtn>
        <TabBtn active={tab === "groups"} onClick={() => setTab("groups")}>Groups <Count n={groups.length} /></TabBtn>
        <TabBtn active={tab === "campaigns"} onClick={() => setTab("campaigns")}>Campaigns <Count n={campaigns.length} /></TabBtn>
      </div>

      {tab === "contacts" && (
        <>
          <div className="flex items-center gap-2 mb-3 flex-wrap">
            <div className="flex items-center gap-2 bg-surface border border-border rounded-pill px-3 py-1.5 flex-1 min-w-[200px]">
              <span className="text-ink-muted text-[13px]">🔍</span>
              <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search name, email, phone, company…" className="bg-transparent outline-none text-[12.5px] w-full" />
            </div>
            <select className="fsel !w-auto" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as FarmStatus | "all")}>
              <option value="all">All statuses</option>
              {FARM_STATUSES.map((s) => <option key={s.key} value={s.key}>{s.label}</option>)}
            </select>
            <select className="fsel !w-auto" value={groupFilter} onChange={(e) => setGroupFilter(e.target.value)}>
              <option value="all">All groups</option>
              {groups.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
            </select>
            <label className="flex items-center gap-1.5 text-[12px] font-semibold text-ink-2 cursor-pointer"><input type="checkbox" checked={showSuppressed} onChange={(e) => setShowSuppressed(e.target.checked)} /> Show opted-out</label>
            <div className="flex-1" />
            <button className="btn btn-ghost btn-sm" onClick={() => exportCsv(filtered)}>📥 Export</button>
            <button className="btn btn-ghost btn-sm" onClick={() => setImportOpen(true)}>📤 Import</button>
            <button className="btn btn-primary btn-sm" onClick={() => setContactModal({ open: true, editing: null })}>+ Add contact</button>
          </div>

          <div className="bg-surface border border-border rounded-xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full border-collapse min-w-[820px] text-[13px]">
                <thead className="bg-surface-2">
                  <tr>
                    <th className="px-3 py-2.5 w-8"><input type="checkbox" checked={allShownSelected} onChange={() => setSel(allShownSelected ? new Set() : new Set(filtered.map((c) => c.id)))} /></th>
                    {["Name", "Email", "Phone", "Company", "Groups", "Status"].map((h) => <th key={h} className="text-left px-3 py-2.5 text-[10px] uppercase tracking-wide text-ink-muted font-bold">{h}</th>)}
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((c) => (
                    <tr key={c.id} className={`border-t border-border hover:bg-surface-2 cursor-pointer ${sel.has(c.id) ? "bg-brand-soft/40" : ""}`} onClick={() => setContactModal({ open: true, editing: c })}>
                      <td className="px-3 py-2.5" onClick={(e) => e.stopPropagation()}><input type="checkbox" checked={sel.has(c.id)} onChange={() => toggleSel(c.id)} /></td>
                      <td className="px-3 py-2.5"><div className="font-semibold flex items-center gap-1.5">{[c.firstName, c.lastName].filter(Boolean).join(" ") || "—"}{c.optedOut && <Pill intent="red">opted out</Pill>}</div>{c.title && <div className="text-[11px] text-ink-muted">{c.title}</div>}</td>
                      <td className="px-3 py-2.5 text-ink-muted">{c.email || "—"}</td>
                      <td className="px-3 py-2.5 text-ink-muted">{c.phone || "—"}</td>
                      <td className="px-3 py-2.5">{c.company || "—"}</td>
                      <td className="px-3 py-2.5"><div className="flex flex-wrap gap-1">{c.groupIds.map((g) => groupById[g] ? <span key={g} className="text-[10.5px] font-semibold px-1.5 py-0.5 rounded-full text-white" style={{ background: groupById[g].color }}>{groupById[g].name}</span> : null)}</div></td>
                      <td className="px-3 py-2.5"><Pill intent={STATUS_META[c.status].intent as never} dot>{STATUS_META[c.status].label}</Pill></td>
                    </tr>
                  ))}
                  {filtered.length === 0 && <tr><td colSpan={7} className="px-3 py-12 text-center text-ink-muted text-[12px]">No contacts match. Add one or import a list.</td></tr>}
                </tbody>
              </table>
            </div>
            <div className="py-2 px-4 border-t border-border bg-surface-2 text-[11.5px] text-ink-muted">Showing {filtered.length} of {contacts.length} contacts</div>
          </div>
        </>
      )}

      {tab === "groups" && (
        <>
          <div className="flex justify-end mb-3"><button className="btn btn-primary btn-sm" onClick={() => setGroupModal({ open: true, editing: null })}>+ New group</button></div>
          <div className="grid grid-cols-3 gap-3 max-[1000px]:grid-cols-2 max-[640px]:grid-cols-1">
            {groups.map((g) => {
              const count = contacts.filter((c) => c.groupIds.includes(g.id)).length;
              return (
                <div key={g.id} className="bg-surface border border-border rounded-xl p-4">
                  <div className="flex items-center gap-2.5 mb-2">
                    <span className="w-4 h-4 rounded-full flex-shrink-0" style={{ background: g.color }} />
                    <div className="font-bold text-[14px] flex-1 truncate">{g.name}</div>
                  </div>
                  {g.description && <div className="text-[12px] text-ink-muted mb-2">{g.description}</div>}
                  <div className="text-[13px] font-semibold mb-3">{count} contact{count === 1 ? "" : "s"}</div>
                  <div className="flex gap-2">
                    <button className="btn btn-ghost btn-sm" onClick={() => { setGroupFilter(g.id); setTab("contacts"); }}>View</button>
                    <button className="btn btn-ghost btn-sm" onClick={() => setGroupModal({ open: true, editing: g })}>Edit</button>
                    <div className="flex-1" />
                    <button className="btn btn-ghost btn-sm text-red" onClick={() => setGroupDelete(g)}>Delete</button>
                  </div>
                </div>
              );
            })}
            {groups.length === 0 && <div className="text-[12.5px] text-ink-muted col-span-full py-8 text-center">No groups yet. Create one to organize your contacts.</div>}
          </div>
        </>
      )}

      {tab === "campaigns" && (
        <>
          <div className="flex justify-end mb-3"><button className="btn btn-primary btn-sm" onClick={() => { setComposerSelection(undefined); setComposerOpen(true); }}>+ New campaign</button></div>
          <div className="space-y-2.5">
            {campaigns.map((c) => {
              const total = c.totalRecipients || 0;
              const pct = total ? Math.round(((c.sent + c.failed) / total) * 100) : 0;
              return (
                <div key={c.id} className="bg-surface border border-border rounded-xl p-4">
                  <div className="flex items-start gap-3 flex-wrap">
                    <div className="text-[18px]">{c.channel === "email" ? "📧" : "📱"}</div>
                    <div className="flex-1 min-w-[180px]">
                      <div className="flex items-center gap-2 flex-wrap"><span className="font-bold text-[14px]">{c.name}</span><Pill intent={CAMPAIGN_INTENT[c.status] as never} dot>{c.status}</Pill></div>
                      <div className="text-[11.5px] text-ink-muted mt-0.5">{audienceLabel(c, groupById)}{c.scheduledAt && (c.status === "scheduled") ? ` · scheduled ${new Date(c.scheduledAt).toLocaleString()}` : ""}</div>
                    </div>
                    <div className="text-right text-[12px]">
                      {total > 0 ? <><div className="font-semibold">{c.sent}/{total} sent{c.failed ? ` · ${c.failed} failed` : ""}</div><div className="w-[140px] h-1.5 bg-surface-3 rounded-full overflow-hidden mt-1"><div className="h-full bg-brand rounded-full" style={{ width: `${pct}%` }} /></div></> : <span className="text-ink-muted">Not sent yet</span>}
                    </div>
                  </div>
                  <div className="flex gap-2 mt-3 pt-3 border-t border-border flex-wrap">
                    {(c.status === "draft") && <button className="btn btn-primary btn-sm" onClick={() => campaignAction(c, "send")}>🚀 Send now</button>}
                    {(c.status === "sending" || c.status === "scheduled") && <button className="btn btn-ghost btn-sm" onClick={() => campaignAction(c, "pause")}>⏸ Pause</button>}
                    {(c.status === "paused") && <button className="btn btn-ghost btn-sm" onClick={() => campaignAction(c, "resume")}>▶ Resume</button>}
                    {(c.status !== "sent" && c.status !== "canceled") && <button className="btn btn-ghost btn-sm text-red" onClick={() => campaignAction(c, "cancel")}>🚫 Cancel</button>}
                    <button className="btn btn-ghost btn-sm" onClick={() => setResultsFor(c)}>📊 Details</button>
                    <button className="btn btn-ghost btn-sm" onClick={() => { const copy = f.duplicateCampaign(c.id); if (copy) toast(`📋 Duplicated as "${copy.name}"`); }}>📋 Duplicate</button>
                    <div className="flex-1" />
                    <button className="btn btn-ghost btn-sm text-red" onClick={() => setCampaignDelete(c)}>🗑 Delete</button>
                  </div>
                </div>
              );
            })}
            {campaigns.length === 0 && <div className="text-[12.5px] text-ink-muted py-8 text-center">No campaigns yet. Create one to reach a group or your whole list.</div>}
          </div>
        </>
      )}

      {/* Bulk action bar (contacts) */}
      {tab === "contacts" && sel.size > 0 && (
        <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-40 bg-ink text-white rounded-xl shadow-lg px-3 py-2 flex items-center gap-2 flex-wrap max-w-[95vw]">
          <span className="text-[12.5px] font-semibold px-1">{sel.size} selected</span>
          <select className="text-[12px] rounded-md bg-white/10 border border-white/20 px-2 py-1 outline-none" defaultValue="" onChange={(e) => { if (e.target.value) bulkStatus(e.target.value as FarmStatus); e.target.value = ""; }}>
            <option value="" disabled>Set status…</option>
            {FARM_STATUSES.map((s) => <option key={s.key} value={s.key} className="text-ink">{s.label}</option>)}
          </select>
          <select className="text-[12px] rounded-md bg-white/10 border border-white/20 px-2 py-1 outline-none" defaultValue="" onChange={(e) => { if (e.target.value) bulkAddGroup(e.target.value); e.target.value = ""; }}>
            <option value="" disabled>Add to group…</option>
            {groups.map((g) => <option key={g.id} value={g.id} className="text-ink">{g.name}</option>)}
          </select>
          <select className="text-[12px] rounded-md bg-white/10 border border-white/20 px-2 py-1 outline-none" defaultValue="" onChange={(e) => { if (e.target.value) bulkMoveGroup(e.target.value); e.target.value = ""; }}>
            <option value="" disabled>Move to group…</option>
            {groups.map((g) => <option key={g.id} value={g.id} className="text-ink">{g.name}</option>)}
          </select>
          <button className="text-[12px] font-semibold bg-white/15 hover:bg-white/25 rounded-md px-2.5 py-1" onClick={() => { setComposerSelection(selIds()); setComposerOpen(true); }}>📣 Campaign</button>
          <button className="text-[12px] font-semibold bg-red/80 hover:bg-red rounded-md px-2.5 py-1" onClick={() => setDeleteSel(true)}>🗑 Delete</button>
          <button className="text-[12px] font-semibold hover:bg-white/15 rounded-md px-2 py-1" onClick={clearSel}>Clear</button>
        </div>
      )}

      {/* Modals */}
      <ContactModal open={contactModal.open} onClose={() => setContactModal({ open: false, editing: null })} contact={contactModal.editing} groups={groups} onSave={saveContact} />
      <GroupModal open={groupModal.open} onClose={() => setGroupModal({ open: false, editing: null })} group={groupModal.editing} onSave={(input, id) => { if (id) { f.updateGroup(id, input); toast("✓ Group updated"); } else { f.addGroup(input); toast("✓ Group created"); } }} />
      <ImportContactsModal open={importOpen} onClose={() => setImportOpen(false)} existing={contacts.map((c) => ({ email: c.email, phone: c.phone }))} defaultGroupId={groupFilter !== "all" ? groupFilter : undefined} onImport={(rows) => { const n = f.addContacts(rows); toast(`✓ Imported ${n} contact${n === 1 ? "" : "s"}`); }} />
      <CampaignComposer open={composerOpen} onClose={() => setComposerOpen(false)} groups={groups} contacts={contacts} initialSelectionIds={composerSelection} onSubmit={submitComposer} />

      <ConfirmModal open={deleteSel} onClose={() => setDeleteSel(false)} onConfirm={() => { const n = sel.size; f.removeContacts(selIds()); clearSel(); toast(`🗑 Deleted ${n} contact${n === 1 ? "" : "s"}`); }} title="Delete contacts?" message={`Permanently remove ${sel.size} selected contact${sel.size === 1 ? "" : "s"}? This can't be undone.`} confirmLabel="Delete" />
      <ConfirmModal open={!!groupDelete} onClose={() => setGroupDelete(null)} onConfirm={() => { if (groupDelete) { f.removeGroup(groupDelete.id); toast(`🗑 Deleted group`); } }} title="Delete group?" message={`Delete "${groupDelete?.name}"? Contacts stay, but lose this group tag.`} confirmLabel="Delete" />
      <ConfirmModal open={!!campaignDelete} onClose={() => setCampaignDelete(null)} onConfirm={() => { if (campaignDelete) { f.removeCampaign(campaignDelete.id); toast(`🗑 Deleted campaign`); } }} title="Delete campaign?" message={`Delete "${campaignDelete?.name}"?`} confirmLabel="Delete" />

      {resultsFor && <CampaignDetails campaign={resultsFor} contacts={contacts} onClose={() => setResultsFor(null)} />}

      <Toast />
    </div>
  );
}

function audienceLabel(c: FarmCampaign, groupById: Record<string, FarmGroup>): string {
  const a = c.audience;
  if (a.kind === "all") return "All contacts";
  if (a.kind === "group") return "Groups: " + (a.groupIds || []).map((g) => groupById[g]?.name || g).join(", ");
  if (a.kind === "status") return "Status: " + (a.statuses || []).join(", ");
  return `${(a.contactIds || []).length} selected contacts`;
}

function CampaignDetails({ campaign: c, contacts, onClose }: { campaign: FarmCampaign; contacts: FarmContact[]; onClose: () => void }) {
  const byId = Object.fromEntries(contacts.map((x) => [x.id, x])) as Record<string, FarmContact>;
  const results = Object.entries(c.results || {});
  return (
    <div className="modal-overlay show" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="bg-surface rounded-2xl border border-border w-[560px] max-w-[94vw] max-h-[86vh] overflow-hidden flex flex-col">
        <div className="px-5 py-3.5 border-b border-border flex items-center gap-2"><span className="text-[17px]">{c.channel === "email" ? "📧" : "📱"}</span><div className="font-bold flex-1">{c.name}</div><button onClick={onClose} className="text-ink-muted hover:text-ink">✕</button></div>
        <div className="p-5 overflow-y-auto">
          <div className="grid grid-cols-4 gap-2 mb-4 text-center">
            {[["Recipients", c.totalRecipients], ["Sent", c.sent], ["Failed", c.failed], ["Status", c.status]].map(([l, v]) => (
              <div key={l as string} className="bg-surface-2 rounded-lg py-2"><div className="text-[15px] font-extrabold">{String(v)}</div><div className="text-[10px] text-ink-muted">{l}</div></div>
            ))}
          </div>
          {c.subject && <div className="text-[12.5px] mb-1"><span className="text-ink-muted">Subject:</span> {c.subject}</div>}
          <div className="text-[12.5px] whitespace-pre-wrap bg-surface-2 border border-border rounded-md p-3 mb-4">{c.body}</div>
          <div className="text-[10px] uppercase tracking-widest text-ink-muted font-bold mb-1.5">Per-recipient outcomes</div>
          {results.length === 0 ? <div className="text-[12px] text-ink-muted">No sends recorded yet.</div> : (
            <div className="max-h-[220px] overflow-y-auto border border-border rounded-md">
              {results.map(([id, r]) => (
                <div key={id} className="flex items-center justify-between px-3 py-1.5 border-b border-border last:border-none text-[12px]">
                  <span>{byId[id] ? [byId[id].firstName, byId[id].lastName].filter(Boolean).join(" ") || byId[id].email : id}</span>
                  <Pill intent={r === "sent" || r === "delivered" ? "green" : r === "opted_out" ? "muted" : "red"}>{r}</Pill>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function TabBtn({ active, onClick, children }: { active: boolean; onClick: () => void; children: ReactNode }) {
  return <button onClick={onClick} className={`py-2.5 px-4 text-[13px] font-semibold whitespace-nowrap -mb-[1.5px] border-b-[2.5px] flex items-center gap-1.5 ${active ? "text-brand border-brand" : "text-ink-muted border-transparent hover:text-ink"}`}>{children}</button>;
}
function Count({ n }: { n: number }) {
  return <span className="inline-flex items-center justify-center min-w-[18px] h-[17px] px-1.5 rounded-full text-[10px] font-bold bg-surface-3 text-ink-muted">{n}</span>;
}
