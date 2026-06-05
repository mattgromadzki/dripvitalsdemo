"use client";

/**
 * Lets every store poller refresh instantly when the user focuses or returns to
 * the tab, and lets pollers skip work while the tab is hidden. Pollers register
 * their pull function here once.
 */
const pulls = new Set<() => void>();
let wired = false;

export function registerPull(fn: () => void): void {
  if (typeof window === "undefined") return;
  pulls.add(fn);
  if (wired) return;
  wired = true;
  const fire = () => {
    if (document.visibilityState !== "visible") return;
    pulls.forEach((p) => { try { p(); } catch { /* ignore */ } });
  };
  window.addEventListener("focus", fire);
  document.addEventListener("visibilitychange", fire);
}

/** True when the tab is visible (or in non-browser contexts). */
export function isVisible(): boolean {
  return typeof document === "undefined" || document.visibilityState === "visible";
}
