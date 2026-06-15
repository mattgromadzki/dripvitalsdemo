"use client";

import { create } from "@/lib/hooks/zustand-shim";
import type { InventoryItem, InventoryStatus } from "@/lib/types";
import { INVENTORY as SEED } from "@/lib/data/inventory";
import { seedList } from "@/lib/config/runtime";

interface InventoryState {
  items: InventoryItem[];
  reorder: (id: string, qty: number) => void;
  receive: (id: string) => void;             // marks an on-order delivery as received
  adjustStock: (id: string, delta: number) => void;
  setStatus: (id: string, status: InventoryStatus) => void;
}

function computeStatus(stock: number, reorderAt: number): InventoryStatus {
  if (stock === 0) return "critical";
  if (stock < reorderAt * 0.4) return "critical";
  if (stock < reorderAt) return "low";
  return "ok";
}

function nowStr(): string {
  const d = new Date();
  const months = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
  return `${months[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}`;
}

export const useInventory = create<InventoryState>((set) => ({
  items: seedList(SEED),
  reorder: (id, qty) => {
    set((s) => ({
      items: s.items.map((it) => {
        if (it.id !== id) return it;
        return {
          ...it,
          onOrder: (it.onOrder || 0) + qty,
          lastReorderAt: nowStr(),
        };
      }),
    }));
  },
  receive: (id) => {
    set((s) => ({
      items: s.items.map((it) => {
        if (it.id !== id) return it;
        const incoming = it.onOrder || 0;
        if (incoming === 0) return it;
        const newStock = it.stock + incoming;
        return {
          ...it,
          stock: newStock,
          onOrder: 0,
          status: computeStatus(newStock, it.reorderAt),
        };
      }),
    }));
  },
  adjustStock: (id, delta) => {
    set((s) => ({
      items: s.items.map((it) => {
        if (it.id !== id) return it;
        const newStock = Math.max(0, it.stock + delta);
        return { ...it, stock: newStock, status: computeStatus(newStock, it.reorderAt) };
      }),
    }));
  },
  setStatus: (id, status) => {
    set((s) => ({ items: s.items.map((it) => (it.id === id ? { ...it, status } : it)) }));
  },
}));
