"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Pill } from "@/components/ui/Pill";
import { Toast } from "@/components/ui/Toast";
import { toast } from "@/lib/hooks/useToast";
import { usePatients } from "@/lib/hooks/usePatients";
import { getFulfillmentOrders, type FulfillmentOrder } from "@/lib/data/fulfillmentOrders";
import { WORKFLOW_META, WORKFLOW_STAGES, type WorkflowStatus } from "@/lib/data/orderWorkflow";
import { StatusBadge } from "@/components/modules/orders/StatusBadge";
import { OrderPreviewDrawer } from "@/components/modules/orders/OrderPreviewDrawer";

const TONE_DOT: Record<string, string> = {
  brand: "var(--color-brand)", green: "var(--color-green)", blue: "var(--color-blue)",
  amber: "var(--color-amber)", red: "var(--color-red)", purple: "var(--color-purple)",
  teal: "var(--color-teal)", coral: "var(--color-coral)", pink: "var(--color-pink)", muted: "var(--color-ink-muted-2)",
};
const money = (n: number) => "$" + n.toLocaleString("en-US");
const parse$ = (s: string) => Number((s || "").replace(/[^0-9.]/g, "")) || 0;

const MONTHS: Record<string, number> = { Jan: 0, Feb: 1, Mar: 2, Apr: 3, May: 4, Jun: 5, Jul: 6, Aug: 7, Sep: 8, Oct: 9, Nov: 10, Dec: 11 };
const NOW = new Date(2026, 4, 31); // May 31, 2026
function parseCreated(s: string): Date | null {
  const m = (s || "").match(/^([A-Za-z]{3})\s+(\d{1,2})(?:,\s*(\d{4}))?$/);
  if (!m) return null;
  const mon = MONTHS[m[1]];
  if (mon == null) return null;
  return new Date(m[3] ? Number(m[3]) : 2026, mon, Number(m[2]));
}
function withinDays(s: string, days: number): boolean {
  const d = parseCreated(s);
  if (!d) return false;
  const diff = (NOW.getTime() - d.getTime()) / 86400000;
  return diff >= 0 && (days === 0 ? diff < 1 : diff <= days);
}
const DATE_LABELS: Record<string, string> = { today: "Today", "7": "Last 7 days", "30": "Last 30 days", "90": "Last 90 days" };

export default function OrdersPage() {
  const patients = usePatients((s) => s.patients);
  const orders = useMemo(() => getFulfillmentOrders(patients), [patients]);

  const [search, setSearch] = useState("");
  const [activeStatuses, setActiveStatuses] = useState<WorkflowStatus[] | null>(null);
  const [programFilter, setProgramFilter] = useState<string | null>(null);
  const [orderTypeFilter, setOrderTypeFilter] = useState<string | null>(null);
  const [providerFilter, setProviderFilter] = useState<string | null>(null);
  const [pharmacyFilter, setPharmacyFilter] = useState<string | null>(null);
  const [stateFilter, setStateFilter] = useState<string | null>(null);
  const [dateFilter, setDateFilter] = useState<string | null>(null);
  const [statusOpen, setStatusOpen] = useState(false);
  const [selected, setSelected] = useState<FulfillmentOrder | null>(null);

  const byStatus = useMemo(() => {
    const m: Partial<Record<WorkflowStatus, number>> = {};
    orders.forEach((o) => { m[o.status] = (m[o.status] || 0) + 1; });
    return m;
  }, [orders]);
  const n = (...s: WorkflowStatus[]) => s.reduce((a, k) => a + (byStatus[k] || 0), 0);

  const revToday = orders.filter((o) => o.updated !== "Yesterday").reduce((a, o) => a + parse$(o.total), 0);
  const revMonth = orders.reduce((a, o) => a + parse$(o.total), 0);

  const KPIS: { label: string; value: string; statuses?: WorkflowStatus[]; orderType?: string; rev?: boolean }[] = [
    { label: "New Today",         value: String(n("new_order")),                                   statuses: ["new_order"] },
    { label: "Pending Review",    value: String(n("awaiting_provider_review", "provider_reviewing")), statuses: ["awaiting_provider_review", "provider_reviewing"] },
    { label: "Awaiting Pay",      value: String(n("awaiting_payment")),                            statuses: ["awaiting_payment"] },
    { label: "Awaiting Pharmacy", value: String(n("ready_for_pharmacy")),                          statuses: ["ready_for_pharmacy"] },
    { label: "In Processing",     value: String(n("pharmacy_processing", "sent_to_pharmacy")),     statuses: ["pharmacy_processing", "sent_to_pharmacy"] },
    { label: "Shipped",           value: String(n("label_created", "shipped", "in_transit")),      statuses: ["label_created", "shipped", "in_transit"] },
    { label: "Delivered",         value: String(n("delivered")),                                   statuses: ["delivered"] },
    { label: "Refills Due",       value: String(orders.filter((o) => o.orderType === "Refill").length), orderType: "Refill" },
    { label: "Failed",            value: String(n("payment_failed", "denied", "chargeback")),      statuses: ["payment_failed", "denied", "chargeback"] },
    { label: "Rev. Today",        value: money(revToday), rev: true },
    { label: "Rev. MTD",          value: money(revMonth), rev: true },
  ];

  const programs = useMemo(() => Array.from(new Set(orders.map((o) => o.program))), [orders]);
  const providers = useMemo(() => Array.from(new Set(orders.map((o) => o.provider))).sort(), [orders]);
  const pharmacies = useMemo(() => Array.from(new Set(orders.map((o) => o.pharmacy))).sort(), [orders]);
  const states = useMemo(() => Array.from(new Set(orders.map((o) => o.state))).sort(), [orders]);

  const filtered = useMemo(() => orders.filter((o) => {
    if (activeStatuses && !activeStatuses.includes(o.status)) return false;
    if (programFilter && o.program !== programFilter) return false;
    if (orderTypeFilter && o.orderType !== orderTypeFilter) return false;
    if (providerFilter && o.provider !== providerFilter) return false;
    if (pharmacyFilter && o.pharmacy !== pharmacyFilter) return false;
    if (stateFilter && o.state !== stateFilter) return false;
    if (dateFilter && !withinDays(o.created, dateFilter === "today" ? 0 : Number(dateFilter))) return false;
    if (search) {
      const q = search.toLowerCase();
      if (!(o.id.toLowerCase().includes(q) || o.patientName.toLowerCase().includes(q) || o.medication.toLowerCase().includes(q))) return false;
    }
    return true;
  }), [orders, activeStatuses, programFilter, orderTypeFilter, providerFilter, pharmacyFilter, stateFilter, dateFilter, search]);

  const anyFilter = activeStatuses || programFilter || orderTypeFilter || providerFilter || pharmacyFilter || stateFilter || dateFilter;
  const clearAll = () => {
    setActiveStatuses(null); setProgramFilter(null); setOrderTypeFilter(null);
    setProviderFilter(null); setPharmacyFilter(null); setStateFilter(null); setDateFilter(null);
  };
  const typeIntent = (t: string): "blue" | "teal" | "purple" => (t === "New" ? "blue" : t === "Refill" ? "teal" : "purple");

  return (
    <div className="px-7 py-6 text-[14px]">
      <div className="flex items-center gap-3.5 mb-4 flex-wrap">
        <div>
          <h1 className="text-[21px] font-extrabold tracking-tight">Orders</h1>
          <div className="text-[12px] text-ink-muted mt-0.5">Operational command center · process, route &amp; track every order without opening a chart</div>
        </div>
        <div className="flex-1" />
        <button className="btn btn-ghost btn-sm" onClick={() => toast("⬇ Exporting…")}>⬇ Export</button>
        <button className="btn btn-ghost btn-sm" onClick={() => toast("⚙ Columns")}>⚙ Columns</button>
        <button className="btn btn-primary btn-sm" onClick={() => toast("➕ New order")}>+ New order</button>
      </div>

      {/* KPI cards */}
      <div className="flex flex-wrap justify-between gap-2.5 mb-3.5">
        {KPIS.map((k) => (
          <button
            key={k.label}
            onClick={() => {
              if (k.rev) return;
              clearAll();
              if (k.statuses) setActiveStatuses(k.statuses);
              else if (k.orderType) setOrderTypeFilter(k.orderType);
            }}
            className="bg-surface border border-border rounded-2xl px-4 py-3 text-left hover:shadow-md transition-shadow"
          >
            <div className={`text-[22px] font-extrabold tracking-tight leading-none ${k.rev ? "text-green text-[18px]" : "text-ink"}`}>{k.value}</div>
            <div className="text-[11px] text-ink-muted mt-1.5 whitespace-nowrap">{k.label}</div>
          </button>
        ))}
      </div>

      {/* Toolbar */}
      <div className="flex items-center gap-2 flex-wrap bg-surface border border-border rounded-xl p-2.5 mb-3">
        <div className="flex-1 min-w-[220px] flex items-center gap-2 bg-surface-2 border border-border rounded-[9px] px-3 py-2">
          <span className="text-ink-muted">🔍</span>
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search order ID, patient, medication…" className="bg-transparent outline-none text-[12.5px] w-full" />
        </div>

        {/* Status workflow filter */}
        <div className="relative">
          <button className="text-[12px] font-semibold text-ink-2 bg-surface border border-border rounded-[9px] px-3 py-2" onClick={() => setStatusOpen((o) => !o)}>
            Status <span className="text-ink-muted">▾</span>
          </button>
          {statusOpen && (
            <>
              <div className="fixed inset-0 z-[40]" onClick={() => setStatusOpen(false)} />
              <div className="absolute top-[42px] left-0 z-[50] bg-surface border border-border rounded-xl shadow-xl p-4 grid grid-cols-4 gap-x-5 gap-y-3 w-[720px]">
                {WORKFLOW_STAGES.map((g) => (
                  <div key={g.stage}>
                    <div className="text-[9px] uppercase tracking-wider text-ink-muted-2 font-bold mb-1.5">{g.stage}</div>
                    {g.statuses.map((st) => (
                      <div key={st} onClick={() => { setActiveStatuses([st]); setStatusOpen(false); }}
                           className="flex items-center gap-2 py-1 text-[11.5px] text-ink-2 cursor-pointer hover:text-brand-dk">
                        <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: TONE_DOT[WORKFLOW_META[st].intent] }} />
                        {WORKFLOW_META[st].label}
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            </>
          )}
        </div>

        {/* Program filter */}
        <select value={programFilter ?? ""} onChange={(e) => setProgramFilter(e.target.value || null)}
                className="text-[12px] font-semibold text-ink-2 bg-surface border border-border rounded-[9px] px-3 py-2 cursor-pointer">
          <option value="">Program</option>
          {programs.map((p) => <option key={p} value={p}>{p}</option>)}
        </select>
        <select value={providerFilter ?? ""} onChange={(e) => setProviderFilter(e.target.value || null)}
                className="text-[12px] font-semibold text-ink-2 bg-surface border border-border rounded-[9px] px-3 py-2 cursor-pointer">
          <option value="">Provider</option>
          {providers.map((p) => <option key={p} value={p}>{p}</option>)}
        </select>
        <select value={pharmacyFilter ?? ""} onChange={(e) => setPharmacyFilter(e.target.value || null)}
                className="text-[12px] font-semibold text-ink-2 bg-surface border border-border rounded-[9px] px-3 py-2 cursor-pointer">
          <option value="">Pharmacy</option>
          {pharmacies.map((p) => <option key={p} value={p}>{p}</option>)}
        </select>
        <select value={stateFilter ?? ""} onChange={(e) => setStateFilter(e.target.value || null)}
                className="text-[12px] font-semibold text-ink-2 bg-surface border border-border rounded-[9px] px-3 py-2 cursor-pointer">
          <option value="">State</option>
          {states.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
        <select value={dateFilter ?? ""} onChange={(e) => setDateFilter(e.target.value || null)}
                className="text-[12px] font-semibold text-ink-2 bg-surface border border-border rounded-[9px] px-3 py-2 cursor-pointer">
          <option value="">Date</option>
          <option value="today">Today</option>
          <option value="7">Last 7 days</option>
          <option value="30">Last 30 days</option>
          <option value="90">Last 90 days</option>
        </select>
      </div>

      {/* Active filter chips */}
      {anyFilter && (
        <div className="flex items-center gap-2 mb-3 text-[12px]">
          <span className="text-ink-muted">Filtered:</span>
          {activeStatuses && <span className="bg-brand-soft text-brand-dk font-semibold px-2.5 py-1 rounded-pill">{activeStatuses.map((s) => WORKFLOW_META[s].label).join(" / ")}</span>}
          {programFilter && <span className="bg-brand-soft text-brand-dk font-semibold px-2.5 py-1 rounded-pill">{programFilter}</span>}
          {orderTypeFilter && <span className="bg-brand-soft text-brand-dk font-semibold px-2.5 py-1 rounded-pill">{orderTypeFilter}</span>}
          {providerFilter && <span className="bg-brand-soft text-brand-dk font-semibold px-2.5 py-1 rounded-pill">{providerFilter}</span>}
          {pharmacyFilter && <span className="bg-brand-soft text-brand-dk font-semibold px-2.5 py-1 rounded-pill">{pharmacyFilter}</span>}
          {stateFilter && <span className="bg-brand-soft text-brand-dk font-semibold px-2.5 py-1 rounded-pill">{stateFilter}</span>}
          {dateFilter && <span className="bg-brand-soft text-brand-dk font-semibold px-2.5 py-1 rounded-pill">{DATE_LABELS[dateFilter]}</span>}
          <button className="text-ink-muted hover:text-ink underline" onClick={clearAll}>Clear</button>
        </div>
      )}

      {/* Table */}
      <div className="bg-surface border border-border rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="border-collapse w-full min-w-[1500px]">
            <thead>
              <tr className="bg-surface-2">
                {["Order ID","Patient","Medication","Program","Order Type","Current Dose","Qty","Provider","State","Pharmacy","Status","Created","Last Updated","Tracking","Total"].map((h) => (
                  <th key={h} className="text-[10px] uppercase tracking-wide text-ink-muted font-bold text-left px-3 py-2.5 border-b border-border whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((o) => (
                <tr key={o.id} onClick={() => setSelected(o)} className="border-b border-border last:border-none hover:bg-surface-2 cursor-pointer">
                  <td className="px-3 py-2.5 font-mono text-[11.5px] font-semibold text-ink-2 whitespace-nowrap">{o.id}</td>
                  <td className="px-3 py-2.5 whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                    <Link href={`/patients/${o.patientId}`} className="text-brand-dk font-semibold hover:underline">{o.patientName}</Link>
                  </td>
                  <td className="px-3 py-2.5 font-semibold whitespace-nowrap">{o.medication}</td>
                  <td className="px-3 py-2.5"><Pill intent={o.programIntent}>{o.program}</Pill></td>
                  <td className="px-3 py-2.5"><Pill intent={typeIntent(o.orderType)}>{o.orderType}</Pill></td>
                  <td className="px-3 py-2.5 whitespace-nowrap">{o.dose}</td>
                  <td className="px-3 py-2.5 whitespace-nowrap">{o.qty}</td>
                  <td className="px-3 py-2.5 whitespace-nowrap">{o.provider}</td>
                  <td className="px-3 py-2.5">{o.state}</td>
                  <td className="px-3 py-2.5 whitespace-nowrap">{o.pharmacy}</td>
                  <td className="px-3 py-2.5"><StatusBadge status={o.status} /></td>
                  <td className="px-3 py-2.5 whitespace-nowrap text-ink-2">{o.created}</td>
                  <td className="px-3 py-2.5 whitespace-nowrap text-ink-muted">{o.updated}</td>
                  <td className="px-3 py-2.5 whitespace-nowrap text-ink-muted text-[11px]">{o.tracking}</td>
                  <td className="px-3 py-2.5 font-bold whitespace-nowrap">{o.total}</td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr><td colSpan={15} className="px-3 py-10 text-center text-ink-muted text-[12px]">No orders match these filters.</td></tr>
              )}
            </tbody>
          </table>
        </div>
        <div className="flex items-center gap-2 px-4 py-2.5 border-t border-border text-[12px] text-ink-muted">
          Showing <b className="text-ink-2">{filtered.length}</b> of <b className="text-ink-2">{orders.length}</b> orders
        </div>
      </div>

      {selected && <OrderPreviewDrawer order={selected} onClose={() => setSelected(null)} />}
      <Toast />
    </div>
  );
}
