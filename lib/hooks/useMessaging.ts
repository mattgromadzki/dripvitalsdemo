"use client";

import { create } from "@/lib/hooks/zustand-shim";
import type { MessageThread } from "@/lib/types";
import { MESSAGE_THREADS as SEED } from "@/lib/data/messageThreads";
import { seedList } from "@/lib/config/runtime";

interface MessagingState {
  threads: MessageThread[];
  sendMessage: (threadId: number, text: string, from: string) => void;
  markRead: (threadId: number) => void;
  markUnread: (threadId: number) => void;
  togglePin: (threadId: number) => void;
  archive: (threadId: number) => void;
  composeNew: (input: Omit<MessageThread, "id" | "orderedAt"> & { orderedAt?: number }) => MessageThread;
}

let nextThreadId = SEED.length + 1;

function nowOrdered(): number {
  const d = new Date();
  return parseInt(
    `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, "0")}${String(d.getDate()).padStart(2, "0")}` +
    `${String(d.getHours()).padStart(2, "0")}${String(d.getMinutes()).padStart(2, "0")}`,
    10,
  );
}

function nowTimeString(): string {
  const d = new Date();
  const h = d.getHours();
  const m = String(d.getMinutes()).padStart(2, "0");
  const ampm = h >= 12 ? "PM" : "AM";
  const h12 = h === 0 ? 12 : h > 12 ? h - 12 : h;
  return `Today ${h12}:${m} ${ampm}`;
}

export const useMessaging = create<MessagingState>((set) => ({
  threads: seedList(SEED),
  sendMessage: (threadId, text, from) => {
    set((s) => ({
      threads: s.threads.map((t) => {
        if (t.id !== threadId) return t;
        const time = "Just now";
        return {
          ...t,
          preview: text,
          time: nowTimeString(),
          orderedAt: nowOrdered(),
          unread: false,
          thread: [...t.thread, { from, text, time, me: true }],
        };
      }),
    }));
  },
  markRead: (threadId) => {
    set((s) => ({
      threads: s.threads.map((t) => (t.id === threadId ? { ...t, unread: false } : t)),
    }));
  },
  markUnread: (threadId) => {
    set((s) => ({
      threads: s.threads.map((t) => (t.id === threadId ? { ...t, unread: true } : t)),
    }));
  },
  togglePin: (threadId) => {
    set((s) => ({
      threads: s.threads.map((t) => (t.id === threadId ? { ...t, pinned: !t.pinned } : t)),
    }));
  },
  archive: (threadId) => {
    set((s) => ({
      threads: s.threads.map((t) => (t.id === threadId ? { ...t, archived: true } : t)),
    }));
  },
  composeNew: (input) => {
    const id = nextThreadId++;
    const created: MessageThread = {
      id,
      orderedAt: input.orderedAt ?? nowOrdered(),
      ...input,
    };
    set((s) => ({ threads: [created, ...s.threads] }));
    return created;
  },
}));
