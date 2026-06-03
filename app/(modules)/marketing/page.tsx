"use client";

import { useMemo, useState } from "react";
import type { Key, ReactNode } from "react";
import { Pill } from "@/components/ui/Pill";
import { Toast } from "@/components/ui/Toast";
import { KpiCard, KpiGrid } from "@/components/ui/Kpi";
import { ConfirmModal } from "@/components/ui/ConfirmModal";
import { NewCampaignModal } from "@/components/modules/NewCampaignModal";
import { toast } from "@/lib/hooks/useToast";
import { useMarketing } from "@/lib/hooks/useMarketing";
import type { Campaign, CampaignStatus, CampaignChannel } from "@/lib/types";

type Tab = "campaigns" | "automations" | "templates" | "segments";

const TAB_LABEL: Record<Tab, string> = {
  campaigns:   "Campaigns",
  automations: "Automations",
  templates:   "Templates",
  segments:    "Segments",
};

const STATUS_LABEL: Record<CampaignStatus, string> = {
  active:    "Active",
  paused:    "⏸ Paused",
  draft:     "Draft",
  completed: "Completed",
};

const STATUS_INTENT: Record<CampaignStatus, "green" | "amber" | "muted" | "blue"> = {
  active:    "green",
  paused:    "amber",
  draft:     "muted",
  completed: "blue",
};

const CHANNEL_LABEL: Record<CampaignChannel, string> = {
  email: "Email",
  sms:   "SMS",
  both:  "Email + SMS",
};

const CHANNEL_ICON: Record<CampaignChannel, string> = {
  email: "📧",
  sms:   "📱",
  both:  "⚡",
};

export default function MarketingPage() {
  const campaigns         = useMarketing((s) => s.campaigns);
  const automations       = useMarketing((s) => s.automations);
  const templates         = useMarketing((s) => s.templates);
  const segments          = useMarketing((s) => s.segments);
  const addCampaign       = useMarketing((s) => s.addCampaign);
  const setCampaignStatus = useMarketing((s) => s.setCampaignStatus);
  const removeCampaign    = useMarketing((s) => s.removeCampaign);
  const toggleAutomation  = useMarketing((s) => s.toggleAutomation);

  const [tab, setTab]                 = useState<Tab>("campaigns");
  const [filter, setFilter]           = useState<"all" | CampaignStatus>("all");
  const [search, setSearch]           = useState("");
  const [expandedId, setExpandedId]   = useState<string | null>(null);
  const [newOpen, setNewOpen]         = useState(false);
  const [removeTarget, setRemoveTarget] = useState<Campaign | null>(null);

  // KPIs across all campaigns
  const metrics = useMemo(() => {
    const totalSent = campaigns.reduce((sum, c) => sum + c.sent, 0);
    const totalDelivered = campaigns.reduce((sum, c) => sum + c.delivered, 0);
    const totalOpens = campaigns.reduce((sum, c) => sum + c.opens, 0);
    const totalClicks = campaigns.reduce((sum, c) => sum + c.clicks, 0);
    const totalConversions = campaigns.reduce((sum, c) => sum + c.conversions, 0);
    const totalRevenue = campaigns.reduce((sum, c) => sum + c.revenue, 0);
    const active = campaigns.filter((c) => c.status === "active").length;

    const deliverability = totalSent > 0 ? (totalDelivered / totalSent) * 100 : 0;
    const openRate       = totalDelivered > 0 ? (totalOpens / totalDelivered) * 100 : 0;
    const clickRate      = totalDelivered > 0 ? (totalClicks / totalDelivered) * 100 : 0;
    const conversionRate = totalClicks > 0 ? (totalConversions / totalClicks) * 100 : 0;

    return {
      active,
      total: campaigns.length,
      totalSent,
      totalDelivered,
      totalRevenue,
      deliverability,
      openRate,
      clickRate,
      conversionRate,
      totalConversions,
    };
  }, [campaigns]);

  // Filtered campaigns
  const filteredCampaigns = useMemo(() => {
    let list = campaigns;
    if (filter !== "all") list = list.filter((c) => c.status === filter);
    if (search) {
      const q = search.toLowerCase();
      list = list.filter((c) =>
        c.name.toLowerCase().includes(q) ||
        c.audience.toLowerCase().includes(q) ||
        c.subject.toLowerCase().includes(q)
      );
    }
    return list;
  }, [campaigns, filter, search]);

  function exportCsv() {
    const header = ["Campaign", "Channel", "Type", "Audience", "Status", "Sent", "Delivered", "Opens", "Clicks", "Conversions", "Revenue"];
    const rows = filteredCampaigns.map((c) => [
      `"${c.name.replace(/"/g, '""')}"`,
      c.channel, c.type,
      `"${c.audience}"`,
      c.status,
      c.sent, c.delivered, c.opens, c.clicks, c.conversions, c.revenue,
    ].join(","));
    const csv = [header.join(","), ...rows].join("\n");
    const a = document.createElement("a");
    a.href = "data:text/csv;charset=utf-8," + encodeURIComponent(csv);
    a.download = `dripvitals_campaigns_${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    toast(`📥 Exported ${filteredCampaigns.length} campaigns to CSV`);
  }

  return (
    <div className="px-7 py-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 mb-5 flex-wrap">
        <div>
          <div className="text-[22px] font-bold tracking-tight text-ink mb-1">Marketing</div>
          <div className="text-[13px] text-ink-muted">
            Campaigns · Automations · A/B tests · Template library
          </div>
        </div>
        <div className="flex gap-2">
          <button className="btn btn-ghost btn-sm" onClick={exportCsv}>📥 Export CSV</button>
          <button className="btn btn-primary btn-sm" onClick={() => setNewOpen(true)}>+ New Campaign</button>
        </div>
      </div>

      {/* KPI strip */}
      <KpiGrid cols={4}>
        <KpiCard
          label="Active Campaigns"
          value={metrics.active}
          icon="📣"
          iconBg="var(--color-brand-soft)"
          iconColor="var(--color-brand)"
          trend={`${metrics.total} total · ${(metrics.totalSent / 1000).toFixed(1)}K sent`}
          trendColor="var(--color-brand)"
        />
        <KpiCard
          label="Open Rate"
          value={`${metrics.openRate.toFixed(1)}%`}
          icon="📧"
          iconBg="var(--color-green-soft)"
          iconColor="var(--color-green)"
          trend={`${metrics.totalDelivered.toLocaleString()} delivered`}
          trendColor="var(--color-green)"
        />
        <KpiCard
          label="Click Rate"
          value={`${metrics.clickRate.toFixed(1)}%`}
          icon="🎯"
          iconBg="var(--color-amber-soft)"
          iconColor="var(--color-amber)"
          trend={`${metrics.conversionRate.toFixed(1)}% conv rate`}
          trendColor="var(--color-amber)"
        />
        <KpiCard
          label="Revenue Generated"
          value={`$${(metrics.totalRevenue / 1000).toFixed(1)}K`}
          icon="💰"
          iconBg="var(--color-violet-soft)"
          iconColor="var(--color-violet)"
          trend={`${metrics.totalConversions} conversions`}
          trendColor="var(--color-violet)"
        />
      </KpiGrid>

      {/* Tabs */}
      <div className="flex border-b-[1.5px] border-border mb-4 gap-1 overflow-x-auto">
        <TabButton active={tab === "campaigns"}   onClick={() => setTab("campaigns")}>
          {TAB_LABEL.campaigns} <CountBadge count={campaigns.length} />
        </TabButton>
        <TabButton active={tab === "automations"} onClick={() => setTab("automations")}>
          {TAB_LABEL.automations} <CountBadge count={automations.length} />
        </TabButton>
        <TabButton active={tab === "templates"}   onClick={() => setTab("templates")}>
          {TAB_LABEL.templates} <CountBadge count={templates.length} />
        </TabButton>
        <TabButton active={tab === "segments"}    onClick={() => setTab("segments")}>
          {TAB_LABEL.segments} <CountBadge count={segments.length} />
        </TabButton>
      </div>

      {/* Tab content */}
      {tab === "campaigns" && (
        <div>
          {/* Campaign filter + search */}
          <div className="flex items-center gap-2 mb-4 flex-wrap">
            {(["all", "active", "paused", "draft", "completed"] as const).map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={[
                  "py-1.5 px-3 rounded-pill text-[11.5px] font-semibold border transition-colors",
                  filter === f ? "bg-brand text-white border-brand" : "bg-surface border-border text-ink-2 hover:border-border-2",
                ].join(" ")}
              >
                {f === "all" ? "All" : STATUS_LABEL[f as CampaignStatus]}
              </button>
            ))}
            <div className="flex items-center gap-1.5 bg-surface border border-border rounded-pill py-1 px-3.5 ml-auto min-w-[260px] focus-within:border-brand focus-within:shadow-[0_0_0_3px_rgba(31,138,112,.18)]">
              <span className="text-ink-muted text-[13px]">🔍</span>
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search campaign, audience, subject…"
                className="flex-1 bg-transparent border-none outline-none text-[12px] text-ink placeholder:text-ink-muted"
              />
            </div>
          </div>

          {/* Campaigns table */}
          <div className="bg-surface border border-border rounded-lg overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-[13px]">
                <thead className="bg-surface-2">
                  <tr>
                    <Th>Campaign</Th>
                    <Th>Type</Th>
                    <Th>Audience</Th>
                    <Th>Sent</Th>
                    <Th>Open Rate</Th>
                    <Th>Click Rate</Th>
                    <Th>Revenue</Th>
                    <Th>Status</Th>
                    <Th>{""}</Th>
                  </tr>
                </thead>
                <tbody>
                  {filteredCampaigns.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="py-12 text-center text-ink-muted">
                        <div className="text-[36px] opacity-40 mb-2">📣</div>
                        <div className="text-[13px] font-bold text-ink mb-0.5">No campaigns match</div>
                        <div className="text-[11.5px]">Try a different filter or search term</div>
                      </td>
                    </tr>
                  ) : (
                    filteredCampaigns.map((c, i) => (
                      <CampaignRow
                        key={c.id}
                        campaign={c}
                        expanded={expandedId === c.id}
                        onToggle={() => setExpandedId(expandedId === c.id ? null : c.id)}
                        onPause={() => {
                          setCampaignStatus(c.id, "paused");
                          toast(`⏸ ${c.name} paused`);
                        }}
                        onResume={() => {
                          setCampaignStatus(c.id, "active");
                          toast(`▶ ${c.name} resumed`);
                        }}
                        onLaunch={() => {
                          setCampaignStatus(c.id, "active");
                          toast(`🚀 ${c.name} launched`);
                        }}
                        onRemove={() => setRemoveTarget(c)}
                        delay={i * 20}
                      />
                    ))
                  )}
                </tbody>
              </table>
            </div>
            <div className="py-2.5 px-[18px] border-t border-border bg-surface-2 flex items-center justify-between text-[11.5px] text-ink-muted">
              <span>Showing {filteredCampaigns.length} of {campaigns.length} campaigns</span>
              <span>
                Deliverability: <strong className="text-green">{metrics.deliverability.toFixed(1)}%</strong> ·
                Avg open rate: <strong className="text-brand-dk ml-1">{metrics.openRate.toFixed(1)}%</strong>
              </span>
            </div>
          </div>
        </div>
      )}

      {tab === "automations" && (
        <div className="grid grid-cols-2 gap-3 max-[900px]:grid-cols-1">
          {automations.map((a) => {
            const progress = a.enrolled > 0 ? (a.completed / a.enrolled) * 100 : 0;
            return (
              <div key={a.id} className="bg-surface border border-border rounded-lg overflow-hidden">
                <div className="py-3 px-5 bg-surface-2 border-b border-border flex items-center gap-3">
                  <div className="w-9 h-9 rounded-md flex items-center justify-center text-[18px] flex-shrink-0 border border-border bg-surface">
                    {a.icon}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-[13.5px] font-bold text-ink truncate">{a.name}</div>
                    <div className="text-[11px] text-ink-muted">{a.steps} steps · {a.channel}</div>
                  </div>
                  <Pill intent={a.status === "active" ? "green" : a.status === "paused" ? "amber" : "muted"} dot>
                    {a.status === "active" ? "Active" : a.status === "paused" ? "⏸ Paused" : "Draft"}
                  </Pill>
                </div>
                <div className="p-4">
                  <div className="text-[11px] text-ink-muted mb-1">
                    <strong className="text-ink-2">Trigger:</strong> {a.trigger}
                  </div>
                  <div className="grid grid-cols-2 gap-2 mt-3">
                    <div className="bg-surface-2 border border-border rounded p-2 text-center">
                      <div className="text-[15px] font-extrabold leading-none text-brand-dk">{a.enrolled}</div>
                      <div className="text-[9.5px] font-bold uppercase tracking-widest text-ink-muted mt-1">Enrolled</div>
                    </div>
                    <div className="bg-surface-2 border border-border rounded p-2 text-center">
                      <div className="text-[15px] font-extrabold leading-none text-green">{a.completed}</div>
                      <div className="text-[9.5px] font-bold uppercase tracking-widest text-ink-muted mt-1">Completed</div>
                    </div>
                  </div>
                  <div className="mt-3">
                    <div className="flex items-center justify-between text-[10.5px] text-ink-muted mb-1">
                      <span>Completion rate</span>
                      <strong>{Math.round(progress)}%</strong>
                    </div>
                    <div className="h-1.5 bg-surface-3 rounded overflow-hidden">
                      <div className="h-full rounded transition-all" style={{ width: `${progress}%`, background: a.color }} />
                    </div>
                  </div>
                  <div className="flex gap-1.5 mt-3 pt-3 border-t border-border">
                    <button className="btn btn-ghost btn-sm" onClick={() => toast(`📋 ${a.name} flow editor opened`)}>
                      🛠 Edit Flow
                    </button>
                    <button className="btn btn-ghost btn-sm" onClick={() => toast(`📊 ${a.name} analytics opened`)}>
                      📊 Stats
                    </button>
                    <div className="flex-1" />
                    <button
                      className="btn btn-ghost btn-sm"
                      onClick={() => {
                        toggleAutomation(a.id);
                        toast(`${a.status === "active" ? "⏸" : "▶"} ${a.name} ${a.status === "active" ? "paused" : "resumed"}`);
                      }}
                    >
                      {a.status === "active" ? "⏸ Pause" : "▶ Resume"}
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {tab === "templates" && (
        <div className="grid grid-cols-3 gap-3 max-[1100px]:grid-cols-2 max-[700px]:grid-cols-1">
          {templates.map((t) => (
            <div key={t.id} className="bg-surface border border-border rounded-lg overflow-hidden hover:border-border-2 transition-colors">
              <div className="p-4">
                <div className="flex items-center gap-2.5 mb-3">
                  <div className="w-9 h-9 rounded-md flex items-center justify-center text-[16px] flex-shrink-0 border border-border bg-surface-2" style={{ color: t.color }}>
                    {t.icon}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-[13px] font-bold text-ink truncate">{t.name}</div>
                    <div className="text-[10.5px] text-ink-muted">{t.category}</div>
                  </div>
                  <Pill intent={t.channel === "Email" ? "blue" : "purple"}>{t.channel}</Pill>
                </div>
                {t.subject && (
                  <div className="mb-2">
                    <div className="text-[10px] font-bold uppercase tracking-widest text-ink-muted mb-0.5">Subject</div>
                    <div className="text-[12px] font-semibold text-ink-2 truncate" title={t.subject}>{t.subject}</div>
                  </div>
                )}
                <div className="text-[11.5px] text-ink-muted leading-relaxed line-clamp-2 mb-3">
                  {t.preview}
                </div>
                <div className="flex items-center gap-2 pt-3 border-t border-border">
                  <span className="text-[10.5px] text-ink-muted">
                    Used in <strong className="text-ink-2">{t.uses}</strong> campaign{t.uses === 1 ? "" : "s"}
                  </span>
                  <div className="flex-1" />
                  <button className="btn btn-ghost btn-sm" onClick={() => toast(`✏ ${t.name} editor opened`)}>
                    ✏ Edit
                  </button>
                  <button
                    className="btn btn-primary btn-sm"
                    onClick={() => {
                      setNewOpen(true);
                      toast(`📋 Starting new campaign from ${t.name}`);
                    }}
                  >
                    + Use
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {tab === "segments" && (
        <div className="grid grid-cols-2 gap-3 max-[900px]:grid-cols-1">
          {segments.map((s) => (
            <div key={s.id} className="bg-surface border border-border rounded-lg overflow-hidden hover:border-border-2 transition-colors">
              <div className="p-4 flex items-center gap-4">
                <div className="w-12 h-12 rounded-md flex items-center justify-center text-[22px] flex-shrink-0 border border-border bg-surface-2" style={{ color: s.color }}>
                  {s.icon}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <div className="text-[14px] font-bold text-ink">{s.name}</div>
                    <Pill intent={s.type === "Dynamic" ? "green" : "muted"}>{s.type}</Pill>
                  </div>
                  <div className="text-[11.5px] text-ink-muted mb-2">{s.description}</div>
                  <div className="text-[18px] font-extrabold" style={{ color: s.color }}>
                    {s.count.toLocaleString()} <span className="text-[11px] font-bold text-ink-muted uppercase tracking-widest">people</span>
                  </div>
                </div>
                <div className="flex flex-col gap-1.5">
                  <button className="btn btn-primary btn-sm" onClick={() => {
                    setNewOpen(true);
                    toast(`📋 Starting new campaign for "${s.name}"`);
                  }}>
                    📣 Campaign
                  </button>
                  <button className="btn btn-ghost btn-sm" onClick={() => toast(`👥 Viewing ${s.count} members of ${s.name}`)}>
                    👥 View
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <NewCampaignModal
        open={newOpen}
        onClose={() => setNewOpen(false)}
        onCreate={(c) => {
          const created = addCampaign(c);
          toast(`✓ Campaign "${created.name}" ${created.status === "draft" ? "saved as draft" : "launched"}`);
        }}
      />
      <ConfirmModal
        open={!!removeTarget}
        onClose={() => setRemoveTarget(null)}
        onConfirm={() => {
          if (removeTarget) {
            removeCampaign(removeTarget.id);
            toast(`🗑 ${removeTarget.name} archived`);
          }
        }}
        icon="🗑"
        title="Archive campaign?"
        message={removeTarget ? `${removeTarget.name} will be archived. Historical metrics are retained for 7 years but the campaign won't appear in active lists.` : ""}
        confirmLabel="Archive campaign"
      />
      <Toast />
    </div>
  );
}

// ─── Campaign row ─────────────────────────────────────────────────────────
interface CampaignRowProps {
  key?: Key;
  campaign: Campaign;
  expanded: boolean;
  onToggle: () => void;
  onPause: () => void;
  onResume: () => void;
  onLaunch: () => void;
  onRemove: () => void;
  delay: number;
}

function CampaignRow({ campaign: c, expanded, onToggle, onPause, onResume, onLaunch, onRemove, delay }: CampaignRowProps) {
  const openRate  = c.delivered > 0 ? (c.opens / c.delivered) * 100 : 0;
  const clickRate = c.delivered > 0 ? (c.clicks / c.delivered) * 100 : 0;
  const convRate  = c.clicks > 0    ? (c.conversions / c.clicks) * 100 : 0;
  const cpa       = c.conversions > 0 ? c.revenue / c.conversions : 0;

  return (
    <>
      <tr
        onClick={onToggle}
        className="cursor-pointer hover:bg-surface-2 transition-colors animate-fadeUp"
        style={{ animationDelay: `${delay}ms` }}
      >
        <Td>
          <div className="flex items-center gap-2.5">
            <div
              className="w-8 h-8 rounded-md flex items-center justify-center text-[15px] flex-shrink-0 border border-border bg-surface-2"
              style={{ color: c.color }}
            >
              {c.icon}
            </div>
            <div className="min-w-0">
              <div className="text-[12.5px] font-bold truncate">{c.name}</div>
              {c.subject && <div className="text-[10.5px] text-ink-muted truncate max-w-[260px]">{c.subject}</div>}
            </div>
          </div>
        </Td>
        <Td>
          <Pill intent="muted">
            <span className="mr-1">{CHANNEL_ICON[c.channel]}</span> {c.type}
          </Pill>
        </Td>
        <Td><span className="text-[12px] text-ink-2">{c.audience}</span></Td>
        <Td><span className="font-mono text-[12.5px] font-bold">{c.sent.toLocaleString()}</span></Td>
        <Td>
          {c.delivered > 0 ? (
            <span className="font-mono text-[12px] font-semibold text-green">{openRate.toFixed(1)}%</span>
          ) : (
            <span className="text-[11px] text-ink-muted">—</span>
          )}
        </Td>
        <Td>
          {c.delivered > 0 ? (
            <span className="font-mono text-[12px] font-semibold text-brand-dk">{clickRate.toFixed(1)}%</span>
          ) : (
            <span className="text-[11px] text-ink-muted">—</span>
          )}
        </Td>
        <Td>
          {c.revenue > 0 ? (
            <span className="font-mono text-[12.5px] font-bold text-violet">${c.revenue.toLocaleString()}</span>
          ) : (
            <span className="text-[11px] text-ink-muted">—</span>
          )}
        </Td>
        <Td><Pill intent={STATUS_INTENT[c.status]} dot>{STATUS_LABEL[c.status]}</Pill></Td>
        <Td>
          <div className="flex gap-1">
            {c.status === "draft" && (
              <button
                className="px-2.5 py-1 rounded-md bg-brand text-white text-[11px] font-bold hover:bg-brand-dk transition-colors"
                onClick={(e) => { e.stopPropagation(); onLaunch(); }}
              >
                🚀 Launch
              </button>
            )}
            {c.status === "active" && (
              <button
                className="px-2.5 py-1 rounded-md bg-surface-2 border border-border text-[11px] font-semibold text-ink-2 hover:bg-amber-soft hover:border-amber transition-colors"
                onClick={(e) => { e.stopPropagation(); onPause(); }}
              >
                ⏸ Pause
              </button>
            )}
            {c.status === "paused" && (
              <button
                className="px-2.5 py-1 rounded-md bg-brand-soft border border-brand text-[11px] font-semibold text-brand-dk hover:bg-brand hover:text-white transition-colors"
                onClick={(e) => { e.stopPropagation(); onResume(); }}
              >
                ▶ Resume
              </button>
            )}
            <button
              className="px-2.5 py-1 rounded-md bg-surface-2 border border-border text-[11px] font-semibold text-ink-2 hover:bg-brand-soft hover:border-brand hover:text-brand-dk transition-colors"
              onClick={(e) => { e.stopPropagation(); onToggle(); }}
            >
              {expanded ? "Hide" : "View"}
            </button>
          </div>
        </Td>
      </tr>

      {expanded && (
        <tr>
          <td colSpan={9} className="py-[18px] px-[22px] border-b border-border-2" style={{ background: "#f8faff" }}>
            <div className="grid grid-cols-4 gap-3 mb-4 max-[800px]:grid-cols-2">
              <Field label="Campaign ID"      value={c.id} mono />
              <Field label="Created"          value={c.createdDate} mono />
              <Field label="Channel"          value={CHANNEL_LABEL[c.channel]} />
              <Field label="Type"             value={c.type} />
              <Field label="Audience Segment" value={c.audience} />
              {c.subject && <Field label="Subject Line" value={c.subject} />}
            </div>

            {/* Funnel breakdown */}
            <div className="bg-surface border border-border rounded-md overflow-hidden mb-3">
              <div className="bg-surface-2 py-2 px-4 border-b border-border text-[10.5px] font-bold uppercase tracking-widest text-ink-2">
                Conversion Funnel
              </div>
              <div className="p-4">
                <FunnelStep label="Sent"        count={c.sent}        prev={c.sent}        color="var(--color-ink-muted)" />
                <FunnelStep label="Delivered"   count={c.delivered}   prev={c.sent}        color="var(--color-blue)" />
                <FunnelStep label="Opens"       count={c.opens}       prev={c.delivered}   color="var(--color-green)" />
                <FunnelStep label="Clicks"      count={c.clicks}      prev={c.opens}       color="var(--color-brand)" />
                <FunnelStep label="Conversions" count={c.conversions} prev={c.clicks}      color="var(--color-violet)" />
              </div>
            </div>

            {/* Performance metrics */}
            <div className="bg-surface border border-border rounded-md p-3 mb-3">
              <div className="text-[10.5px] font-bold uppercase tracking-widest text-ink-muted mb-3">Performance Metrics</div>
              <div className="grid grid-cols-4 gap-2 max-[700px]:grid-cols-2">
                <MetricBox label="Open Rate"      value={`${openRate.toFixed(1)}%`}  color="var(--color-green)" />
                <MetricBox label="Click Rate"     value={`${clickRate.toFixed(1)}%`} color="var(--color-brand)" />
                <MetricBox label="Conv Rate"      value={`${convRate.toFixed(1)}%`}  color="var(--color-violet)" />
                <MetricBox label="Revenue / Conv" value={c.conversions > 0 ? `$${cpa.toFixed(0)}` : "—"} color="var(--color-amber)" />
              </div>
            </div>

            <div className="flex gap-2 flex-wrap">
              <button className="btn btn-ghost btn-sm" onClick={() => toast(`✏ ${c.name} editor opened`)}>
                ✏ Edit
              </button>
              <button className="btn btn-ghost btn-sm" onClick={() => toast(`📊 ${c.name} A/B test results`)}>
                📊 A/B Results
              </button>
              <button className="btn btn-ghost btn-sm" onClick={() => toast(`📋 ${c.name} duplicated`)}>
                📋 Duplicate
              </button>
              <button className="btn btn-ghost btn-sm" onClick={() => toast(`🧪 Sending test email to your inbox`)}>
                🧪 Send Test
              </button>
              <div className="flex-1" />
              <button
                className="btn btn-sm text-red border border-red-soft bg-transparent hover:bg-red-soft transition-colors"
                onClick={onRemove}
              >
                🗑 Archive
              </button>
            </div>
          </td>
        </tr>
      )}
    </>
  );
}

// ─── Funnel step ──────────────────────────────────────────────────────────
function FunnelStep({ label, count, prev, color }: { label: string; count: number; prev: number; color: string }) {
  const pct = prev > 0 ? (count / prev) * 100 : 0;
  return (
    <div className="flex items-center gap-3 py-1.5">
      <div className="w-24 text-[11.5px] font-semibold text-ink-2 text-right">{label}</div>
      <div className="flex-1 h-6 bg-surface-2 rounded overflow-hidden relative">
        <div
          className="h-full rounded transition-all flex items-center px-2"
          style={{ width: `${pct}%`, background: color, minWidth: count > 0 ? 50 : 0 }}
        >
          <span className="text-[10.5px] font-bold text-white whitespace-nowrap">
            {count.toLocaleString()}
          </span>
        </div>
        {count === 0 && (
          <span className="absolute left-2 top-1/2 -translate-y-1/2 text-[10.5px] text-ink-muted">—</span>
        )}
      </div>
      <div className="w-12 text-[10.5px] font-mono text-ink-muted text-right">
        {prev > 0 ? `${pct.toFixed(0)}%` : ""}
      </div>
    </div>
  );
}

// ─── Helpers ──────────────────────────────────────────────────────────────
function MetricBox({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div className="bg-surface-2 border border-border rounded p-2 text-center">
      <div className="text-[15px] font-extrabold leading-none" style={{ color }}>{value}</div>
      <div className="text-[9.5px] font-bold uppercase tracking-widest text-ink-muted mt-1">{label}</div>
    </div>
  );
}

function Field({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div>
      <div className="text-[10px] uppercase tracking-widest text-ink-muted font-bold mb-1">{label}</div>
      <div className={`text-[12.5px] font-semibold text-ink truncate ${mono ? "font-mono" : ""}`} title={value}>{value}</div>
    </div>
  );
}

function TabButton({ active, onClick, children }: { active: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={[
        "py-2.5 px-4 text-[13px] font-semibold cursor-pointer whitespace-nowrap transition-colors -mb-[1.5px] border-b-[2.5px] flex items-center gap-1.5",
        active ? "text-brand border-brand" : "text-ink-muted border-transparent hover:text-ink hover:bg-surface-2",
      ].join(" ")}
    >
      {children}
    </button>
  );
}

function CountBadge({ count }: { count: number }) {
  return (
    <span className="inline-flex items-center justify-center min-w-[18px] h-[17px] px-1.5 rounded-pill text-[10px] font-bold bg-surface-3 text-ink-muted">
      {count}
    </span>
  );
}

function Th({ children }: { children: ReactNode }) {
  return (
    <th className="py-2.5 px-3.5 text-left text-[10px] font-bold uppercase tracking-wider text-ink-muted border-b border-border whitespace-nowrap">
      {children}
    </th>
  );
}

function Td({ children }: { children: ReactNode }) {
  return <td className="py-2.5 px-3.5 border-b border-border align-middle">{children}</td>;
}
