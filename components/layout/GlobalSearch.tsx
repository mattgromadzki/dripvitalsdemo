"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { usePatients } from "@/lib/hooks/usePatients";
import { useLeads } from "@/lib/hooks/useLeads";
import { useSubscriptions } from "@/lib/hooks/useSubscriptions";
import { useIntake } from "@/lib/hooks/useIntake";
import { useLabs } from "@/lib/hooks/useLabs";
import { useShipments } from "@/lib/hooks/useShipments";
import { useAdverse } from "@/lib/hooks/useAdverse";

interface Item { type: string; label: string; sub: string; href: string; icon: string; }

const PAGES: Item[] = [
  { type: "Page", label: "Dashboard", sub: "Overview", href: "/dashboard", icon: "📊" },
  { type: "Page", label: "Visits", sub: "Fulfillment", href: "/orders", icon: "📦" },
  { type: "Page", label: "Shipments", sub: "Tracking", href: "/shipments", icon: "🚚" },
  { type: "Page", label: "Intake Review", sub: "Clinical", href: "/intake-review", icon: "🧾" },
  { type: "Page", label: "Dose Titration", sub: "Clinical", href: "/titration", icon: "💉" },
  { type: "Page", label: "Side Effects", sub: "Clinical", href: "/side-effects", icon: "🩹" },
  { type: "Page", label: "Lab Orders", sub: "Clinical", href: "/labs", icon: "🧪" },
  { type: "Page", label: "Emails", sub: "Messaging", href: "/emails", icon: "✉️" },
  { type: "Page", label: "SMS & Campaigns", sub: "Messaging", href: "/sms", icon: "📲" },
  { type: "Page", label: "Subscriptions", sub: "Billing", href: "/subscriptions", icon: "🔁" },
  { type: "Page", label: "Analytics", sub: "Business", href: "/analytics", icon: "📈" },
  { type: "Page", label: "Automations", sub: "Growth", href: "/automations", icon: "⚡" },
  { type: "Page", label: "Lead Pipeline", sub: "Growth", href: "/pipeline", icon: "🧲" },
  { type: "Page", label: "Consent", sub: "Clinical", href: "/consent", icon: "✍️" },
  { type: "Page", label: "State Licensure", sub: "Admin", href: "/licensure", icon: "🗺️" },
  { type: "Page", label: "Roles & Access", sub: "Admin", href: "/roles", icon: "🔐" },
  { type: "Page", label: "API Keys", sub: "Admin", href: "/api-keys", icon: "🔑" },
];

export function GlobalSearch() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  const patients = usePatients((s) => s.patients);
  const leads = useLeads((s) => s.leads);
  const subs = useSubscriptions((s) => s.subscriptions);
  const intakes = useIntake((s) => s.submissions);
  const labs = useLabs((s) => s.orders);
  const shipments = useShipments((s) => s.shipments);
  const adverse = useAdverse((s) => s.reports);

  const index = useMemo<Item[]>(() => [
    ...patients.map((p) => ({ type: "Patient", label: p.name, sub: `${p.state} · ${p.plan || "—"}`, href: `/patients/${p.id}`, icon: "👤" })),
    ...leads.map((l) => ({ type: "Lead", label: l.name, sub: `${l.stage || "new"} · ${l.source || ""}`, href: "/pipeline", icon: "🧲" })),
    ...subs.map((s) => ({ type: "Subscription", label: s.patientName, sub: `${s.planName} · ${s.status}`, href: "/subscriptions", icon: "🔁" })),
    ...intakes.map((i) => ({ type: "Intake", label: i.patientName, sub: `${i.program} · ${i.status}`, href: "/intake-review", icon: "🧾" })),
    ...labs.map((o) => ({ type: "Lab", label: `${o.patientName} — ${o.panelName}`, sub: o.status, href: "/labs", icon: "🧪" })),
    ...shipments.map((s) => ({ type: "Shipment", label: s.patientName, sub: `${s.carrier} · ${s.trackingNumber}`, href: "/shipments", icon: "🚚" })),
    ...adverse.map((r) => ({ type: "Adverse event", label: `${r.patientName} — ${r.symptom}`, sub: `${r.severity} · ${r.status}`, href: "/side-effects", icon: "🩹" })),
    ...PAGES,
  ], [patients, leads, subs, intakes, labs, shipments, adverse]);

  const results = useMemo(() => {
    const term = q.trim().toLowerCase();
    if (!term) return PAGES.slice(0, 8);
    return index.filter((i) => (i.label + " " + i.sub + " " + i.type).toLowerCase().includes(term)).slice(0, 24);
  }, [q, index]);

  const grouped = useMemo(() => {
    const m: Record<string, Item[]> = {};
    results.forEach((r) => { (m[r.type] ||= []).push(r); });
    return Object.entries(m);
  }, [results]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") { e.preventDefault(); setOpen(true); }
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);
  useEffect(() => { if (open) { setQ(""); setTimeout(() => inputRef.current?.focus(), 30); } }, [open]);

  function go(href: string) { setOpen(false); router.push(href); }

  return (
    <>
      <button onClick={() => setOpen(true)} className="flex items-center gap-2 bg-surface-2 border border-border rounded-pill pl-3 pr-2 py-1.5 text-[12.5px] text-ink-muted hover:bg-surface-3 min-w-[200px]">
        <span>🔍</span><span className="flex-1 text-left">Search…</span>
        <span className="text-[10px] font-semibold bg-surface border border-border rounded px-1.5 py-0.5">⌘K</span>
      </button>

      {open && (
        <div className="fixed inset-0 z-[200] bg-black/30 flex items-start justify-center pt-[12vh] px-4" onClick={() => setOpen(false)}>
          <div className="w-full max-w-[560px] bg-surface border border-border rounded-2xl shadow-2xl overflow-hidden" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center gap-2.5 px-4 py-3 border-b border-border">
              <span className="text-ink-muted">🔍</span>
              <input ref={inputRef} value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search patients, orders, leads, labs…"
                onKeyDown={(e) => { if (e.key === "Enter" && results[0]) go(results[0].href); }}
                className="flex-1 bg-transparent outline-none text-[14px]" />
              <span className="text-[10px] text-ink-muted-2">esc</span>
            </div>
            <div className="max-h-[55vh] overflow-y-auto py-1.5">
              {grouped.length === 0 && <div className="px-4 py-8 text-center text-ink-muted text-[12.5px]">No matches for “{q}”.</div>}
              {grouped.map(([type, items]) => (
                <div key={type} className="mb-1">
                  <div className="px-4 py-1 text-[10px] uppercase tracking-wide text-ink-muted font-bold">{type}</div>
                  {items.map((it, i) => (
                    <button key={i} onClick={() => go(it.href)} className="w-full flex items-center gap-2.5 px-4 py-2 text-left hover:bg-surface-2">
                      <span className="text-[15px]">{it.icon}</span>
                      <span className="flex-1 min-w-0"><span className="text-[13px] font-semibold block truncate">{it.label}</span><span className="text-[11px] text-ink-muted block truncate">{it.sub}</span></span>
                      <span className="text-[11px] text-ink-muted-2">↵</span>
                    </button>
                  ))}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
