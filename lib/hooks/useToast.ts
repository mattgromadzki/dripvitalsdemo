"use client";

import { create } from "@/lib/hooks/zustand-shim";

interface ToastState {
  message: string;
  visible: boolean;
  show: (msg: string) => void;
  hide: () => void;
}

let timer: ReturnType<typeof setTimeout> | null = null;

export const useToast = create<ToastState>((set) => ({
  message: "",
  visible: false,
  show: (msg: string) => {
    set({ message: msg, visible: true });
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => set({ visible: false }), 2800);
  },
  hide: () => set({ visible: false }),
}));

// Convenience non-hook accessor for components that just want to fire and forget
export function toast(msg: string) {
  useToast.getState().show(msg);
}
