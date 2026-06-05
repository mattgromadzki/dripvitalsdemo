"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "@/lib/hooks/useAuth";
import { usePermissions } from "@/lib/rbac/usePermission";
import { requiredPermFor } from "@/lib/rbac/navPerms";

export function RouteGuard({ children }: { children: ReactNode }) {
  const path = usePathname() || "/";
  const role = useAuth((s) => s.user?.role);
  const perms = usePermissions();
  const required = requiredPermFor(path);

  const allowed = !required || role === "owner" || perms.includes(required);
  if (allowed) return <>{children}</>;

  return (
    <div className="px-7 py-10">
      <div className="bg-surface border border-border rounded-lg p-12 text-center max-w-lg mx-auto">
        <div className="text-[36px] opacity-40 mb-2">🔒</div>
        <div className="text-[15px] font-bold mb-1">You don’t have access to this page</div>
        <div className="text-[12.5px] text-ink-muted mb-4">Your role doesn’t include the permission needed to view this area. An owner can grant it on the Roles &amp; Access screen.</div>
        <Link href="/dashboard" className="btn btn-primary btn-sm">Back to dashboard</Link>
      </div>
    </div>
  );
}
