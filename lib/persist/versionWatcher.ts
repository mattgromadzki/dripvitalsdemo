"use client";

import { isVisible } from "./syncTrigger";

/**
 * One shared heartbeat for all persisted domains. Instead of each store polling
 * the database every few seconds, every store registers here and a single timer
 * checks the cheap Redis version counters (via /api/sync/versions). When a
 * domain's counter changes, we call that domain's refetch — so Postgres is only
 * touched on real changes and can sleep otherwise.
 *
 * If the server reports signals are unavailable (no Redis configured), watchers
 * are told via `signalsEnabled() === false` and fall back to their own polling.
 */
type Cb = () => void;

const subs = new Map<string, Cb>();
const seen = new Map<string, number>();
let started = false;
let enabled = true;
let timer: ReturnType<typeof setInterval> | null = null;

const POLL_MS = 2000; // cheap Redis check; ~2s update latency feels instant

export function signalsEnabled(): boolean {
  return enabled;
}

export function watchVersion(domain: string, onBump: Cb): void {
  if (typeof window === "undefined") return;
  subs.set(domain, onBump);
  if (!started) { started = true; timer = setInterval(tick, POLL_MS); }
}

async function tick(): Promise<void> {
  if (!isVisible() || subs.size === 0) return;
  const domains = Array.from(subs.keys());
  try {
    const r = await fetch(`/api/sync/versions?domains=${encodeURIComponent(domains.join(","))}`, { cache: "no-store" });
    const d = await r.json();
    if (!d?.enabled) { enabled = false; return; } // signals off → stores poll on their own
    enabled = true;
    const v: Record<string, number> = d.versions || {};
    for (const dom of domains) {
      const cur = Number(v[dom] || 0);
      if (!seen.has(dom)) { seen.set(dom, cur); continue; } // baseline; hydrate already loaded current data
      if (cur !== seen.get(dom)) {
        seen.set(dom, cur);
        try { subs.get(dom)?.(); } catch { /* ignore */ }
      }
    }
  } catch { /* ignore — try again next tick */ }
}
