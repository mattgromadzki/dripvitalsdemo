"use client";

import { useMemo, useState } from "react";
import type { Key, ReactNode } from "react";
import { Pill } from "@/components/ui/Pill";
import { Toast } from "@/components/ui/Toast";
import { KpiCard, KpiGrid } from "@/components/ui/Kpi";
import { ReorderModal } from "@/components/modules/ReorderModal";
import { toast } from "@/lib/hooks/useToast";
import { useInventory } from "@/lib/hooks/useInventory";
import type { InventoryItem, InventoryStatus, InventoryCategory } from "@/lib/types";

type Filter = "all" | "critical" | "low" | "ok" | "on_order" | InventoryCategory;

const STATUS_LABEL: Record<InventoryStatus, string> = {
  ok:       "In Stock",
  low:      "Low Stock",
  critical: "🔴 Critical",
  on_order: "On Order",
};

const STATUS_INTENT: Record<InventoryStatus, "green" | "amber" | "red" | "blue"> = {
  ok:       "green",
  low:      "amber",
  critical: "red",
  on_order: "blue",
};

const CATEGORY_INTENT: Record<InventoryCategory, "brand" | "purple" | "teal" | "blue" | "muted"> = {
  "GLP-1":      "brand",
  "IV Therapy": "purple",
  "Oral":       "teal",
  "Injectable": "blue",
  "Other":      "muted",
};

export default function InventoryPage() {
  const items   = useInventory((s) => s.items);
  const reorder = useInventory((s) => s.reorder);
  const receive = useInventory((s) => s.receive);

  const [filter, setFilter] = useState<Filter>("all");
  const [search, setSearch] = useState("");
  const [reorderTarget, setReorderTarget] = useState<InventoryItem | null>(null);

  // KPIs
  const counts = useMemo(() => {
    return {
      total:    items.length,
      ok:       items.filter((i) => i.status === "ok").length,
      low:      items.filter((i) => i.status === "low").length,
      critical: items.filter((i) => i.status === "critical").length,
      onOrder:  items.filter((i) => (i.onOrder || 0) > 0).length,
      totalValue: items.reduce((sum, i) => sum + i.stock * (i.pricePerUnit || 0), 0),
    };
  }, [items]);

  // Categories for chip generation
  const categories = useMemo(() => {
    return Array.from(new Set(items.map((i) => i.category))) as InventoryCategory[];
  }, [items]);

  // Critical items list for the alert banner
  const criticalItems = useMemo(() => items.filter((i) => i.status === "critical"), [items]);

  // Filtered list
  const filtered = useMemo(() => {
    let list = items;
    if (filter === "critical" || filter === "low" || filter === "ok") {
      list = list.filter((i) => i.status === filter);
    } else if (filter === "on_order") {
      list = list.filter((i) => (i.onOrder || 0) > 0);
    } else if (filter !== "all") {
      list = list.filter((i) => i.category === filter);
    }
    if (search) {
      const q = search.toLowerCase();
      list = list.filter((i) =>
        i.name.toLowerCase().includes(q) ||
        i.category.toLowerCase().includes(q) ||
        i.pharmacy.toLowerCase().includes(q)
      );
    }
    // Sort: critical first, then low, then by name
    const statusRank: Record<InventoryStatus, number> = { critical: 0, low: 1, ok: 2, on_order: 3 };
    return [...list].sort((a, b) => {
      if (a.status !== b.status) return statusRank[a.status] - statusRank[b.status];
      return a.name.localeCompare(b.name);
    });
  }, [items, filter, search]);

  function exportCsv() {
    const header = ["SKU ID", "Medication", "Category", "Pharmacy", "Stock", "Reorder At", "On Order", "Expires", "Status", "Unit Price", "Stock Value"];
    const rows = filtered.map((i) => [
      i.id,
      `"${i.name.replace(/"/g, '""')}"`,
      i.category,
      `"${i.pharmacy.replace(/"/g, '""')}"`,
      i.stock,
      i.reorderAt,
      i.onOrder || 0,
      i.expires,
      i.status,
      i.pricePerUnit || 0,
      (i.stock * (i.pricePerUnit || 0)).toFixed(2),
    ].join(","));
    const csv = [header.join(","), ...rows].join("\n");
    const a = document.createElement("a");
    a.href = "data:text/csv;charset=utf-8," + encodeURIComponent(csv);
    a.download = `dripvitals_inventory_${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    toast(`📥 Exported ${filtered.length} inventory items to CSV`);
  }

  function handleReorderSubmit(qty: number) {
    if (!reorderTarget) return;
    reorder(reorderTarget.id, qty);
    toast(`📦 ${qty} units of ${reorderTarget.name} reordered from ${reorderTarget.pharmacy}`);
  }

  function handleReceiveAll() {
    let count = 0;
    items.forEach((i) => {
      if ((i.onOrder || 0) > 0) {
        receive(i.id);
        count++;
      }
    });
    if (count > 0) toast(`✓ Marked ${count} pending deliver${count === 1 ? "y" : "ies"} as received`);
    else toast("No pending deliveries to receive");
  }

  function handleReceiveOne(item: InventoryItem) {
    receive(item.id);
    toast(`✓ ${item.onOrder} units of ${item.name} received`);
  }

  return (
    <div className="px-7 py-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 mb-5 flex-wrap">
        <div>
          <div className="text-[22px] font-bold tracking-tight text-ink mb-1">Inventory Management</div>
          <div className="text-[13px] text-ink-muted">
            Stock levels across 4 partner pharmacies · Total value:
            <span className="text-brand-dk font-semibold ml-1">${counts.totalValue.toLocaleString()}</span>
          </div>
        </div>
        <div className="flex gap-2">
          <button className="btn btn-ghost btn-sm" onClick={exportCsv}>📥 Export CSV</button>
          <button className="btn btn-ghost btn-sm" onClick={handleReceiveAll}>📦 Receive Pending</button>
          <button className="btn btn-primary btn-sm" onClick={() => toast("🔄 Syncing with pharmacy partners…")}>🔄 Sync</button>
        </div>
      </div>

      {/* KPI strip */}
      <KpiGrid cols={5}>
        <KpiCard
          label="SKUs Tracked"
          value={counts.total}
          icon="💊"
          iconBg="var(--color-brand-soft)"
          iconColor="var(--color-brand)"
          trend={`${categories.length} categories`}
          trendColor="var(--color-brand)"
        />
        <KpiCard
          label="In Stock"
          value={counts.ok}
          icon="✅"
          iconBg="var(--color-green-soft)"
          iconColor="var(--color-green)"
          trend={`${Math.round((counts.ok / Math.max(1, counts.total)) * 100)}% healthy`}
          trendColor="var(--color-green)"
        />
        <KpiCard
          label="Low Stock"
          value={counts.low}
          icon="⚠️"
          iconBg="var(--color-amber-soft)"
          iconColor="var(--color-amber)"
          trend={counts.low > 0 ? "Reorder soon" : "All clear"}
          trendColor="var(--color-amber)"
        />
        <KpiCard
          label="Critical / Out"
          value={counts.critical}
          icon="🔴"
          iconBg="var(--color-red-soft)"
          iconColor="var(--color-red)"
          trend={counts.critical > 0 ? "Immediate reorder" : "All clear"}
          trendColor={counts.critical > 0 ? "var(--color-red)" : "var(--color-green)"}
        />
        <KpiCard
          label="On Order"
          value={counts.onOrder}
          icon="📦"
          iconBg="var(--color-blue-soft)"
          iconColor="var(--color-blue)"
          trend="In transit"
          trendColor="var(--color-blue)"
        />
      </KpiGrid>

      {/* Critical alert banner */}
      {criticalItems.length > 0 && (
        <div className="border border-red-soft rounded-lg py-4 px-5 mb-4" style={{ borderLeft: "3px solid var(--color-red)", background: "rgba(192,57,43,.04)" }}>
          <div className="font-bold text-red mb-2.5 text-[14px]">
            🔴 {criticalItems.length} Medication{criticalItems.length === 1 ? "" : "s"} Need{criticalItems.length === 1 ? "s" : ""} Immediate Reorder
          </div>
          <div className="space-y-2">
            {criticalItems.map((m) => (
              <div
                key={m.id}
                className="flex items-center gap-3 bg-surface border border-red-soft rounded-md py-2.5 px-3.5"
              >
                <span className="text-[18px]">{m.stock === 0 ? "🚨" : "🔴"}</span>
                <div className="flex-1 min-w-0">
                  <div className="font-bold text-[13px] text-ink">{m.name}</div>
                  <div className="text-[11.5px] text-ink-muted">
                    {m.pharmacy} · {m.stock} units remaining · Reorder at {m.reorderAt}
                  </div>
                </div>
                <button
                  className="btn btn-primary btn-sm"
                  onClick={() => setReorderTarget(m)}
                >
                  📦 Reorder
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Main inventory card */}
      <div className="bg-surface border border-border rounded-lg overflow-hidden">
        {/* Filter bar */}
        <div className="flex items-center gap-2 p-3 px-[18px] border-b border-border bg-surface-2 flex-wrap">
          <FilterChip active={filter === "all"}       onClick={() => setFilter("all")}      >All</FilterChip>
          <FilterChip active={filter === "critical"}  onClick={() => setFilter("critical")} count={counts.critical}>🔴 Critical</FilterChip>
          <FilterChip active={filter === "low"}       onClick={() => setFilter("low")}      count={counts.low}>Low</FilterChip>
          <FilterChip active={filter === "ok"}        onClick={() => setFilter("ok")}       count={counts.ok}>OK</FilterChip>
          <FilterChip active={filter === "on_order"}  onClick={() => setFilter("on_order")} count={counts.onOrder}>📦 On Order</FilterChip>
          <div className="w-px h-5 bg-border mx-1" />
          {categories.map((c) => (
            <FilterChip key={c} active={filter === c} onClick={() => setFilter(c)}>
              {c}
            </FilterChip>
          ))}
          <div className="flex items-center gap-1.5 bg-surface border border-border rounded-pill py-1 px-3.5 ml-auto min-w-[240px] focus-within:border-brand focus-within:shadow-[0_0_0_3px_rgba(31,138,112,.18)]">
            <span className="text-ink-muted text-[13px]">🔍</span>
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search medication, pharmacy…"
              className="flex-1 bg-transparent border-none outline-none text-[12px] text-ink placeholder:text-ink-muted"
            />
          </div>
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-[13px]">
            <thead className="bg-surface-2">
              <tr>
                <Th>Medication</Th>
                <Th>Category</Th>
                <Th>Pharmacy</Th>
                <Th>Stock</Th>
                <Th>Reorder At</Th>
                <Th>Stock Level</Th>
                <Th>Expires</Th>
                <Th>Status</Th>
                <Th>{""}</Th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-12 text-center text-ink-muted">
                    <div className="text-[36px] opacity-40 mb-2">💊</div>
                    <div className="text-[13px] font-bold text-ink mb-0.5">No inventory matches</div>
                    <div className="text-[11.5px]">Try a different filter or search term</div>
                  </td>
                </tr>
              ) : (
                filtered.map((m, i) => {
                  const isCritical = m.status === "critical";
                  // Stock level percentage — relative to 2× reorder threshold
                  const pct = Math.min(100, Math.round((m.stock / Math.max(1, m.reorderAt * 2)) * 100));
                  const barColor = m.status === "ok" ? "var(--color-green)"
                                : m.status === "low" ? "var(--color-amber)"
                                : "var(--color-red)";
                  const expiringSoon = m.expires.includes("May 2026") || m.expires.includes("Jun 2026");
                  return (
                    <tr
                      key={m.id}
                      className="hover:bg-surface-2 transition-colors animate-fadeUp"
                      style={{
                        animationDelay: `${i * 20}ms`,
                        borderLeft: isCritical ? "3px solid var(--color-red)" : undefined,
                        background: isCritical ? "rgba(192,57,43,.025)" : undefined,
                      }}
                    >
                      <Td>
                        <div className="font-semibold text-[12.5px]">{m.name}</div>
                        <div className="text-[10.5px] font-mono text-ink-muted">{m.id}</div>
                      </Td>
                      <Td><Pill intent={CATEGORY_INTENT[m.category]}>{m.category}</Pill></Td>
                      <Td><span className="text-[12px] text-ink-2">{m.pharmacy}</span></Td>
                      <Td>
                        <div className="flex flex-col">
                          <span
                            className="font-mono text-[13px] font-bold"
                            style={{ color: m.stock === 0 ? "var(--color-red)" : "var(--color-ink)" }}
                          >
                            {m.stock}
                          </span>
                          {(m.onOrder || 0) > 0 && (
                            <span className="text-[10px] font-mono text-blue">+{m.onOrder} in transit</span>
                          )}
                        </div>
                      </Td>
                      <Td>
                        <span className="font-mono text-[11.5px] text-ink-muted">{m.reorderAt}</span>
                      </Td>
                      <Td>
                        <div className="flex items-center gap-2 min-w-[120px]">
                          <div className="h-1.5 bg-surface-3 rounded overflow-hidden flex-1 max-w-[100px]">
                            <div className="h-full rounded transition-all" style={{ width: `${pct}%`, background: barColor }} />
                          </div>
                          <span className="text-[10.5px] font-mono text-ink-muted whitespace-nowrap">{pct}%</span>
                        </div>
                      </Td>
                      <Td>
                        <span className={`font-mono text-[11px] ${expiringSoon ? "text-red font-bold" : "text-ink-muted"}`}>
                          {m.expires}
                        </span>
                      </Td>
                      <Td><Pill intent={STATUS_INTENT[m.status]} dot>{STATUS_LABEL[m.status]}</Pill></Td>
                      <Td>
                        <div className="flex gap-1">
                          {(m.onOrder || 0) > 0 && (
                            <button
                              className="px-2.5 py-1 rounded-md bg-blue-soft border border-blue text-[11px] font-semibold text-blue hover:bg-blue hover:text-white transition-colors"
                              onClick={() => handleReceiveOne(m)}
                              title="Mark received"
                            >
                              📦 Receive
                            </button>
                          )}
                          <button
                            className="px-2.5 py-1 rounded-md bg-surface-2 border border-border text-[11px] font-semibold text-ink-2 hover:bg-brand-soft hover:border-brand hover:text-brand-dk transition-colors"
                            onClick={() => setReorderTarget(m)}
                          >
                            Reorder
                          </button>
                        </div>
                      </Td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Footer */}
        <div className="py-2.5 px-[18px] border-t border-border bg-surface-2 flex items-center gap-2.5 text-[11.5px] text-ink-muted">
          <span>Showing {filtered.length} of {counts.total} SKUs</span>
          <div className="flex-1" />
          <span className="text-ink">Total inventory value: <span className="font-bold text-brand-dk">${counts.totalValue.toLocaleString()}</span></span>
        </div>
      </div>

      <ReorderModal
        open={!!reorderTarget}
        onClose={() => setReorderTarget(null)}
        item={reorderTarget}
        onSubmit={handleReorderSubmit}
      />
      <Toast />
    </div>
  );
}

interface FilterChipProps {
  key?: Key;
  active: boolean;
  count?: number;
  onClick: () => void;
  children: ReactNode;
}

function FilterChip({ active, count, onClick, children }: FilterChipProps) {
  return (
    <button
      onClick={onClick}
      className={[
        "py-1.5 px-3 rounded-pill text-[11.5px] font-semibold border transition-colors flex items-center gap-1.5",
        active ? "bg-brand text-white border-brand" : "bg-surface border-border text-ink-2 hover:border-border-2",
      ].join(" ")}
    >
      {children}
      {count !== undefined && (
        <span className={[
          "inline-flex items-center justify-center min-w-[18px] h-[17px] px-1.5 rounded-pill text-[10px] font-bold",
          active ? "bg-white/20 text-white" : "bg-surface-3 text-ink-muted",
        ].join(" ")}>
          {count}
        </span>
      )}
    </button>
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
