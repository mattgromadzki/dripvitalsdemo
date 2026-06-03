"use client";

import { useMemo } from "react";
import Link from "next/link";
import { KpiCard, KpiGrid } from "@/components/ui/Kpi";
import { Pill } from "@/components/ui/Pill";
import { Toast } from "@/components/ui/Toast";
import { toast } from "@/lib/hooks/useToast";
import { usePatients } from "@/lib/hooks/usePatients";
import { useVisitQueue } from "@/lib/hooks/useVisitQueue";

export default function DashboardPage() {
  const patients = usePatients((s) => s.patients);
  const visits   = useVisitQueue((s) => s.visits);
  const stats = useMemo(() => {
    const active = patients.filter((p) => p.status === "active").length;
    const pending = patients.filter((p) => p.status === "pending").length;
    const urgent = patients.filter((p) => p.tags.some((t) => t.toLowerCase().startsWith("urgent"))).length;
    const totalLost = patients.reduce((sum, p) => sum + (p.wtStart - p.wt), 0);
    return { active, pending, urgent, totalLost: totalLost.toFixed(1) };
  }, [patients]);

  // Today's schedule — pull from visit queue, sort by time, take next 4
  const todaysSchedule = useMemo(() => {
    return [...visits].sort((a, b) => timeOf(a.time) - timeOf(b.time)).slice(0, 4);
  }, [visits]);

  return (
    <div className="px-7 py-6">
      <div className="flex items-start justify-between gap-4 mb-5 flex-wrap">
        <div>
          <div className="text-[22px] font-bold tracking-tight text-ink mb-1">Good morning, Dr. Rivera</div>
          <div className="text-[13px] text-ink-muted">Monday, May 24, 2026 · You have 3 visits scheduled today</div>
        </div>
        <div className="flex gap-2">
          <button className="btn btn-ghost btn-sm" onClick={() => toast("📊 Generating daily report…")}>📊 Daily Report</button>
          <button className="btn btn-primary btn-sm" onClick={() => toast("🩺 Starting next visit in queue")}>🩺 Start Next Visit</button>
        </div>
      </div>

      <KpiGrid cols={4}>
        <KpiCard
          label="Active Patients"
          value={stats.active}
          icon="👥"
          iconBg="var(--color-brand-soft, #e6f4ef)"
          iconColor="var(--color-brand, #1f8a70)"
          trend="+12 this month"
          trendColor="var(--color-brand, #1f8a70)"
        />
        <KpiCard
          label="Pending Intake"
          value={stats.pending}
          icon="📋"
          iconBg="var(--color-amber-soft, #fbf2e3)"
          iconColor="var(--color-amber, #b86e1e)"
          trend="Awaiting clinical review"
          trendColor="var(--color-amber, #b86e1e)"
        />
        <KpiCard
          label="Urgent Flags"
          value={stats.urgent}
          icon="⚠"
          iconBg="var(--color-red-soft, #fbecea)"
          iconColor="var(--color-red, #c0392b)"
          trend="Patient needs attention"
          trendColor="var(--color-red, #c0392b)"
        />
        <KpiCard
          label="Total Weight Lost"
          value={`${stats.totalLost} lb`}
          icon="📉"
          iconBg="var(--color-purple-soft, #efeaf6)"
          iconColor="var(--color-purple, #6b4ea8)"
          trend="Across active patients"
          trendColor="var(--color-purple, #6b4ea8)"
        />
      </KpiGrid>

      {/* Two-column layout: today's schedule + alerts */}
      <div className="grid grid-cols-[2fr_1fr] gap-3.5 mb-3.5 max-[1100px]:grid-cols-1">
        <div className="card">
          <div className="card-head">
            <div className="ch-icon">🩺</div>
            <div className="ct">Today&rsquo;s Schedule</div>
            <div className="flex-1" />
            <Link href="/queue" className="btn btn-ghost btn-xs">Open queue</Link>
          </div>
          <div className="p-1">
            {todaysSchedule.length === 0 && (
              <div className="py-6 text-center text-ink-muted text-[12px]">
                <div className="text-[28px] opacity-40 mb-1.5">📅</div>
                <div>No visits scheduled for today</div>
              </div>
            )}
            {todaysSchedule.map((v) => (
              <div key={v.id} className="flex items-center gap-3 py-2.5 px-3.5 border-b border-border last:border-none animate-fadeUp">
                <div className="font-mono text-[11.5px] text-ink-muted w-[68px] flex-shrink-0">{v.time}</div>
                <div className="w-9 h-9 rounded-full flex items-center justify-center text-[11px] font-bold text-white flex-shrink-0" style={{ background: v.color }}>
                  {v.patientName.split(" ").map((s) => s[0]).join("").slice(0, 2)}
                </div>
                <div className="flex-1 min-w-0">
                  {v.patientId ? (
                    <Link href={`/patients/${v.patientId}`} className="text-[13px] font-semibold text-ink tracking-tight hover:text-brand-dk">
                      {v.patientName}
                    </Link>
                  ) : (
                    <div className="text-[13px] font-semibold text-ink tracking-tight">{v.patientName}</div>
                  )}
                  <div className="text-[11.5px] text-ink-muted">{v.type} · {v.reason}</div>
                </div>
                {v.status === "completed"   && <Pill intent="green" dot>Completed</Pill>}
                {v.status === "in_progress" && <Pill intent="blue"  dot>In Progress</Pill>}
                {v.status === "waiting"     && <Pill intent="amber" dot>Waiting</Pill>}
                {v.status === "urgent"      && <Pill intent="red"   dot>Urgent</Pill>}
                {v.status === "scheduled"   && <Pill intent="muted" dot>Scheduled</Pill>}
              </div>
            ))}
          </div>
        </div>

        <div className="card">
          <div className="card-head">
            <div className="ch-icon" style={{ background: "var(--color-red-soft, #fbecea)", color: "var(--color-red, #c0392b)" }}>⚠</div>
            <div className="ct">Alerts &amp; Tasks</div>
          </div>
          <div className="p-3.5 flex flex-col gap-2.5">
            {[
              { icon: "⚠",  title: "Robert Kim — Severe Nausea",    sub: "Reported 9:15 AM. Awaiting response.",          intent: "red" as const },
              { icon: "📦", title: "Order #ORD-8502 — Damaged",     sub: "Anna Bellamy. Replacement requested.",          intent: "amber" as const },
              { icon: "🧪", title: "Lab Results Ready",             sub: "3 new patient results in inbox.",               intent: "teal" as const },
              { icon: "💊", title: "Refill Approvals Pending",      sub: "5 refills awaiting your signature.",            intent: "purple" as const },
              { icon: "📋", title: "Intake Review Queue",            sub: `${stats.pending} pending clinical reviews.`,    intent: "blue" as const },
            ].map((a, i) => (
              <div key={i} className="flex items-start gap-2.5 py-2 border-b border-border last:border-none">
                <div className="text-[18px] flex-shrink-0">{a.icon}</div>
                <div className="flex-1 min-w-0">
                  <div className="text-[12.5px] font-semibold text-ink mb-0.5">{a.title}</div>
                  <div className="text-[11px] text-ink-muted leading-snug">{a.sub}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <Toast />
    </div>
  );
}

function timeOf(time: string): number {
  // "9:30 AM" → 570
  const m = time.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
  if (!m) return 0;
  let h = parseInt(m[1], 10);
  const min = parseInt(m[2], 10);
  if (m[3].toUpperCase() === "PM" && h !== 12) h += 12;
  if (m[3].toUpperCase() === "AM" && h === 12) h = 0;
  return h * 60 + min;
}
