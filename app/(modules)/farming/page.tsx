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
import type { FarmContact, FarmGroup, FarmCampaign, FarmStatus, CampaignStatus, FarmTemplate } from "@/lib/types/farming";
import { ContactModal } from "@/components/modules/farming/ContactModal";
import { GroupModal } from "@/components/modules/farming/GroupModal";
import { ImportContactsModal } from "@/components/modules/farming/ImportContactsModal";
import { TemplateModal } from "@/components/modules/farming/TemplateModal";
import { CampaignComposer, type ComposerSubmit } from "@/components/modules/farming/CampaignComposer";
import * as api from "@/lib/farming/contactsClient";

type Tab = "overview" | "contacts" | "groups" | "campaigns" | "templates";
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
  const [sortCol, setSortCol] = useState<api.SortKey>("created");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");

  // Cold-outreach sender POOL (dripvitals.net subdomains) — farming-settings store.
  const [senders, setSenders] = useState<{ name: string; email: string; dailyCap: string }[]>([{ name: "DripVitals", email: "", dailyCap: "1500" }]);
  const [warmup, setWarmup] = useState(true);
  const [warmupStart, setWarmupStart] = useState("");

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
  const [composerFilter, setComposerFilter] = useState<api.Filter | undefined>(undefined);
  const [groupConfirm, setGroupConfirm] = useState<{ action: "addGroup" | "moveGroup"; groupId: string; label: string } | null>(null);
  const [campaignDelete, setCampaignDelete] = useState<FarmCampaign | null>(null);
  const [resultsFor, setResultsFor] = useState<FarmCampaign | null>(null);
  const [templates, setTemplates] = useState<FarmTemplate[]>([]);
  const [templateModal, setTemplateModal] = useState<{ open: boolean; editing: FarmTemplate | null }>({ open: false, editing: null });

  const groupById = useMemo(() => Object.fromEntries(groups.map((g) => [g.id, g])) as Record<string, FarmGroup>, [groups]);
  const filter = useMemo<api.Filter>(() => ({ search: search.trim() || undefined, status: statusFilter === "all" ? undefined : statusFilter, group: groupFilter === "all" ? undefined : groupFilter, state: stateFilter === "all" ? undefined : stateFilter, county: countyFilter === "all" ? undefined : countyFilter, city: cityFilter === "all" ? undefined : cityFilter, includeSuppressed: showSuppressed }), [search, statusFilter, groupFilter, stateFilter, countyFilter, cityFilter, showSuppressed]);
  const filteredTotal = counts ? (counts.filtered ?? counts.total) : 0;

  const refreshCounts = useCallback(() => { api.getCounts(filter).then(setCounts).catch(() => {}); }, [filter]);
  const reload = useCallback(async () => {
    setLoading(true); setSel(new Set()); setSelectAllMatching(false);
    try { const p = await api.listContacts({ ...filter, cursor: null, limit: PAGE, sort: sortCol, dir: sortDir }); setRows(p.contacts); setCursor(p.nextCursor); }
    finally { setLoading(false); }
  }, [filter, sortCol, sortDir]);
  const loadMore = useCallback(async () => {
    if (!cursor || loading) return;
    setLoading(true);
    try { const p = await api.listContacts({ ...filter, cursor, limit: PAGE, sort: sortCol, dir: sortDir }); setRows((r) => [...r, ...p.contacts]); setCursor(p.nextCursor); }
    finally { setLoading(false); }
  }, [cursor, loading, filter, sortCol, sortDir]);
  const toggleSort = (col: api.SortKey) => {
    if (sortCol === col) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else { setSortCol(col); setSortDir(col === "created" ? "desc" : "asc"); }
  };

  // Debounced reload on filter change.
  const firstRun = useRef(true);
  useEffect(() => {
    const t = setTimeout(() => { reload(); refreshCounts(); }, firstRun.current ? 0 : 250);
    firstRun.current = false;
    return () => clearTimeout(t);
  }, [reload, refreshCounts]);
  // Campaign engagement counts (Overview + list progress).
  useEffect(() => { api.campaignAnalytics().then(setCampCounts).catch(() => {}); }, [campaigns.length]);
  // Templates (managed in the Templates tab; also feed the composer picker).
  useEffect(() => { api.getTemplates().then(setTemplates).catch(() => {}); }, []);
  async function saveTemplate(t: FarmTemplate) {
    const next = templates.some((x) => x.id === t.id) ? templates.map((x) => (x.id === t.id ? t : x)) : [t, ...templates];
    setTemplates(next);
    if (await api.saveTemplates(next)) toast("✓ Template saved"); else toast("⚠️ Couldn't save template");
  }
  async function deleteTemplate(id: string) {
    const next = templates.filter((x) => x.id !== id);
    setTemplates(next);
    if (await api.saveTemplates(next)) toast("🗑 Template deleted");
  }

  // Load the saved sender pool.
  useEffect(() => {
    fetch("/api/store/farming-settings", { cache: "no-store" }).then((r) => r.json()).then((d) => {
      const s = d?.data || {};
      if (Array.isArray(s.senders) && s.senders.length) {
        setSenders(s.senders.map((x: { name?: string; email?: string; dailyCap?: number }) => ({ name: x.name || "DripVitals", email: x.email || "", dailyCap: String(x.dailyCap ?? 1500) })));
      } else if (s.fromEmail) {
        setSenders([{ name: s.fromName || "DripVitals", email: s.fromEmail, dailyCap: String(s.dailyCap ?? 1500) }]);
      }
      setWarmup(!!s.warmupStart);
      if (s.warmupStart) setWarmupStart(s.warmupStart);
    }).catch(() => {});
  }, []);
  const setSender = (i: number, k: "name" | "email" | "dailyCap", v: string) => setSenders((prev) => prev.map((s, idx) => (idx === i ? { ...s, [k]: v } : s)));
  const addSender = () => setSenders((prev) => [...prev, { name: prev[0]?.name || "DripVitals", email: "", dailyCap: "1500" }]);
  const removeSender = (i: number) => setSenders((prev) => (prev.length > 1 ? prev.filter((_, idx) => idx !== i) : prev));
  async function saveSender() {
    const cleaned = senders.map((s) => ({ name: s.name.trim(), email: s.email.trim(), dailyCap: Math.max(0, Math.floor(Number(s.dailyCap) || 0)) })).filter((s) => s.email);
    if (!cleaned.length) { toast("⚠️ Add at least one sender"); return; }
    for (const s of cleaned) if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(s.email)) { toast(`⚠️ Invalid email: ${s.email}`); return; }
    const start = warmup ? (warmupStart || new Date().toISOString().slice(0, 10)) : undefined;
    const data = { senders: cleaned, warmupStart: start, fromName: cleaned[0].name, fromEmail: cleaned[0].email };
    const r = await fetch("/api/store/farming-settings", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ data }) });
    if ((await r.json()).ok) { toast("✓ Sender pool saved"); if (start) setWarmupStart(start); } else toast("⚠️ Couldn't save senders");
  }
  // Warm-up ramp info for the hint (mirrors server WARMUP_STEPS).
  const WARMUP_STEPS = [0.13, 0.27, 0.47, 0.67, 0.83, 1];
  const warmupInfo = (() => {
    if (!warmup || !warmupStart) return null;
    const start = Date.parse(`${warmupStart}T00:00:00Z`); if (!Number.isFinite(start)) return null;
    const day = Math.floor((Date.now() - start) / 86_400_000) + 1;
    const frac = day > WARMUP_STEPS.length ? 1 : WARMUP_STEPS[Math.max(0, day - 1)];
    return { day, frac, done: day > WARMUP_STEPS.length };
  })();
  const targetTotal = senders.reduce((a, s) => a + (Number(s.dailyCap) || 0), 0);
  const todayTotal = warmupInfo ? senders.reduce((a, s) => a + Math.max(50, Math.round(((Number(s.dailyCap) || 0) * warmupInfo.frac) / 50) * 50), 0) : targetTotal;

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
        <TabBtn active={tab === "templates"} onClick={() => setTab("templates")}>Templates <Count n={templates.length} /></TabBtn>
      </div>

      {tab === "overview" && (
        <>
          <div className="bg-surface border border-border rounded-xl p-4 mb-3">
            <div className="flex items-center justify-between mb-1">
              <div className="text-[13px] font-bold">📧 Outreach senders</div>
              <span className="text-[11px] text-ink-muted">Rotated round-robin · separate from clinical email</span>
            </div>
            <div className="text-[11.5px] text-ink-muted mb-3">Each sender should be an authenticated (sub)domain in SendGrid (SPF/DKIM). Volume is spread evenly across all senders; each honors its own daily cap.</div>
            <div className="flex flex-col gap-2">
              {senders.map((s, i) => (
                <div key={i} className="flex gap-2 items-end flex-wrap">
                  <div><label className="fl">Name</label><input className="fi !w-[140px]" value={s.name} onChange={(e) => setSender(i, "name", e.target.value)} placeholder="DripVitals" /></div>
                  <div><label className="fl">From email</label><input className="fi !w-[250px]" value={s.email} onChange={(e) => setSender(i, "email", e.target.value)} placeholder="outreach@go.dripvitals.net" /></div>
                  <div><label className="fl">Daily cap</label><input className="fi !w-[100px]" type="number" min={0} value={s.dailyCap} onChange={(e) => setSender(i, "dailyCap", e.target.value)} placeholder="1500" /></div>
                  {senders.length > 1 && <button className="btn btn-ghost btn-sm" onClick={() => removeSender(i)} title="Remove sender">✕</button>}
                </div>
              ))}
            </div>
            <div className="flex items-center gap-3 mt-2 flex-wrap">
              <button className="btn btn-ghost btn-sm" onClick={addSender}>+ Add sender</button>
              <label className="flex items-center gap-1.5 text-[12px] font-semibold text-ink-2 cursor-pointer"><input type="checkbox" checked={warmup} onChange={(e) => setWarmup(e.target.checked)} /> Warm-up ramp (climb to cap over ~1 week)</label>
              <div className="flex-1" />
              <button className="btn btn-primary btn-sm" onClick={saveSender}>Save senders</button>
            </div>
            <div className="text-[11px] text-ink-muted mt-2">
              {senders.length} sender{senders.length === 1 ? "" : "s"} · target <b>{targetTotal.toLocaleString()}</b> emails/day
              {warmupInfo && (warmupInfo.done ? <> · warm-up complete ✅</> : <> · warm-up day <b>{warmupInfo.day}</b> → sending ~<b>{todayTotal.toLocaleString()}</b>/day today</>)}
            </div>
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
                    {([{ l: "Name", k: "name" }, { l: "Email", k: "email" }, { l: "Phone", k: "phone" }, { l: "State", k: "state" }, { l: "County", k: "county" }, { l: "City", k: "city" }, { l: "Groups" }, { l: "Status", k: "status" }] as { l: string; k?: api.SortKey }[]).map((c) => (
                      <th key={c.l} className="text-left px-3 py-2.5 text-[10px] uppercase tracking-wide text-ink-muted font-bold">
                        {c.k
                          ? <button onClick={() => toggleSort(c.k!)} className={`flex items-center gap-1 hover:text-ink ${sortCol === c.k ? "text-ink" : ""}`}>{c.l}<span className="text-[8px]">{sortCol === c.k ? (sortDir === "asc" ? "▲" : "▼") : "↕"}</span></button>
                          : c.l}
                      </th>
                    ))}
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

      {tab === "campaigns" && resultsFor && (
        <CampaignDetails campaign={resultsFor} groups={groups} onBack={() => setResultsFor(null)}
          onCampaignTo={(ids) => { setResultsFor(null); setComposerFilter(undefined); setComposerSelection(ids); setComposerOpen(true); }} />
      )}

      {tab === "campaigns" && !resultsFor && (
        <>
          <div className="flex justify-end mb-3"><button className="btn btn-primary btn-sm" onClick={() => { setComposerSelection(undefined); setComposerFilter(undefined); setComposerOpen(true); }}>+ New campaign</button></div>
          <div className="bg-surface border border-border rounded-xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-[12.5px] min-w-[960px]">
                <thead className="bg-surface-2">
                  <tr>{["Campaign", "Created", "Status", "Recipients", "Sent", "Opens", "Clicks", "Unsubs", "Bounces", ""].map((h, i) => <th key={i} className="text-left px-3 py-2.5 text-[9.5px] uppercase tracking-wide text-ink-muted font-bold">{h}</th>)}</tr>
                </thead>
                <tbody>
                  {campaigns.map((c) => {
                    const cc = campCounts[c.id] || api.ZERO_SEND_COUNTS;
                    const total = c.totalRecipients || cc.sent || 0;
                    const sent = cc.sent || c.sent || 0;
                    const p = (n: number) => (sent > 0 ? `${Math.round((n / sent) * 100)}%` : "—");
                    const cell = (n: number, cls = "") => sent > 0 ? <><span className={`font-semibold ${cls}`}>{n.toLocaleString()}</span> <span className="text-ink-muted-2 text-[11px]">({p(n)})</span></> : <span className="text-ink-muted-2">—</span>;
                    return (
                      <tr key={c.id} className="border-t border-border hover:bg-surface-2">
                        <td className="px-3 py-2.5">
                          <button className="text-left" onClick={() => setResultsFor(c)}>
                            <div className="font-semibold text-ink hover:text-brand flex items-center gap-1.5">{c.channel === "email" ? "📧" : "📱"} {c.name}</div>
                            <div className="text-[10.5px] text-ink-muted">{audienceLabel(c, groupById)}</div>
                          </button>
                        </td>
                        <td className="px-3 py-2.5 text-ink-muted whitespace-nowrap">{c.createdAt ? new Date(c.createdAt).toLocaleDateString(undefined, { month: "short", day: "numeric" }) : "—"}</td>
                        <td className="px-3 py-2.5"><Pill intent={CAMPAIGN_INTENT[c.status] as never} dot>{c.status}</Pill></td>
                        <td className="px-3 py-2.5 font-semibold">{total ? total.toLocaleString() : "—"}</td>
                        <td className="px-3 py-2.5 font-semibold">{sent ? sent.toLocaleString() : "—"}</td>
                        <td className="px-3 py-2.5 whitespace-nowrap">{cell(cc.opened, "text-blue")}</td>
                        <td className="px-3 py-2.5 whitespace-nowrap">{cell(cc.clicked, "text-brand")}</td>
                        <td className="px-3 py-2.5 whitespace-nowrap">{cell(cc.unsubscribed, cc.unsubscribed ? "text-red" : "")}</td>
                        <td className="px-3 py-2.5 whitespace-nowrap">{cell(cc.bounced, cc.bounced ? "text-red" : "")}</td>
                        <td className="px-3 py-2.5" onClick={(e) => e.stopPropagation()}>
                          <div className="flex items-center gap-1 justify-end">
                            {c.status === "draft" && <button title="Send now" className="btn btn-primary btn-sm !px-2" onClick={() => campaignAction(c, "send")}>🚀</button>}
                            {(c.status === "sending" || c.status === "scheduled") && <button title="Pause" className="btn btn-ghost btn-sm !px-2" onClick={() => campaignAction(c, "pause")}>⏸</button>}
                            {c.status === "paused" && <button title="Resume" className="btn btn-ghost btn-sm !px-2" onClick={() => campaignAction(c, "resume")}>▶</button>}
                            <button title="Details" className="btn btn-ghost btn-sm !px-2" onClick={() => setResultsFor(c)}>📊</button>
                            <button title="Duplicate" className="btn btn-ghost btn-sm !px-2" onClick={() => { const copy = f.duplicateCampaign(c.id); if (copy) toast("📋 Duplicated"); }}>📋</button>
                            <button title="Delete" className="btn btn-ghost btn-sm !px-2 text-red" onClick={() => setCampaignDelete(c)}>🗑</button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                  {campaigns.length === 0 && <tr><td colSpan={10} className="px-3 py-12 text-center text-ink-muted text-[12px]">No campaigns yet. Create one to start reporting.</td></tr>}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {tab === "templates" && (
        <>
          <div className="flex justify-end mb-3"><button className="btn btn-primary btn-sm" onClick={() => setTemplateModal({ open: true, editing: null })}>+ New template</button></div>
          <div className="grid grid-cols-3 gap-3 max-[1000px]:grid-cols-2 max-[640px]:grid-cols-1">
            {templates.map((t) => (
              <div key={t.id} className="bg-surface border border-border rounded-xl p-4 flex flex-col">
                <div className="flex items-center gap-2 mb-1"><span>{t.channel === "email" ? "📧" : "📱"}</span><div className="font-bold text-[14px] flex-1 truncate">{t.name}</div></div>
                {t.subject && <div className="text-[12px] text-ink-muted mb-2 line-clamp-1"><span className="font-semibold text-ink-2">Subject:</span> {t.subject}</div>}
                <div className="text-[11px] text-ink-muted-2 bg-surface-2 border border-border rounded-md p-2 h-[64px] overflow-hidden mb-3">{t.body.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim().slice(0, 180) || "—"}</div>
                <div className="flex gap-2 mt-auto">
                  <button className="btn btn-ghost btn-sm" onClick={() => setTemplateModal({ open: true, editing: t })}>Edit</button>
                  <button className="btn btn-ghost btn-sm" onClick={() => { setComposerSelection(undefined); setComposerFilter(undefined); setComposerOpen(true); setTimeout(() => toast(`Pick “${t.name}” in the composer’s template dropdown`), 300); }}>Use</button>
                  <button className="btn btn-ghost btn-sm" onClick={() => saveTemplate({ ...t, id: "FTPL-" + Date.now().toString(36), name: `${t.name} (copy)`, createdAt: new Date().toISOString() })}>Duplicate</button>
                  <div className="flex-1" />
                  <button className="btn btn-ghost btn-sm text-red" onClick={() => deleteTemplate(t.id)}>Delete</button>
                </div>
              </div>
            ))}
            {templates.length === 0 && <div className="text-[12.5px] text-ink-muted col-span-full py-8 text-center">No templates yet. Create one to reuse across campaigns.</div>}
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
          <select className="text-[12px] rounded-md bg-white/10 border border-white/20 px-2 py-1 outline-none" value="" onChange={(e) => { if (e.target.value) setGroupConfirm({ action: "addGroup", groupId: e.target.value, label: "Added to group" }); }}>
            <option value="" disabled>Add to group…</option>
            {groups.map((g) => <option key={g.id} value={g.id} className="text-ink">{g.name}</option>)}
          </select>
          <select className="text-[12px] rounded-md bg-white/10 border border-white/20 px-2 py-1 outline-none" value="" onChange={(e) => { if (e.target.value) setGroupConfirm({ action: "moveGroup", groupId: e.target.value, label: "Moved to group" }); }}>
            <option value="" disabled>Move to group…</option>
            {groups.map((g) => <option key={g.id} value={g.id} className="text-ink">{g.name}</option>)}
          </select>
          <button className="text-[12px] font-semibold bg-white/15 hover:bg-white/25 rounded-md px-2.5 py-1" onClick={() => { if (selectAllMatching) { setComposerSelection(undefined); setComposerFilter(filter); } else { setComposerFilter(undefined); setComposerSelection([...sel]); } setComposerOpen(true); }}>📣 Campaign</button>
          <button className="text-[12px] font-semibold bg-red/80 hover:bg-red rounded-md px-2.5 py-1" onClick={() => setDeleteSel(true)}>🗑 Delete</button>
          <button className="text-[12px] font-semibold hover:bg-white/15 rounded-md px-2 py-1" onClick={() => { setSel(new Set()); setSelectAllMatching(false); }}>Clear</button>
        </div>
      )}

      {/* Modals */}
      <ContactModal open={contactModal.open} onClose={() => setContactModal({ open: false, editing: null })} contact={contactModal.editing} groups={groups} onSave={saveContact} />
      <GroupModal open={groupModal.open} onClose={() => setGroupModal({ open: false, editing: null })} group={groupModal.editing} onSave={(input, id) => { if (id) { f.updateGroup(id, input); toast("✓ Group updated"); } else { f.addGroup(input); toast("✓ Group created"); } }} />
      <ImportContactsModal open={importOpen} onClose={() => setImportOpen(false)} defaultGroupId={groupFilter !== "all" ? groupFilter : undefined}
        groups={groups}
        onCreateGroup={(name) => { const palette = ["#6650e0", "#0ea5e9", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6", "#ec4899", "#14b8a6"]; const g = f.addGroup({ name, color: palette[groups.length % palette.length] }); toast(`✓ Group “${name}” created`); return g.id; }}
        onDone={(s) => { toast(`✓ Imported ${s.inserted.toLocaleString()} · ${s.duplicates.toLocaleString()} dupes`); afterMutation(); }} />
      <CampaignComposer open={composerOpen} onClose={() => setComposerOpen(false)} groups={groups} initialSelectionIds={composerSelection} initialFilter={composerFilter} onSubmit={submitComposer} />
      <TemplateModal open={templateModal.open} onClose={() => setTemplateModal({ open: false, editing: null })} template={templateModal.editing} onSave={saveTemplate} onDelete={deleteTemplate} />

      <ConfirmModal open={deleteSel} onClose={() => setDeleteSel(false)} onConfirm={async () => { const n = await api.bulkAction("delete", bulkTarget()); setSel(new Set()); setSelectAllMatching(false); toast(`🗑 Deleted ${n.toLocaleString()}`); afterMutation(); }} title="Delete contacts?" message={`Permanently remove ${bulkLabel().toLocaleString()} contact${bulkLabel() === 1 ? "" : "s"}? This can't be undone.`} confirmLabel="Delete" />
      <ConfirmModal open={!!groupConfirm} onClose={() => setGroupConfirm(null)} destructive={false} icon="🏷️"
        onConfirm={() => { const gc = groupConfirm; if (gc) bulk(gc.action, gc.groupId, gc.label); }}
        title={groupConfirm?.action === "moveGroup" ? "Move to group?" : "Add to group?"}
        message={groupConfirm ? `${groupConfirm.action === "moveGroup" ? "Move" : "Add"} ${bulkLabel().toLocaleString()} contact${bulkLabel() === 1 ? "" : "s"} to “${groupById[groupConfirm.groupId]?.name || groupConfirm.groupId}”?${groupConfirm.action === "moveGroup" ? " This replaces any groups they’re already in." : ""}` : ""}
        confirmLabel={groupConfirm?.action === "moveGroup" ? "Move to group" : "Add to group"} />
      <ConfirmModal open={!!groupDelete} onClose={() => setGroupDelete(null)} onConfirm={async () => { if (groupDelete) { f.removeGroup(groupDelete.id); await api.stripGroupFromContacts(groupDelete.id); toast("🗑 Deleted group"); afterMutation(); } }} title="Delete group?" message={`Delete "${groupDelete?.name}"? Contacts stay, but lose this group tag.`} confirmLabel="Delete" />
      <ConfirmModal open={!!campaignDelete} onClose={() => setCampaignDelete(null)} onConfirm={() => { if (campaignDelete) { f.removeCampaign(campaignDelete.id); toast("🗑 Deleted campaign"); } }} title="Delete campaign?" message={`Delete "${campaignDelete?.name}"?`} confirmLabel="Delete" />

      <Toast />
    </div>
  );
}

function audienceLabel(c: FarmCampaign, groupById: Record<string, FarmGroup>): string {
  const a = c.audience;
  if (a.kind === "all") return "All contacts";
  if (a.kind === "group") return "Groups: " + (a.groupIds || []).map((g) => groupById[g]?.name || g).join(", ");
  if (a.kind === "status") return "Status: " + (a.statuses || []).join(", ");
  if (a.kind === "filter") {
    const f = a.filter || {};
    const parts = [f.search && `“${f.search}”`, f.status, f.group && (groupById[f.group]?.name || f.group), f.city, f.county, f.state].filter(Boolean);
    return parts.length ? `Matching: ${parts.join(" · ")}` : "All matching filter";
  }
  return `${(a.contactIds || []).length} selected contacts`;
}

const SEND_FILTERS: { key: api.SendFilter; label: string; count: (c: api.SendCounts) => number }[] = [
  { key: "all", label: "All", count: (c) => c.sent },
  { key: "delivered", label: "Delivered", count: (c) => c.delivered },
  { key: "opened", label: "Opened", count: (c) => c.opened },
  { key: "clicked", label: "Clicked", count: (c) => c.clicked },
  { key: "replied", label: "Replied", count: (c) => c.replied },
  { key: "bounced", label: "Bounced", count: (c) => c.bounced },
  { key: "unsubscribed", label: "Unsub", count: (c) => c.unsubscribed },
  { key: "not_opened", label: "Not opened", count: (c) => Math.max(0, c.sent - c.opened - c.bounced) },
];

function CampaignDetails({ campaign: c, groups, onBack, onCampaignTo }: { campaign: FarmCampaign; groups: FarmGroup[]; onBack: () => void; onCampaignTo: (ids: string[]) => void }) {
  const [counts, setCounts] = useState<api.SendCounts>(api.ZERO_SEND_COUNTS);
  const [filter, setFilter] = useState<api.SendFilter>("all");
  const [rows, setRows] = useState<api.SendRow[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [sel, setSel] = useState<Set<string>>(new Set());
  const RPAGE = 100;

  const load = useCallback(async (f: api.SendFilter, off: number) => {
    setLoading(true);
    try {
      const d = await api.campaignSends(c.id, off, RPAGE, f);
      setCounts(d.counts); setTotal(d.total);
      setRows((prev) => (off === 0 ? d.sends : [...prev, ...d.sends]));
    } catch { if (!rows.length) setRows([]); } finally { setLoading(false); }
  }, [c.id, rows.length]);
  useEffect(() => { setSel(new Set()); load(filter, 0); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [filter, c.id]);

  const pct = (n: number) => (counts.sent > 0 ? ((n / counts.sent) * 100).toFixed(1) + "%" : "—");
  const fmt = (iso?: string) => (iso ? new Date(iso).toLocaleString(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }) : "");
  const Ev = ({ ts, cls }: { ts?: string; cls: string }) => ts ? <span title={fmt(ts)} className={`font-bold ${cls}`}>✓</span> : <span className="text-ink-muted-2">–</span>;
  const statusIntent = (s: string) => (s === "bounced" || s === "failed" ? "red" : s === "delivered" ? "teal" : "green");
  const toggle = (id: string) => setSel((s) => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; });
  const allChecked = rows.length > 0 && rows.every((r) => sel.has(r.contactId));

  async function bulk(action: "setStatus" | "addGroup", value: string, label: string) {
    const n = await api.bulkAction(action, { ids: [...sel] }, value);
    toast(`✓ ${label} · ${n.toLocaleString()} contact${n === 1 ? "" : "s"}`);
  }

  const TILES: { label: string; value: number; rate?: string; intent?: string }[] = [
    { label: "Recipients", value: counts.sent },
    { label: "Delivered", value: counts.delivered, rate: pct(counts.delivered) },
    { label: "Opened", value: counts.opened, rate: pct(counts.opened), intent: "text-blue" },
    { label: "Clicked", value: counts.clicked, rate: pct(counts.clicked), intent: "text-brand" },
    { label: "Replied", value: counts.replied, rate: pct(counts.replied), intent: "text-green" },
    { label: "Bounced", value: counts.bounced, rate: pct(counts.bounced), intent: counts.bounced ? "text-red" : "" },
    { label: "Unsub", value: counts.unsubscribed, rate: pct(counts.unsubscribed), intent: counts.unsubscribed ? "text-red" : "" },
  ];

  return (
    <div>
      <div className="flex items-center gap-2 mb-3 flex-wrap">
        <button onClick={onBack} className="text-[13px] text-brand font-semibold hover:underline">‹ Campaigns</button>
        <span className="text-ink-muted-2">/</span>
        <span className="text-[15px] font-bold flex items-center gap-1.5 min-w-0"><span>{c.channel === "email" ? "📧" : "📱"}</span><span className="truncate">{c.name}</span></span>
        <Pill intent={(CAMPAIGN_INTENT[c.status] || "muted") as never}>{c.status}</Pill>
        <div className="flex-1" />
        <a className="btn btn-ghost btn-sm" href={api.campaignSendsExportUrl(c.id)}>📥 Export</a>
      </div>
      {c.subject && <div className="text-[12px] text-ink-muted mb-3"><span className="font-semibold text-ink-2">Subject:</span> {c.subject}</div>}

      <div className="grid grid-cols-7 gap-2 mb-4 max-[720px]:grid-cols-4">
        {TILES.map((t) => (
          <div key={t.label} className="bg-surface border border-border rounded-xl py-3 px-1 text-center">
            <div className={`text-[19px] font-extrabold leading-none ${t.intent || ""}`}>{t.value.toLocaleString()}</div>
            {t.rate && <div className="text-[11px] text-ink-muted mt-1">{t.rate}</div>}
            <div className="text-[10px] text-ink-muted-2 mt-0.5">{t.label}</div>
          </div>
        ))}
      </div>

      <div className="flex flex-wrap gap-1.5 mb-2">
        {SEND_FILTERS.map((f) => (
          <button key={f.key} onClick={() => setFilter(f.key)}
            className={`text-[11.5px] font-semibold px-2.5 py-1 rounded-full border transition-colors ${filter === f.key ? "bg-brand text-white border-brand" : "bg-surface border-border text-ink-2 hover:border-border-2"}`}>
            {f.label} <span className={filter === f.key ? "opacity-80" : "text-ink-muted"}>{f.count(counts).toLocaleString()}</span>
          </button>
        ))}
      </div>

      <div className="bg-surface border border-border rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-[12px] min-w-[720px]">
            <thead className="bg-surface-2">
              <tr>
                <th className="px-3 py-2.5 w-8"><input type="checkbox" checked={allChecked} onChange={(e) => setSel(e.target.checked ? new Set(rows.map((r) => r.contactId)) : new Set())} /></th>
                {["Recipient", "Email", "Status", "Delivered", "Opened", "Clicked", "Replied", "Bounced", "Unsub"].map((h) => <th key={h} className="text-left px-3 py-2.5 text-[9.5px] uppercase tracking-wide text-ink-muted font-bold">{h}</th>)}
              </tr>
            </thead>
            <tbody>
              {rows.map((s) => (
                <tr key={s.contactId} className={`border-t border-border hover:bg-surface-2 ${sel.has(s.contactId) ? "bg-brand-soft/40" : ""}`}>
                  <td className="px-3 py-1.5"><input type="checkbox" checked={sel.has(s.contactId)} onChange={() => toggle(s.contactId)} /></td>
                  <td className="px-3 py-1.5 font-semibold">{s.name}</td>
                  <td className="px-3 py-1.5 text-ink-muted">{s.email || "—"}</td>
                  <td className="px-3 py-1.5"><Pill intent={statusIntent(s.status) as never}>{s.status}</Pill></td>
                  <td className="px-3 py-1.5"><Ev ts={s.deliveredAt} cls="text-teal" /></td>
                  <td className="px-3 py-1.5"><Ev ts={s.openedAt} cls="text-blue" /></td>
                  <td className="px-3 py-1.5"><Ev ts={s.clickedAt} cls="text-brand" /></td>
                  <td className="px-3 py-1.5"><Ev ts={s.repliedAt} cls="text-green" /></td>
                  <td className="px-3 py-1.5"><Ev ts={s.bouncedAt} cls="text-red" /></td>
                  <td className="px-3 py-1.5"><Ev ts={s.unsubscribedAt} cls="text-red" /></td>
                </tr>
              ))}
              {rows.length === 0 && !loading && <tr><td colSpan={10} className="px-3 py-10 text-center text-ink-muted text-[12px]">No recipients in this view yet.</td></tr>}
              {loading && rows.length === 0 && <tr><td colSpan={10} className="px-3 py-10 text-center text-ink-muted text-[12px]">Loading…</td></tr>}
            </tbody>
          </table>
        </div>
        <div className="py-2 px-4 border-t border-border bg-surface-2 flex items-center justify-between text-[11.5px] text-ink-muted">
          <span>Showing {rows.length.toLocaleString()} of {total.toLocaleString()}</span>
          {rows.length < total && <button className="btn btn-ghost btn-sm" onClick={() => load(filter, rows.length)} disabled={loading}>{loading ? "Loading…" : "Load more"}</button>}
        </div>
      </div>

      {/* Selection action bar — act on recipients right from the report */}
      {sel.size > 0 && (
        <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-40 bg-ink text-white rounded-xl shadow-lg px-3 py-2 flex items-center gap-2 flex-wrap max-w-[95vw]">
          <span className="text-[12.5px] font-semibold px-1">{sel.size} selected</span>
          <button className="text-[12px] font-semibold bg-white/15 hover:bg-white/25 rounded-md px-2.5 py-1" onClick={() => onCampaignTo([...sel])}>📣 New campaign</button>
          <select className="text-[12px] rounded-md bg-white/10 border border-white/20 px-2 py-1 outline-none" defaultValue="" onChange={(e) => { if (e.target.value) bulk("addGroup", e.target.value, "added to group"); e.target.value = ""; }}>
            <option value="" disabled>Add to group…</option>
            {groups.map((g) => <option key={g.id} value={g.id} className="text-ink">{g.name}</option>)}
          </select>
          <select className="text-[12px] rounded-md bg-white/10 border border-white/20 px-2 py-1 outline-none" defaultValue="" onChange={(e) => { if (e.target.value) bulk("setStatus", e.target.value, "status set"); e.target.value = ""; }}>
            <option value="" disabled>Set status…</option>
            {FARM_STATUSES.map((s) => <option key={s.key} value={s.key} className="text-ink">{s.label}</option>)}
          </select>
          <button className="text-[12px] font-semibold hover:bg-white/15 rounded-md px-2 py-1" onClick={() => setSel(new Set())}>Clear</button>
        </div>
      )}
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
