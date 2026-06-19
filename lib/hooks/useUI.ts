"use client";
import { create } from "@/lib/hooks/zustand-shim";

interface UIState {
  sidebarOpen: boolean;       // mobile drawer
  openSidebar: () => void;
  closeSidebar: () => void;
  toggleSidebar: () => void;
  collapsed: boolean;         // desktop icon-rail collapse
  toggleCollapsed: () => void;
  setCollapsed: (v: boolean) => void;
}

export const useUI = create<UIState>((set) => ({
  sidebarOpen: false,
  openSidebar: () => set({ sidebarOpen: true }),
  closeSidebar: () => set({ sidebarOpen: false }),
  toggleSidebar: () => set((s) => ({ sidebarOpen: !s.sidebarOpen })),
  collapsed: false,
  toggleCollapsed: () => set((s) => ({ collapsed: !s.collapsed })),
  setCollapsed: (v) => set({ collapsed: v }),
}));
