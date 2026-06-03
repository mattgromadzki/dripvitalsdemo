"use client";

import { useMemo, useState } from "react";
import type { Key, ReactNode } from "react";
import { Pill } from "@/components/ui/Pill";
import { Toast } from "@/components/ui/Toast";
import { KpiCard, KpiGrid } from "@/components/ui/Kpi";
import { ConfirmModal } from "@/components/ui/ConfirmModal";
import { toast } from "@/lib/hooks/useToast";
import { useIntegrations } from "@/lib/hooks/useIntegrations";
import type { Integration, IntegrationStatus, IntegrationCategory, Webhook } from "@/lib/types";

const STATUS_LABEL: Record<IntegrationStatus, string> = {
  connected:    "✓ Connected",
  error:        "⚠ Error",
  disconnected: "Not Connected",
  configuring:  "⚙ Configuring",
};

const STATUS_INTENT: Record<IntegrationStatus, "green" | "red" | "muted" | "amber"> = {
  connected:    "green",
  error:        "red",
  disconnected: "muted",
  configuring:  "amber",
};

const CATEGORY_ICON: Record<IntegrationCategory, string> = {
  "Payments":       "💳",
  "Communications": "📨",
  "Video":          "🎥",
  "Labs":           "🧪",
  "Pharmacy":       "💊",
  "EHR":            "🏥",
  "e-Rx":           "📋",
  "Analytics":      "📊",
  "Storage":        "☁",
  "Other":          "🔧",
};

export default function IntegrationsPage() {
  const integrations  = useIntegrations((s) => s.integrations);
  const webhooks      = useIntegrations((s) => s.webhooks);
  const reconnect     = useIntegrations((s) => s.reconnect);
  const disconnect    = useIntegrations((s) => s.disconnect);
  const setStatus     = useIntegrations((s) => s.setStatus);
  const toggleWebhook = useIntegrations((s) => s.toggleWebhook);
  const removeWebhook = useIntegrations((s) => s.removeWebhook);

  const [category, setCategory]       = useState<"all" | IntegrationCategory>("all");
  const [expandedId, setExpandedId]   = useState<string | null>(null);
  const [removeWhTarget, setRemoveWhTarget] = useState<Webhook | null>(null);

  // KPIs
  const metrics = useMemo(() => {
    const connected = integrations.filter((i) => i.status === "connected").length;
    const error = integrations.filter((i) => i.status === "error").length;
    const disconnected = integrations.filter((i) => i.status === "disconnected").length;
    const monthlySpend = integrations.reduce((sum, i) => sum + (i.monthlySpend || 0), 0);

    return {
      total: integrations.length,
      connected, error, disconnected, monthlySpend,
    };
  }, [integrations]);

  // Errored integrations for banner
  const erroredIntegrations = useMemo(
    () => integrations.filter((i) => i.status === "error"),
    [integrations]
  );

  // Category counts
  const categoryCounts = useMemo(() => {
    const map: Record<string, number> = {};
    for (const i of integrations) map[i.category] = (map[i.category] || 0) + 1;
    return map;
  }, [integrations]);

  // Filtered list
  const filtered = useMemo(() => {
    let list = integrations;
    if (category !== "all") list = list.filter((i) => i.category === category);
    // Sort errored first, then connected, then disconnected
    return [...list].sort((a, b) => {
      const rank: Record<IntegrationStatus, number> = { error: 0, connected: 1, configuring: 2, disconnected: 3 };
      return rank[a.status] - rank[b.status];
    });
  }, [integrations, category]);

  function handleTestAll() {
    toast(`⚡ Testing ${integrations.length} integrations…`);
    setTimeout(() => {
      const connected = metrics.connected;
      const errors = metrics.error;
      const disconnected = metrics.disconnected;
      toast(`✅ ${connected} healthy · ${errors} error${errors === 1 ? "" : "s"} · ${disconnected} not connected`);
    }, 1200);
  }

  function handleCopyKey(name: string, key: string) {
    if (typeof navigator !== "undefined" && navigator.clipboard) {
      navigator.clipboard.writeText(key).catch(() => {});
    }
    toast(`📋 ${name} key copied to clipboard`);
  }

  return (
    <div className="px-7 py-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 mb-5 flex-wrap">
        <div>
          <div className="text-[22px] font-bold tracking-tight text-ink mb-1">Integrations Hub</div>
          <div className="text-[13px] text-ink-muted">
            {metrics.total} third-party connections · API keys · Webhooks · Monthly spend ${metrics.monthlySpend.toLocaleString()}
          </div>
        </div>
        <div className="flex gap-2">
          <button className="btn btn-ghost btn-sm" onClick={handleTestAll}>⚡ Test All</button>
          <button className="btn btn-primary btn-sm" onClick={() => toast("➕ Browse integration catalog…")}>+ Add Integration</button>
        </div>
      </div>

      {/* Error banner */}
      {erroredIntegrations.length > 0 && (
        <div
          className="border border-red-soft rounded-lg py-3.5 px-4 mb-4 flex items-center gap-3"
          style={{ borderLeft: "3px solid var(--color-red)", background: "rgba(192,57,43,.04)" }}
        >
          <span className="text-[20px] flex-shrink-0">🚨</span>
          <div className="flex-1">
            <div className="text-[13px] font-bold text-red">
              {erroredIntegrations.length} integration{erroredIntegrations.length === 1 ? "" : "s"} need{erroredIntegrations.length === 1 ? "s" : ""} attention
            </div>
            <div className="text-[12px] text-ink-2 mt-0.5">
              {erroredIntegrations.map((i, idx) => (
                <span key={i.id}>
                  <strong>{i.name}</strong> — {i.errorMessage || "Authentication error"}
                  {idx < erroredIntegrations.length - 1 ? " · " : ""}
                </span>
              ))}
            </div>
          </div>
          <button
            className="btn btn-primary btn-sm flex-shrink-0"
            onClick={() => {
              erroredIntegrations.forEach((i) => reconnect(i.id));
              toast(`✓ Reconnected ${erroredIntegrations.length} integration${erroredIntegrations.length === 1 ? "" : "s"}`);
            }}
          >
            🔑 Fix All
          </button>
        </div>
      )}

      {/* KPI strip */}
      <KpiGrid cols={4}>
        <KpiCard
          label="Total Integrations"
          value={metrics.total}
          icon="🔗"
          iconBg="var(--color-brand-soft)"
          iconColor="var(--color-brand)"
          trend={`${Object.keys(categoryCounts).length} categories`}
          trendColor="var(--color-brand)"
        />
        <KpiCard
          label="Connected"
          value={metrics.connected}
          icon="✅"
          iconBg="var(--color-green-soft)"
          iconColor="var(--color-green)"
          trend="Healthy & syncing"
          trendColor="var(--color-green)"
        />
        <KpiCard
          label="Errors"
          value={metrics.error}
          icon="⚠"
          iconBg="var(--color-red-soft)"
          iconColor="var(--color-red)"
          trend={metrics.error > 0 ? "Needs attention" : "All clear"}
          trendColor={metrics.error > 0 ? "var(--color-red)" : "var(--color-green)"}
        />
        <KpiCard
          label="Monthly Spend"
          value={`$${metrics.monthlySpend.toLocaleString()}`}
          icon="💸"
          iconBg="var(--color-violet-soft)"
          iconColor="var(--color-violet)"
          trend="Across all platforms"
          trendColor="var(--color-violet)"
        />
      </KpiGrid>

      {/* Category filter chips */}
      <div className="flex items-center gap-2 mb-4 flex-wrap">
        <button
          onClick={() => setCategory("all")}
          className={[
            "py-1.5 px-3 rounded-pill text-[11.5px] font-semibold border transition-colors",
            category === "all" ? "bg-brand text-white border-brand" : "bg-surface border-border text-ink-2 hover:border-border-2",
          ].join(" ")}
        >
          All ({metrics.total})
        </button>
        {(Object.keys(categoryCounts) as IntegrationCategory[]).map((c) => (
          <button
            key={c}
            onClick={() => setCategory(category === c ? "all" : c)}
            className={[
              "py-1.5 px-3 rounded-pill text-[11.5px] font-semibold border transition-colors flex items-center gap-1.5",
              category === c ? "bg-brand text-white border-brand" : "bg-surface border-border text-ink-2 hover:border-border-2",
            ].join(" ")}
          >
            <span>{CATEGORY_ICON[c]}</span>
            <span>{c}</span>
            <span
              className={[
                "inline-flex items-center justify-center min-w-[18px] h-[17px] px-1 rounded-pill text-[10px] font-bold",
                category === c ? "bg-white/20 text-white" : "bg-surface-3 text-ink-muted",
              ].join(" ")}
            >
              {categoryCounts[c]}
            </span>
          </button>
        ))}
      </div>

      {/* Integration grid */}
      <div className="grid grid-cols-3 gap-3 mb-5 max-[1100px]:grid-cols-2 max-[700px]:grid-cols-1">
        {filtered.map((i) => (
          <IntegrationCard
            key={i.id}
            integration={i}
            expanded={expandedId === i.id}
            onToggle={() => setExpandedId(expandedId === i.id ? null : i.id)}
            onReconnect={() => {
              reconnect(i.id);
              toast(`✓ ${i.name} reconnected`);
            }}
            onDisconnect={() => {
              disconnect(i.id);
              toast(`🔌 ${i.name} disconnected`);
            }}
            onConfigure={() => {
              setStatus(i.id, "configuring");
              setTimeout(() => {
                setStatus(i.id, "connected");
                toast(`✓ ${i.name} configured`);
              }, 800);
            }}
            onTest={() => {
              toast(`🧪 Testing ${i.name}…`);
              setTimeout(() => toast(`✅ ${i.name} responded in 142ms`), 700);
            }}
            onCopyKey={(key) => handleCopyKey(i.name, key)}
          />
        ))}
      </div>

      {/* Webhooks section */}
      <div className="bg-surface border border-border rounded-lg overflow-hidden">
        <div className="py-3 px-5 bg-surface-2 border-b border-border flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-md flex items-center justify-center text-[13px] flex-shrink-0 border border-border bg-surface" style={{ background: "var(--color-violet-soft)", color: "var(--color-violet)" }}>
            🪝
          </div>
          <div className="text-[13px] font-bold uppercase tracking-wider text-ink-2 flex-1">Outgoing Webhooks</div>
          <div className="text-[11px] text-ink-muted mr-3">
            {webhooks.filter((w) => w.isActive).length} active · {webhooks.reduce((sum, w) => sum + w.totalCalls, 0).toLocaleString()} total calls
          </div>
          <button className="btn btn-ghost btn-sm" onClick={() => toast("➕ New webhook editor opened")}>+ Add Webhook</button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-[13px]">
            <thead className="bg-surface-2">
              <tr>
                <Th>Endpoint URL</Th>
                <Th>Events</Th>
                <Th>Last Fired</Th>
                <Th>Success Rate</Th>
                <Th>Total Calls</Th>
                <Th>Status</Th>
                <Th>{""}</Th>
              </tr>
            </thead>
            <tbody>
              {webhooks.map((w, i) => (
                <tr key={w.id} className="hover:bg-surface-2 transition-colors animate-fadeUp" style={{ animationDelay: `${i * 30}ms` }}>
                  <Td>
                    <code className="font-mono text-[11px] text-brand-dk font-semibold break-all">{w.endpointUrl}</code>
                    {w.notes && (
                      <div className="text-[10.5px] text-ink-muted mt-0.5">💡 {w.notes}</div>
                    )}
                  </Td>
                  <Td>
                    <div className="flex flex-wrap gap-1 max-w-[260px]">
                      {w.events.map((e) => (
                        <span key={e} className="font-mono text-[10px] py-0.5 px-1.5 rounded bg-brand-soft text-brand-dk border border-brand-soft">
                          {e}
                        </span>
                      ))}
                    </div>
                  </Td>
                  <Td><span className="font-mono text-[11px] text-ink-muted">{w.lastFired}</span></Td>
                  <Td>
                    <span
                      className="font-mono text-[12.5px] font-bold"
                      style={{ color: w.successRate >= 99 ? "var(--color-green)" : w.successRate >= 95 ? "var(--color-amber)" : "var(--color-red)" }}
                    >
                      {w.successRate}%
                    </span>
                  </Td>
                  <Td><span className="font-mono text-[12px]">{w.totalCalls.toLocaleString()}</span></Td>
                  <Td><Pill intent={w.isActive ? "green" : "muted"} dot>{w.isActive ? "Active" : "Paused"}</Pill></Td>
                  <Td>
                    <div className="flex gap-1">
                      <button
                        className="px-2.5 py-1 rounded-md bg-surface-2 border border-border text-[11px] font-semibold text-ink-2 hover:bg-brand-soft hover:border-brand hover:text-brand-dk transition-colors"
                        onClick={() => toast(`🧪 Test webhook sent to ${w.endpointUrl.split("/").slice(-1)[0]}`)}
                      >
                        🧪 Test
                      </button>
                      <button
                        className="px-2.5 py-1 rounded-md bg-surface-2 border border-border text-[11px] font-semibold text-ink-2 hover:bg-amber-soft hover:border-amber hover:text-amber transition-colors"
                        onClick={() => {
                          toggleWebhook(w.id);
                          toast(`${w.isActive ? "⏸" : "▶"} ${w.id} ${w.isActive ? "paused" : "resumed"}`);
                        }}
                      >
                        {w.isActive ? "⏸" : "▶"}
                      </button>
                      <button
                        className="px-2.5 py-1 rounded-md bg-surface-2 border border-border text-[11px] font-semibold text-ink-muted hover:bg-red-soft hover:border-red hover:text-red transition-colors"
                        onClick={() => setRemoveWhTarget(w)}
                      >
                        🗑
                      </button>
                    </div>
                  </Td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="py-2.5 px-[18px] border-t border-border bg-surface-2 text-[11.5px] text-ink-muted flex items-center justify-between">
          <span>{webhooks.length} webhooks configured</span>
          <span>Webhook signing: <strong className="text-green">HMAC-SHA256</strong></span>
        </div>
      </div>

      <ConfirmModal
        open={!!removeWhTarget}
        onClose={() => setRemoveWhTarget(null)}
        onConfirm={() => {
          if (removeWhTarget) {
            removeWebhook(removeWhTarget.id);
            toast(`🗑 Webhook removed`);
          }
        }}
        icon="🗑"
        title="Remove webhook?"
        message={removeWhTarget ? `${removeWhTarget.endpointUrl} will no longer receive events. Existing event history is preserved.` : ""}
        confirmLabel="Remove webhook"
      />
      <Toast />
    </div>
  );
}

// ─── Integration card ─────────────────────────────────────────────────────
interface IntegrationCardProps {
  key?: Key;
  integration: Integration;
  expanded: boolean;
  onToggle: () => void;
  onReconnect: () => void;
  onDisconnect: () => void;
  onConfigure: () => void;
  onTest: () => void;
  onCopyKey: (key: string) => void;
}

function IntegrationCard({ integration: i, expanded, onToggle, onReconnect, onDisconnect, onConfigure, onTest, onCopyKey }: IntegrationCardProps) {
  const isError = i.status === "error";
  const isConnected = i.status === "connected";
  const isDisconnected = i.status === "disconnected";

  return (
    <div
      className={[
        "bg-surface border rounded-lg overflow-hidden transition-all",
        expanded ? "border-brand shadow-md" : isError ? "border-red-soft" : "border-border hover:border-border-2",
      ].join(" ")}
      style={{
        borderLeft: isError ? "3px solid var(--color-red)" : undefined,
      }}
    >
      <button
        onClick={onToggle}
        className="w-full text-left p-4 hover:bg-surface-2 transition-colors"
      >
        <div className="flex items-start gap-3 mb-2">
          <div
            className="w-11 h-11 rounded-md flex items-center justify-center text-[22px] flex-shrink-0 border border-border bg-surface-2"
            style={{ color: i.color }}
          >
            {i.icon}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5 mb-0.5 flex-wrap">
              <div className="text-[14px] font-bold text-ink">{i.name}</div>
            </div>
            <div className="text-[10.5px] text-ink-muted">
              {CATEGORY_ICON[i.category]} {i.category}
            </div>
          </div>
          <Pill intent={STATUS_INTENT[i.status]} dot={isError || isConnected}>
            {STATUS_LABEL[i.status]}
          </Pill>
        </div>

        <div className="text-[11.5px] text-ink-2 leading-relaxed line-clamp-2 mb-2">
          {i.description}
        </div>

        {i.usage && (
          <div
            className="text-[11px] font-semibold"
            style={{ color: isError ? "var(--color-red)" : isDisconnected ? "var(--color-ink-muted)" : i.color }}
          >
            {isError ? "⚠ " : ""}{i.usage}
          </div>
        )}
      </button>

      {expanded && (
        <div className="border-t border-border bg-surface-2 p-4 space-y-3">
          {isError && i.errorMessage && (
            <div className="bg-red-soft border border-red-soft rounded-md p-2.5 text-[11.5px] text-red">
              <strong>⚠ Error:</strong> {i.errorMessage}
            </div>
          )}

          <div className="grid grid-cols-2 gap-2.5">
            {i.endpoint && <Field label="Endpoint"  value={i.endpoint} mono />}
            {i.lastSync && <Field label="Last Sync" value={i.lastSync} mono />}
            {i.setupDate && <Field label="Connected Since" value={i.setupDate} mono />}
            {i.monthlySpend !== undefined && i.monthlySpend > 0 && (
              <Field label="Monthly Cost" value={`$${i.monthlySpend.toLocaleString()}`} mono />
            )}
          </div>

          {i.apiKeyMasked && (
            <div>
              <div className="text-[10px] uppercase tracking-widest text-ink-muted font-bold mb-1">API Key</div>
              <div className="flex items-center gap-2">
                <code className="flex-1 font-mono text-[11.5px] bg-surface border border-border rounded px-2.5 py-1.5 text-ink-2 truncate" title={i.apiKeyMasked}>
                  {i.apiKeyMasked}
                </code>
                <button
                  className="btn btn-ghost btn-sm flex-shrink-0"
                  onClick={() => onCopyKey(i.apiKeyMasked || "")}
                  title="Copy"
                >
                  📋
                </button>
                <button
                  className="btn btn-ghost btn-sm flex-shrink-0"
                  onClick={() => toast(`🔑 Rotating ${i.name} key…`)}
                  title="Rotate"
                >
                  🔄
                </button>
              </div>
            </div>
          )}

          {i.webhookEndpoint && (
            <div>
              <div className="text-[10px] uppercase tracking-widest text-ink-muted font-bold mb-1">Webhook URL (Receiving)</div>
              <code className="block font-mono text-[10.5px] bg-surface border border-border rounded px-2.5 py-1.5 text-brand-dk break-all">
                {i.webhookEndpoint}
              </code>
            </div>
          )}

          {i.documentation && (
            <div className="text-[11px] text-ink-muted">
              📚 <a href="#" onClick={(e) => { e.preventDefault(); toast(`Opening ${i.name} docs…`); }} className="text-brand-dk font-semibold hover:underline">
                View {i.name} API documentation →
              </a>
            </div>
          )}

          <div className="flex gap-1.5 flex-wrap pt-2 border-t border-border">
            {isError && (
              <button className="btn btn-primary btn-sm" onClick={onReconnect}>
                🔑 Reconnect
              </button>
            )}
            {isDisconnected && (
              <button className="btn btn-primary btn-sm" onClick={onConfigure}>
                + Connect
              </button>
            )}
            {isConnected && (
              <>
                <button className="btn btn-ghost btn-sm" onClick={onTest}>
                  🧪 Test Connection
                </button>
                <button className="btn btn-ghost btn-sm" onClick={() => toast(`⚙ ${i.name} settings opened`)}>
                  ⚙ Configure
                </button>
                <button className="btn btn-ghost btn-sm" onClick={() => toast(`📊 ${i.name} usage report opened`)}>
                  📊 Usage
                </button>
                <button
                  className="btn btn-sm text-red border border-red-soft bg-transparent hover:bg-red-soft transition-colors ml-auto"
                  onClick={onDisconnect}
                >
                  🔌 Disconnect
                </button>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Helpers ──────────────────────────────────────────────────────────────
function Field({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div>
      <div className="text-[10px] uppercase tracking-widest text-ink-muted font-bold mb-0.5">{label}</div>
      <div className={`text-[11.5px] font-semibold text-ink truncate ${mono ? "font-mono" : ""}`} title={value}>
        {value}
      </div>
    </div>
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
  return <td className="py-2.5 px-3.5 border-b border-border align-top">{children}</td>;
}
