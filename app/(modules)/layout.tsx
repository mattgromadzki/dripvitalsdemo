import type { ReactNode } from "react";
import { Topbar } from "@/components/layout/Topbar";
import { Sidebar } from "@/components/layout/Sidebar";
import { AuthGuard } from "@/components/auth/AuthGuard";

export default function ModulesLayout({ children }: { children: ReactNode }) {
  return (
    <AuthGuard>
      <Topbar />
      <div className="flex-1 flex overflow-hidden">
        <Sidebar />
        <main className="flex-1 overflow-y-auto emr-content">{children}</main>
      </div>
    </AuthGuard>
  );
}
