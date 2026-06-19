"use client";

import { useMemo, useState } from "react";
import type { ReactNode } from "react";
import { Pill } from "@/components/ui/Pill";
import { Toast } from "@/components/ui/Toast";
import { KpiCard, KpiGrid } from "@/components/ui/Kpi";
import { ConfirmModal } from "@/components/ui/ConfirmModal";
import { ShopProductDrawer } from "@/components/modules/ShopProductDrawer";
import { toast } from "@/lib/hooks/useToast";
import { useShop, resetShopToDefaults } from "@/lib/hooks/useShop";
import { SHOP_CATEGORY_LABEL, SHOP_THUMB_STYLE } from "@/lib/data/shopProducts";
import type { ShopProduct, ShopProductInput, ShopCategory } from "@/lib/types";

type CatFilter = "all" | ShopCategory;
type StatusFilter = "all" | "published" | "draft";

const CATEGORY_INTENT: Record<ShopCategory, "brand" | "purple" | "blue" | "amber" | "teal"> = {
  weight: "brand",
  "anti-aging": "purple",
  hair: "blue",
  sexual: "amber",
  skin: "teal",
};

export default function ShopPage() {
  const products = useShop((s) => s.products);
  const add = useShop((s) => s.add);
  const update = useShop((s) => s.update);
  const remove = useShop((s) => s.remove);
  const duplicate = useShop((s) => s.duplicate);

  const [search, setSearch] = useState("");
  const [catFilter, setCatFilter] = useState<CatFilter>("all");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");

  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editing, setEditing] = useState<ShopProduct | null>(null);
  const [confirmTarget, setConfirmTarget] = useState<ShopProduct | null>(null);

  // KPIs
  const stats = useMemo(() => {
    const published = products.filter((p) => p.published);
    const categories = new Set(products.map((p) => p.cat));
    const top = products.reduce<ShopProduct | null>((best, p) => {
      if ((p.clicks ?? 0) <= 0) return best;
      if (!best || (p.clicks ?? 0) > (best.clicks ?? 0)) return p;
      return best;
    }, null);
    return {
      total: products.length,
      categories: categories.size,
      published: published.length,
      drafts: products.length - published.length,
      top,
    };
  }, [products]);

  const nextSort = useMemo(
    () => products.reduce((m, p) => Math.max(m, p.sort), 0) + 1,
    [products],
  );

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return products
      .filter((p) => catFilter === "all" || p.cat === catFilter)
      .filter((p) =>
        statusFilter === "all"
          ? true
          : statusFilter === "published"
            ? p.published
            : !p.published,
      )
      .filter((p) => !q || p.name.toLowerCase().includes(q) || p.desc.toLowerCase().includes(q))
      .sort((a, b) => a.sort - b.sort);
  }, [products, search, catFilter, statusFilter]);

  function openNew() {
    setEditing(null);
    setDrawerOpen(true);
  }
  function openEdit(p: ShopProduct) {
    setEditing(p);
    setDrawerOpen(true);
  }
  function closeDrawer() {
    setDrawerOpen(false);
  }

  function handleSave(input: ShopProductInput, editingId: string | null) {
    if (editingId) {
      update(editingId, input);
      toast(`✓ "${input.name}" updated`);
    } else {
      add(input);
      toast(`✓ "${input.name}" added`);
    }
    setDrawerOpen(false);
  }

  function handleDuplicate(p: ShopProduct) {
    const copy = duplicate(p.id);
    if (copy) toast(`✓ Duplicated "${p.name}"`);
  }

  // Delete invoked from the drawer footer — close the drawer, then confirm.
  function handleDrawerDelete(id: string) {
    const p = products.find((x) => x.id === id) || null;
    setDrawerOpen(false);
    setConfirmTarget(p);
  }

  function confirmDelete() {
    if (!confirmTarget) return;
    remove(confirmTarget.id);
    toast(`✓ "${confirmTarget.name}" deleted`);
  }

  return (
    <div className="px-7 py-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 mb-5 flex-wrap">
        <div>
          <div className="text-[22px] font-bold tracking-tight text-ink mb-1">Shop Products</div>
          <div className="text-[13px] text-ink-muted leading-relaxed">
            Manage marketing cards shown in the Shop tab of the patient portal.
            <br />
            Each product&rsquo;s Get Started button redirects to the intake URL you assign.
          </div>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={async () => {
              if (!confirm("Reset the Shop catalog to the latest code defaults? This replaces the saved copy on all devices (and the patient portal) and reloads the page. Uploaded product photos are kept.")) return;
              await resetShopToDefaults();
              window.location.reload();
            }}
            title="Re-sync the catalog from code (keeps uploaded photos)"
            style={{
              background: "#fff7ed",
              border: "2px solid #fb923c",
              color: "#c2410c",
              fontWeight: 600,
              padding: "7px 13px",
              borderRadius: 8,
              cursor: "pointer",
              fontSize: 13,
              display: "inline-flex",
              alignItems: "center",
              gap: 4,
            }}
          >
            ↺ Reset to defaults
          </button>
          <button className="btn btn-primary btn-sm" onClick={openNew}>
            + Add Product
          </button>
        </div>
      </div>

      {/* KPI strip */}
      <KpiGrid cols={4}>
        <KpiCard
          label="Total Products"
          value={stats.total}
          icon="🛍️"
          iconBg="var(--color-brand-soft)"
          iconColor="var(--color-brand)"
          trend={`Across ${stats.categories} categories`}
          trendColor="var(--color-ink-muted)"
        />
        <KpiCard
          label="Published"
          value={stats.published}
          icon="🌐"
          iconBg="var(--color-green-soft)"
          iconColor="var(--color-green)"
          trend="Visible to patients"
          trendColor="var(--color-green)"
        />
        <KpiCard
          label="Drafts"
          value={stats.drafts}
          icon="📝"
          iconBg="var(--color-amber-soft)"
          iconColor="var(--color-amber)"
          trend="Hidden from portal"
          trendColor="var(--color-amber)"
        />
        <KpiCard
          label="Top Performer"
          value={stats.top ? stats.top.name : "—"}
          icon="🔥"
          iconBg="var(--color-purple-soft)"
          iconColor="var(--color-purple)"
          trend={stats.top ? `${stats.top.clicks} Get Started clicks · 30 days` : "No clicks yet"}
          trendColor="var(--color-ink-muted)"
        />
      </KpiGrid>

      {/* Filters */}
      <div className="flex items-center gap-2.5 mb-4 flex-wrap">
        <div className="flex items-center gap-1.5 bg-surface border border-border rounded-sm py-2 px-3 flex-1 max-w-[360px] focus-within:border-brand focus-within:shadow-[0_0_0_3px_var(--color-brand-glow)] transition-all">
          <span className="text-ink-muted text-[13px]">🔍</span>
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search products…"
            className="flex-1 bg-transparent border-none outline-none text-[13px] text-ink placeholder:text-ink-muted"
          />
        </div>
        <select
          className="form-select max-w-[170px]"
          value={catFilter}
          onChange={(e) => setCatFilter(e.target.value as CatFilter)}
        >
          <option value="all">All categories</option>
          {(Object.keys(SHOP_CATEGORY_LABEL) as ShopCategory[]).map((k) => (
            <option key={k} value={k}>
              {SHOP_CATEGORY_LABEL[k]}
            </option>
          ))}
        </select>
        <select
          className="form-select max-w-[150px]"
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}
        >
          <option value="all">All statuses</option>
          <option value="published">Published</option>
          <option value="draft">Drafts</option>
        </select>
      </div>

      {/* Table */}
      <div className="card overflow-hidden p-0">
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-[13px]">
            <thead className="bg-surface-2">
              <tr>
                <Th className="w-[60px]">Image</Th>
                <Th>Product</Th>
                <Th>Category</Th>
                <Th className="w-[120px]">Price</Th>
                <Th>Get Started URL</Th>
                <Th className="w-[110px]">Status</Th>
                <Th className="w-[56px]">Sort</Th>
                <Th className="w-[120px] text-right">Actions</Th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-14 text-center text-ink-muted">
                    <div className="text-[36px] opacity-40 mb-2">🛍️</div>
                    <div className="text-[13px] font-bold text-ink mb-0.5">No products match your filters</div>
                    <div className="text-[11.5px]">Try a different search term, category, or status</div>
                  </td>
                </tr>
              ) : (
                filtered.map((p, i) => {
                  const thumb = SHOP_THUMB_STYLE[p.cls];
                  return (
                    <tr
                      key={p.id}
                      className="hover:bg-brand-softer transition-colors cursor-pointer animate-fadeUp"
                      style={{ animationDelay: `${i * 18}ms` }}
                      onClick={() => openEdit(p)}
                    >
                      <Td>
                        <div
                          className="w-11 h-11 rounded-sm flex items-center justify-center text-[22px] flex-shrink-0 overflow-hidden"
                          style={{ background: thumb.background, color: thumb.color }}
                        >
                          {p.imageUrl
                            ? <img src={p.imageUrl} alt="" className="w-full h-full object-cover" />
                            : p.img}
                        </div>
                      </Td>
                      <Td>
                        <div className="font-semibold text-ink text-[12.5px]">{p.name}</div>
                        <div className="text-[11.5px] text-ink-muted mt-0.5 max-w-[260px]">{p.desc}</div>
                      </Td>
                      <Td>
                        <Pill intent={CATEGORY_INTENT[p.cat]}>{SHOP_CATEGORY_LABEL[p.cat]}</Pill>
                      </Td>
                      <Td>
                        <strong className="text-ink">${p.price}/mo</strong>
                      </Td>
                      <Td>
                        <div
                          className="font-mono text-[11.5px] text-ink-muted max-w-[200px] overflow-hidden text-ellipsis whitespace-nowrap"
                          title={p.url}
                        >
                          {p.url}
                        </div>
                      </Td>
                      <Td>
                        <Pill intent={p.published ? "green" : "muted"} dot>
                          {p.published ? "Published" : "Draft"}
                        </Pill>
                      </Td>
                      <Td>
                        <span className="text-ink-muted text-[12px] font-mono">{p.sort}</span>
                      </Td>
                      <Td>
                        <div className="flex gap-1 justify-end" onClick={(e) => e.stopPropagation()}>
                          <IconBtn title="Edit" onClick={() => openEdit(p)}>
                            ✏️
                          </IconBtn>
                          <IconBtn title="Duplicate" onClick={() => handleDuplicate(p)}>
                            📋
                          </IconBtn>
                          <IconBtn title="Delete" onClick={() => setConfirmTarget(p)}>
                            🗑️
                          </IconBtn>
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
          <span>
            Showing {filtered.length} of {stats.total} products
          </span>
          <div className="flex-1" />
          <span className="text-ink">
            <span className="font-bold text-brand-dk">{stats.published}</span> live ·{" "}
            <span className="font-bold text-amber">{stats.drafts}</span> drafts
          </span>
        </div>
      </div>

      <ShopProductDrawer
        open={drawerOpen}
        product={editing}
        nextSort={nextSort}
        onClose={closeDrawer}
        onSave={handleSave}
        onDelete={handleDrawerDelete}
      />

      <ConfirmModal
        open={!!confirmTarget}
        onClose={() => setConfirmTarget(null)}
        onConfirm={confirmDelete}
        title="Delete product?"
        message={confirmTarget ? `"${confirmTarget.name}" will be removed from the Shop. This cannot be undone.` : ""}
        confirmLabel="Delete"
      />

      <Toast />
    </div>
  );
}

function Th({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <th
      className={`py-2.5 px-3.5 text-left text-[10px] font-bold uppercase tracking-wider text-ink-muted border-b border-border whitespace-nowrap ${className}`}
    >
      {children}
    </th>
  );
}

function Td({ children }: { children: ReactNode }) {
  return <td className="py-3 px-3.5 border-b border-border align-middle last:[&]:pr-3.5">{children}</td>;
}

function IconBtn({ title, onClick, children }: { title: string; onClick: () => void; children: ReactNode }) {
  return (
    <button
      title={title}
      onClick={onClick}
      className="p-1.5 rounded-md text-[14px] text-ink-muted hover:bg-surface-3 hover:text-ink transition-colors border-none leading-none"
    >
      {children}
    </button>
  );
}
