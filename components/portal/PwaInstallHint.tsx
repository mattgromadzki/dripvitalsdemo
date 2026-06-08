"use client";

import { useEffect, useState } from "react";

type BIPEvent = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: string }> };

const DISMISS_KEY = "dv-pwa-hint-dismissed";

export function PwaInstallHint() {
  const [show, setShow] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const [deferred, setDeferred] = useState<BIPEvent | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const standalone =
      window.matchMedia?.("(display-mode: standalone)").matches ||
      (window.navigator as unknown as { standalone?: boolean }).standalone === true;
    if (standalone) return; // already installed → never show
    if (localStorage.getItem(DISMISS_KEY) === "1") return;

    const ua = window.navigator.userAgent || "";
    const ios = /iphone|ipad|ipod/i.test(ua) && !/crios|fxios/i.test(ua); // Safari on iOS
    setIsIOS(ios);

    if (ios) {
      const t = setTimeout(() => setShow(true), 1200); // let the app paint first
      return () => clearTimeout(t);
    }

    const onBip = (e: Event) => { e.preventDefault(); setDeferred(e as BIPEvent); setShow(true); };
    window.addEventListener("beforeinstallprompt", onBip);
    return () => window.removeEventListener("beforeinstallprompt", onBip);
  }, []);

  function dismiss() {
    setShow(false);
    try { localStorage.setItem(DISMISS_KEY, "1"); } catch {}
  }

  async function install() {
    if (!deferred) return;
    await deferred.prompt();
    await deferred.userChoice;
    setDeferred(null);
    dismiss();
  }

  if (!show) return null;

  return (
    <div
      role="dialog"
      aria-label="Install DripVitals"
      style={{
        position: "fixed",
        left: 12, right: 12,
        bottom: "calc(env(safe-area-inset-bottom, 0px) + 84px)",
        zIndex: 200,
        background: "#fff",
        border: "1px solid #e3e8ee",
        borderRadius: 16,
        boxShadow: "0 12px 32px rgba(20,40,70,.18)",
        padding: "14px 14px 14px 16px",
        display: "flex",
        alignItems: "center",
        gap: 12,
        fontFamily: "var(--font-inter, system-ui, sans-serif)",
      }}
    >
      <img src="/icon-192.png" alt="" width={42} height={42} style={{ borderRadius: 10, flexShrink: 0 }} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 14, fontWeight: 700, color: "#1b2733" }}>Add DripVitals to your Home Screen</div>
        <div style={{ fontSize: 12, color: "#5b6671", marginTop: 2, lineHeight: 1.35 }}>
          {isIOS ? (
            <>Tap the Share icon <span style={{ fontWeight: 700 }}>⬆️</span>, then <span style={{ fontWeight: 700 }}>“Add to Home Screen.”</span></>
          ) : (
            <>Install the app for one-tap access and full-screen use.</>
          )}
        </div>
      </div>
      {!isIOS && deferred && (
        <button
          onClick={install}
          style={{ flexShrink: 0, background: "#4a8ec7", color: "#fff", border: "none", borderRadius: 10, padding: "9px 14px", fontSize: 13, fontWeight: 700, cursor: "pointer" }}
        >
          Install
        </button>
      )}
      <button
        onClick={dismiss}
        aria-label="Dismiss"
        style={{ flexShrink: 0, background: "transparent", border: "none", color: "#9aa4ae", fontSize: 20, lineHeight: 1, cursor: "pointer", padding: 4 }}
      >
        ×
      </button>
    </div>
  );
}
