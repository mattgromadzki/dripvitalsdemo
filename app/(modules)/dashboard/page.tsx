"use client";

import { useMemo, useEffect, useState } from "react";
import Link from "next/link";
import { Pill } from "@/components/ui/Pill";
import { Toast } from "@/components/ui/Toast";
import { toast } from "@/lib/hooks/useToast";
import { usePatients } from "@/lib/hooks/usePatients";
import { useTreatmentRequests } from "@/lib/hooks/useTreatmentRequests";
import { usePrescriptions } from "@/lib/hooks/usePrescriptions";
import { useSubscriptions } from "@/lib/hooks/useSubscriptions";
import { useEmails } from "@/lib/hooks/useEmails";
import { useDoctors } from "@/lib/hooks/useDoctors";
import { useAuth } from "@/lib/hooks/useAuth";

interface PharmEvt {
  id?: string; orderId?: string | number; internalOrderId?: string;
  patientName?: string; medication?: string; stage?: string; status?: string;
  trackingNumber?: string; trackingUrl?: string; event?: string; at: string;
}

const money = (cents: number) =>
  (cents / 100).toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });

function patientNum(id: string): number {
  const m = id.match(/PT-(\d+)/);
  return m ? parseInt(m[1], 10) : 0;
}
function shortDate(iso?: string): string {
  if (!iso) return "";
  const d = new Date(iso);
  return isNaN(d.getTime()) ? "" : d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}
function daysUntil(iso?: string): number {
  if (!iso) return Infinity;
  const d = new Date(iso).getTime();
  return isNaN(d) ? Infinity : Math.round((d - Date.now()) / 86_400_000);
}

export default function DashboardPage() {
  const patients = usePatients((s) => s.patients);
  const requests = useTreatmentRequests((s) => s.requests);
  const prescriptions = usePrescriptions((s) => s.prescriptions);
  const subscriptions = useSubscriptions((s) => s.subscriptions);
  const emails = useEmails((s) => s.emails);
  const doctors = useDoctors((s) => s.doctors);
  const user = useAuth((s) => s.user);

  // Pharmacy fulfillment + shipping come from the shared pharmacy-events log.
  const [pharmEvents, setPharmEvents] = useState<PharmEvt[]>([]);
  useEffect(() => {
    let alive = true;
    const load = () => fetch("/api/store/pharmacy-events", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => { if (alive && Array.isArray(j?.data)) setPharmEvents(j.data as PharmEvt[]); })
      .catch(() => {});
    load();
    const t = setInterval(load, 30000);
    return () => { alive = false; clearInterval(t); };
  }, []);

  // 1 — New patient activity (newest patient records first).
  const newPatients = useMemo(
    () => [...patients].sort((a, b) => patientNum(b.id) - patientNum(a.id)).slice(0, 5),
    [patients],
  );

  // 2 — Paid visits awaiting provider review.
  const awaitingReview = useMemo(() => requests.filter((r) => r.status === "pending"), [requests]);

  // 3 — Abandoned intake recovery (intake started but not completed).
  const abandoned = useMemo(
    () => patients.filter((p) => p.intakeProgress && p.intakeProgress !== "Completed"),
    [patients],
  );

  // 4 — Rx signatures (prescriptions awaiting a provider signature).
  const rxToSign = useMemo(() => prescriptions.filter((r) => r.status === "pending"), [prescriptions]);

  // 5 & 6 — Pharmacy fulfillment + shipping, from the latest event per order.
  const { fulfillment, shipping, delivered } = useMemo(() => {
    const byOrder = new Map<string, PharmEvt[]>();
    for (const e of pharmEvents) {
      const key = e.orderId != null && String(e.orderId) ? String(e.orderId) : (e.internalOrderId || "");
      if (!key) continue;
      const arr = byOrder.get(key) || []; arr.push(e); byOrder.set(key, arr);
    }
    const latest: PharmEvt[] = [];
    byOrder.forEach((evs) => {
      latest.push(evs.slice().sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime())[0]);
    });
    const stageOf = (e: PharmEvt) => (e.stage || e.status || "").toLowerCase();
    const isDelivered = (s: string) => s.includes("deliver");
    const isShipping = (s: string) => s.includes("ship") || s.includes("transit") || s.includes("label");
    return {
      fulfillment: latest.filter((e) => { const s = stageOf(e); return !isDelivered(s) && !isShipping(s) && !s.includes("cancel") && !s.includes("void"); }),
      shipping: latest.filter((e) => { const s = stageOf(e); return isShipping(s) && !isDelivered(s); }),
      delivered: latest.filter((e) => isDelivered(stageOf(e))),
    };
  }, [pharmEvents]);

  // 7 — Refill reminders (active subscriptions billing/refilling within 10 days).
  const refills = useMemo(
    () => subscriptions
      .filter((s) => (s.status === "active" || s.status === "trialing") && daysUntil(s.nextBillingDate) <= 10 && daysUntil(s.nextBillingDate) >= 0)
      .sort((a, b) => daysUntil(a.nextBillingDate) - daysUntil(b.nextBillingDate)),
    [subscriptions],
  );

  // 8 — Patient messages (unread inbound).
  const unreadMsgs = useMemo(
    () => emails.filter((e) => e.folder === "inbox" && e.direction === "in" && !e.read),
    [emails],
  );

  // 9 — Compliance warnings.
  const compliance = useMemo(() => {
    const now = Date.now();
    const coveredStates = new Set<string>();
    for (const d of doctors) {
      if (!d.active) continue;
      for (const l of d.licenses || []) {
        if (l.state && new Date(l.expDate).getTime() >= now) coveredStates.add(l.state.toUpperCase());
      }
    }
    const activeish = patients.filter((p) => p.status !== "churned" && p.status !== "disqualified");
    const uncovered = activeish.filter((p) => p.state && !coveredStates.has(p.state.toUpperCase()));
    const pastDue = subscriptions.filter((s) => s.status === "past_due");
    const expiringLicenses = doctors.flatMap((d) => (d.licenses || []).filter((l) => {
      const days = (new Date(l.expDate).getTime() - now) / 86_400_000;
      return days >= 0 && days <= 60;
    }));

    const warnings: { icon: string; text: string; href: string; tone: "red" | "amber" }[] = [];
    if (uncovered.length) warnings.push({ icon: "🗺", text: `${uncovered.length} patient${uncovered.length === 1 ? "" : "s"} in state${uncovered.length === 1 ? "" : "s"} with no licensed provider`, href: "/patients", tone: "red" });
    if (pastDue.length) warnings.push({ icon: "💳", text: `${pastDue.length} subscription${pastDue.length === 1 ? "" : "s"} past due (failed payment)`, href: "/subscriptions", tone: "red" });
    if (expiringLicenses.length) warnings.push({ icon: "📋", text: `${expiringLicenses.length} provider license${expiringLicenses.length === 1 ? "" : "s"} expiring within 60 days`, href: "/staff", tone: "amber" });
    return warnings;
  }, [patients, subscriptions, doctors]);

  // 10 — Revenue (from paid subscription billing cycles).
  const revenue = useMemo(() => {
    const startToday = new Date(); startToday.setHours(0, 0, 0, 0);
    const startMonth = new Date(); startMonth.setDate(1); startMonth.setHours(0, 0, 0, 0);
    let today = 0, month = 0, monthCount = 0;
    for (const s of subscriptions) {
      for (const c of s.cycles || []) {
        if (c.status !== "paid") continue;
        const t = new Date(c.date).getTime();
        if (isNaN(t)) continue;
        if (t >= startMonth.getTime()) { month += c.amountCents; monthCount++; }
        if (t >= startToday.getTime()) today += c.amountCents;
      }
    }
    return { today, month, monthCount };
  }, [subscriptions]);

  // Headline stat strip (mirrors an at-a-glance analytics header).
  const strip = useMemo(() => {
    const active = patients.filter((p) => p.status === "active").length;
    const inactive = Math.max(0, patients.length - active);
    const processing = requests.filter((r) => r.status === "approved").length;
    const rxSent = prescriptions.filter((r) => r.status !== "pending" && r.status !== "denied").length;
    const failed = subscriptions.filter((s) => s.status === "past_due").length;
    return { active, inactive, processing, rxSent, shipped: shipping.length + delivered.length, failed };
  }, [patients, requests, prescriptions, subscriptions, shipping, delivered]);

  // Monthly revenue for the current year (paid subscription cycles).
  const yearRevenue = useMemo(() => {
    const year = new Date().getFullYear();
    const months = new Array(12).fill(0) as number[];
    for (const s of subscriptions) for (const c of s.cycles || []) {
      if (c.status !== "paid") continue;
      const d = new Date(c.date);
      if (isNaN(d.getTime()) || d.getFullYear() !== year) continue;
      months[d.getMonth()] += c.amountCents;
    }
    return { months, ytd: months.reduce((a, b) => a + b, 0), year };
  }, [subscriptions]);

  const hr = new Date().getHours();
  const greeting = hr < 12 ? "Good morning" : hr < 18 ? "Good afternoon" : "Good evening";
  const dateStr = new Date().toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" });

  return (
    <div className="px-7 py-6">
      <div className="flex items-start justify-between gap-4 mb-5 flex-wrap">
        <div>
          <div className="text-[22px] font-bold tracking-tight text-ink mb-1">{greeting}{user?.name ? `, ${user.name}` : ""}</div>
          <div className="text-[13px] text-ink-muted">{dateStr} · {awaitingReview.length} paid visit{awaitingReview.length === 1 ? "" : "s"} awaiting review</div>
        </div>
        <div className="flex gap-2">
          <button className="btn btn-ghost btn-sm" onClick={() => toast("📊 Generating daily report…")}>📊 Daily Report</button>
          <Link href="/intake-review" className="btn btn-primary btn-sm">📋 Review Visits</Link>
        </div>
      </div>

      {/* Headline stats */}
      <div className="grid grid-cols-6 gap-3 mb-4 max-[1100px]:grid-cols-3 max-[560px]:grid-cols-2">
        <Stat label="Rx patients" value={strip.active} sub={`${strip.inactive} inactive`} icon="🧑‍⚕️" href="/patients" />
        <Stat label="Visits pending" value={awaitingReview.length} icon="🕓" tone={awaitingReview.length ? "amber" : undefined} href="/intake-review" />
        <Stat label="Visits processing" value={strip.processing} icon="⚙️" href="/intake-review" />
        <Stat label="Rx sent" value={strip.rxSent} icon="✅" href="/e-prescribe" />
        <Stat label="Shipped" value={strip.shipped} icon="📦" href="/shipments" />
        <Stat label="Failed payments" value={strip.failed} icon="⚠️" tone={strip.failed ? "red" : undefined} href="/subscriptions" />
      </div>

      {/* Revenue overview */}
      <div className="card p-4 mb-4">
        <div className="flex items-start justify-between flex-wrap gap-3 mb-3">
          <div className="text-[13px] font-bold text-ink">Revenue overview <span className="text-ink-muted font-medium">· {yearRevenue.year}</span></div>
          <div className="flex gap-6">
            <Figure label="This year" value={money(yearRevenue.ytd)} />
            <Figure label="This month" value={money(revenue.month)} />
            <Figure label="Today" value={money(revenue.today)} />
          </div>
        </div>
        <RevenueChart months={yearRevenue.months} />
      </div>

      {/* Sections */}
      <div className="grid grid-cols-2 gap-4 max-[1000px]:grid-cols-1">
        <Panel title="New patient activity" icon="🌱" count={newPatients.length} href="/patients">
          {newPatients.length === 0 ? <Empty>No patients yet</Empty> : newPatients.map((p) => (
            <Row key={p.id} href={`/patients/${p.id}`} left={p.name} sub={`${p.id} · ${p.state || "—"}`} right={p.plan} rightSub={p.since} />
          ))}
        </Panel>

        <Panel title="Paid visits awaiting provider review" icon="🩺" count={awaitingReview.length} tone={awaitingReview.length ? "amber" : "muted"} href="/intake-review">
          {awaitingReview.length === 0 ? <Empty>Nothing awaiting review</Empty> : awaitingReview.slice(0, 5).map((r) => (
            <Row key={r.id} href="/intake-review" left={r.patientName} sub={r.treatmentName || r.medication} right={r.submittedDate?.split(" · ")[0]} />
          ))}
        </Panel>

        <Panel title="Abandoned intake recovery" icon="🔄" count={abandoned.length} tone={abandoned.length ? "amber" : "muted"} href="/patients">
          {abandoned.length === 0 ? <Empty>No abandoned intakes</Empty> : abandoned.slice(0, 5).map((p) => (
            <Row key={p.id} href={`/patients/${p.id}`} left={p.name} sub={`${p.id} · ${p.state || "—"}`} right={`⏳ ${p.intakeProgress}`} />
          ))}
        </Panel>

        <Panel title="Rx signatures" icon="✍️" count={rxToSign.length} tone={rxToSign.length ? "amber" : "muted"} href="/e-prescribe">
          {rxToSign.length === 0 ? <Empty>No prescriptions to sign</Empty> : rxToSign.slice(0, 5).map((r) => (
            <Row key={r.id} href="/e-prescribe" left={r.patientName} sub={`${r.medication} · ${r.dose}`} right={r.prescriber} />
          ))}
        </Panel>

        <Panel title="Pharmacy fulfillment" icon="🏭" count={fulfillment.length} href="/orders">
          {fulfillment.length === 0 ? <Empty>Nothing in fulfillment</Empty> : fulfillment.slice(0, 5).map((e, i) => (
            <Row key={e.id || i} href="/orders" left={e.patientName || "—"} sub={e.medication} right={e.stage || e.status} />
          ))}
        </Panel>

        <Panel title="Shipping status" icon="🚚" count={shipping.length} href="/shipments">
          {shipping.length === 0 ? <Empty>{delivered.length ? `${delivered.length} delivered · none in transit` : "No shipments in transit"}</Empty> : shipping.slice(0, 5).map((e, i) => (
            <Row key={e.id || i} href="/shipments" left={e.patientName || "—"} sub={e.medication} right={e.stage || "In transit"} rightSub={e.trackingNumber} />
          ))}
        </Panel>

        <Panel title="Refill reminders" icon="🔔" count={refills.length} href="/subscriptions">
          {refills.length === 0 ? <Empty>No refills due in the next 10 days</Empty> : refills.slice(0, 5).map((s) => (
            <Row key={s.id} href="/subscriptions" left={s.patientName} sub={s.med || s.planName} right={shortDate(s.nextBillingDate)} rightSub={`${daysUntil(s.nextBillingDate)}d`} />
          ))}
        </Panel>

        <Panel title="Patient messages" icon="💬" count={unreadMsgs.length} tone={unreadMsgs.length ? "brand" : "muted"} href="/emails">
          {unreadMsgs.length === 0 ? <Empty>Inbox is clear</Empty> : unreadMsgs.slice(0, 5).map((e) => (
            <Row key={e.id} href="/emails" left={e.fromName || "Patient"} sub={e.subject} right={shortDate(e.createdAt)} />
          ))}
        </Panel>

        <Panel title="Compliance warnings" icon="🛡" count={compliance.length} tone={compliance.length ? "red" : "green"} href="/readiness">
          {compliance.length === 0 ? <Empty>No compliance issues 🎉</Empty> : compliance.map((w, i) => (
            <Link key={i} href={w.href} className="flex items-center gap-2.5 px-2.5 py-2 rounded-lg hover:bg-surface-2">
              <span className="text-[15px]">{w.icon}</span>
              <span className={`text-[12.5px] font-medium ${w.tone === "red" ? "text-red" : "text-amber"}`}>{w.text}</span>
            </Link>
          ))}
        </Panel>
      </div>

      <Toast />
    </div>
  );
}

function Panel({ title, icon, count, href, tone = "brand", children }: {
  title: string; icon: string; count?: number; href?: string;
  tone?: "brand" | "amber" | "red" | "green" | "muted"; children: React.ReactNode;
}) {
  return (
    <div className="card p-0 overflow-hidden flex flex-col">
      <div className="flex items-center justify-between px-4 py-3 border-b border-border">
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-[15px]">{icon}</span>
          <span className="text-[13px] font-bold text-ink truncate">{title}</span>
          {count != null && <Pill intent={tone}>{count}</Pill>}
        </div>
        {href && <Link href={href} className="text-[11.5px] text-brand font-semibold hover:underline whitespace-nowrap">View all →</Link>}
      </div>
      <div className="p-2 flex-1">{children}</div>
    </div>
  );
}

function Row({ left, sub, right, rightSub, href }: {
  left: React.ReactNode; sub?: React.ReactNode; right?: React.ReactNode; rightSub?: React.ReactNode; href?: string;
}) {
  const inner = (
    <div className="flex items-center justify-between gap-3 px-2.5 py-2 rounded-lg hover:bg-surface-2">
      <div className="min-w-0">
        <div className="text-[12.5px] font-semibold text-ink truncate">{left}</div>
        {sub && <div className="text-[11px] text-ink-muted truncate">{sub}</div>}
      </div>
      {(right || rightSub) && (
        <div className="text-right shrink-0">
          {right && <div className="text-[11.5px] text-ink-2">{right}</div>}
          {rightSub && <div className="text-[10.5px] text-ink-muted">{rightSub}</div>}
        </div>
      )}
    </div>
  );
  return href ? <Link href={href} className="block">{inner}</Link> : inner;
}

function Empty({ children }: { children: React.ReactNode }) {
  return <div className="px-2.5 py-6 text-center text-[12px] text-ink-muted">{children}</div>;
}

function Stat({ label, value, sub, icon, tone, href }: {
  label: string; value: number | string; sub?: string; icon: string; tone?: "red" | "amber"; href?: string;
}) {
  const body = (
    <div className="card px-4 py-3.5 h-full hover:shadow-sm hover:border-border-2 transition-all">
      <div className="flex items-center gap-1.5 mb-1.5">
        <span className="text-[13px]">{icon}</span>
        <span className="text-[10px] uppercase tracking-wide text-ink-muted font-semibold truncate">{label}</span>
      </div>
      <div className={`text-[24px] font-extrabold tracking-tight leading-none ${tone === "red" ? "text-red" : tone === "amber" ? "text-amber" : "text-ink"}`}>{value}</div>
      {sub && <div className="text-[11px] text-ink-muted mt-1">{sub}</div>}
    </div>
  );
  return href ? <Link href={href} className="block">{body}</Link> : body;
}

function Figure({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-[9.5px] uppercase tracking-wide text-ink-muted font-semibold">{label}</div>
      <div className="text-[17px] font-extrabold text-ink tracking-tight leading-tight">{value}</div>
    </div>
  );
}

// Dependency-free area chart of monthly revenue (dollars). Uniform scaling keeps
// the line, dots, and labels crisp at any width.
function RevenueChart({ months }: { months: number[] }) {
  const W = 1000, H = 220, pad = { l: 48, r: 14, t: 14, b: 26 };
  const labels = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const max = Math.max(1, ...months);
  const innerW = W - pad.l - pad.r, innerH = H - pad.t - pad.b;
  const xOf = (i: number) => pad.l + (i / (months.length - 1)) * innerW;
  const yOf = (v: number) => pad.t + innerH - (v / max) * innerH;
  const pts = months.map((v, i) => [xOf(i), yOf(v)] as const);
  const line = pts.map((p, i) => `${i ? "L" : "M"}${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(" ");
  const area = `${line} L${xOf(months.length - 1).toFixed(1)},${(pad.t + innerH).toFixed(1)} L${xOf(0).toFixed(1)},${(pad.t + innerH).toFixed(1)} Z`;
  const grid = [0, 0.25, 0.5, 0.75, 1];
  return (
    <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="xMidYMid meet" width="100%" style={{ display: "block", height: "auto" }}>
      <defs>
        <linearGradient id="rev-grad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="var(--color-brand)" stopOpacity="0.26" />
          <stop offset="100%" stopColor="var(--color-brand)" stopOpacity="0.02" />
        </linearGradient>
      </defs>
      {grid.map((g, i) => {
        const y = pad.t + innerH - g * innerH;
        return (
          <g key={i}>
            <line x1={pad.l} y1={y} x2={W - pad.r} y2={y} stroke="var(--color-border)" strokeWidth="1" />
            <text x={pad.l - 7} y={y + 3.5} fontSize="10.5" fill="var(--color-ink-muted)" textAnchor="end">${Math.round((max * g) / 100).toLocaleString()}</text>
          </g>
        );
      })}
      <path d={area} fill="url(#rev-grad)" />
      <path d={line} fill="none" stroke="var(--color-brand)" strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" />
      {pts.map((p, i) => <circle key={i} cx={p[0]} cy={p[1]} r="2.6" fill="var(--color-brand)" />)}
      {labels.map((l, i) => <text key={i} x={xOf(i)} y={H - 8} fontSize="10.5" fill="var(--color-ink-muted)" textAnchor="middle">{l}</text>)}
    </svg>
  );
}
