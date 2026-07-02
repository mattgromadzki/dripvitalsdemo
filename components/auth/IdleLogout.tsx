"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/hooks/useAuth";

// Automatic sign-out after a period of inactivity — a HIPAA Security Rule
// safeguard (automatic logoff) so an unattended workstation doesn't leave PHI
// exposed. 15 minutes is a common clinical default.
const IDLE_MS = 15 * 60 * 1000;

export function IdleLogout() {
  const router = useRouter();
  const logout = useAuth((s) => s.logout);
  const user = useAuth((s) => s.user);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!user) return; // only arm the timer while signed in

    const signOut = async () => {
      // Record the auto sign-out while the session cookie is still valid, then
      // clear the session and return to the sign-in screen.
      try {
        await fetch("/api/audit", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "auth.idle_logout", detail: "Auto sign-out after inactivity" }),
        });
      } catch { /* never block sign-out on an audit failure */ }
      await logout();
      router.replace("/login");
    };

    const reset = () => {
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(signOut, IDLE_MS);
    };

    const events = ["mousemove", "mousedown", "keydown", "scroll", "touchstart", "click"];
    events.forEach((e) => window.addEventListener(e, reset, { passive: true }));
    reset();

    return () => {
      events.forEach((e) => window.removeEventListener(e, reset));
      if (timer.current) clearTimeout(timer.current);
    };
  }, [user, logout, router]);

  return null;
}
