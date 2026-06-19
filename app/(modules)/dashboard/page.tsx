"use client";

import { useMemo } from "react";
import Link from "next/link";
import { KpiCard, KpiGrid } from "@/components/ui/Kpi";
import { Pill } from "@/components/ui/Pill";
import { Toast } from "@/components/ui/Toast";
import { toast } from "@/lib/hooks/useToast";
import { usePatients } from "@/lib/hooks/usePatients";
import { useIntake } from "@/lib/hooks/useIntake";

export default function DashboardPage() {
  const patients = usePatients((s) => s.patients);
  const submissions = useIntake((s) => s.submissions);

  const stats = useMemo(() => {
    const active = patients.filter((p) => p.status === "active").length;
    const pending = patients.filter((p) => p.status === "pending").length;
    const urgent = patients.filter((p) => p.tags.some((t) => t.toLowerCase().startsWith("urgent"))).length;
    const totalLost = patients.reduce((sum, p) => sum + Math.max(0, (p.wtStart || p.wt) - p.wt), 0);
    return { active, pending, urgent, totalLost: totalLost.toFixed(1) };
  }, [patients]);

  const recentIntakes = useMemo(() => [...submissions].sort((a, b) => (a.submittedAt < b.submittedAt ? 1 : -1)).slice(0, 5), [submissions]);

  const queues = [
    { href: "/intake-review", icon: "📋", label: "Provider review", sub: "New intakes waiting", value: stats.pending, intent: "amber" as const },
    { href: "/orders", icon: "💊", label: "Needs Rx", sub: "Paid orders needing signature", value: 12, intent: "amber" as const },
    { href: "/orders", icon: "📦", label: "At pharmacy", sub: "Processing or queued", value: 34, intent: "blue" as const },
    { href: "/shipments", icon: "🚚", label: "Shipping issues", sub: "Address, tracking, delivery", value: 4, intent: "red" as const },
    { href: "/titration", icon: "↻", label: "Refills due", sub: "Next 7 days", value: 41, intent: "green" as const },
    { href: "/patient-chat", icon: "✉️", label: "Needs reply", sub: "Patient messages", value: 6, intent: "purple" as const },
  ];

  return (
    <div className="px-7 py-6 text-[14px]">
      <div className="flex items-start justify-between gap-4 mb-5 flex-wrap">
        <div>
          <h1 className="text-[26px] font-extrabold tracking-tight text-ink leading-tight">Operations command center</h1>
          <div className="text-[13px] text-ink-muted mt-1">Today’s clinical, pharmacy, shipping, refill, and patient communication workload.</div>
        </div>
        <div className="flex gap-2 flex-wrap">
          <button className="btn btn-ghost btn-sm" onClick={() => toast("📊 Generating daily report…")}>Daily report</button>
          <Link href="/orders" className="btn btn-primary btn-sm">Open orders</Link>
        </div>
      </div>

      <KpiGrid cols={6}>
        <KpiCard label="Active Patients" value={stats.active} icon="👥" trend="Currently enrolled" />
        <KpiCard label="New Intakes" value={stats.pending} icon="📋" iconBg="var(--color-amber-soft)" iconColor="var(--color-amber)" trend="Need review" trendColor="var(--color-amber)" />
        <KpiCard label="Needs Rx" value="12" icon="💊" iconBg="var(--color-amber-soft)" iconColor="var(--color-amber)" trend="Provider action" trendColor="var(--color-amber)" />
        <KpiCard label="Shipping Issues" value="4" icon="🚚" iconBg="var(--color-red-soft)" iconColor="var(--color-red)" trend="Needs support" trendColor="var(--color-red)" />
        <KpiCard label="Refills Due" value="41" icon="↻" iconBg="var(--color-green-soft)" iconColor="var(--color-green)" trend="Next 7 days" trendColor="var(--color-green)" />
        <KpiCard label="Total Weight Lost" value={`${stats.totalLost} lb`} icon="📉" iconBg="var(--color-teal-soft)" iconColor="var(--color-teal)" trend="Active patients" trendColor="var(--color-teal)" />
      </KpiGrid>

      <div className="grid grid-cols-[2fr_1fr] gap-4 max-[1100px]:grid-cols-1">
        <div className="card">
          <div className="card-head">
            <div className="ch-icon">⚙️</div>
            <div>
              <div className="ct">Daily action queues</div>
              <div className="text-[12px] text-ink-muted">This is the main staff workflow: what is stuck, what needs review, and what needs follow-up.</div>
            </div>
            <div className="flex-1" />
            <Link href="/tasks" className="btn btn-ghost btn-xs">View tasks</Link>
          </div>
          <div className="p-4 grid gap-3" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))" }}>
            {queues.map((q) => (
              <Link key={q.label} href={q.href} className="bg-surface border border-border rounded-2xl p-4 hover:shadow-sm hover:border-border-2 transition-all block">
                <div className="flex items-start justify-between gap-3">
                  <div className={`w-10 h-10 rounded-[14px] flex items-center justify-center text-[17px] bg-${q.intent}-soft text-${q.intent}`}>{q.icon}</div>
                  <div className="text-[26px] font-extrabold tracking-tight leading-none text-ink">{q.value}</div>
                </div>
                <div className="mt-3 font-bold text-[13.5px] text-ink">{q.label}</div>
                <div className="text-[12px] text-ink-muted mt-0.5">{q.sub}</div>
              </Link>
            ))}
          </div>
        </div>

        <div className="card">
          <div className="card-head">
            <div className="ch-icon" style={{ background: "var(--color-amber-soft)", color: "var(--color-amber)" }}>!</div>
            <div>
              <div className="ct">Needs attention</div>
              <div className="text-[12px] text-ink-muted">Quiet alerts, not loud alerts.</div>
            </div>
          </div>
          <div className="p-4 flex flex-col gap-3">
            {[
              { title: "Robert Kim — nausea report", sub: "Reported 9:15 AM. Awaiting provider response.", intent: "red" as const },
              { title: "Order #ORD-8502 — damaged", sub: "Replacement requested for Anna Bellamy.", intent: "amber" as const },
              { title: "Lab results ready", sub: "3 new patient results in the lab inbox.", intent: "teal" as const },
              { title: "Refill approvals pending", sub: "5 refills awaiting signature.", intent: "purple" as const },
            ].map((a) => (
              <div key={a.title} className="flex items-start gap-3 pb-3 border-b border-border last:border-none last:pb-0">
                <span className={`w-2.5 h-2.5 rounded-full mt-1.5 bg-${a.intent}`} />
                <div className="min-w-0">
                  <div className="text-[12.5px] font-semibold text-ink">{a.title}</div>
                  <div className="text-[11.5px] text-ink-muted leading-snug">{a.sub}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="card mt-4">
        <div className="card-head">
          <div className="ch-icon">📋</div>
          <div>
            <div className="ct">Recent intake submissions</div>
            <div className="text-[12px] text-ink-muted">Latest submitted patient forms.</div>
          </div>
          <div className="flex-1" />
          <Link href="/intake-review" className="btn btn-ghost btn-xs">Open reviews</Link>
        </div>
        <div className="p-1">
          {recentIntakes.length === 0 && <div className="py-8 text-center text-ink-muted text-[12px]">No intake submissions yet</div>}
          {recentIntakes.map((sub) => (
            <div key={sub.id} className="flex items-center gap-3 py-3 px-4 border-b border-border last:border-none animate-fadeUp">
              <div className="font-mono text-[11.5px] text-ink-muted w-[120px] flex-shrink-0">{sub.submittedAt}</div>
              <div className="flex-1 min-w-0">
                <div className="text-[13px] font-semibold text-ink tracking-tight">{sub.patientName}</div>
                <div className="text-[11.5px] text-ink-muted">{sub.program} · {sub.state}</div>
              </div>
              {sub.status === "approved" && <Pill intent="green" dot>Approved</Pill>}
              {sub.status === "denied" && <Pill intent="red" dot>Denied</Pill>}
              {sub.status === "info" && <Pill intent="blue" dot>Needs Info</Pill>}
              {sub.status === "pending" && <Pill intent="amber" dot>Pending</Pill>}
            </div>
          ))}
        </div>
      </div>

      <Toast />
    </div>
  );
}
