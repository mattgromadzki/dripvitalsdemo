"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import type { ReactNode } from "react";
import { useAuth } from "@/lib/hooks/useAuth";

export function AuthGuard({ children }: { children: ReactNode }) {
  const router = useRouter();
  const user = useAuth((s) => s.user);
  const hydrated = useAuth((s) => s.hydrated);
  const hydrate = useAuth((s) => s.hydrate);
  const mustEnroll = useAuth((s) => s.mustEnroll);

  useEffect(() => { hydrate(); }, [hydrate]);

  useEffect(() => {
    if (hydrated && !user) router.replace("/login");
    else if (hydrated && user && mustEnroll) router.replace("/enroll-2fa");
  }, [hydrated, user, mustEnroll, router]);

  if (!hydrated) {
    return (
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "var(--color-bg, #f5f7fb)", color: "var(--color-ink-muted, #6b7890)", fontSize: 13 }}>
        Loading…
      </div>
    );
  }
  if (!user) return null; // redirecting to /login
  if (mustEnroll) return null; // redirecting to /enroll-2fa
  return <>{children}</>;
}
