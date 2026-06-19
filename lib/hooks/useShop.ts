"use client";

import { create } from "@/lib/hooks/zustand-shim";
import type { ShopProduct, ShopProductInput } from "@/lib/types";
import { SHOP_PRODUCTS as SEED } from "@/lib/data/shopProducts";

interface ShopState {
  products: ShopProduct[];
  add: (input: ShopProductInput) => ShopProduct;
  update: (id: string, patch: Partial<ShopProductInput>) => void;
  remove: (id: string) => void;
  duplicate: (id: string) => ShopProduct | null;
  togglePublished: (id: string) => void;
}

// Monotonic id generator — keeps new ids unique even after deletions, which a
// naive max()+1 over the current list would not guarantee.
let seq = SEED.length;
function nextId(): string {
  seq += 1;
  return `SHOP-${String(seq).padStart(3, "0")}`;
}

export const useShop = create<ShopState>((set, get) => ({
  // The Shop catalog is real storefront data (not demo data), so it always
  // seeds regardless of NEXT_PUBLIC_SEED_DEMO_DATA. Admin edits layer on top.
  products: SEED,

  add: (input) => {
    const product: ShopProduct = { id: nextId(), ...input };
    set((s) => ({ products: [...s.products, product] }));
    return product;
  },

  update: (id, patch) => {
    set((s) => ({
      products: s.products.map((p) => (p.id === id ? { ...p, ...patch } : p)),
    }));
  },

  remove: (id) => {
    set((s) => ({ products: s.products.filter((p) => p.id !== id) }));
  },

  duplicate: (id) => {
    const original = get().products.find((p) => p.id === id);
    if (!original) return null;
    const maxSort = get().products.reduce((m, p) => Math.max(m, p.sort), 0);
    const copy: ShopProduct = {
      ...original,
      id: nextId(),
      name: `${original.name} (copy)`,
      published: false, // copies start as drafts so they aren't accidentally live
      sort: maxSort + 1,
      clicks: 0,
    };
    set((s) => ({ products: [...s.products, copy] }));
    return copy;
  },

  togglePublished: (id) => {
    set((s) => ({
      products: s.products.map((p) =>
        p.id === id ? { ...p, published: !p.published } : p,
      ),
    }));
  },
}));

/**
 * Re-sync the Shop catalog from code (lib/data/shopProducts.ts) and overwrite the
 * saved server copy. Mirrors the Treatments "Reset to defaults" flow.
 *
 * Uploaded product photos are PRESERVED: a reset restores default catalog *content*
 * (names, prices, copy, ordering) but must not wipe images an operator uploaded via
 * the product drawer. We read the current server copy, map id -> imageUrl, and
 * re-apply those photos onto matching seed products before pushing.
 */
export async function resetShopToDefaults(): Promise<void> {
  seq = SEED.length;

  let products: ShopProduct[] = SEED;
  if (typeof window !== "undefined") {
    try {
      const r = await fetch(`/api/store/shop`, { cache: "no-store" });
      const d = await r.json();
      const current: Array<{ id: string; imageUrl?: string }> = Array.isArray(d?.data) ? d.data : [];
      const imgById = new Map<string, string>();
      current.forEach((p) => { if (p && p.imageUrl) imgById.set(p.id, p.imageUrl); });
      if (imgById.size > 0) {
        products = SEED.map((p) => (imgById.has(p.id) ? { ...p, imageUrl: imgById.get(p.id) } : p));
      }
    } catch { /* ignore — fall back to seed without preserved photos */ }
  }

  useShop.setState({ products });

  if (typeof window !== "undefined") {
    try {
      await fetch(`/api/store/shop`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ data: products }),
      });
    } catch { /* ignore — local reset still applied */ }
  }
}
