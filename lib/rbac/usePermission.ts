"use client";
import { useAuth } from "@/lib/hooks/useAuth";
import { useRbac } from "@/lib/hooks/useRbac";

/** True if the signed-in user's role grants the given permission key. */
export function usePermission(perm: string): boolean {
  const role = useAuth((s) => s.user?.role);
  const rolePerms = useRbac((s) => s.rolePerms);
  if (!role) return false;
  return (rolePerms[role] || []).includes(perm);
}

/** All permission keys for the signed-in user's role. */
export function usePermissions(): string[] {
  const role = useAuth((s) => s.user?.role);
  const rolePerms = useRbac((s) => s.rolePerms);
  return role ? (rolePerms[role] || []) : [];
}
