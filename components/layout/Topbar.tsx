"use client";

import Link from "next/link";
import { useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { GlobalSearch } from "./GlobalSearch";
import { useAuth } from "@/lib/hooks/useAuth";
import { useUI } from "@/lib/hooks/useUI";

const CRUMB_LABELS: Record<string, string> = {
  dashboard: "Dashboard",
  patients: "Patients",
  emr: "EMR",
  queue: "Visit Queue",
  soap: "SOAP Notes",
  rx: "Prescriptions",
  labs: "Lab Orders",
  video: "Video Visits",
  tasks: "Tasks",
  messaging: "Messaging",
  billing: "Billing",
  marketing: "Marketing",
  analytics: "Analytics",
  staff: "Staff",
  pharmacies: "Pharmacies",
  integrations: "Integrations",
};

export function Topbar() {
  const path = usePathname();
  const router = useRouter();
  const segment = path.split("/").filter(Boolean)[0] || "dashboard";
  const label = CRUMB_LABELS[segment] || segment;
  const user = useAuth((s) => s.user);
  const logout = useAuth((s) => s.logout);
  const toggleSidebar = useUI((s) => s.toggleSidebar);
  const [menuOpen, setMenuOpen] = useState(false);

  function signOut() {
    setMenuOpen(false);
    logout();
    router.replace("/login");
  }

  return (
    <header className="h-[60px] flex-shrink-0 flex items-center gap-3.5 px-6 max-md:px-3 bg-surface border-b border-border z-[100]">
      <button onClick={toggleSidebar} aria-label="Open menu" className="dv-hamburger w-9 h-9 rounded-lg border border-border bg-surface-2 text-ink text-[17px] mr-0.5">☰</button>
      <Link href="/dashboard" className="flex items-center">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/logo.png" alt="DripVitals" style={{ height: 40, width: "auto", objectFit: "contain", borderRadius: 8 }} />
      </Link>
      <div className="w-px h-[22px] bg-border dv-hide-mobile" />
      <div className="flex items-center gap-1.5 text-[12.5px] text-ink-muted dv-hide-mobile">
        <span>Operations</span>
        <span className="text-ink-muted-2">›</span>
        <span className="text-ink font-semibold">{label}</span>
      </div>
      <div className="flex-1" />
      <div className="dv-hide-mobile"><GlobalSearch /></div>
      <div className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-brand bg-brand-soft py-1 px-3 rounded-pill dv-hide-mobile">
        🛡 Admin Console
      </div>
      <div className="relative">
        <button onClick={() => setMenuOpen((o) => !o)} className="flex items-center gap-2.5 bg-surface-2 border border-border rounded-pill pl-1 pr-3 py-1 hover:bg-surface-3">
          <div className="w-[30px] h-[30px] rounded-full bg-brand flex items-center justify-center text-[11px] font-bold text-white">
            {user?.initials || "DV"}
          </div>
          <div className="text-left">
            <div className="text-[12.5px] font-semibold leading-tight">{user?.name || "Guest"}</div>
            <div className="text-[10.5px] text-ink-muted leading-tight">{user?.role || "—"}</div>
          </div>
          <span className="text-ink-muted-2 text-[10px] ml-0.5">▾</span>
        </button>
        {menuOpen && (
          <>
            <div className="fixed inset-0 z-[140]" onClick={() => setMenuOpen(false)} />
            <div className="absolute right-0 mt-1.5 w-[220px] bg-surface border border-border rounded-xl shadow-lg z-[150] overflow-hidden">
              <div className="px-3.5 py-2.5 border-b border-border">
                <div className="text-[12.5px] font-semibold">{user?.name}</div>
                <div className="text-[11px] text-ink-muted">{user?.email}</div>
              </div>
              <button onClick={signOut} className="w-full text-left px-3.5 py-2.5 text-[12.5px] text-red hover:bg-surface-2 font-medium">
                Sign out
              </button>
            </div>
          </>
        )}
      </div>
    </header>
  );
}
