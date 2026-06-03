"use client";

import { create } from "@/lib/hooks/zustand-shim";
import type { Review } from "@/lib/types";
import { REVIEWS as SEED } from "@/lib/data/reviews";

interface ReviewsState {
  reviews: Review[];
  addReply: (id: string, reply: string, author: string) => void;
  toggleFlag: (id: string, reason?: string) => void;
  remove: (id: string) => void;
}

function nowDisplay(): string {
  const d = new Date();
  const months = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
  return `${months[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}`;
}

export const useReviews = create<ReviewsState>((set) => ({
  reviews: SEED,
  addReply: (id, reply, author) => {
    set((s) => ({
      reviews: s.reviews.map((r) =>
        r.id === id ? { ...r, reply, replyAuthor: author, repliedAt: nowDisplay() } : r
      ),
    }));
  },
  toggleFlag: (id, reason) => {
    set((s) => ({
      reviews: s.reviews.map((r) =>
        r.id === id ? { ...r, flagged: !r.flagged, flagReason: !r.flagged ? reason : undefined } : r
      ),
    }));
  },
  remove: (id) => {
    set((s) => ({ reviews: s.reviews.filter((r) => r.id !== id) }));
  },
}));
