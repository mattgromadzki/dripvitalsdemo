"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { Suspense, useEffect } from "react";
import { usePortalRecords } from "@/lib/hooks/usePortalRecords";
import { useChatReads, unreadTotal } from "@/lib/hooks/useChatReads";
import { useUI } from "@/lib/hooks/useUI";

interface NavItem { href: string; icon: string; label: string; badge?: string | number; }
interface NavSection { label: string; items: NavItem[]; }

const NAV: NavSection[] = [
  {
    label: "Clinical",
    items: [
      { href: "/dashboard",        icon: "📊", label: "Dashboard" },
      { href: "/orders",           icon: "📦", label: "Orders" },
      { href: "/shipments",        icon: "🚚", label: "Shipments" },
      { href: "/patients",         icon: "👥", label: "Patients",         badge: 8 },
      { href: "/queue",            icon: "🩺", label: "Visit Queue",      badge: 3 },
      { href: "/intake-review",    icon: "🧾", label: "Intake Review",    badge: 4 },
      { href: "/titration",        icon: "💉", label: "Dose Titration" },
      { href: "/side-effects",     icon: "🩹", label: "Side Effects" },
      { href: "/soap",             icon: "📝", label: "SOAP Notes" },
      { href: "/rx",               icon: "💊", label: "Prescriptions" },
      { href: "/e-prescribe",      icon: "℞",  label: "e-Prescribe" },
      { href: "/labs",             icon: "🧪", label: "Lab Orders" },
      { href: "/video",            icon: "🎥", label: "Video Visits" },
      { href: "/tasks",            icon: "✅", label: "Tasks",             badge: 12 },
      { href: "/referrals",        icon: "↗",  label: "Referrals" },
      { href: "/patient-chat",     icon: "💬", label: "Patient Chat" },
      { href: "/emails",           icon: "✉️", label: "Emails" },
      { href: "/sms",              icon: "📲", label: "SMS" },
      { href: "/portal",           icon: "👁", label: "Patient View" },
      { href: "/patient-portal",   icon: "📱", label: "Patient Portal" },
      { href: "/consent",          icon: "✍",  label: "Consent" },
      { href: "/treatments",       icon: "💉", label: "Treatments" },
    ],
  },
  {
    label: "Operations",
    items: [
      { href: "/shop",             icon: "🛍️", label: "Shop" },
      { href: "/medications",      icon: "💊", label: "Medications" },
      { href: "/pharmacies",       icon: "🏥", label: "Pharmacies" },
      { href: "/staff",            icon: "🩺", label: "Doctors" },
      { href: "/roles",            icon: "🔐", label: "Roles & Access" },
      { href: "/notifications",    icon: "🔔", label: "Notifications" },
      { href: "/email-templates",  icon: "🎨", label: "Email Templates" },
    ],
  },
  {
    label: "Business",
    items: [
      { href: "/analytics",        icon: "📈", label: "Analytics" },
      { href: "/subscriptions",    icon: "🔁", label: "Subscriptions" },
      { href: "/billing",          icon: "💳", label: "Billing" },
      { href: "/marketing",        icon: "📡", label: "Marketing" },
      { href: "/automations",      icon: "⚡", label: "Automations" },
      { href: "/pipeline",         icon: "🧲", label: "Lead Pipeline" },
      { href: "/reviews",          icon: "⭐", label: "Reviews" },
      { href: "/affiliate",        icon: "🤝", label: "Affiliate" },
    ],
  },
  {
    label: "Admin",
    items: [
      { href: "/audit-log",        icon: "📋", label: "Audit Log" },
      { href: "/knowledge",        icon: "📚", label: "Knowledge Base" },
      { href: "/licensure",        icon: "🗺️", label: "State Licensure" },
      { href: "/integrations",     icon: "🔗", label: "Integrations" },
      { href: "/api-keys",         icon: "🔑", label: "API Keys" },
      { href: "/connections",      icon: "🔌", label: "Connection Health" },
      { href: "/settings",         icon: "⚙",  label: "Settings" },
    ],
  },
];

export function Sidebar() {
  const open = useUI((s) => s.sidebarOpen);
  const close = useUI((s) => s.closeSidebar);
  const path = usePathname();

  // Close the drawer whenever the route changes (i.e. after tapping a nav item).
  useEffect(() => { close(); }, [path, close]);

  return (
    <>
      {open && <div className="dv-backdrop" onClick={close} />}
      <aside className={`dv-sidebar w-[236px] min-w-[236px] bg-surface border-r border-border flex flex-col overflow-y-auto py-3.5 px-3${open ? " open" : ""}`}>
        <Suspense fallback={<SidebarSkeleton />}>
          <SidebarInner />
        </Suspense>
      </aside>
    </>
  );
}

function SidebarSkeleton() {
  return (
    <>
      {NAV.map((section) => (
        <div key={section.label} className="py-1">
          <div className="text-[10px] uppercase tracking-[1.4px] text-ink-muted-2 font-bold px-3 py-1.5">
            {section.label}
          </div>
          {section.items.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="flex items-center gap-2.5 py-2 px-3 rounded-[9px] text-[12.5px] font-medium mb-px text-ink-2"
            >
              <span className="text-[14px] w-[18px] text-center flex-shrink-0">{item.icon}</span>
              <span className="flex-1">{item.label}</span>
            </Link>
          ))}
        </div>
      ))}
    </>
  );
}

function SidebarInner() {
  const path = usePathname();
  const searchParams = useSearchParams();
  const queryString = searchParams.toString();

  // Live unread count for Patient Chat: read the shared (localStorage-mirrored)
  // chat store + per-patient "seen" baseline, and re-sync on cross-tab writes.
  const records = usePortalRecords((s) => s.records);
  const seen = useChatReads((s) => s.seen);
  const hydrateRecords = usePortalRecords((s) => s.hydrate);
  const hydrateSeen = useChatReads((s) => s.hydrate);
  const initMissing = useChatReads((s) => s.initMissing);
  useEffect(() => {
    hydrateRecords(); hydrateSeen();
    const onStorage = (e: StorageEvent) => {
      if (!e.key || e.key === "dv_portal_records_v2" || e.key === "dv_chat_seen_v1") { hydrateRecords(); hydrateSeen(); }
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, [hydrateRecords, hydrateSeen]);
  useEffect(() => { initMissing(records); }, [records, initMissing]);
  const chatUnread = unreadTotal(records, seen);

  // Pre-compute the set of full hrefs (path?query) that are declared in the nav,
  // so a plain-path link doesn't claim active when a sibling claims the exact URL.
  const fullHrefsInNav = new Set<string>();
  for (const section of NAV) {
    for (const item of section.items) {
      if (item.href.includes("?")) fullHrefsInNav.add(item.href);
    }
  }

  const currentFullHref = queryString ? `${path}?${queryString}` : path;

  return (
    <>
      {NAV.map((section) => (
        <div key={section.label} className="py-1">
          <div className="text-[10px] uppercase tracking-[1.4px] text-ink-muted-2 font-bold px-3 py-1.5">
            {section.label}
          </div>
          {section.items.map((item) => {
            let active: boolean;
            if (item.href.includes("?")) {
              // Items with query strings require an exact full match.
              active = currentFullHref === item.href;
            } else {
              // Plain-path items match path; but defer to a sibling claiming the exact full URL.
              const matchesPath = path === item.href || (item.href !== "/" && path.startsWith(item.href + "/"));
              const someSiblingClaimsCurrentUrl = fullHrefsInNav.has(currentFullHref);
              active = matchesPath && !someSiblingClaimsCurrentUrl;
            }
            const badge = item.href === "/patient-chat" ? (chatUnread > 0 ? chatUnread : undefined) : item.badge;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={[
                  "flex items-center gap-2.5 py-2 px-3 rounded-[9px] text-[12.5px] font-medium mb-px transition-colors",
                  active
                    ? "text-brand-dk bg-brand-soft font-semibold"
                    : "text-ink-2 hover:bg-surface-3 hover:text-ink",
                ].join(" ")}
              >
                <span className="text-[14px] w-[18px] text-center flex-shrink-0">{item.icon}</span>
                <span className="flex-1">{item.label}</span>
                {badge != null && (
                  <span
                    className={[
                      "text-[10px] font-bold py-[1px] px-1.5 rounded-pill min-w-[18px] text-center",
                      item.href === "/patient-chat" ? "bg-red text-white" : active ? "bg-brand text-white" : "bg-surface-3 text-ink-muted",
                    ].join(" ")}
                  >
                    {badge}
                  </span>
                )}
              </Link>
            );
          })}
        </div>
      ))}
    </>
  );
}
