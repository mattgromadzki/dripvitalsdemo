"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import type { ReactNode } from "react";
import { Pill } from "@/components/ui/Pill";
import { Toast } from "@/components/ui/Toast";
import { KpiCard, KpiGrid } from "@/components/ui/Kpi";
import { ScheduleVisitModal } from "@/components/modules/ScheduleVisitModal";
import { toast } from "@/lib/hooks/useToast";
import { useVisitQueue } from "@/lib/hooks/useVisitQueue";
import type { QueueStatus, QueueVisit } from "@/lib/types";

type Filter = "all" | QueueStatus;

const STATUS_LABEL: Record<QueueStatus, string> = {
  waiting:     "Waiting",
  in_progress: "In Progress",
  completed:   "Completed",
  urgent:      "Urgent",
  scheduled:   "Scheduled",
};

const STATUS_INTENT: Record<QueueStatus, "muted" | "amber" | "green" | "red" | "blue"> = {
  waiting:     "amber",
  in_progress: "blue",
  completed:   "green",
  urgent:      "red",
  scheduled:   "muted",
};

export default function QueuePage() {
  const visits      = useVisitQueue((s) => s.visits);
  const addVisit    = useVisitQueue((s) => s.add);
  const updateVisit = useVisitQueue((s) => s.updateStatus);

  const [filter, setFilter] = useState<Filter>("all");
  const [scheduleOpen, setScheduleOpen] = useState(false);

  // Live counts per status
  const counts = useMemo(() => {
    const c: Record<Filter, number> = { all: visits.length, waiting: 0, in_progress: 0, completed: 0, urgent: 0, scheduled: 0 };
    for (const v of visits) c[v.status] = (c[v.status] || 0) + 1;
    return c;
  }, [visits]);

  // Filtered list — sorted by time
  const filteredVisits = useMemo(() => {
    const list = filter === "all" ? visits : visits.filter((v) => v.status === filter);
    return [...list].sort((a, b) => timeToMinutes(a.time) - timeToMinutes(b.time));
  }, [visits, filter]);

  function handleAdvanceStatus(v: QueueVisit) {
    // waiting → in_progress → completed
    const next: QueueStatus = v.status === "waiting" ? "in_progress" : "completed";
    updateVisit(v.id, next);
    toast(next === "in_progress" ? `🎥 Joining visit with ${v.patientName}…` : `✓ Visit with ${v.patientName} marked completed`);
  }

  const TABS: { value: Filter; label: string }[] = [
    { value: "all",         label: "All" },
    { value: "waiting",     label: "Waiting" },
    { value: "in_progress", label: "In Progress" },
    { value: "completed",   label: "Completed" },
    { value: "urgent",      label: "🔴 Urgent" },
  ];

  return (
    <div className="px-7 py-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 mb-5 flex-wrap">
        <div>
          <div className="text-[22px] font-bold tracking-tight text-ink mb-1">Visit Queue</div>
          <div className="text-[13px] text-ink-muted">
            Today · {counts.all} scheduled · {counts.completed} completed
          </div>
        </div>
        <div className="flex gap-2">
          <button className="btn btn-ghost btn-sm" onClick={() => toast("📥 Today's roster exported")}>
            📥 Export
          </button>
          <button className="btn btn-primary btn-sm" onClick={() => setScheduleOpen(true)}>
            + Schedule Visit
          </button>
        </div>
      </div>

      {/* KPI strip */}
      <KpiGrid cols={5}>
        <KpiCard
          label="Total Today"
          value={counts.all}
          icon="📅"
          iconBg="var(--color-brand-soft)"
          iconColor="var(--color-brand)"
        />
        <KpiCard
          label="Waiting"
          value={counts.waiting}
          icon="⏳"
          iconBg="var(--color-amber-soft)"
          iconColor="var(--color-amber)"
        />
        <KpiCard
          label="In Progress"
          value={counts.in_progress}
          icon="🎥"
          iconBg="var(--color-blue-soft)"
          iconColor="var(--color-blue)"
        />
        <KpiCard
          label="Completed"
          value={counts.completed}
          icon="✓"
          iconBg="var(--color-green-soft)"
          iconColor="var(--color-green)"
        />
        <KpiCard
          label="Urgent"
          value={counts.urgent}
          icon="⚠"
          iconBg="var(--color-red-soft)"
          iconColor="var(--color-red)"
        />
      </KpiGrid>

      {/* Filter tabs */}
      <div className="bg-surface border border-border rounded-lg overflow-hidden">
        <div className="flex border-b border-border bg-surface-2 px-3 py-2 gap-1 overflow-x-auto flex-nowrap">
          {TABS.map((t) => {
            const isActive = filter === t.value;
            const count = counts[t.value];
            return (
              <button
                key={t.value}
                onClick={() => setFilter(t.value)}
                className={[
                  "py-1.5 px-3.5 text-[12px] font-semibold cursor-pointer whitespace-nowrap rounded-pill border transition-colors flex items-center gap-1.5",
                  isActive
                    ? "bg-brand text-white border-brand"
                    : "bg-surface text-ink-2 border-border hover:border-border-2",
                ].join(" ")}
              >
                {t.label}
                <span
                  className={[
                    "inline-flex items-center justify-center min-w-[20px] h-[18px] px-1.5 rounded-pill text-[10.5px] font-bold",
                    isActive ? "bg-white/20 text-white" : "bg-surface-3 text-ink-muted",
                  ].join(" ")}
                >
                  {count}
                </span>
              </button>
            );
          })}
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-[13px]">
            <thead className="bg-surface-2">
              <tr>
                <Th>Patient</Th>
                <Th>Time</Th>
                <Th>Type</Th>
                <Th>Provider</Th>
                <Th>Reason</Th>
                <Th>Status</Th>
                <Th>Action</Th>
              </tr>
            </thead>
            <tbody>
              {filteredVisits.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-ink-muted">
                    <div className="text-[36px] opacity-40 mb-2">📅</div>
                    <div className="text-[13px] font-bold text-ink mb-0.5">
                      {filter === "all" ? "No visits scheduled today" : `No ${STATUS_LABEL[filter as QueueStatus].toLowerCase()} visits`}
                    </div>
                    <div className="text-[11.5px]">
                      {filter === "all" ? "Click \u201C+ Schedule Visit\u201D to add one" : "Try a different filter"}
                    </div>
                  </td>
                </tr>
              ) : (
                filteredVisits.map((v, i) => {
                  const initials = v.patientName.split(" ").map((s) => s[0]).join("").slice(0, 2);
                  const isUrgent = v.status === "urgent";
                  const isCompleted = v.status === "completed";

                  return (
                    <tr
                      key={v.id}
                      className={[
                        "transition-colors animate-fadeUp",
                        isUrgent ? "hover:bg-red-soft/40" : "hover:bg-surface-2",
                      ].join(" ")}
                      style={{
                        animationDelay: `${i * 25}ms`,
                        background: isUrgent ? "rgba(192,57,43,.025)" : undefined,
                        borderLeft: isUrgent ? "3px solid var(--color-red)" : undefined,
                      }}
                    >
                      <Td>
                        {v.patientId ? (
                          <Link
                            href={`/patients/${v.patientId}`}
                            className="flex items-center gap-2.5 group"
                          >
                            <div
                              className="w-8 h-8 rounded-full flex items-center justify-center text-[10.5px] font-bold text-white flex-shrink-0"
                              style={{ background: v.color }}
                            >
                              {initials}
                            </div>
                            <span className="text-[13px] font-semibold text-ink group-hover:text-brand-dk">
                              {v.patientName}
                            </span>
                          </Link>
                        ) : (
                          <div className="flex items-center gap-2.5">
                            <div
                              className="w-8 h-8 rounded-full flex items-center justify-center text-[10.5px] font-bold text-white flex-shrink-0"
                              style={{ background: v.color }}
                            >
                              {initials}
                            </div>
                            <div>
                              <span className="text-[13px] font-semibold text-ink">{v.patientName}</span>
                              <div className="text-[10px] text-ink-muted-2 italic">New / unregistered</div>
                            </div>
                          </div>
                        )}
                      </Td>

                      <Td>
                        <span className="font-mono text-[12px] text-ink-2">{v.time}</span>
                      </Td>

                      <Td>
                        <Pill intent={isUrgent ? "red" : "muted"}>{v.type}</Pill>
                      </Td>

                      <Td>
                        <span className="text-[12.5px] text-ink-2">{v.provider}</span>
                      </Td>

                      <Td>
                        <div className="text-[12px] text-ink-muted max-w-[200px] truncate" title={v.reason}>
                          {v.reason}
                        </div>
                      </Td>

                      <Td>
                        <Pill intent={STATUS_INTENT[v.status]} dot>
                          {STATUS_LABEL[v.status]}
                        </Pill>
                      </Td>

                      <Td>
                        <div className="flex gap-1">
                          {isCompleted ? (
                            <button
                              className="px-2.5 py-1 rounded-md bg-surface-2 border border-border text-[11px] font-semibold text-ink-2 hover:bg-brand-soft hover:border-brand hover:text-brand-dk transition-colors"
                              onClick={() => toast(`📝 Opening SOAP note for ${v.patientName}…`)}
                            >
                              📝 Note
                            </button>
                          ) : (
                            <button
                              className={[
                                "px-2.5 py-1 rounded-md text-[11px] font-semibold transition-colors",
                                isUrgent
                                  ? "bg-red text-white hover:bg-red-soft hover:text-red border border-red"
                                  : "bg-brand text-white hover:bg-brand-dk",
                              ].join(" ")}
                              onClick={() => handleAdvanceStatus(v)}
                            >
                              {v.status === "waiting" ? "Join 🎥" : "Mark Done"}
                            </button>
                          )}
                        </div>
                      </Td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        <div className="py-2.5 px-[18px] border-t border-border bg-surface-2 text-[11.5px] text-ink-muted">
          Showing {filteredVisits.length} of {counts.all} {filteredVisits.length === 1 ? "visit" : "visits"} today
        </div>
      </div>

      <ScheduleVisitModal
        open={scheduleOpen}
        onClose={() => setScheduleOpen(false)}
        onSave={(v) => {
          const created = addVisit(v);
          toast(`✓ ${created.patientName} scheduled for ${created.time}`);
        }}
      />
      <Toast />
    </div>
  );
}

function timeToMinutes(time: string): number {
  // Parses "9:30 AM" → 570
  const m = time.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
  if (!m) return 0;
  let h = parseInt(m[1], 10);
  const min = parseInt(m[2], 10);
  const ampm = m[3].toUpperCase();
  if (ampm === "PM" && h !== 12) h += 12;
  if (ampm === "AM" && h === 12) h = 0;
  return h * 60 + min;
}

function Th({ children }: { children: ReactNode }) {
  return (
    <th className="py-2.5 px-3.5 text-left text-[10px] font-bold uppercase tracking-wider text-ink-muted border-b border-border whitespace-nowrap">
      {children}
    </th>
  );
}

function Td({ children }: { children: ReactNode }) {
  return <td className="py-2.5 px-3.5 border-b border-border align-middle">{children}</td>;
}
