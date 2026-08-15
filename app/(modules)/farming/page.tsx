"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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
import * as api from "@/lib/farming/contactsClient";

type Tab = "overview" | "contacts" | "groups" | "campaigns";
const pctStr = (n: number) => (n * 100).toFixed(1) + "%";
const rate = (n: number, d: number) => (d > 0 ? n / d : 0);
const STATUS_META = Object.fromEntries(FARM_STATUSES.map((s) => [s.key, s])) as Record<FarmStatus, (typeof FARM_STATUSES)[number]>;
const CAMPAIGN_INTENT: Record<CampaignStatus, string> = { draft: "muted", scheduled: "amber", sending: "blue", sent: "green", paused: "amber", canceled: "red" };
const PAGE = 50;

async function campaignApi(id: string, action: string, extra: Record<string, unknown> = {}) {
  try {
    const r = await fetch(`/api/farming/campaigns/${id}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action, ...extra }) });
    return await r.json();
  } catch { return { ok: false, error: "Network error." }; }
}

export default function FarmingPage() {
  const groups = useFarming((s) => s.groups);
  const campaigns = useFarming((s) => s.campaigns);
  const f = useFarming();

  const [tab, setTab] = useState<Tab>("overview");

  // ── server-driven contacts state ────────────────────────────────────────
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<FarmStatus | "all">("all");
  const [groupFilter, setGroupFilter] = useState<string>("all");
  const [stateFilter, setStateFilter] = useState<string>("all");
  const [countyFilter, setCountyFilter] = useState<string>("all");
  const [cityFilter, setCityFilter] = useState<string>("all");
  const [stateOpts, setStateOpts] = useState<string[]>([]);
  const [countyOpts, setCountyOpts] = useState<string[]>([]);
  const [cityOpts, setCityOpts] = useState<string[]>([]);
  const [showSuppressed, setShowSuppressed] = useState(false);

  // Cold-outreach sender (dripvitals.net) — persisted to the farming-settings store.
  const [senderName, setSenderName] = useState("DripVitals");
  const [senderEmail, setSenderEmail] = useState("");
  const [dailyCap, setDailyCap] = useState("");

  const [rows, setRows] = useState<FarmContact[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [counts, setCounts] = useState<api.Counts | null>(null);
  const [campCounts, setCampCounts] = useState<Record<string, api.SendCounts>>({});

  const [sel, setSel] = useState<Set<string>>(new Set());
  const [selectAllMatching, setSelectAllMatching] = useState(false);

  const [contactModal, setContactModal] = useState<{ open: boolean; editing: FarmContact | null }>({ open: false, editing: null });
  const [importOpen, setImportOpen] = useState(false);
  const [deleteSel, setDeleteSel] = useState(false);
  const [groupModal, setGroupModal] = useState<{ open: boolean; editing: FarmGroup | null }>({ open: false, editing: null });
  const [groupDelete, setGroupDelete] = useState<FarmGroup | null>(null);
  const [composerOpen, setComposerOpen] = useState(false);
  const [composerSelection, setComposerSelection] = useState<string[] | undefined>(undefined);
  const [campaignDelete, setCampaignDelete] = useState<FarmCampaign | null>(null);
  const [resultsFor, setResultsFor] = useState<FarmCampaign | null>(null);

  const groupById = useMemo(() => Object.fromEntries(groups.map((g) => [g.id, g])) as Record<string, FarmGroup>, [groups]);
  const filter = useMemo<api.Filter>(() => ({ search: search.trim() || undefined, status: statusFilter === "all" ? undefined : statusFilter, group: groupFilter === "all" ? undefined : groupFilter, state: stateFilter === "all" ? undefined : stateFilter, county: countyFilter === "all" ? undefined : countyFilter, city: cityFilter === "all" ? undefined : cityFilter, includeSuppressed: showSuppressed }), [search, statusFilter, groupFilter, stateFilter, countyFilter, cityFilter, showSuppressed]);
  const filteredTotal = counts ? (counts.filtered ?? counts.total) : 0;

  const refreshCounts = useCallback(() => { api.getCounts(filter).then(setCounts).catch(() => {}); }, [filter]);
  const reload = useCallback(async () => {
    setLoading(true); setSel(new Set()); setSelectAllMatching(false);
    try { const p = await api.listContacts({ ...filter, cursor: null, limit: PAGE }); setRows(p.contacts); setCursor(p.nextCursor); }
    finally { setLoading(false); }
  }, [filter]);
  const loadMore = useCallback(async () => {
    if (!cursor || loading) return;
    setLoading(true);
    try { const p = await api.listContacts({ ...filter, cursor, limit: PAGE }); setRows((r) => [...r, ...p.contacts]); setCursor(p.nextCursor); }
    finally { setLoading(false); }
  }, [cursor, loading, filter]);

  // Debounced reload on filter change.
  const firstRun = useRef(true);
  useEffect(() => {
    const t = setTimeout(() => { reload(); refreshCounts(); }, firstRun.current ? 0 : 250);
    firstRun.current = false;
    return () => clearTimeout(t);
  }, [reload, refreshCounts]);
  // Campaign engagement counts (Overview + list progress).
  useEffect(() => { api.campaignAnalytics().then(setCampCounts).catch(() => {}); }, [campaigns.length]);

  // Load the saved outreach sender.
  useEffect(() => {
    fetch("/api/store/farming-settings", { cache: "no-store" }).then((r) => r.json()).then((d) => {
      const s = d?.data || {};
      if (s.fromName) setSenderName(s.fromName);
      if (s.fromEmail) setSenderEmail(s.fromEmail);
      if (s.dailyCap) setDailyCap(String(s.dailyCap));
    }).catch(() => {});
  }, []);
  async function saveSender() {
    if (senderEmail.trim() && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(senderEmail.trim())) { toast("⚠️ Enter a valid from email"); return; }
    const cap = Math.max(0, Math.floor(Number(dailyCap) || 0));
    const r = await fetch("/api/store/farming-settings", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ data: { fromName: senderName.trim(), fromEmail: senderEmail.trim(), dailyCap: cap } }) });
    if ((await r.json()).ok) toast("✓ Outreach settings saved"); else toast("⚠️ Couldn't save settings");
  }

  // Location filter facets — dependent dropdowns (state → county → city).
  useEffect(() => { api.getFacet("state").then(setStateOpts).catch(() => {}); }, []);
  useEffect(() => {
    setCountyFilter("all"); setCityFilter("all"); setCityOpts([]);
    api.getFacet("county", stateFilter === "all" ? {} : { state: stateFilter }).then(setCountyOpts).catch(() => {});
  }, [stateFilter]);
  useEffect(() => {
    setCityFilter("all");
    if (countyFilter === "all") { setCityOpts([]); return; }
    api.getFacet("city", { state: stateFilter === "all" ? undefined : stateFilter, county: countyFilter }).then(setCityOpts).catch(() => {});
  }, [countyFilter, stateFilter]);

  const afterMutation = useCallback(() => { reload(); refreshCounts(); }, [reload, refreshCounts]);

  // ── contact CRUD ────────────────────────────────────────────────────────
  async function saveContact(input: Parameters<typeof api.createContact>[0], id?: string) {
    if (id) { await api.updateContact(id, input); toast("✓ Contact updated"); }
    else { await api.createContact(input); toast("✓ Contact added"); }
    afterMutation();
  }
  const bulkTarget = () => (selectAllMatching ? { filter } : { ids: [...sel] });
  const bulkLabel = () => (selectAllMatching ? filteredTotal : sel.size);
  async function bulk(action: "setStatus" | "addGroup" | "moveGroup" | "delete", value?: string, label?: string) {
    const n = await api.bulkAction(action, bulkTarget(), value);
    toast(`✓ ${label || action} · ${n.toLocaleString()} contact${n === 1 ? "" : "s"}`);
    afterMutation();
  }

  // ── campaigns ───────────────────────────────────────────────────────────
  function submitComposer(data: ComposerSubmit) {
    if (data.mode === "draft") {
      f.addCampaign({ name: data.name, channel: data.channel, subject: data.subject, body: data.body, audience: data.audience, status: "draft", throttlePerMin: data.throttlePerMin });
      toast("💾 Draft saved"); return;
    }
    const id = "FCMP-" + Date.now().toString(36);
    const campaign: FarmCampaign = { id, name: data.name, channel: data.channel, subject: data.subject, body: data.body, audience: data.audience, status: "scheduled", scheduledAt: data.mode === "send" ? new Date().toISOString() : data.scheduledAt, throttlePerMin: data.throttlePerMin, createdAt: new Date().toISOString(), totalRecipients: 0, sent: 0, delivered: 0, failed: 0 };
    campaignApi(id, data.mode, { campaign, scheduledAt: campaign.scheduledAt, throttlePerMin: data.throttlePerMin }).then((res) => {
      if (!res?.ok) { toast("⚠️ " + (res?.error || "Couldn't start campaign")); return; }
      toast(data.mode === "send" ? (res.dispatch ? `🚀 Sending — ${res.dispatch.sent} sent so far` : "🚀 Campaign started") : `🕑 Scheduled for ${new Date(campaign.scheduledAt!).toLocaleString()}`);
      setTimeout(() => api.campaignAnalytics().then(setCampCounts).catch(() => {}), 800);
    });
  }
  function campaignAction(c: FarmCampaign, action: "send" | "pause" | "resume" | "cancel") {
    campaignApi(c.id, action).then((res) => {
      if (!res?.ok) { toast("⚠️ " + (res?.error || "Action failed")); return; }
      toast(action === "send" ? "🚀 Sending…" : action === "pause" ? "⏸ Paused" : action === "resume" ? "▶ Resumed" : "🚫 Canceled");
    });
  }

  // ── analytics (Overview) from server counts ──────────────────────────────
  const analytics = useMemo(() => {
    const sc = Object.values(campCounts);
    const sent = sc.reduce((a, c) => a + c.sent, 0), delivered = sc.reduce((a, c) => a + c.delivered, 0);
    const opened = sc.reduce((a, c) => a + c.opened, 0), clicked = sc.reduce((a, c) => a + c.clicked, 0), replied = sc.reduce((a, c) => a + c.replied, 0);
    const emailSent = campaigns.filter((c) => c.channel === "email").reduce((a, c) => a + (campCounts[c.id]?.sent || 0), 0);
    return { sent, delivered, opened, clicked, replied, emailSent };
  }, [campCounts, campaigns]);

  return (
    <div className="px-7 py-6 text-[14px]">
      <div className="flex items-start justify-between gap-4 mb-5 flex-wrap">
        <div>
          <h1 className="text-[22px] font-bold tracking-tight">Farming</h1>
          <div className="text-[12.5px] text-ink-muted mt-0.5">Cold outreach at scale — a contact base separate from patients, built for millions, with grouping, mass email/SMS, scheduling, tracking, and opt-out compliance.</div>
        </div>
      </div>

      <KpiGrid cols={4}>
        <KpiCard label="Contacts" value={(counts?.total ?? 0).toLocaleString()} icon="🌱" trend={`${groups.length} groups`} />
        <KpiCard label="Suppressed" value={(counts?.suppressed ?? 0).toLocaleString()} icon="🚫" iconBg="var(--color-red-soft)" iconColor="var(--color-red)" trend="opted out" trendColor="var(--color-red)" />
        <KpiCard label="Active campaigns" value={campaigns.filter((c) => c.status === "scheduled" || c.status === "sending").length} icon="📣" iconBg="var(--color-amber-soft)" iconColor="var(--color-amber)" trend={`${campaigns.length} total`} />
        <KpiCard label="Messages sent" value={analytics.sent.toLocaleString()} icon="📤" iconBg="var(--color-green-soft)" iconColor="var(--color-green)" trend="all campaigns" trendColor="var(--color-green)" />
      </KpiGrid>

      <div className="flex border-b-[1.5px] border-border mb-4 gap-1 overflow-x-auto mt-1">
        <TabBtn active={tab === "overview"} onClick={() => setTab("overview")}>Overview</TabBtn>
        <TabBtn active={tab === "contacts"} onClick={() => setTab("contacts")}>Contacts <Count n={counts?.total ?? 0} /></TabBtn>
        <TabBtn active={tab === "groups"} onClick={() => setTab("groups")}>Groups <Count n={groups.length} /></TabBtn>
        <TabBtn active={tab === "campaigns"} onClick={() => setTab("campaigns")}>Campaigns <Count n={campaigns.length} /></TabBtn>
      </div>

      {tab === "overview" && (
        <>
          <div className="bg-surface border border-border rounded-xl p-4 mb-3">
            <div className="flex items-center justify-between mb-1">
              <div className="text-[13px] font-bold">📧 Outreach sender</div>
              <span className="text-[11px] text-ink-muted">Separate from your clinical email</span>
            </div>
            <div className="text-[11.5px] text-ink-muted mb-3">Cold campaigns send from this address on <b>dripvitals.net</b>, isolated from patient/clinical email. Authenticate this domain in SendGrid (SPF/DKIM) before sending, or messages won&rsquo;t deliver.</div>
            <div className="flex gap-3 items-end flex-wrap">
              <div><label className="fl">Sender name</label><input className="fi !w-[160px]" value={senderName} onChange={(e) => setSenderName(e.target.value)} placeholder="DripVitals" /></div>
              <div><label className="fl">From email</label><input className="fi !w-[260px]" value={senderEmail} onChange={(e) => setSenderEmail(e.target.value)} placeholder="outreach@dripvitals.net" /></div>
              <div><label className="fl">Daily send cap</label><input className="fi !w-[120px]" type="number" min={0} value={dailyCap} onChange={(e) => setDailyCap(e.target.value)} placeholder="0 = no cap" /></div>
              <button className="btn btn-primary btn-sm" onClick={saveSender}>Save</button>
            </div>
            <div className="text-[11px] text-ink-muted mt-2">Sends as <b>{(senderName || "DripVitals")} &lt;{senderEmail || "outreach@dripvitals.net"}&gt;</b>{Number(dailyCap) > 0 ? <> · max <b>{Number(dailyCap).toLocaleString()}</b> emails/day (≈ {(Number(dailyCap) * 30).toLocaleString()}/mo) — paced across days, resumes automatically.</> : <> · no daily cap set.</>}</div>
          </div>
          <div className="grid grid-cols-4 gap-2.5 mb-3 max-[900px]:grid-cols-2">
            <Metric label="Reachable" value={`${((counts?.reachableEmail ?? 0) + (counts?.reachablePhone ?? 0)).toLocaleString()}`} sub={`${(counts?.reachableEmail ?? 0).toLocaleString()} email · ${(counts?.reachablePhone ?? 0).toLocaleString()} SMS`} />
            <Metric label="Opt-out rate" value={pctStr(rate(counts?.suppressed ?? 0, counts?.total ?? 0))} sub={`${(counts?.suppressed ?? 0).toLocaleString()} suppressed`} intent={rate(counts?.suppressed ?? 0, counts?.total ?? 0) > 0.05 ? "text-red" : ""} />
            <Metric label="Delivery rate" value={pctStr(rate(analytics.delivered, analytics.sent))} sub={`${analytics.delivered.toLocaleString()}/${analytics.sent.toLocaleString()}`} />
            <Metric label="Reply rate" value={pctStr(rate(analytics.replied, analytics.sent))} sub={`${analytics.replied.toLocaleString()} replies`} intent="text-green" />
          </div>
          <div className="grid grid-cols-4 gap-2.5 mb-5 max-[900px]:grid-cols-2">
            <Metric label="Open rate (email)" value={pctStr(rate(analytics.opened, analytics.emailSent))} sub={`${analytics.opened.toLocaleString()} opens`} />
            <Metric label="Click rate (email)" value={pctStr(rate(analytics.clicked, analytics.emailSent))} sub={`${analytics.clicked.toLocaleString()} clicks`} />
            <Metric label="Click-to-open" value={pctStr(rate(analytics.clicked, analytics.opened))} sub="of opens clicked" />
            <Metric label="Messages sent" value={analytics.sent.toLocaleString()} sub={`${analytics.emailSent.toLocaleString()} email`} />
          </div>
          <div className="bg-surface border border-border rounded-xl overflow-hidden">
            <div className="px-4 py-2.5 bg-surface-2 border-b border-border text-[12px] font-bold uppercase tracking-wider text-ink-2">Per-campaign funnel</div>
            <div className="overflow-x-auto">
              <table className="w-full border-collapse min-w-[720px] text-[12.5px]">
                <thead className="bg-surface-2"><tr>{["Campaign", "Sent", "Delivered", "Opened", "Clicked", "Replied"].map((h) => <th key={h} className="text-left px-3 py-2 text-[10px] uppercase tracking-wide text-ink-muted font-bold">{h}</th>)}</tr></thead>
                <tbody>
                  {campaigns.filter((c) => (campCounts[c.id]?.sent || 0) > 0).map((c) => { const cc = campCounts[c.id]; return (
                    <tr key={c.id} className="border-t border-border">
                      <td className="px-3 py-2"><span className="font-semibold">{c.channel === "email" ? "📧" : "📱"} {c.name}</span></td>
                      <td className="px-3 py-2">{cc.sent.toLocaleString()}</td>
                      <td className="px-3 py-2">{cc.delivered.toLocaleString()}<span className="text-ink-muted"> · {pctStr(rate(cc.delivered, cc.sent))}</span></td>
                      <td className="px-3 py-2">{c.channel === "email" ? <>{cc.opened.toLocaleString()}<span className="text-ink-muted"> · {pctStr(rate(cc.opened, cc.sent))}</span></> : "—"}</td>
                      <td className="px-3 py-2">{c.channel === "email" ? <>{cc.clicked.toLocaleString()}<span className="text-ink-muted"> · {pctStr(rate(cc.clicked, cc.sent))}</span></> : "—"}</td>
                      <td className="px-3 py-2">{cc.replied.toLocaleString()}<span className="text-ink-muted"> · {pctStr(rate(cc.replied, cc.sent))}</span></td>
                    </tr>
                  ); })}
                  {campaigns.filter((c) => (campCounts[c.id]?.sent || 0) > 0).length === 0 && <tr><td colSpan={6} className="px-3 py-10 text-center text-ink-muted text-[12px]">No campaigns have been sent yet.</td></tr>}
                </tbody>
              </table>
            </div>
          </div>
          <div className="text-[11px] text-ink-muted-2 mt-3">Opens &amp; clicks are tracked via an email pixel + link-redirects; SMS delivery via Twilio callbacks; email delivery/bounce via the SendGrid event webhook when configured; replies are inbound SMS/email matched to a contact. All counts are aggregated from the per-recipient send table.</div>
        </>
      )}

      {tab === "contacts" && (
        <>
          <div className="flex items-center gap-2 mb-3 flex-wrap">
            <div className="flex items-center gap-2 bg-surface border border-border rounded-pill px-3 py-1.5 flex-1 min-w-[200px]">
              <span className="text-ink-muted text-[13px]">🔍</span>
              <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search name, email, city, county, state…" className="bg-transparent outline-none text-[12.5px] w-full" />
            </div>
            <select className="fsel !w-auto" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as FarmStatus | "all")}>
              <option value="all">All statuses</option>
              {FARM_STATUSES.map((s) => <option key={s.key} value={s.key}>{s.label}</option>)}
            </select>
            <select className="fsel !w-auto" value={groupFilter} onChange={(e) => setGroupFilter(e.target.value)}>
              <option value="all">All groups</option>
              {groups.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
            </select>
            <select className="fsel !w-auto" value={stateFilter} onChange={(e) => setStateFilter(e.target.value)}>
              <option value="all">All states</option>
              {stateOpts.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
            <select className="fsel !w-auto" value={countyFilter} onChange={(e) => setCountyFilter(e.target.value)} disabled={countyOpts.length === 0}>
              <option value="all">All counties</option>
              {countyOpts.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
            <select className="fsel !w-auto" value={cityFilter} onChange={(e) => setCityFilter(e.target.value)} disabled={cityOpts.length === 0} title={cityOpts.length === 0 ? "Pick a county first" : undefined}>
              <option value="all">All cities</option>
              {cityOpts.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
            <label className="flex items-center gap-1.5 text-[12px] font-semibold text-ink-2 cursor-pointer"><input type="checkbox" checked={showSuppressed} onChange={(e) => setShowSuppressed(e.target.checked)} /> Show opted-out</label>
            <div className="flex-1" />
            <a className="btn btn-ghost btn-sm" href={api.exportUrl(filter)}>📥 Export</a>
            <button className="btn btn-ghost btn-sm" onClick={() => setImportOpen(true)}>📤 Import</button>
            <button className="btn btn-primary btn-sm" onClick={() => setContactModal({ open: true, editing: null })}>+ Add contact</button>
          </div>

          <div className="bg-surface border border-border rounded-xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full border-collapse min-w-[960px] text-[13px]">
                <thead className="bg-surface-2">
                  <tr>
                    <th className="px-3 py-2.5 w-8"><input type="checkbox" checked={rows.length > 0 && rows.every((c) => sel.has(c.id))} onChange={(e) => { setSelectAllMatching(false); setSel(e.target.checked ? new Set(rows.map((c) => c.id)) : new Set()); }} /></th>
                    {["Name", "Email", "Phone", "State", "County", "City", "Groups", "Status"].map((h) => <th key={h} className="text-left px-3 py-2.5 text-[10px] uppercase tracking-wide text-ink-muted font-bold">{h}</th>)}
                  </tr>
                </thead>
                <tbody>
                  {rows.map((c) => (
                    <tr key={c.id} className={`border-t border-border hover:bg-surface-2 cursor-pointer ${sel.has(c.id) ? "bg-brand-soft/40" : ""}`} onClick={() => setContactModal({ open: true, editing: c })}>
                      <td className="px-3 py-2.5" onClick={(e) => e.stopPropagation()}><input type="checkbox" checked={sel.has(c.id)} onChange={() => setSel((s) => { const n = new Set(s); n.has(c.id) ? n.delete(c.id) : n.add(c.id); return n; })} /></td>
                      <td className="px-3 py-2.5"><div className="font-semibold flex items-center gap-1.5">{[c.firstName, c.lastName].filter(Boolean).join(" ") || "—"}{c.optedOut && <Pill intent="red">opted out</Pill>}</div></td>
                      <td className="px-3 py-2.5 text-ink-muted">{c.email || "—"}</td>
                      <td className="px-3 py-2.5 text-ink-muted">{c.phone || "—"}</td>
                      <td className="px-3 py-2.5 text-ink-muted">{c.custom?.state || "—"}</td>
                      <td className="px-3 py-2.5 text-ink-muted">{c.custom?.county || "—"}</td>
                      <td className="px-3 py-2.5 text-ink-muted">{c.custom?.city || "—"}</td>
                      <td className="px-3 py-2.5"><div className="flex flex-wrap gap-1">{c.groupIds.map((g) => groupById[g] ? <span key={g} className="text-[10.5px] font-semibold px-1.5 py-0.5 rounded-full text-white" style={{ background: groupById[g].color }}>{groupById[g].name}</span> : null)}</div></td>
                      <td className="px-3 py-2.5"><Pill intent={STATUS_META[c.status].intent as never} dot>{STATUS_META[c.status].label}</Pill></td>
                    </tr>
                  ))}
                  {rows.length === 0 && !loading && <tr><td colSpan={9} className="px-3 py-12 text-center text-ink-muted text-[12px]">No contacts match. Add one or import a list.</td></tr>}
                  {loading && rows.length === 0 && <tr><td colSpan={9} className="px-3 py-12 text-center text-ink-muted text-[12px]">Loading…</td></tr>}
                </tbody>
              </table>
            </div>
            <div className="py-2 px-4 border-t border-border bg-surface-2 flex items-center justify-between text-[11.5px] text-ink-muted">
              <span>Showing {rows.length.toLocaleString()} of {filteredTotal.toLocaleString()}</span>
              {cursor && <button className="btn btn-ghost btn-sm" onClick={loadMore} disabled={loading}>{loading ? "Loading…" : "Load more"}</button>}
            </div>
          </div>
        </>
      )}

      {tab === "groups" && (
        <>
          <div className="flex justify-end mb-3"><button className="btn btn-primary btn-sm" onClick={() => setGroupModal({ open: true, editing: null })}>+ New group</button></div>
          <div className="grid grid-cols-3 gap-3 max-[1000px]:grid-cols-2 max-[640px]:grid-cols-1">
            {groups.map((g) => {
              const count = counts?.groups?.[g.id] ?? 0;
              return (
                <div key={g.id} className="bg-surface border border-border rounded-xl p-4">
                  <div className="flex items-center gap-2.5 mb-2"><span className="w-4 h-4 rounded-full flex-shrink-0" style={{ background: g.color }} /><div className="font-bold text-[14px] flex-1 truncate">{g.name}</div></div>
                  {g.description && <div className="text-[12px] text-ink-muted mb-2">{g.description}</div>}
                  <div className="text-[13px] font-semibold mb-3">{count.toLocaleString()} contact{count === 1 ? "" : "s"}</div>
                  <div className="flex gap-2">
                    <button className="btn btn-ghost btn-sm" onClick={() => { setGroupFilter(g.id); setTab("contacts"); }}>View</button>
                    <button className="btn btn-ghost btn-sm" onClick={() => setGroupModal({ open: true, editing: g })}>Edit</button>
                    <div className="flex-1" />
                    <button className="btn btn-ghost btn-sm text-red" onClick={() => setGroupDelete(g)}>Delete</button>
                  </div>
                </div>
              );
            })}
            {groups.length === 0 && <div className="text-[12.5px] text-ink-muted col-span-full py-8 text-center">No groups yet.</div>}
          </div>
        </>
      )}

      {tab === "campaigns" && (
        <>
          <div className="flex justify-end mb-3"><button className="btn btn-primary btn-sm" onClick={() => { setComposerSelection(undefined); setComposerOpen(true); }}>+ New campaign</button></div>
          <div className="space-y-2.5">
            {campaigns.map((c) => {
              const cc = campCounts[c.id]; const total = c.totalRecipients || 0;
              const done = cc ? cc.sent : c.sent; const pct = total ? Math.round((done / total) * 100) : 0;
              return (
                <div key={c.id} className="bg-surface border border-border rounded-xl p-4">
                  <div className="flex items-start gap-3 flex-wrap">
                    <div className="text-[18px]">{c.channel === "email" ? "📧" : "📱"}</div>
                    <div className="flex-1 min-w-[180px]">
                      <div className="flex items-center gap-2 flex-wrap"><span className="font-bold text-[14px]">{c.name}</span><Pill intent={CAMPAIGN_INTENT[c.status] as never} dot>{c.status}</Pill></div>
                      <div className="text-[11.5px] text-ink-muted mt-0.5">{audienceLabel(c, groupById)}{c.scheduledAt && c.status === "scheduled" ? ` · scheduled ${new Date(c.scheduledAt).toLocaleString()}` : ""}</div>
                    </div>
                    <div className="text-right text-[12px]">
                      {total > 0 ? <><div className="font-semibold">{done.toLocaleString()}/{total.toLocaleString()} sent</div><div className="w-[140px] h-1.5 bg-surface-3 rounded-full overflow-hidden mt-1"><div className="h-full bg-brand rounded-full" style={{ width: `${pct}%` }} /></div></> : <span className="text-ink-muted">Not sent yet</span>}
                    </div>
                  </div>
                  <div className="flex gap-2 mt-3 pt-3 border-t border-border flex-wrap">
                    {c.status === "draft" && <button className="btn btn-primary btn-sm" onClick={() => campaignAction(c, "send")}>🚀 Send now</button>}
                    {(c.status === "sending" || c.status === "scheduled") && <button className="btn btn-ghost btn-sm" onClick={() => campaignAction(c, "pause")}>⏸ Pause</button>}
                    {c.status === "paused" && <button className="btn btn-ghost btn-sm" onClick={() => campaignAction(c, "resume")}>▶ Resume</button>}
                    {c.status !== "sent" && c.status !== "canceled" && <button className="btn btn-ghost btn-sm text-red" onClick={() => campaignAction(c, "cancel")}>🚫 Cancel</button>}
                    <button className="btn btn-ghost btn-sm" onClick={() => setResultsFor(c)}>📊 Details</button>
                    <button className="btn btn-ghost btn-sm" onClick={() => { const copy = f.duplicateCampaign(c.id); if (copy) toast(`📋 Duplicated`); }}>📋 Duplicate</button>
                    <div className="flex-1" />
                    <button className="btn btn-ghost btn-sm text-red" onClick={() => setCampaignDelete(c)}>🗑 Delete</button>
                  </div>
                </div>
              );
            })}
            {campaigns.length === 0 && <div className="text-[12.5px] text-ink-muted py-8 text-center">No campaigns yet.</div>}
          </div>
        </>
      )}

      {/* Bulk action bar */}
      {tab === "contacts" && (sel.size > 0 || selectAllMatching) && (
        <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-40 bg-ink text-white rounded-xl shadow-lg px-3 py-2 flex items-center gap-2 flex-wrap max-w-[95vw]">
          <span className="text-[12.5px] font-semibold px-1">{selectAllMatching ? `All ${filteredTotal.toLocaleString()} matching` : `${sel.size} selected`}</span>
          {!selectAllMatching && cursor && <button className="text-[11.5px] underline" onClick={() => setSelectAllMatching(true)}>Select all {filteredTotal.toLocaleString()}</button>}
          <select className="text-[12px] rounded-md bg-white/10 border border-white/20 px-2 py-1 outline-none" defaultValue="" onChange={(e) => { if (e.target.value) bulk("setStatus", e.target.value, "status set"); e.target.value = ""; }}>
            <option value="" disabled>Set status…</option>
            {FARM_STATUSES.map((s) => <option key={s.key} value={s.key} className="text-ink">{s.label}</option>)}
          </select>
          <select className="text-[12px] rounded-md bg-white/10 border border-white/20 px-2 py-1 outline-none" defaultValue="" onChange={(e) => { if (e.target.value) bulk("addGroup", e.target.value, "added to group"); e.target.value = ""; }}>
            <option value="" disabled>Add to group…</option>
            {groups.map((g) => <option key={g.id} value={g.id} className="text-ink">{g.name}</option>)}
          </select>
          <select className="text-[12px] rounded-md bg-white/10 border border-white/20 px-2 py-1 outline-none" defaultValue="" onChange={(e) => { if (e.target.value) bulk("moveGroup", e.target.value, "moved to group"); e.target.value = ""; }}>
            <option value="" disabled>Move to group…</option>
            {groups.map((g) => <option key={g.id} value={g.id} className="text-ink">{g.name}</option>)}
          </select>
          {!selectAllMatching && <button className="text-[12px] font-semibold bg-white/15 hover:bg-white/25 rounded-md px-2.5 py-1" onClick={() => { setComposerSelection([...sel]); setComposerOpen(true); }}>📣 Campaign</button>}
          <button className="text-[12px] font-semibold bg-red/80 hover:bg-red rounded-md px-2.5 py-1" onClick={() => setDeleteSel(true)}>🗑 Delete</button>
          <button className="text-[12px] font-semibold hover:bg-white/15 rounded-md px-2 py-1" onClick={() => { setSel(new Set()); setSelectAllMatching(false); }}>Clear</button>
        </div>
      )}

      {/* Modals */}
      <ContactModal open={contactModal.open} onClose={() => setContactModal({ open: false, editing: null })} contact={contactModal.editing} groups={groups} onSave={saveContact} />
      <GroupModal open={groupModal.open} onClose={() => setGroupModal({ open: false, editing: null })} group={groupModal.editing} onSave={(input, id) => { if (id) { f.updateGroup(id, input); toast("✓ Group updated"); } else { f.addGroup(input); toast("✓ Group created"); } }} />
      <ImportContactsModal open={importOpen} onClose={() => setImportOpen(false)} defaultGroupId={groupFilter !== "all" ? groupFilter : undefined} onDone={(s) => { toast(`✓ Imported ${s.inserted.toLocaleString()} · ${s.duplicates.toLocaleString()} dupes`); afterMutation(); }} />
      <CampaignComposer open={composerOpen} onClose={() => setComposerOpen(false)} groups={groups} initialSelectionIds={composerSelection} onSubmit={submitComposer} />

      <ConfirmModal open={deleteSel} onClose={() => setDeleteSel(false)} onConfirm={async () => { const n = await api.bulkAction("delete", bulkTarget()); setSel(new Set()); setSelectAllMatching(false); toast(`🗑 Deleted ${n.toLocaleString()}`); afterMutation(); }} title="Delete contacts?" message={`Permanently remove ${bulkLabel().toLocaleString()} contact${bulkLabel() === 1 ? "" : "s"}? This can't be undone.`} confirmLabel="Delete" />
      <ConfirmModal open={!!groupDelete} onClose={() => setGroupDelete(null)} onConfirm={async () => { if (groupDelete) { f.removeGroup(groupDelete.id); await api.stripGroupFromContacts(groupDelete.id); toast("🗑 Deleted group"); afterMutation(); } }} title="Delete group?" message={`Delete "${groupDelete?.name}"? Contacts stay, but lose this group tag.`} confirmLabel="Delete" />
      <ConfirmModal open={!!campaignDelete} onClose={() => setCampaignDelete(null)} onConfirm={() => { if (campaignDelete) { f.removeCampaign(campaignDelete.id); toast("🗑 Deleted campaign"); } }} title="Delete campaign?" message={`Delete "${campaignDelete?.name}"?`} confirmLabel="Delete" />

      {resultsFor && <CampaignDetails campaign={resultsFor} onClose={() => setResultsFor(null)} />}
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

function CampaignDetails({ campaign: c, onClose }: { campaign: FarmCampaign; onClose: () => void }) {
  const [data, setData] = useState<{ counts: api.SendCounts; sends: api.SendRow[] } | null>(null);
  useEffect(() => { api.campaignSends(c.id, 0, 100).then(setData).catch(() => setData({ counts: { sent: 0, delivered: 0, opened: 0, clicked: 0, replied: 0 }, sends: [] })); }, [c.id]);
  const cc = data?.counts;
  return (
    <div className="modal-overlay show" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="bg-surface rounded-2xl border border-border w-[560px] max-w-[94vw] max-h-[86vh] overflow-hidden flex flex-col">
        <div className="px-5 py-3.5 border-b border-border flex items-center gap-2"><span className="text-[17px]">{c.channel === "email" ? "📧" : "📱"}</span><div className="font-bold flex-1">{c.name}</div><button onClick={onClose} className="text-ink-muted hover:text-ink">✕</button></div>
        <div className="p-5 overflow-y-auto">
          <div className="grid grid-cols-4 gap-2 mb-2 text-center">
            {[["Recipients", c.totalRecipients], ["Sent", cc?.sent ?? 0], ["Delivered", cc?.delivered ?? 0], ["Status", c.status]].map(([l, v]) => (
              <div key={l as string} className="bg-surface-2 rounded-lg py-2"><div className="text-[15px] font-extrabold">{typeof v === "number" ? v.toLocaleString() : String(v)}</div><div className="text-[10px] text-ink-muted">{l}</div></div>
            ))}
          </div>
          <div className="grid grid-cols-4 gap-2 mb-4 text-center">
            {[["Opened", cc?.opened ?? 0], ["Clicked", cc?.clicked ?? 0], ["Replied", cc?.replied ?? 0], ["Failed", c.failed]].map(([l, v]) => (
              <div key={l as string} className="bg-surface-2 rounded-lg py-2"><div className="text-[15px] font-extrabold">{typeof v === "number" ? v.toLocaleString() : String(v)}</div><div className="text-[10px] text-ink-muted">{l}</div></div>
            ))}
          </div>
          {c.subject && <div className="text-[12.5px] mb-1"><span className="text-ink-muted">Subject:</span> {c.subject}</div>}
          <div className="text-[12.5px] whitespace-pre-wrap bg-surface-2 border border-border rounded-md p-3 mb-4">{c.body}</div>
          <div className="text-[10px] uppercase tracking-widest text-ink-muted font-bold mb-1.5">Recent recipients</div>
          {!data ? <div className="text-[12px] text-ink-muted">Loading…</div> : data.sends.length === 0 ? <div className="text-[12px] text-ink-muted">No sends recorded yet.</div> : (
            <div className="max-h-[220px] overflow-y-auto border border-border rounded-md">
              {data.sends.map((s) => (
                <div key={s.contactId} className="flex items-center justify-between px-3 py-1.5 border-b border-border last:border-none text-[12px]">
                  <span>{s.name}</span>
                  <div className="flex items-center gap-1">
                    <Pill intent={s.status === "failed" ? "red" : "green"}>{s.status}</Pill>
                    {s.deliveredAt && <Pill intent="teal">delivered</Pill>}
                    {s.openedAt && <Pill intent="blue">opened</Pill>}
                    {s.clickedAt && <Pill intent="purple">clicked</Pill>}
                    {s.repliedAt && <Pill intent="green">replied</Pill>}
                  </div>
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
  return <span className="inline-flex items-center justify-center min-w-[18px] h-[17px] px-1.5 rounded-full text-[10px] font-bold bg-surface-3 text-ink-muted">{n.toLocaleString()}</span>;
}
function Metric({ label, value, sub, intent }: { label: string; value: string; sub?: string; intent?: string }) {
  return (
    <div className="bg-surface border border-border rounded-2xl px-4 py-3.5">
      <div className="text-[11px] text-ink-muted mb-1">{label}</div>
      <div className={`text-[22px] font-extrabold tracking-tight leading-none ${intent || ""}`}>{value}</div>
      {sub && <div className="text-[11px] text-ink-muted mt-1">{sub}</div>}
    </div>
  );
}
