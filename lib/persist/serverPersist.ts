"use client";

import type { Store } from "@/lib/hooks/zustand-shim";
import { registerPull, isVisible } from "@/lib/persist/syncTrigger";
import { watchVersion, signalsEnabled } from "@/lib/persist/versionWatcher";

/**
 * Mirrors one collection field of a client store to the server so the data
 * survives refreshes and syncs across devices. Last-write-wins. Hydrates on
 * load, writes back on change (debounced), and refetches when the server's
 * change-signal for this domain bumps (instead of blindly polling the database).
 * An equality guard prevents write/apply feedback loops.
 */
const started = new Set<string>();

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function serverPersist(store: Store<any>, domain: string, field: string, pollMs = 5000): void {
  if (typeof window === "undefined" || started.has(domain)) return;
  started.add(domain);

  let last = "";
  let writeTimer: ReturnType<typeof setTimeout> | null = null;

  const pickJSON = () => JSON.stringify(store.getState()[field]);
  const apply = (data: unknown) => store.setState({ [field]: data });

  function writeBack() {
    const cur = pickJSON();
    if (cur === last) return;
    last = cur;
    if (writeTimer) clearTimeout(writeTimer);
    writeTimer = setTimeout(() => {
      fetch(`/api/store/${domain}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ data: JSON.parse(cur) }) }).catch(() => {});
    }, 800);
  }

  async function pull() {
    try {
      const r = await fetch(`/api/store/${domain}`, { cache: "no-store" });
      const d = await r.json();
      if (d?.data != null) {
        const s = JSON.stringify(d.data);
        if (s !== last) { last = s; apply(d.data); }
      } else {
        // Server has nothing yet → seed it from the current (seed) data.
        last = pickJSON();
        fetch(`/api/store/${domain}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ data: JSON.parse(last) }) }).catch(() => {});
      }
    } catch { /* ignore */ }
  }

  // Hydrate first, THEN attach the write-back listener (so applying server data
  // doesn't immediately echo back).
  pull().then(() => store.subscribe(writeBack));
  registerPull(pull); // instant refresh when the tab regains focus

  // Push-style sync: refetch ONLY when this domain's server change-signal bumps,
  // so the database stays asleep while data is static (no blind DB polling).
  watchVersion(domain, pull);

  // Fallback safety net: if realtime signals aren't available (e.g. Redis not
  // configured), revert to periodic polling at the original cadence.
  setInterval(() => { if (isVisible() && !signalsEnabled()) pull(); }, pollMs);
}
