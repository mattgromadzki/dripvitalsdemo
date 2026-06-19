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
  orders: "Orders",
  shipments: "Shipments",
  "intake-review": "Intake Review",
  rx: "Prescriptions",
  "e-prescribe": "e-Prescribe",
  labs: "Labs",
  messages: "Messages",
  emails: "Emails",
  sms: "SMS",
  billing: "Billing",
  payments: "Payments",
  analytics: "Analytics",
  compliance: "Compliance",
  "audit-log": "Audit Log",
  settings: "Settings",
};

export function Topbar() {
  const path = usePathname();
  const router = useRouter();
  const segment = path.split("/").filter(Boolean)[0] || "dashboard";
  const label = CRUMB_LABELS[segment] || segment.replace(/-/g, " ");
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
    <header className="h-[64px] flex-shrink-0 flex items-center gap-3.5 px-6 max-md:px-3 bg-surface/95 backdrop-blur border-b border-border z-[100]">
      <button
        onClick={toggleSidebar}
        aria-label="Open menu"
        className="dv-hamburger w-9 h-9 rounded-[13px] border border-border bg-surface-2 text-ink-2 text-[17px] mr-0.5 hover:bg-surface-3 transition-colors"
      >
        ☰
      </button>
      <Link href="/dashboard" className="flex items-center gap-2.5">
        <span className="logo-mark">DV</span>
        <span className="text-[18px] font-extrabold tracking-[-.04em] text-ink dv-hide-mobile">
          Drip<span className="text-brand">Vitals</span>
        </span>
      </Link>
      <div className="w-px h-[22px] bg-border dv-hide-mobile" />
      <div className="flex items-center gap-1.5 text-[12.5px] text-ink-muted dv-hide-mobile">
        <span>Operations</span>
        <span className="text-ink-muted-2">›</span>
        <span className="text-ink font-semibold capitalize">{label}</span>
      </div>
      <div className="flex-1" />
      <div className="dv-hide-mobile"><GlobalSearch /></div>
      <Link href="/orders" className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-brand bg-brand-soft py-1.5 px-3 rounded-pill dv-hide-mobile hover:bg-brand-softer transition-colors">
        📦 Order queue
      </Link>
      <div className="relative">
        <button onClick={() => setMenuOpen((o) => !o)} className="flex items-center gap-2.5 bg-surface border border-border rounded-pill pl-1 pr-3 py-1 hover:bg-surface-2 transition-colors">
          <div className="w-[30px] h-[30px] rounded-full bg-brand-soft flex items-center justify-center text-[11px] font-bold text-brand">
            {user?.initials || "DV"}
          </div>
          <div className="text-left dv-hide-mobile">
            <div className="text-[12.5px] font-semibold leading-tight text-ink">{user?.name || "Guest"}</div>
            <div className="text-[10.5px] text-ink-muted leading-tight">{user?.role || "—"}</div>
          </div>
          <span className="text-ink-muted-2 text-[10px] ml-0.5">▾</span>
        </button>
        {menuOpen && (
          <>
            <div className="fixed inset-0 z-[140]" onClick={() => setMenuOpen(false)} />
            <div className="absolute right-0 mt-2 w-[230px] bg-surface border border-border rounded-2xl shadow-xl z-[150] overflow-hidden">
              <div className="px-4 py-3 border-b border-border bg-surface-2">
                <div className="text-[12.5px] font-semibold">{user?.name}</div>
                <div className="text-[11px] text-ink-muted">{user?.email}</div>
              </div>
              <Link href="/settings" className="block px-4 py-2.5 text-[12.5px] hover:bg-surface-2 font-medium">Settings</Link>
              <button onClick={signOut} className="w-full text-left px-4 py-2.5 text-[12.5px] text-red hover:bg-red-soft font-medium">
                Sign out
              </button>
            </div>
          </>
        )}
      </div>
    </header>
  );
}
