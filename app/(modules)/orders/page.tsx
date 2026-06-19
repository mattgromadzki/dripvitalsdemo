"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Pill } from "@/components/ui/Pill";
import { Toast } from "@/components/ui/Toast";
import { toast } from "@/lib/hooks/useToast";
import { usePatients } from "@/lib/hooks/usePatients";
import { getFulfillmentOrders, type FulfillmentOrder } from "@/lib/data/fulfillmentOrders";
import { WORKFLOW_META, type WorkflowStatus, type WorkflowStage } from "@/lib/data/orderWorkflow";
import { StatusBadge } from "@/components/modules/orders/StatusBadge";
import { OrderPreviewDrawer } from "@/components/modules/orders/OrderPreviewDrawer";

const parse$ = (s: string) => Number((s || "").replace(/[^0-9.]/g, "")) || 0;
const MONTHS: Record<string, number> = { Jan: 0, Feb: 1, Mar: 2, Apr: 3, May: 4, Jun: 5, Jul: 6, Aug: 7, Sep: 8, Oct: 9, Nov: 10, Dec: 11 };
const NOW = new Date(2026, 4, 31);
function parseCreated(s: string): Date | null {
  const m = (s || "").match(/^([A-Za-z]{3})\s+(\d{1,2})(?:,\s*(\d{4}))?$/);
  if (!m) return null;
  const mon = MONTHS[m[1]]; if (mon == null) return null;
  return new Date(m[3] ? Number(m[3]) : 2026, mon, Number(m[2]));
}
function withinDays(s: string, days: number): boolean {
  const d = parseCreated(s); if (!d) return false;
  const diff = (NOW.getTime() - d.getTime()) / 86400000;
  return diff >= 0 && (days === 0 ? diff < 1 : diff <= days);
}

const STAGE_ORDER: WorkflowStage[] = ["Intake", "Medical Review", "Clinical Decision", "Payment", "Pharmacy", "Shipping"];
const TL_LABELS = ["Order", "Paid", "Review", "Rx", "Pharm", "Ship"];

// Pipeline tabs (exact design labels) -> workflow status groups
const TABS: { key: string; label: string; statuses: WorkflowStatus[] | null }[] = [
  { key: "all", label: "All", statuses: null },
  { key: "new", label: "New", statuses: ["new_order", "intake_incomplete", "awaiting_questionnaire"] },
  { key: "review", label: "Provider Review", statuses: ["awaiting_provider_review", "provider_reviewing", "additional_info_requested", "labs_required", "approved", "modification_requested"] },
  { key: "payment", label: "Payment", statuses: ["awaiting_payment", "payment_failed", "paid"] },
  { key: "pharmacy", label: "At Pharmacy", statuses: ["ready_for_pharmacy", "sent_to_pharmacy", "pharmacy_processing"] },
  { key: "shipped", label: "Shipped", statuses: ["label_created", "shipped", "in_transit"] },
  { key: "delivered", label: "Delivered", statuses: ["delivered"] },
  { key: "issues", label: "Issues", statuses: ["hold", "refund_requested", "chargeback", "compliance_review", "payment_failed", "denied", "pharmacy_delayed"] },
];

interface Derived {
  isException: boolean; isDelivered: boolean; isShipping: boolean; atPharmacy: boolean; leftPharmacy: boolean;
  inReview: boolean; reviewed: boolean; isApproved: boolean; awaitingPay: boolean; payFailed: boolean;
  isPaid: boolean; rxSent: boolean; rxNeeded: boolean; preRx: boolean;
}
function derive(o: FulfillmentOrder): Derived {
  const stage = WORKFLOW_META[o.status].stage;
  const inP = (s: WorkflowStage[]) => s.includes(stage);
  const isException = stage === "Exceptions";
  const isDelivered = o.status === "delivered";
  const isShipping = ["label_created", "shipped", "in_transit"].includes(o.status);
  const atPharmacy = stage === "Pharmacy";
  const leftPharmacy = stage === "Shipping";
  const inReview = stage === "Medical Review";
  const reviewed = inP(["Clinical Decision", "Payment", "Pharmacy", "Shipping"]);
  const isApproved = o.status === "approved" || inP(["Payment", "Pharmacy", "Shipping"]);
  const awaitingPay = o.status === "awaiting_payment";
  const payFailed = o.status === "payment_failed";
  const isPaid = o.status === "paid" || inP(["Pharmacy", "Shipping"]);
  const rxSent = inP(["Pharmacy", "Shipping"]);
  const preRx = !rxSent && !isException && !isDelivered;
  const rxNeeded = preRx;
  return { isException, isDelivered, isShipping, atPharmacy, leftPharmacy, inReview, reviewed, isApproved, awaitingPay, payFailed, isPaid, rxSent, rxNeeded, preRx };
}
function timelineStates(d: Derived): ("done" | "current" | "need" | "")[] {
  return [
    "done",
    d.isPaid ? "done" : (d.awaitingPay || d.payFailed) ? "need" : "",
    d.reviewed ? "done" : d.inReview ? "current" : "",
    d.rxSent ? "done" : d.isApproved ? "need" : "",
    d.leftPharmacy ? "done" : d.atPharmacy ? "current" : "",
    d.isDelivered ? "done" : d.isShipping ? "current" : "",
  ];
}

const initials = (s: string) => s.split(/\s+/).filter(Boolean).map((w) => w[0]).slice(0, 2).join("").toUpperCase();
const medAbbr = (s: string) => s.split(/\s+/).filter(Boolean).map((w) => w[0]).slice(0, 2).join("").toUpperCase();
const typeIntent = (t: string): "blue" | "teal" | "purple" => (t === "New" ? "blue" : t === "Refill" ? "teal" : "purple");
const carrierFor = (o: FulfillmentOrder) => (o.tracking && o.tracking !== "—" ? "UPS" : "—");
const methodFor = (o: FulfillmentOrder) => (/semaglutide|tirzepatide|glp|nad|sermorelin|testosterone/i.test(o.medication) ? "Cold-chain" : "Standard");

type ViewMode = "cards" | "table";

export default function OrdersPage() {
  const patients = usePatients((s) => s.patients);
  const orders = useMemo(() => getFulfillmentOrders(patients), [patients]);
  const pMap = useMemo(() => new Map(patients.map((p) => [p.id, p])), [patients]);

  const [view, setView] = useState<ViewMode>("cards");
  const [search, setSearch] = useState("");
  const [activeTab, setActiveTab] = useState("all");
  const [programFilter, setProgramFilter] = useState("");
  const [dateFilter, setDateFilter] = useState("");
  const [selected, setSelected] = useState<FulfillmentOrder | null>(null);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const toggleExpand = (id: string) => setExpanded((p) => { const n = new Set(p); n.has(id) ? n.delete(id) : n.add(id); return n; });

  const tabStatuses = (key: string) => TABS.find((t) => t.key === key)?.statuses ?? null;
  const tabCount = (key: string) => { const s = tabStatuses(key); return s ? orders.filter((o) => s.includes(o.status)).length : orders.length; };

  const programs = useMemo(() => Array.from(new Set(orders.map((o) => o.program))), [orders]);

  const filtered = useMemo(() => orders.filter((o) => {
    const ts = tabStatuses(activeTab);
    if (ts && !ts.includes(o.status)) return false;
    if (programFilter && o.program !== programFilter) return false;
    if (dateFilter && !withinDays(o.created, dateFilter === "today" ? 0 : Number(dateFilter))) return false;
    if (search) {
      const q = search.toLowerCase();
      if (!(o.id.toLowerCase().includes(q) || o.patientName.toLowerCase().includes(q) || o.medication.toLowerCase().includes(q))) return false;
    }
    return true;
  }), [orders, activeTab, programFilter, dateFilter, search]);

  const KPIS = [
    { label: "New Today", sub: "Awaiting first review", value: tabCount("new"), color: "text-ink", tab: "new" },
    { label: "Needs Review", sub: "Provider action required", value: tabCount("review"), color: "text-amber", tab: "review" },
    { label: "At Pharmacy", sub: "Processing or queued", value: tabCount("pharmacy"), color: "text-ink", tab: "pharmacy" },
    { label: "Shipped", sub: "Tracking active", value: tabCount("shipped"), color: "text-brand", tab: "shipped" },
    { label: "Delivered", sub: "Recently completed", value: tabCount("delivered"), color: "text-green", tab: "delivered" },
    { label: "Issues", sub: "Needs attention", value: tabCount("issues"), color: "text-red", tab: "issues" },
  ];

  return (
    <div className="px-7 py-6 text-[14px]">
      {/* Page head */}
      <div className="flex items-start gap-3.5 mb-4 flex-wrap">
        <div>
          <h1 className="text-[23px] font-extrabold tracking-tight">All Orders</h1>
          <div className="text-[12.5px] text-ink-muted mt-1 max-w-[680px]">Incoming orders, prescription status, pharmacy progress, shipment tracking, payment, and delivery issues — across the full fulfillment workflow.</div>
        </div>
        <div className="flex-1" />
        <button className="btn btn-ghost btn-sm" onClick={() => toast("⬇ Exporting CSV…")}>Export CSV</button>
        <button className="btn btn-ghost btn-sm" onClick={() => toast("⚙ Bulk actions")}>Bulk actions</button>
        <button className="btn btn-primary btn-sm" onClick={() => toast("➕ Create manual order")}>+ Create manual order</button>
      </div>

      {/* KPI strip */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-2.5 mb-4">
        {KPIS.map((k) => (
          <button key={k.label} onClick={() => setActiveTab(k.tab)}
            className="bg-surface border border-border rounded-2xl px-4 py-3 text-left hover:shadow-md transition-shadow">
            <div className="text-[10px] font-bold uppercase tracking-wide text-ink-muted">{k.label}</div>
            <div className={`text-[26px] font-extrabold tracking-tight leading-none mt-1 ${k.color}`}>{k.value}</div>
            <div className="text-[11px] text-ink-muted mt-0.5">{k.sub}</div>
          </button>
        ))}
      </div>

      {/* Toolbar */}
      <div className="flex items-center gap-2 flex-wrap mb-3.5">
        <div className="flex-1 min-w-[240px] flex items-center gap-2 bg-surface border border-border rounded-[9px] px-3 py-2">
          <span className="text-ink-muted">🔍</span>
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search by order #, patient, medication, tracking…" className="bg-transparent outline-none text-[12.5px] w-full" />
        </div>
        <select value={activeTab} onChange={(e) => setActiveTab(e.target.value)}
          className="text-[12.5px] font-semibold text-ink-2 bg-surface border border-border rounded-[9px] px-3 py-2 cursor-pointer">
          {TABS.map((t) => <option key={t.key} value={t.key}>{t.key === "all" ? "All statuses" : t.label}</option>)}
        </select>
        <select value={programFilter} onChange={(e) => setProgramFilter(e.target.value)}
          className="text-[12.5px] font-semibold text-ink-2 bg-surface border border-border rounded-[9px] px-3 py-2 cursor-pointer">
          <option value="">All treatments</option>
          {programs.map((p) => <option key={p} value={p}>{p}</option>)}
        </select>
        <select value={dateFilter} onChange={(e) => setDateFilter(e.target.value)}
          className="text-[12.5px] font-semibold text-ink-2 bg-surface border border-border rounded-[9px] px-3 py-2 cursor-pointer">
          <option value="">All dates</option>
          <option value="today">Today</option>
          <option value="7">Last 7 days</option>
          <option value="30">Last 30 days</option>
        </select>
        <div className="ml-auto flex bg-surface border border-border rounded-[9px] p-0.5">
          {(["cards", "table"] as ViewMode[]).map((v) => (
            <button key={v} onClick={() => setView(v)}
              className={`text-[12.5px] font-semibold px-3.5 py-1.5 rounded-[7px] capitalize ${view === v ? "bg-brand-soft text-brand-dk" : "text-ink-muted hover:text-ink-2"}`}>{v}</button>
          ))}
        </div>
      </div>

      {/* Pipeline tabs */}
      <nav className="flex gap-0.5 border-b border-border mb-3.5 overflow-x-auto">
        {TABS.map((t) => {
          const active = activeTab === t.key;
          return (
            <button key={t.key} onClick={() => setActiveTab(t.key)}
              className={`text-[12.5px] font-semibold px-3 py-2.5 whitespace-nowrap border-b-2 -mb-px flex items-center gap-1.5 ${active ? "text-brand-dk border-brand" : "text-ink-muted border-transparent hover:text-ink-2"}`}>
              {t.label}
              <span className={`text-[10.5px] rounded-pill px-1.5 font-bold ${active ? "bg-brand-soft text-brand-dk" : "bg-surface-3 text-ink-2"}`}>{tabCount(t.key)}</span>
            </button>
          );
        })}
      </nav>

      {/* CARDS VIEW */}
      {view === "cards" && (
        <div className="flex flex-col gap-2.5">
          {filtered.map((o) => {
            const d = derive(o);
            const p = pMap.get(o.patientId);
            const tl = timelineStates(d);
            const open = expanded.has(o.id);
            const demo = `${p ? `${p.age}${p.gender === "Other" ? "" : p.gender} · ` : ""}${o.state} · ${o.id}`;
            const invoice = `INV-${o.id.replace(/[^0-9]/g, "")} · ${d.isPaid ? "Paid" : "Unpaid"}`;
            const eta = d.isDelivered ? "Delivered" : d.isShipping ? "In transit" : d.atPharmacy ? "After pharmacy" : "Pending";
            return (
              <article key={o.id} className="bg-surface border border-border rounded-2xl overflow-hidden hover:border-border-2 transition-colors">
                <div className="grid items-center gap-4 px-4 py-3.5 cursor-pointer" style={{ gridTemplateColumns: "minmax(140px,152px) 1.25fr 1.45fr 1.2fr 1.05fr auto" }} onClick={() => toggleExpand(o.id)}>
                  {/* col1 */}
                  <div>
                    <div className="font-mono text-[12.5px] font-bold text-ink-2">{o.id}</div>
                    <div className="text-[11px] text-ink-muted my-1">{o.created} · {o.updated}</div>
                    <StatusBadge status={o.status} />
                  </div>
                  {/* col2 patient */}
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="w-[38px] h-[38px] rounded-[11px] flex items-center justify-center text-white font-extrabold text-[13px] shrink-0" style={{ background: "linear-gradient(135deg,var(--color-brand),var(--color-brand-dk))" }}>{initials(o.patientName)}</div>
                    <div className="min-w-0" onClick={(e) => e.stopPropagation()}>
                      <Link href={`/patients/${o.patientId}`} className="text-[13px] font-bold text-ink hover:text-brand-dk hover:underline block truncate">{o.patientName}</Link>
                      <div className="text-[11px] text-ink-muted truncate">{demo}</div>
                    </div>
                  </div>
                  {/* col3 product */}
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="w-[38px] h-[38px] rounded-[11px] bg-brand-soft text-brand-dk flex items-center justify-center font-extrabold text-[12px] shrink-0">{medAbbr(o.medication)}</div>
                    <div className="min-w-0">
                      <div className="text-[13px] font-semibold truncate">{o.medication}</div>
                      <div className="text-[11px] text-ink-muted truncate">{o.dose} · {o.qty}</div>
                    </div>
                  </div>
                  {/* col4 status stack */}
                  <div className="flex flex-col gap-1 items-start">
                    <Pill intent={o.programIntent}>{o.program}</Pill>
                    {d.rxSent ? <Pill intent="green">Rx signed</Pill> : d.rxNeeded ? <Pill intent="amber">Rx needed</Pill> : null}
                    {d.isPaid ? <Pill intent="green">Paid {o.total}</Pill> : (d.awaitingPay || d.payFailed) ? <Pill intent="amber">Unpaid {o.total}</Pill> : <span className="text-[12px] font-bold">{o.total}</span>}
                  </div>
                  {/* col5 ship-mini */}
                  <div className="min-w-0">
                    <div className="text-[12px] font-semibold truncate">{o.tracking && o.tracking !== "—" ? o.tracking : "Tracking pending"}</div>
                    <div className="text-[11px] text-ink-muted truncate">{o.pharmacy}</div>
                  </div>
                  {/* col6 actions */}
                  <div className="flex gap-1.5 items-center" onClick={(e) => e.stopPropagation()}>
                    <button className="btn btn-ghost btn-xs" onClick={() => setSelected(o)}>Open</button>
                    {d.preRx
                      ? <Link href={`/patients/${o.patientId}/prescribe?tx=${encodeURIComponent(o.medication)}`} className="btn btn-primary btn-xs">⚡ Create Rx</Link>
                      : <Link href={`/patients/${o.patientId}`} className="btn btn-ghost btn-xs">Chart →</Link>}
                    <button className="btn btn-ghost btn-xs" onClick={() => toast("⋯ Order actions")}>•••</button>
                  </div>
                </div>

                {open && (
                  <div className="border-t border-border px-4 py-4 grid gap-4" style={{ gridTemplateColumns: "1fr 1.3fr 1fr" }}>
                    <DetailBox title="Patient / order">
                      <DRow k="Email" v={p?.email || "—"} />
                      <DRow k="Phone" v={p?.phone || "—"} />
                      <DRow k="Provider" v={o.provider} />
                      <DRow k="Invoice" v={invoice} />
                    </DetailBox>
                    <DetailBox title="Fulfillment timeline">
                      <div className="flex items-start justify-between gap-1 mt-1">
                        {TL_LABELS.map((lbl, i) => {
                          const st = d.isException ? "" : tl[i];
                          const dotCls = st === "done" ? "bg-green text-white border-green" : st === "current" ? "bg-brand text-white border-brand" : st === "need" ? "bg-amber text-white border-amber" : "bg-surface-3 text-ink-muted border-border";
                          const content = st === "done" ? "✓" : st === "need" ? "!" : i + 1;
                          return (
                            <div key={lbl} className="flex-1 text-center relative">
                              {i < TL_LABELS.length - 1 && <div className={`absolute top-[11px] left-1/2 w-full h-0.5 ${!d.isException && tl[i] === "done" ? "bg-green" : "bg-border"}`} />}
                              <div className={`w-[22px] h-[22px] rounded-full mx-auto mb-1.5 flex items-center justify-center text-[10px] font-bold border-2 relative z-[1] ${dotCls}`}>{content}</div>
                              <div className="text-[9.5px] text-ink-muted font-semibold">{lbl}</div>
                            </div>
                          );
                        })}
                      </div>
                      {d.isException && <div className="text-[11.5px] text-red font-semibold mt-3">⚠ Exception · {WORKFLOW_META[o.status].label} — needs attention</div>}
                    </DetailBox>
                    <DetailBox title="Shipping">
                      <DRow k="Ship to" v={`${o.state}`} />
                      <DRow k="Carrier" v={carrierFor(o)} />
                      <DRow k="Method" v={methodFor(o)} />
                      <DRow k="ETA" v={eta} />
                    </DetailBox>
                  </div>
                )}
              </article>
            );
          })}
          {filtered.length === 0 && <div className="bg-surface border border-border rounded-2xl px-4 py-12 text-center text-ink-muted text-[12.5px]">No orders match these filters.</div>}
        </div>
      )}

      {/* TABLE VIEW */}
      {view === "table" && (
        <div className="bg-surface border border-border rounded-2xl overflow-hidden">
          <div className="flex items-center justify-between gap-3 px-4 py-3.5 border-b border-border">
            <div>
              <h3 className="text-[14px] font-extrabold">Compact table view</h3>
              <div className="text-[12px] text-ink-muted mt-0.5">Spreadsheet-style order management for high-volume triage.</div>
            </div>
            <button className="btn btn-ghost btn-sm" onClick={() => toast("⚙ Customize columns")}>⚙ Customize columns</button>
          </div>
          <div className="overflow-x-auto">
            <table className="border-collapse w-full min-w-[1100px]">
              <thead>
                <tr className="bg-surface-2">
                  {["Order #", "Date", "Patient", "State", "Treatment", "Rx", "Order Status", "Pharmacy", "Shipment", "Tracking", "Payment", "Total", "Action"].map((h) => (
                    <th key={h} className={`text-[10px] uppercase tracking-wide text-ink-muted font-bold text-left px-3 py-2.5 border-b border-border whitespace-nowrap ${h === "Total" ? "text-right" : ""}`}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map((o) => {
                  const d = derive(o);
                  const rx = d.rxSent ? ["green", "Signed"] : d.rxNeeded ? ["amber", "Needs Rx"] : ["muted", "Pending"];
                  const pay = d.isPaid ? ["green", "Paid"] : d.awaitingPay || d.payFailed ? ["amber", "Unpaid"] : null;
                  const ship = d.isDelivered ? "Complete" : d.isShipping ? "Shipped" : d.atPharmacy ? "Processing" : d.isException ? "Held" : "Pending";
                  return (
                    <tr key={o.id} onClick={() => setSelected(o)} className="border-b border-border last:border-none hover:bg-surface-2 cursor-pointer">
                      <td className="px-3 py-2.5 font-mono text-[11.5px] font-bold text-ink-2 whitespace-nowrap">{o.id}</td>
                      <td className="px-3 py-2.5 whitespace-nowrap text-ink-2">{o.created}</td>
                      <td className="px-3 py-2.5 whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                        <Link href={`/patients/${o.patientId}`} className="text-brand-dk font-semibold hover:underline">{o.patientName}</Link>
                      </td>
                      <td className="px-3 py-2.5">{o.state}</td>
                      <td className="px-3 py-2.5 font-semibold whitespace-nowrap">{o.medication}</td>
                      <td className="px-3 py-2.5"><Pill intent={rx[0] as "green" | "amber" | "muted"}>{rx[1]}</Pill></td>
                      <td className="px-3 py-2.5"><StatusBadge status={o.status} /></td>
                      <td className="px-3 py-2.5 whitespace-nowrap">{o.pharmacy}</td>
                      <td className="px-3 py-2.5 whitespace-nowrap text-ink-2">{ship}</td>
                      <td className="px-3 py-2.5 whitespace-nowrap text-ink-muted text-[11px]">{o.tracking || "—"}</td>
                      <td className="px-3 py-2.5">{pay ? <Pill intent={pay[0] as "green" | "amber"}>{pay[1]}</Pill> : <span className="text-ink-muted">—</span>}</td>
                      <td className="px-3 py-2.5 font-bold whitespace-nowrap text-right">{o.total}</td>
                      <td className="px-3 py-2.5" onClick={(e) => e.stopPropagation()}><button className="btn btn-ghost btn-xs" onClick={() => setSelected(o)}>Open</button></td>
                    </tr>
                  );
                })}
                {filtered.length === 0 && <tr><td colSpan={13} className="px-3 py-10 text-center text-ink-muted text-[12px]">No orders match these filters.</td></tr>}
              </tbody>
            </table>
          </div>
          <div className="flex items-center gap-2 px-4 py-2.5 border-t border-border text-[12px] text-ink-muted">
            Showing <b className="text-ink-2">{filtered.length}</b> of <b className="text-ink-2">{orders.length}</b> orders
          </div>
        </div>
      )}

      {selected && <OrderPreviewDrawer order={selected} onClose={() => setSelected(null)} />}
      <Toast />
    </div>
  );
}

function DetailBox({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h4 className="text-[10px] uppercase tracking-wider text-ink-muted-2 font-bold mb-2.5">{title}</h4>
      {children}
    </div>
  );
}
function DRow({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex justify-between gap-3 py-[5px] text-[12px] border-b border-surface-3 last:border-none">
      <span className="text-ink-muted">{k}</span>
      <span className="font-semibold text-ink text-right truncate">{v}</span>
    </div>
  );
}
