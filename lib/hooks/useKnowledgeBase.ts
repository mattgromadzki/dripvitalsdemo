"use client";

import { create } from "@/lib/hooks/zustand-shim";
import type { KbArticle, KbCategory } from "@/lib/types";
import { KB_ARTICLES as SEED } from "@/lib/data/knowledgeBase";

interface KbState {
  articles: KbArticle[];
  togglePin: (id: string) => void;
  togglePublished: (id: string) => void;
  voteHelpful: (id: string, helpful: boolean) => void;
  incrementViews: (id: string) => void;
  add: (article: Omit<KbArticle, "id">) => KbArticle;
  remove: (id: string) => void;
}

let nextSeq = SEED.length + 1;
function nextId(): string {
  return `KB-${String(nextSeq++).padStart(3, "0")}`;
}

export const useKnowledgeBase = create<KbState>((set) => ({
  articles: SEED,
  togglePin: (id) => {
    set((s) => ({
      articles: s.articles.map((a) => (a.id === id ? { ...a, pinned: !a.pinned } : a)),
    }));
  },
  togglePublished: (id) => {
    set((s) => ({
      articles: s.articles.map((a) => (a.id === id ? { ...a, isPublished: !a.isPublished } : a)),
    }));
  },
  voteHelpful: (id, helpful) => {
    set((s) => ({
      articles: s.articles.map((a) => {
        if (a.id !== id) return a;
        return helpful
          ? { ...a, helpful: a.helpful + 1 }
          : { ...a, notHelpful: a.notHelpful + 1 };
      }),
    }));
  },
  incrementViews: (id) => {
    set((s) => ({
      articles: s.articles.map((a) => (a.id === id ? { ...a, views: a.views + 1 } : a)),
    }));
  },
  add: (input) => {
    const created: KbArticle = { id: nextId(), ...input };
    set((s) => ({ articles: [created, ...s.articles] }));
    return created;
  },
  remove: (id) => {
    set((s) => ({ articles: s.articles.filter((a) => a.id !== id) }));
  },
}));

export type { KbCategory };
