"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import type { Key, ReactNode } from "react";
import { Pill } from "@/components/ui/Pill";
import { Toast } from "@/components/ui/Toast";
import { KpiCard, KpiGrid } from "@/components/ui/Kpi";
import { Modal } from "@/components/ui/Modal";
import { toast } from "@/lib/hooks/useToast";
import { useVisitQueue } from "@/lib/hooks/useVisitQueue";
import { usePatients } from "@/lib/hooks/usePatients";
import type { QueueVisit, QueueStatus } from "@/lib/types";

const STATUS_LABEL: Record<QueueStatus, string> = {
  waiting:      "Waiting",
  in_progress:  "In Progress",
  completed:    "Completed",
  urgent:       "⚠ Urgent",
  scheduled:    "Scheduled",
};

const STATUS_INTENT: Record<QueueStatus, "amber" | "blue" | "green" | "red" | "purple"> = {
  waiting:      "amber",
  in_progress:  "blue",
  completed:    "green",
  urgent:       "red",
  scheduled:    "purple",
};

// Parse "10:30 AM" → minutes since midnight
function parseTimeToMinutes(time: string): number {
  const m = time.match(/(\d+):(\d+)\s+(AM|PM)/i);
  if (!m) return 0;
  let h = parseInt(m[1], 10);
  const min = parseInt(m[2], 10);
  if (m[3].toUpperCase() === "PM" && h !== 12) h += 12;
  if (m[3].toUpperCase() === "AM" && h === 12) h = 0;
  return h * 60 + min;
}

export default function VideoVisitsPage() {
  const visits   = useVisitQueue((s) => s.visits);
  const updateStatus  = useVisitQueue((s) => s.updateStatus);
  const patients = usePatients((s) => s.patients);

  const [providerFilter, setProviderFilter] = useState<string>("all");
  const [detailVisit, setDetailVisit] = useState<QueueVisit | null>(null);
  const [preCheckOpen, setPreCheckOpen] = useState(false);

  // KPIs
  const metrics = useMemo(() => {
    const completed = visits.filter((v) => v.status === "completed").length;
    const total = visits.length;
    const inProgress = visits.filter((v) => v.status === "in_progress").length;
    const waiting = visits.filter((v) => v.status === "waiting" || v.status === "urgent" || v.status === "scheduled").length;
    const completionRate = total > 0 ? Math.round((completed / total) * 100) : 0;

    return {
      today: total,
      completed,
      inProgress,
      waiting,
      thisMonth: 218, // demo aggregate (independent of today's queue)
      avgDuration: 14.2,
      completionRate: 94,
      todayCompletionRate: completionRate,
    };
  }, [visits]);

  // Sorted by time
  const sortedVisits = useMemo(() => {
    let list = visits;
    if (providerFilter !== "all") list = list.filter((v) => v.provider === providerFilter);
    return [...list].sort((a, b) => parseTimeToMinutes(a.time) - parseTimeToMinutes(b.time));
  }, [visits, providerFilter]);

  // "Next up" is the first non-completed visit, with urgent prioritized
  const nextVisit = useMemo(() => {
    const active = sortedVisits.filter((v) => v.status !== "completed");
    if (active.length === 0) return null;
    const urgent = active.find((v) => v.status === "urgent");
    if (urgent) return urgent;
    const inProgress = active.find((v) => v.status === "in_progress");
    if (inProgress) return inProgress;
    return active[0];
  }, [sortedVisits]);

  // Unique providers for filter
  const providers = useMemo(() => Array.from(new Set(visits.map((v) => v.provider))), [visits]);

  function handleJoinRoom(v: QueueVisit) {
    if (v.status === "waiting" || v.status === "scheduled" || v.status === "urgent") {
      updateStatus(v.id, "in_progress");
    }
    toast(`🎥 Launching Zoom room for ${v.patientName}…`);
  }

  function handleEndVisit(v: QueueVisit) {
    updateStatus(v.id, "completed");
    toast(`✓ ${v.patientName} visit completed · SOAP note drafted`);
  }

  return (
    <div className="px-7 py-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 mb-5 flex-wrap">
        <div>
          <div className="text-[22px] font-bold tracking-tight text-ink mb-1">Video Visits</div>
          <div className="text-[13px] text-ink-muted flex items-center gap-1.5">
            <span>HIPAA-secure telehealth</span>
            <span>·</span>
            <Pill intent="green" dot>BAA with Zoom on file</Pill>
            <span>·</span>
            <span>End-to-end encrypted</span>
          </div>
        </div>
        <div className="flex gap-2">
          <button className="btn btn-ghost btn-sm" onClick={() => setPreCheckOpen(true)}>🎙 Device Check</button>
          <button className="btn btn-primary btn-sm" onClick={() => toast("📅 Schedule visit dialog (use Visit Queue module)")}>+ Schedule Visit</button>
        </div>
      </div>

      {/* "Next up" hero */}
      {nextVisit && (
        <div
          className="rounded-lg p-5 mb-5 text-white flex items-center gap-5 flex-wrap"
          style={{
            background: nextVisit.status === "urgent"
              ? "linear-gradient(135deg, var(--color-red), #8B1F15)"
              : nextVisit.status === "in_progress"
              ? "linear-gradient(135deg, var(--color-blue), #1d4ed8)"
              : "linear-gradient(135deg, var(--color-brand), var(--color-brand-dk))",
          }}
        >
          <div
            className="w-14 h-14 rounded-full flex items-center justify-center text-[16px] font-bold flex-shrink-0 border-2"
            style={{ borderColor: "rgba(255,255,255,.3)", background: "rgba(255,255,255,.15)" }}
          >
            {nextVisit.patientName.split(" ").map((s) => s[0]).join("").slice(0, 2)}
          </div>

          <div className="flex-1 min-w-[280px]">
            <div className="text-white/70 text-[11px] font-bold uppercase tracking-widest mb-1">
              {nextVisit.status === "urgent"  ? "🚨 Urgent Visit Waiting"
              : nextVisit.status === "in_progress" ? "🎥 Visit In Progress"
              : nextVisit.status === "scheduled" ? "📅 Next Scheduled"
              : "▶ Next Up"}
            </div>
            <div className="text-[22px] font-bold leading-tight">{nextVisit.patientName}</div>
            <div className="text-white/85 text-[12.5px] mt-1">
              {nextVisit.time} · <strong>{nextVisit.type}</strong> · with {nextVisit.provider}
            </div>
            <div className="text-white/75 text-[11.5px] mt-1">{nextVisit.reason}</div>
          </div>

          <div className="flex gap-2 flex-shrink-0">
            {nextVisit.status === "in_progress" ? (
              <button
                className="px-5 py-2.5 rounded-md bg-white text-[13px] font-bold text-ink hover:bg-white/90 transition-colors shadow-md"
                onClick={() => handleEndVisit(nextVisit)}
              >
                ✓ End Visit
              </button>
            ) : (
              <button
                className="px-5 py-2.5 rounded-md bg-white text-[13px] font-bold text-ink hover:bg-white/90 transition-colors shadow-md"
                onClick={() => handleJoinRoom(nextVisit)}
              >
                🎥 Join Room
              </button>
            )}
            <button
              className="px-3.5 py-2.5 rounded-md bg-white/10 text-[13px] font-semibold text-white border border-white/15 hover:bg-white/20 transition-colors"
              onClick={() => setDetailVisit(nextVisit)}
            >
              👁 Pre-Visit
            </button>
          </div>
        </div>
      )}

      {/* KPI strip */}
      <KpiGrid cols={4}>
        <KpiCard
          label="Today's Visits"
          value={metrics.today}
          icon="📅"
          iconBg="var(--color-brand-soft)"
          iconColor="var(--color-brand)"
          trend={`${metrics.completed} done · ${metrics.inProgress} live · ${metrics.waiting} waiting`}
          trendColor="var(--color-brand)"
        />
        <KpiCard
          label="Avg Duration"
          value={`${metrics.avgDuration}m`}
          icon="⏱"
          iconBg="var(--color-green-soft)"
          iconColor="var(--color-green)"
          trend="Per completed visit"
          trendColor="var(--color-green)"
        />
        <KpiCard
          label="Completion Rate"
          value={`${metrics.completionRate}%`}
          icon="✅"
          iconBg="var(--color-violet-soft)"
          iconColor="var(--color-violet)"
          trend="Last 30 days"
          trendColor="var(--color-violet)"
        />
        <KpiCard
          label="Visits This Month"
          value={metrics.thisMonth}
          icon="🎥"
          iconBg="var(--color-amber-soft)"
          iconColor="var(--color-amber)"
          trend="↑ 12% vs last month"
          trendColor="var(--color-green)"
        />
      </KpiGrid>

      {/* 2-column layout: main schedule + sidebar */}
      <div className="grid grid-cols-[1fr_300px] gap-4 max-[1100px]:grid-cols-1">
        {/* Main visit list */}
        <div>
          {/* Provider filter */}
          <div className="flex items-center gap-2 mb-3 flex-wrap">
            <button
              onClick={() => setProviderFilter("all")}
              className={[
                "py-1.5 px-3 rounded-pill text-[11.5px] font-semibold border transition-colors",
                providerFilter === "all" ? "bg-brand text-white border-brand" : "bg-surface border-border text-ink-2 hover:border-border-2",
              ].join(" ")}
            >
              All Providers ({visits.length})
            </button>
            {providers.map((p) => {
              const count = visits.filter((v) => v.provider === p).length;
              return (
                <button
                  key={p}
                  onClick={() => setProviderFilter(providerFilter === p ? "all" : p)}
                  className={[
                    "py-1.5 px-3 rounded-pill text-[11.5px] font-semibold border transition-colors flex items-center gap-1.5",
                    providerFilter === p ? "bg-brand text-white border-brand" : "bg-surface border-border text-ink-2 hover:border-border-2",
                  ].join(" ")}
                >
                  <span>{p}</span>
                  <span
                    className={[
                      "inline-flex items-center justify-center min-w-[18px] h-[17px] px-1 rounded-pill text-[10px] font-bold",
                      providerFilter === p ? "bg-white/20 text-white" : "bg-surface-3 text-ink-muted",
                    ].join(" ")}
                  >
                    {count}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Today's Schedule card */}
          <div className="bg-surface border border-border rounded-lg overflow-hidden">
            <div className="py-3 px-5 bg-surface-2 border-b border-border flex items-center gap-2.5">
              <div className="w-7 h-7 rounded-md flex items-center justify-center text-[13px] flex-shrink-0 border border-border bg-surface" style={{ background: "var(--color-brand-soft)", color: "var(--color-brand)" }}>
                📅
              </div>
              <div className="text-[13px] font-bold uppercase tracking-wider text-ink-2 flex-1">Today's Schedule</div>
              <div className="text-[11px] text-ink-muted">
                {sortedVisits.length} visits · {sortedVisits.filter((v) => v.status === "completed").length} completed
              </div>
            </div>

            {sortedVisits.length === 0 ? (
              <div className="py-12 text-center text-ink-muted">
                <div className="text-[36px] opacity-40 mb-2">📅</div>
                <div className="text-[13px] font-bold text-ink mb-0.5">No visits scheduled</div>
                <div className="text-[11.5px]">No matching visits for this provider</div>
              </div>
            ) : (
              sortedVisits.map((v, i) => (
                <VisitRow
                  key={v.id}
                  visit={v}
                  patientExists={!!patients.find((p) => p.id === v.patientId)}
                  onJoin={() => handleJoinRoom(v)}
                  onEnd={() => handleEndVisit(v)}
                  onDetail={() => setDetailVisit(v)}
                  isLast={i === sortedVisits.length - 1}
                  delay={i * 30}
                />
              ))
            )}
          </div>
        </div>

        {/* Sidebar */}
        <div className="space-y-3">
          {/* Telehealth setup */}
          <div className="bg-surface border border-border rounded-lg overflow-hidden">
            <div className="py-3 px-4 bg-surface-2 border-b border-border flex items-center gap-2">
              <span className="text-[14px]">🎥</span>
              <div className="text-[11.5px] font-bold uppercase tracking-wider text-ink-2">Telehealth Setup</div>
            </div>
            <div className="p-3 space-y-2.5">
              <SetupItem icon="🎙" label="Microphone" status="ok" detail="MacBook Pro" />
              <SetupItem icon="📹" label="Camera"     status="ok" detail="FaceTime HD 1080p" />
              <SetupItem icon="🌐" label="Network"    status="ok" detail="42 Mbps · low latency" />
              <SetupItem icon="🔊" label="Speakers"   status="ok" detail="External · tested" />
            </div>
            <div className="border-t border-border p-3">
              <button className="btn btn-ghost btn-sm w-full" onClick={() => setPreCheckOpen(true)}>
                🔁 Run Device Test
              </button>
            </div>
          </div>

          {/* Compliance */}
          <div className="bg-surface border border-border rounded-lg overflow-hidden">
            <div className="py-3 px-4 bg-surface-2 border-b border-border flex items-center gap-2">
              <span className="text-[14px]">🛡</span>
              <div className="text-[11.5px] font-bold uppercase tracking-wider text-ink-2">Compliance</div>
            </div>
            <div className="p-3 space-y-2">
              <ComplianceItem label="HIPAA BAA · Zoom" status="ok" detail="Signed Nov 2024" />
              <ComplianceItem label="End-to-End Encryption" status="ok" detail="AES-256 + ECDH" />
              <ComplianceItem label="Recording (default)" status="off" detail="Off — opt-in only" />
              <ComplianceItem label="State Licensure Check" status="ok" detail="All patients verified" />
            </div>
          </div>

          {/* Quick stats */}
          <div className="bg-surface border border-border rounded-lg overflow-hidden">
            <div className="py-3 px-4 bg-surface-2 border-b border-border flex items-center gap-2">
              <span className="text-[14px]">📊</span>
              <div className="text-[11.5px] font-bold uppercase tracking-wider text-ink-2">This Week</div>
            </div>
            <div className="p-3 grid grid-cols-2 gap-2">
              <div className="bg-surface-2 rounded p-2 text-center">
                <div className="text-[16px] font-extrabold leading-none text-brand-dk">52</div>
                <div className="text-[9.5px] font-bold uppercase tracking-widest text-ink-muted mt-1">Visits</div>
              </div>
              <div className="bg-surface-2 rounded p-2 text-center">
                <div className="text-[16px] font-extrabold leading-none text-green">96%</div>
                <div className="text-[9.5px] font-bold uppercase tracking-widest text-ink-muted mt-1">Showed Up</div>
              </div>
              <div className="bg-surface-2 rounded p-2 text-center">
                <div className="text-[16px] font-extrabold leading-none text-amber">2</div>
                <div className="text-[9.5px] font-bold uppercase tracking-widest text-ink-muted mt-1">No-Shows</div>
              </div>
              <div className="bg-surface-2 rounded p-2 text-center">
                <div className="text-[16px] font-extrabold leading-none text-violet">13.8m</div>
                <div className="text-[9.5px] font-bold uppercase tracking-widest text-ink-muted mt-1">Avg Time</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Pre-visit modal */}
      {detailVisit && (
        <Modal
          open={!!detailVisit}
          onClose={() => setDetailVisit(null)}
          title={`Pre-Visit · ${detailVisit.patientName}`}
          icon="📋"
          width={520}
          footer={
            <>
              <button className="btn btn-ghost" onClick={() => setDetailVisit(null)}>Close</button>
              {detailVisit.status !== "completed" && (
                <button
                  className="btn btn-primary"
                  onClick={() => {
                    handleJoinRoom(detailVisit);
                    setDetailVisit(null);
                  }}
                >
                  🎥 Join Room
                </button>
              )}
            </>
          }
        >
          <div className="bg-surface-2 border border-border rounded-md p-3.5 mb-4 flex items-center gap-3">
            <div
              className="w-11 h-11 rounded-full flex items-center justify-center text-[11px] font-bold text-white flex-shrink-0"
              style={{ background: detailVisit.color }}
            >
              {detailVisit.patientName.split(" ").map((s) => s[0]).join("").slice(0, 2)}
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-[13.5px] font-bold">{detailVisit.patientName}</div>
              <div className="text-[11px] text-ink-muted">
                {detailVisit.time} · {detailVisit.type} · {detailVisit.provider}
              </div>
            </div>
            <Pill intent={STATUS_INTENT[detailVisit.status]} dot>{STATUS_LABEL[detailVisit.status]}</Pill>
          </div>

          <div className="mb-4">
            <div className="text-[10.5px] font-bold uppercase tracking-widest text-ink-muted mb-1">Reason for Visit</div>
            <div className="text-[12.5px] text-ink-2 leading-relaxed">{detailVisit.reason}</div>
          </div>

          <div className="mb-4">
            <div className="text-[10.5px] font-bold uppercase tracking-widest text-ink-muted mb-2">Pre-Visit Checklist</div>
            <div className="space-y-1.5">
              <ChecklistItem checked label="Patient identity verified" detail="2FA confirmed at check-in" />
              <ChecklistItem checked label="Recent vitals reviewed"     detail="Last weight: 187 lbs · BP 142/88" />
              <ChecklistItem checked label="Active medications reviewed" detail="Semaglutide 0.5mg/wk" />
              <ChecklistItem checked label="Consent forms current"      detail="All signed within last 6 months" />
              <ChecklistItem label="Pre-visit questionnaire reviewed" detail="Not yet submitted" />
              <ChecklistItem label="SOAP template selected"            detail="Choose template before joining" />
            </div>
          </div>

          {detailVisit.patientId && (
            <div className="pt-3 border-t border-border flex gap-2">
              <Link href={`/patients/${detailVisit.patientId}`} className="btn btn-ghost btn-sm flex-1">
                👤 Open Patient Chart
              </Link>
              <Link href="/soap" className="btn btn-ghost btn-sm flex-1">
                📝 Start SOAP Note
              </Link>
            </div>
          )}
        </Modal>
      )}

      {/* Device pre-check modal */}
      <Modal
        open={preCheckOpen}
        onClose={() => setPreCheckOpen(false)}
        title="Device Pre-Check"
        icon="🎙"
        width={480}
        footer={
          <>
            <button className="btn btn-ghost" onClick={() => setPreCheckOpen(false)}>Close</button>
            <button
              className="btn btn-primary"
              onClick={() => {
                toast("✅ All devices working · Ready to host visits");
                setPreCheckOpen(false);
              }}
            >
              ✓ Run Full Test
            </button>
          </>
        }
      >
        <div className="space-y-3">
          <div className="bg-surface-2 border border-border rounded-md p-3 flex items-center gap-3">
            <div className="text-[24px]">🎙</div>
            <div className="flex-1">
              <div className="text-[12.5px] font-bold">Microphone</div>
              <div className="text-[11px] text-ink-muted">Default: MacBook Pro Microphone</div>
            </div>
            <Pill intent="green" dot>OK</Pill>
          </div>

          <div className="bg-surface-2 border border-border rounded-md p-3 flex items-center gap-3">
            <div className="text-[24px]">📹</div>
            <div className="flex-1">
              <div className="text-[12.5px] font-bold">Camera</div>
              <div className="text-[11px] text-ink-muted">Default: FaceTime HD Camera · 1080p</div>
            </div>
            <Pill intent="green" dot>OK</Pill>
          </div>

          <div className="bg-surface-2 border border-border rounded-md p-3 flex items-center gap-3">
            <div className="text-[24px]">🌐</div>
            <div className="flex-1">
              <div className="text-[12.5px] font-bold">Network</div>
              <div className="text-[11px] text-ink-muted">42 Mbps down · 12 Mbps up · 24ms latency</div>
            </div>
            <Pill intent="green" dot>OK</Pill>
          </div>

          <div className="text-[11px] text-ink-muted bg-brand-soft border border-brand-soft rounded px-3 py-2 mt-3">
            💡 Run a full test if you're switching audio devices, changing networks, or before a recorded visit.
          </div>
        </div>
      </Modal>

      <Toast />
    </div>
  );
}

// ─── Visit row ────────────────────────────────────────────────────────────
interface VisitRowProps {
  key?: Key;
  visit: QueueVisit;
  patientExists: boolean;
  onJoin: () => void;
  onEnd: () => void;
  onDetail: () => void;
  isLast: boolean;
  delay: number;
}

function VisitRow({ visit: v, patientExists, onJoin, onEnd, onDetail, isLast, delay }: VisitRowProps) {
  const isCompleted = v.status === "completed";
  const isUrgent    = v.status === "urgent";
  const isLive      = v.status === "in_progress";

  return (
    <div
      className={`flex items-center gap-3 py-3 px-4 hover:bg-surface-2 transition-colors animate-fadeUp ${isLast ? "" : "border-b border-border"}`}
      style={{
        animationDelay: `${delay}ms`,
        borderLeft: isUrgent ? "3px solid var(--color-red)" : isLive ? "3px solid var(--color-blue)" : undefined,
        background: isUrgent ? "rgba(192,57,43,.04)" : isLive ? "rgba(43,108,176,.03)" : undefined,
        opacity: isCompleted ? 0.65 : 1,
      }}
    >
      {/* Time column */}
      <div className="text-center flex-shrink-0 w-[68px]">
        <div className="text-[14px] font-bold tracking-tight text-ink">{v.time.replace(/\s+(AM|PM)/, "")}</div>
        <div className="text-[10px] uppercase tracking-widest text-ink-muted font-bold">{v.time.match(/(AM|PM)/i)?.[0] || ""}</div>
      </div>

      {/* Avatar */}
      <div
        className="w-9 h-9 rounded-full flex items-center justify-center text-[10px] font-bold text-white flex-shrink-0"
        style={{ background: v.color }}
      >
        {v.patientName.split(" ").map((s) => s[0]).join("").slice(0, 2)}
      </div>

      {/* Patient + type */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-0.5 flex-wrap">
          {patientExists && v.patientId ? (
            <Link href={`/patients/${v.patientId}`} className="text-[13px] font-bold hover:text-brand-dk hover:underline">
              {v.patientName}
            </Link>
          ) : (
            <span className="text-[13px] font-bold">{v.patientName}</span>
          )}
          <Pill intent={STATUS_INTENT[v.status]} dot={!isCompleted}>{STATUS_LABEL[v.status]}</Pill>
        </div>
        <div className="text-[11.5px] text-ink-muted truncate">
          <strong className="text-ink-2">{v.type}</strong> · with {v.provider} · <span className="italic">{v.reason}</span>
        </div>
      </div>

      {/* Actions */}
      <div className="flex gap-1.5 flex-shrink-0">
        <button
          className="px-2.5 py-1 rounded-md bg-surface-2 border border-border text-[11px] font-semibold text-ink-2 hover:bg-brand-soft hover:border-brand hover:text-brand-dk transition-colors"
          onClick={onDetail}
        >
          👁 Pre-Visit
        </button>
        {isCompleted ? (
          <Link href="/soap" className="px-2.5 py-1 rounded-md bg-surface-2 border border-border text-[11px] font-semibold text-ink-2 hover:bg-brand-soft hover:border-brand hover:text-brand-dk transition-colors">
            📝 Note
          </Link>
        ) : isLive ? (
          <button
            className="px-3 py-1 rounded-md bg-green text-white text-[11px] font-bold hover:opacity-90 transition-opacity"
            onClick={onEnd}
            style={{ background: "var(--color-green)" }}
          >
            ✓ End Visit
          </button>
        ) : (
          <button
            className="px-3 py-1 rounded-md bg-brand text-white text-[11px] font-bold hover:bg-brand-dk transition-colors"
            onClick={onJoin}
          >
            🎥 Join Room
          </button>
        )}
      </div>
    </div>
  );
}

// ─── Setup item (sidebar) ────────────────────────────────────────────────
function SetupItem({ icon, label, status, detail }: { icon: string; label: string; status: "ok" | "warn" | "off"; detail: string }) {
  return (
    <div className="flex items-center gap-2.5">
      <div className="text-[15px] flex-shrink-0">{icon}</div>
      <div className="flex-1 min-w-0">
        <div className="text-[11.5px] font-bold">{label}</div>
        <div className="text-[10.5px] text-ink-muted truncate">{detail}</div>
      </div>
      <div className="flex-shrink-0">
        {status === "ok" && <span className="text-green text-[14px]">✓</span>}
        {status === "warn" && <span className="text-amber text-[14px]">⚠</span>}
        {status === "off" && <span className="text-ink-muted text-[14px]">○</span>}
      </div>
    </div>
  );
}

function ComplianceItem({ label, status, detail }: { label: string; status: "ok" | "off" | "warn"; detail: string }) {
  return (
    <div className="flex items-center gap-2 text-[11px]">
      <span className={status === "ok" ? "text-green" : status === "off" ? "text-ink-muted" : "text-amber"}>
        {status === "ok" ? "✓" : status === "off" ? "○" : "⚠"}
      </span>
      <div className="flex-1 min-w-0">
        <div className="font-bold">{label}</div>
        <div className="text-[10px] text-ink-muted truncate">{detail}</div>
      </div>
    </div>
  );
}

function ChecklistItem({ checked, label, detail }: { checked?: boolean; label: string; detail: string }) {
  return (
    <div
      className={`flex items-start gap-2.5 py-1.5 px-2.5 rounded border ${
        checked ? "bg-green-soft border-green-soft" : "bg-surface-2 border-border"
      }`}
    >
      <span className={`text-[14px] flex-shrink-0 ${checked ? "text-green" : "text-ink-muted"}`}>
        {checked ? "✓" : "○"}
      </span>
      <div className="flex-1 min-w-0">
        <div className={`text-[12px] font-bold ${checked ? "text-green" : "text-ink"}`}>{label}</div>
        <div className="text-[10.5px] text-ink-muted">{detail}</div>
      </div>
    </div>
  );
}
