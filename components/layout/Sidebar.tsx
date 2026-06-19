"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { usePortalRecords } from "@/lib/hooks/usePortalRecords";
import { useChatReads, unreadTotal } from "@/lib/hooks/useChatReads";
import { useUI } from "@/lib/hooks/useUI";
import { usePermissions } from "@/lib/rbac/usePermission";
import { NAV_PERM } from "@/lib/rbac/navPerms";

interface NavItem { href: string; icon: string; label: string; badge?: string | number; }
interface NavSection { label: string; items: NavItem[]; collapsible?: boolean }

const NAV: NavSection[] = [
  {
    label: "Daily Work",
    items: [
      { href: "/dashboard",     icon: "🏠", label: "Dashboard" },
      { href: "/orders",        icon: "📦", label: "Orders" },
      { href: "/patients",      icon: "👥", label: "Patients", badge: 8 },
      { href: "/intake-review", icon: "📋", label: "Intake Review", badge: 4 },
      { href: "/shipments",     icon: "🚚", label: "Shipments" },
      { href: "/patient-chat",  icon: "💬", label: "Patient Chat" },
      { href: "/tasks",         icon: "✅", label: "Tasks", badge: 12 },
    ],
  },
  {
    label: "Clinical",
    items: [
      { href: "/rx",          icon: "💊", label: "Prescriptions" },
      { href: "/e-prescribe", icon: "℞",  label: "e-Prescribe" },
      { href: "/titration",   icon: "💉", label: "Dose Titration" },
      { href: "/side-effects",icon: "🩹", label: "Side Effects" },
      { href: "/soap",        icon: "📝", label: "SOAP Notes" },
      { href: "/labs",        icon: "🧪", label: "Lab Orders" },
      { href: "/consent",     icon: "✍",  label: "Consent" },
    ],
  },
  {
    label: "Business",
    items: [
      { href: "/analytics",     icon: "📈", label: "Analytics" },
      { href: "/subscriptions", icon: "🔁", label: "Subscriptions" },
      { href: "/payments",      icon: "💸", label: "Payments" },
      { href: "/billing",       icon: "💳", label: "Billing" },
      { href: "/marketing",     icon: "📣", label: "Marketing" },
      { href: "/automations",   icon: "⚡", label: "Automations" },
      { href: "/pipeline",      icon: "🧲", label: "Lead Pipeline" },
      { href: "/reviews",       icon: "⭐", label: "Reviews" },
      { href: "/affiliate",     icon: "🤝", label: "Affiliate" },
      { href: "/shop",          icon: "🛍️", label: "Shop" },
    ],
  },
  {
    label: "Admin",
    collapsible: true,
    items: [
      { href: "/audit-log",       icon: "📋", label: "Audit Log" },
      { href: "/licensure",       icon: "🗺️", label: "State Licensure" },
      { href: "/readiness",       icon: "🚀", label: "Launch Readiness" },
      { href: "/brands",          icon: "🏷️", label: "Brands" },
      { href: "/treatments",      icon: "💉", label: "Treatments" },
      { href: "/medications",     icon: "💊", label: "Medications" },
      { href: "/pharmacies",      icon: "🏥", label: "Pharmacies" },
      { href: "/staff",           icon: "🩺", label: "Doctors" },
      { href: "/roles",           icon: "🔐", label: "Roles & Access" },
      { href: "/team",            icon: "👤", label: "Team" },
      { href: "/emails",          icon: "✉️", label: "Emails" },
      { href: "/sms",             icon: "📲", label: "SMS" },
      { href: "/email-templates", icon: "🎨", label: "Email Templates" },
      { href: "/notifications",   icon: "🔔", label: "Notifications" },
      { href: "/integrations",    icon: "🔗", label: "Integrations" },
      { href: "/api-keys",        icon: "🔑", label: "API Keys" },
      { href: "/connections",     icon: "🔌", label: "Connection Health" },
      { href: "/knowledge",       icon: "📚", label: "Knowledge Base" },
      { href: "/settings",        icon: "⚙",  label: "Settings" },
      { href: "/portal",          icon: "👁", label: "Patient View" },
      { href: "/patient-portal",  icon: "📱", label: "Patient Portal" },
      { href: "/referrals",       icon: "↗",  label: "Referrals" },
    ],
  },
];

const headerCls = "text-[10px] uppercase tracking-[1.35px] text-ink-muted-2 font-bold px-3 py-1.5";

export function Sidebar() {
  const open = useUI((s) => s.sidebarOpen);
  const close = useUI((s) => s.closeSidebar);
  const path = usePathname();

  useEffect(() => { close(); }, [path, close]);

  return (
    <>
      {open && <div className="dv-backdrop" onClick={close} />}
      <aside className={`dv-sidebar w-[242px] min-w-[242px] bg-surface border-r border-border flex flex-col overflow-y-auto py-4 px-3${open ? " open" : ""}`}>
        <div className="px-2 pb-3 mb-2 border-b border-border">
          <Link href="/dashboard" className="flex items-center gap-2.5">
            <span className="logo-mark">DV</span>
            <span className="text-[18px] font-extrabold tracking-[-.04em] text-ink">Drip<span className="text-brand">Vitals</span></span>
          </Link>
          <div className="mt-2 text-[11px] text-ink-muted font-medium">Clinic operations</div>
        </div>
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
          <div className={headerCls}>{section.label}</div>
          {!section.collapsible && section.items.map((item) => (
            <div key={item.href} className="flex items-center gap-2.5 py-2 px-3 rounded-[13px] text-[12.5px] font-medium mb-px text-ink-2">
              <span className="text-[14px] w-[20px] text-center flex-shrink-0">{item.icon}</span>
              <span className="flex-1">{item.label}</span>
            </div>
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
  const perms = usePermissions();

  const [collapsed, setCollapsed] = useState<Record<string, boolean>>(() => {
    const init: Record<string, boolean> = {};
    for (const s of NAV) if (s.collapsible) init[s.label] = true;
    return init;
  });

  const fullHrefsInNav = new Set<string>();
  for (const section of NAV) for (const item of section.items) if (item.href.includes("?")) fullHrefsInNav.add(item.href);
  const currentFullHref = queryString ? `${path}?${queryString}` : path;

  function itemActive(item: NavItem): boolean {
    if (item.href.includes("?")) return currentFullHref === item.href;
    const matchesPath = path === item.href || (item.href !== "/" && path.startsWith(item.href + "/"));
    return matchesPath && !fullHrefsInNav.has(currentFullHref);
  }

  return (
    <>
      {NAV.map((section) => {
        const items = section.items.filter((it) => !NAV_PERM[it.href] || perms.includes(NAV_PERM[it.href]));
        if (items.length === 0) return null;
        const sectionActive = items.some(itemActive);
        const expanded = !section.collapsible || !collapsed[section.label] || sectionActive;
        return (
          <div key={section.label} className="py-1">
            {section.collapsible ? (
              <button
                type="button"
                onClick={() => setCollapsed((c) => ({ ...c, [section.label]: !c[section.label] }))}
                className={`${headerCls} w-full flex items-center justify-between hover:text-ink-muted transition-colors`}
              >
                <span>{section.label}</span>
                <span className="text-[9px]">{expanded ? "▾" : "▸"}</span>
              </button>
            ) : <div className={headerCls}>{section.label}</div>}

            {expanded && items.map((item) => {
              const active = itemActive(item);
              const badge = item.href === "/patient-chat" ? (chatUnread > 0 ? chatUnread : undefined) : item.badge;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={[
                    "flex items-center gap-2.5 py-2 px-3 rounded-[13px] text-[12.5px] font-medium mb-px transition-colors",
                    active ? "text-brand-dk bg-brand-soft font-semibold" : "text-ink-2 hover:bg-surface-3 hover:text-ink",
                  ].join(" ")}
                >
                  <span className="text-[14px] w-[20px] text-center flex-shrink-0">{item.icon}</span>
                  <span className="flex-1 truncate">{item.label}</span>
                  {badge != null && (
                    <span className={["text-[10px] font-bold py-[1px] px-1.5 rounded-pill min-w-[18px] text-center", item.href === "/patient-chat" ? "bg-red-soft text-red" : active ? "bg-brand text-white" : "bg-surface-3 text-ink-muted"].join(" ")}>{badge}</span>
                  )}
                </Link>
              );
            })}
          </div>
        );
      })}
    </>
  );
}
