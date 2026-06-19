"use client";

import { create } from "@/lib/hooks/zustand-shim";
import type { OrderRow, RxStatus, LabStatus } from "@/lib/types";
import { ORDERS as SEED } from "@/lib/data/orders";
import { seedList } from "@/lib/config/runtime";

interface OrdersState {
  orders: OrderRow[];
  add: (o: Omit<OrderRow, "id">) => OrderRow;
  updateStatus: (id: string, status: RxStatus | LabStatus) => void;
  remove: (id: string) => void;
}

export const useOrders = create<OrdersState>((set) => ({
  orders: seedList(SEED),
  add: (o) => {
    const created: OrderRow = { id: `${o.kind === "lab" ? "LAB" : "RX"}-${Date.now().toString().slice(-6)}`, ...o };
    set((s) => ({ orders: [created, ...s.orders] }));
    return created;
  },
  updateStatus: (id, status) => {
    set((s) => ({
      orders: s.orders.map((o) => (o.id === id ? { ...o, status } : o)),
    }));
  },
  remove: (id) => {
    set((s) => ({ orders: s.orders.filter((o) => o.id !== id) }));
  },
}));
