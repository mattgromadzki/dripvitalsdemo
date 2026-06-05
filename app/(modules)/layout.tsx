import type { ReactNode } from "react";
import { Topbar } from "@/components/layout/Topbar";
import { Sidebar } from "@/components/layout/Sidebar";
import { AuthGuard } from "@/components/auth/AuthGuard";
import { RouteGuard } from "@/components/auth/RouteGuard";
import { CrmHydrator } from "@/components/crm/CrmHydrator";
import { PersistHydrator } from "@/components/persist/PersistHydrator";

export default function ModulesLayout({ children }: { children: ReactNode }) {
  return (
    <AuthGuard>
      <CrmHydrator />
      <PersistHydrator />
      <Topbar />
      <div className="flex-1 flex overflow-hidden">
        <Sidebar />
        <main className="flex-1 overflow-y-auto emr-content"><RouteGuard>{children}</RouteGuard></main>
      </div>
    </AuthGuard>
  );
}
