"use client";

import { useMemo, useState } from "react";
import type { Key, ReactNode } from "react";
import { Pill } from "@/components/ui/Pill";
import { Toast } from "@/components/ui/Toast";
import { KpiCard, KpiGrid } from "@/components/ui/Kpi";
import { toast } from "@/lib/hooks/useToast";
import { useNotifications } from "@/lib/hooks/useNotifications";
import type { NotificationCategory, NotificationChannel, NotificationRule } from "@/lib/types";

type Tab = "clinical" | "patient" | "staff" | "log";

const TAB_LABEL: Record<Tab, string> = {
  clinical: "Clinical Alerts",
  patient:  "Patient Comms",
  staff:    "Staff Alerts",
  log:      "Delivery Log",
};

const CHANNEL_LABEL: Record<NotificationChannel, string> = {
  email: "Email",
  sms:   "SMS",
  push:  "Push",
  in_app:"In-app",
};

const CHANNEL_ICON: Record<NotificationChannel, string> = {
  email: "✉",
  sms:   "💬",
  push:  "📲",
  in_app:"🔔",
};

const CATEGORY_LABEL: Record<NotificationCategory | "system", string> = {
  clinical: "Clinical",
  patient:  "Patient",
  staff:    "Staff",
  system:   "System",
};

const CATEGORY_INTENT: Record<NotificationCategory | "system", "red" | "brand" | "blue" | "muted"> = {
  clinical: "red",
  patient:  "brand",
  staff:    "blue",
  system:   "muted",
};

export default function NotificationsPage() {
  const rules         = useNotifications((s) => s.rules);
  const log           = useNotifications((s) => s.log);
  const quietHours    = useNotifications((s) => s.quietHours);
  const toggleChannel = useNotifications((s) => s.toggleChannel);
  const toggleAllForRule = useNotifications((s) => s.toggleAllForRule);
  const setQuietHours = useNotifications((s) => s.setQuietHours);
  const retryDelivery = useNotifications((s) => s.retryDelivery);

  const [tab, setTab]     = useState<Tab>("clinical");
  const [search, setSearch] = useState("");

  // Channel availability — synthetic config
  const channels = {
    email:  { configured: true,  provider: "Resend",   status: "Healthy" },
    sms:    { configured: true,  provider: "Twilio",   status: "Healthy" },
    push:   { configured: true,  provider: "OneSignal", status: "Healthy" },
    in_app: { configured: true,  provider: "Native",   status: "Healthy" },
  };

  // KPIs
  const counts = useMemo(() => {
    return {
      total: rules.length,
      activeRules: rules.filter((r) => Object.values(r.channels).some((v) => v)).length,
      sentToday:   log.filter((l) => l.time.includes("AM") || l.time.includes("PM") && !l.time.toLowerCase().includes("yesterday") && !l.time.startsWith("May 2")).length,
      failed:      log.filter((l) => l.status === "failed").length,
    };
  }, [rules, log]);

  // Filtered rules by tab
  const tabRules = useMemo(() => {
    if (tab === "log") return [];
    return rules.filter((r) => r.category === tab);
  }, [rules, tab]);

  // Filtered log by search + category
  const filteredLog = useMemo(() => {
    let list = log;
    if (search) {
      const q = search.toLowerCase();
      list = list.filter((l) =>
        l.event.toLowerCase().includes(q) ||
        l.recipient.toLowerCase().includes(q)
      );
    }
    return [...list].sort((a, b) => b.orderedAt - a.orderedAt);
  }, [log, search]);

  function handleSaveAll() {
    toast("💾 Notification settings saved · All staff will be notified of changes");
  }

  return (
    <div className="px-7 py-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 mb-5 flex-wrap">
        <div>
          <div className="text-[22px] font-bold tracking-tight text-ink mb-1">Notifications Center</div>
          <div className="text-[13px] text-ink-muted">
            Alert settings · Delivery channels · Quiet hours · HIPAA-compliant routing
          </div>
        </div>
        <div className="flex gap-2">
          <button className="btn btn-ghost btn-sm" onClick={() => toast("🧪 Test notification sent to your email + SMS")}>
            🧪 Test Channels
          </button>
          <button className="btn btn-primary btn-sm" onClick={handleSaveAll}>
            💾 Save Changes
          </button>
        </div>
      </div>

      {/* KPI strip */}
      <KpiGrid cols={4}>
        <KpiCard
          label="Active Rules"
          value={counts.activeRules}
          icon="🔔"
          iconBg="var(--color-brand-soft)"
          iconColor="var(--color-brand)"
          trend={`${counts.total} configured`}
          trendColor="var(--color-brand)"
        />
        <KpiCard
          label="Sent Today"
          value={6}
          icon="📤"
          iconBg="var(--color-green-soft)"
          iconColor="var(--color-green)"
          trend="↑ +18% vs yesterday"
          trendColor="var(--color-green)"
        />
        <KpiCard
          label="Failed"
          value={counts.failed}
          icon="❌"
          iconBg="var(--color-red-soft)"
          iconColor="var(--color-red)"
          trend={counts.failed > 0 ? "Retry recommended" : "All delivered"}
          trendColor={counts.failed > 0 ? "var(--color-red)" : "var(--color-green)"}
        />
        <KpiCard
          label="Quiet Hours"
          value={quietHours.enabled ? `${quietHours.startHour}–${quietHours.endHour}` : "Off"}
          icon="🌙"
          iconBg="var(--color-violet-soft)"
          iconColor="var(--color-violet)"
          trend={quietHours.exceptUrgent ? "Urgent bypass: ON" : "Urgent bypass: OFF"}
          trendColor="var(--color-violet)"
        />
      </KpiGrid>

      {/* Channel status strip */}
      <div className="bg-surface border border-border rounded-lg p-4 mb-4">
        <div className="text-[10.5px] font-bold uppercase tracking-widest text-ink-muted mb-3">Delivery Channels · Provider Status</div>
        <div className="grid grid-cols-4 gap-2.5 max-[700px]:grid-cols-2">
          {(Object.entries(channels) as [NotificationChannel, typeof channels.email][]).map(([ch, cfg]) => (
            <div key={ch} className="flex items-center gap-3 bg-surface-2 border border-border rounded-md p-2.5">
              <div className="w-9 h-9 rounded-md flex items-center justify-center text-[16px] flex-shrink-0 bg-surface border border-border">
                {CHANNEL_ICON[ch]}
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-[12.5px] font-bold text-ink">{CHANNEL_LABEL[ch]}</div>
                <div className="text-[10.5px] text-ink-muted">{cfg.provider}</div>
              </div>
              <Pill intent="green" dot>{cfg.status}</Pill>
            </div>
          ))}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b-[1.5px] border-border mb-4 gap-1 overflow-x-auto">
        <TabButton active={tab === "clinical"} onClick={() => setTab("clinical")}>
          {TAB_LABEL.clinical} <CountBadge count={rules.filter((r) => r.category === "clinical").length} />
        </TabButton>
        <TabButton active={tab === "patient"} onClick={() => setTab("patient")}>
          {TAB_LABEL.patient} <CountBadge count={rules.filter((r) => r.category === "patient").length} />
        </TabButton>
        <TabButton active={tab === "staff"} onClick={() => setTab("staff")}>
          {TAB_LABEL.staff} <CountBadge count={rules.filter((r) => r.category === "staff").length} />
        </TabButton>
        <TabButton active={tab === "log"} onClick={() => setTab("log")}>
          {TAB_LABEL.log} <CountBadge count={log.length} />
        </TabButton>
      </div>

      {/* Tab content */}
      {tab !== "log" ? (
        <div className="space-y-3">
          <div className="bg-surface border border-border rounded-lg overflow-hidden">
            <div className="py-3 px-5 bg-surface-2 border-b border-border flex items-center gap-3">
              <div className="text-[13px] font-bold uppercase tracking-wider text-ink-2 flex-1">
                {TAB_LABEL[tab]}
              </div>
              <div className="flex gap-2 text-[10px] font-bold uppercase tracking-widest text-ink-muted">
                <span className="w-12 text-center">Email</span>
                <span className="w-12 text-center">SMS</span>
                <span className="w-12 text-center">Push</span>
                <span className="w-12 text-center">In-app</span>
              </div>
            </div>
            <div>
              {tabRules.map((r, i) => (
                <RuleRow
                  key={r.id}
                  rule={r}
                  onToggle={(ch) => {
                    toggleChannel(r.id, ch);
                    toast(`⚙ ${r.title} · ${CHANNEL_LABEL[ch]} ${r.channels[ch] ? "disabled" : "enabled"}`);
                  }}
                  onToggleAll={(enabled) => {
                    toggleAllForRule(r.id, enabled);
                    toast(`⚙ ${r.title} · all channels ${enabled ? "enabled" : "disabled"}`);
                  }}
                  isLast={i === tabRules.length - 1}
                />
              ))}
            </div>
          </div>

          {/* Quiet Hours card (only show on clinical/patient/staff tabs) */}
          <div className="bg-surface border border-border rounded-lg overflow-hidden">
            <div className="py-3 px-5 bg-surface-2 border-b border-border flex items-center gap-2.5">
              <div className="w-7 h-7 rounded-md flex items-center justify-center text-[13px] flex-shrink-0 border border-border bg-surface" style={{ background: "var(--color-violet-soft)", color: "var(--color-violet)" }}>
                🌙
              </div>
              <div className="text-[13px] font-bold uppercase tracking-wider text-ink-2">Quiet Hours</div>
              <div className="flex-1" />
              <Toggle
                enabled={quietHours.enabled}
                onClick={() => {
                  setQuietHours({ enabled: !quietHours.enabled });
                  toast(`🌙 Quiet hours ${quietHours.enabled ? "disabled" : "enabled"}`);
                }}
              />
            </div>
            <div className="p-5">
              <div className="text-[12px] text-ink-muted mb-4">
                Pause non-urgent notifications during quiet hours. Urgent clinical alerts (critical labs, abnormal vitals) bypass quiet hours by default.
              </div>
              <div className="grid grid-cols-3 gap-3 max-[700px]:grid-cols-1">
                <div>
                  <label className="fl">Start Time</label>
                  <select
                    className="fsel"
                    value={quietHours.startHour}
                    onChange={(e) => setQuietHours({ startHour: parseInt(e.target.value, 10) })}
                    disabled={!quietHours.enabled}
                  >
                    {Array.from({ length: 24 }, (_, h) => (
                      <option key={h} value={h}>{formatHour(h)}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="fl">End Time</label>
                  <select
                    className="fsel"
                    value={quietHours.endHour}
                    onChange={(e) => setQuietHours({ endHour: parseInt(e.target.value, 10) })}
                    disabled={!quietHours.enabled}
                  >
                    {Array.from({ length: 24 }, (_, h) => (
                      <option key={h} value={h}>{formatHour(h)}</option>
                    ))}
                  </select>
                </div>
                <div className="flex items-end">
                  <label className="flex items-center gap-2 cursor-pointer text-[12.5px] font-semibold text-ink-2 select-none">
                    <input
                      type="checkbox"
                      checked={quietHours.exceptUrgent}
                      onChange={() => setQuietHours({ exceptUrgent: !quietHours.exceptUrgent })}
                      disabled={!quietHours.enabled}
                      style={{ accentColor: "var(--color-brand)" }}
                    />
                    Always allow urgent clinical alerts
                  </label>
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : (
        // Delivery Log tab
        <div className="bg-surface border border-border rounded-lg overflow-hidden">
          <div className="py-3 px-5 bg-surface-2 border-b border-border flex items-center gap-2.5 flex-wrap">
            <div className="w-7 h-7 rounded-md flex items-center justify-center text-[13px] flex-shrink-0 border border-border bg-surface" style={{ background: "var(--color-brand-soft)", color: "var(--color-brand)" }}>
              📋
            </div>
            <div className="text-[13px] font-bold uppercase tracking-wider text-ink-2">Delivery Log</div>
            <div className="flex-1" />
            <div className="flex items-center gap-1.5 bg-surface border border-border rounded-pill py-1 px-3.5 min-w-[240px] focus-within:border-brand focus-within:shadow-[0_0_0_3px_rgba(31,138,112,.18)]">
              <span className="text-ink-muted text-[13px]">🔍</span>
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search by event or recipient…"
                className="flex-1 bg-transparent border-none outline-none text-[12px] text-ink placeholder:text-ink-muted"
              />
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-[13px]">
              <thead className="bg-surface-2">
                <tr>
                  <Th>Time</Th>
                  <Th>Event</Th>
                  <Th>Category</Th>
                  <Th>Recipient</Th>
                  <Th>Channels</Th>
                  <Th>Status</Th>
                  <Th>{""}</Th>
                </tr>
              </thead>
              <tbody>
                {filteredLog.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-12 text-center text-ink-muted">
                      <div className="text-[36px] opacity-40 mb-2">📋</div>
                      <div className="text-[13px] font-bold text-ink mb-0.5">No deliveries match</div>
                      <div className="text-[11.5px]">Try a different search term</div>
                    </td>
                  </tr>
                ) : (
                  filteredLog.map((l, i) => (
                    <tr
                      key={l.id}
                      className="hover:bg-surface-2 transition-colors animate-fadeUp"
                      style={{
                        animationDelay: `${i * 20}ms`,
                        borderLeft: l.status === "failed" ? "3px solid var(--color-red)" : undefined,
                      }}
                    >
                      <Td><span className="font-mono text-[11px] text-ink-muted">{l.time}</span></Td>
                      <Td><span className="text-[12.5px] font-semibold">{l.event}</span></Td>
                      <Td><Pill intent={CATEGORY_INTENT[l.category]}>{CATEGORY_LABEL[l.category]}</Pill></Td>
                      <Td><span className="text-[12px] text-ink-2">{l.recipient}</span></Td>
                      <Td>
                        <div className="flex gap-1">
                          {l.channels.map((ch) => (
                            <span
                              key={ch}
                              title={CHANNEL_LABEL[ch]}
                              className="inline-flex items-center justify-center w-6 h-6 rounded text-[11px] bg-surface-2 border border-border"
                            >
                              {CHANNEL_ICON[ch]}
                            </span>
                          ))}
                        </div>
                      </Td>
                      <Td>
                        {l.status === "delivered" ? (
                          <Pill intent="green" dot>✓ Delivered</Pill>
                        ) : l.status === "failed" ? (
                          <div>
                            <Pill intent="red" dot>Failed</Pill>
                            {l.errorMessage && <div className="text-[10px] text-red mt-0.5 max-w-[200px]">{l.errorMessage}</div>}
                          </div>
                        ) : (
                          <Pill intent="amber" dot>Pending</Pill>
                        )}
                      </Td>
                      <Td>
                        {l.status === "failed" && (
                          <button
                            className="px-2.5 py-1 rounded-md bg-red-soft border border-red text-[11px] font-semibold text-red hover:bg-red hover:text-white transition-colors"
                            onClick={() => {
                              retryDelivery(l.id);
                              toast(`🔄 Retried delivery to ${l.recipient}`);
                            }}
                          >
                            🔄 Retry
                          </button>
                        )}
                      </Td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
          <div className="py-2.5 px-[18px] border-t border-border bg-surface-2 text-[11.5px] text-ink-muted">
            Showing {filteredLog.length} of {log.length} log entries · Retained 90 days per HIPAA audit policy
          </div>
        </div>
      )}

      <Toast />
    </div>
  );
}

// ─── Rule row with channel toggles ────────────────────────────────────────
interface RuleRowProps {
  key?: Key;
  rule: NotificationRule;
  onToggle: (channel: NotificationChannel) => void;
  onToggleAll: (enabled: boolean) => void;
  isLast: boolean;
}

function RuleRow({ rule: r, onToggle, onToggleAll, isLast }: RuleRowProps) {
  const allOn = Object.values(r.channels).every((v) => v);
  const anyOn = Object.values(r.channels).some((v) => v);

  return (
    <div
      className={`flex items-center gap-3 py-3 px-5 ${isLast ? "" : "border-b border-border"} hover:bg-surface-2 transition-colors`}
    >
      <div className="w-9 h-9 rounded-md flex items-center justify-center text-[16px] flex-shrink-0 border border-border bg-surface-2">
        {r.icon}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <div className="text-[13px] font-bold text-ink">{r.title}</div>
          {!anyOn && <Pill intent="muted">Disabled</Pill>}
        </div>
        <div className="text-[11.5px] text-ink-muted truncate">{r.description}</div>
      </div>
      <div className="flex gap-2 flex-shrink-0">
        {(["email", "sms", "push", "in_app"] as NotificationChannel[]).map((ch) => (
          <ChannelToggle
            key={ch}
            channel={ch}
            enabled={r.channels[ch]}
            onClick={() => onToggle(ch)}
          />
        ))}
      </div>
      <button
        onClick={() => onToggleAll(!allOn)}
        className="ml-2 text-[10.5px] font-bold uppercase tracking-widest text-ink-muted hover:text-brand-dk transition-colors px-2 py-1.5"
        title={allOn ? "Disable all channels" : "Enable all channels"}
      >
        {allOn ? "Off" : "All"}
      </button>
    </div>
  );
}

interface ChannelToggleProps {
  key?: Key;
  channel: NotificationChannel;
  enabled: boolean;
  onClick: () => void;
}

function ChannelToggle({ channel, enabled, onClick }: ChannelToggleProps) {
  return (
    <button
      onClick={onClick}
      title={`${CHANNEL_LABEL[channel]} · ${enabled ? "ON" : "OFF"}`}
      className={[
        "w-12 h-12 rounded-md flex flex-col items-center justify-center transition-all",
        enabled
          ? "bg-brand-soft border border-brand text-brand-dk shadow-sm"
          : "bg-surface-2 border border-border text-ink-muted hover:border-border-2",
      ].join(" ")}
    >
      <span className="text-[14px] leading-none mb-0.5">{CHANNEL_ICON[channel]}</span>
      <span className="text-[8.5px] font-bold uppercase tracking-wider leading-none">{CHANNEL_LABEL[channel]}</span>
    </button>
  );
}

// ─── Toggle switch (used for quiet hours) ─────────────────────────────────
function Toggle({ enabled, onClick }: { enabled: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={[
        "relative w-11 h-6 rounded-pill transition-colors flex-shrink-0",
        enabled ? "bg-brand" : "bg-surface-3 border border-border",
      ].join(" ")}
    >
      <span
        className="absolute top-[2px] w-[18px] h-[18px] rounded-full bg-white shadow transition-all"
        style={{ left: enabled ? "calc(100% - 20px)" : "2px" }}
      />
    </button>
  );
}

function formatHour(h: number): string {
  if (h === 0) return "12:00 AM (midnight)";
  if (h === 12) return "12:00 PM (noon)";
  if (h < 12) return `${h}:00 AM`;
  return `${h - 12}:00 PM`;
}

// ─── Helpers ──────────────────────────────────────────────────────────────
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
