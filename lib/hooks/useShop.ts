"use client";

import { create } from "@/lib/hooks/zustand-shim";
import type { ShopProduct, ShopProductInput } from "@/lib/types";
import { SHOP_PRODUCTS as SEED } from "@/lib/data/shopProducts";
import { seedList } from "@/lib/config/runtime";

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
  products: seedList(SEED),

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
