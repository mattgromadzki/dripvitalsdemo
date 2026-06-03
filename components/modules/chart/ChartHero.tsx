"use client";

import { Pill } from "@/components/ui/Pill";
import type { Patient, PatientExtra } from "@/lib/types";

interface ChartHeroProps {
  patient: Patient;
  extra: PatientExtra;
}

export function ChartHero({ patient, extra }: ChartHeroProps) {
  const initials = (patient.first[0] || "") + (patient.last[0] || "");
  const lostLbs = (patient.wtStart || patient.wt) - patient.wt;
  const pctGoal = extra.goalWt && patient.wt
    ? Math.round(((patient.wtStart || patient.wt) - patient.wt) / Math.max((patient.wtStart || patient.wt) - extra.goalWt, 1) * 100)
    : 0;
  const refillUrgent = patient._refillDays < 0;
  const refillSoon = patient._refillDays >= 0 && patient._refillDays <= 7;

  return (
    <div className="bg-surface border border-border rounded-lg px-[26px] py-[22px] mb-3.5 shadow-xs flex items-center gap-[22px] max-[900px]:flex-wrap">
      <div
        className="w-[62px] h-[62px] rounded-full flex items-center justify-center text-[22px] font-bold text-white flex-shrink-0"
        style={{ background: patient.color, boxShadow: "0 2px 6px rgba(20,40,30,.12)" }}
      >
        {initials}
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2.5 flex-wrap mb-1.5">
          <span className="text-[24px] font-bold tracking-tight text-ink leading-tight">
            {patient.name}
          </span>
          <StatusPill status={patient.status} />
          {refillUrgent && <Pill intent="red">⚠ Refill Overdue</Pill>}
          {refillSoon && <Pill intent="amber">⏰ Due Soon</Pill>}
        </div>
        <div className="flex items-center gap-[18px] flex-wrap text-[13px] text-ink-muted">
          <span className="font-mono text-[12px] text-ink-2 px-2 py-0.5 bg-surface-3 rounded font-semibold">
            {patient.id}
          </span>
          <span>{extra.gender}{patient.age ? ` · Age ${patient.age}` : ""}</span>
          <span className="text-ink-muted-2 opacity-60">|</span>
          <span>Enrolled {patient.since}</span>
        </div>
      </div>

      <div className="flex gap-2 flex-shrink-0">
        <StatTile value={`${lostLbs > 0 ? "−" : ""}${lostLbs}`} unit="lbs" label="Weight lost" color="green" />
        <StatTile value={String(pctGoal)} unit="%" label="To goal" color="brand" />
        <StatTile value={`Wk ${patient.week}`} unit="" label="Protocol" color="violet" />
        <StatTile value={`${extra.streakWeeks}🔥`} unit="" label="Wk streak" color="amber" />
      </div>
    </div>
  );
}

function StatTile({ value, unit, label, color }: { value: string; unit: string; label: string; color: "green" | "brand" | "violet" | "amber" }) {
  const tones: Record<typeof color, { bg: string; bd: string; tx: string }> = {
    green:  { bg: "var(--color-green-soft)",  bd: "rgba(31,138,112,.20)", tx: "var(--color-green)"  },
    brand:  { bg: "var(--color-brand-soft)",  bd: "rgba(31,138,112,.20)", tx: "var(--color-brand)"  },
    violet: { bg: "var(--color-violet-soft)", bd: "rgba(107,78,168,.20)", tx: "var(--color-violet)" },
    amber:  { bg: "var(--color-amber-soft)",  bd: "rgba(184,110,30,.20)", tx: "var(--color-amber)"  },
  };
  const t = tones[color];
  return (
    <div className="rounded-md px-4 py-3 text-center min-w-[78px] border" style={{ background: t.bg, borderColor: t.bd, color: t.tx }}>
      <div className="text-[22px] font-extrabold leading-none tracking-tight">
        {value}
        {unit && <span className="text-[12px] font-bold ml-0.5">{unit}</span>}
      </div>
      <div className="text-[10.5px] mt-1.5 font-semibold uppercase tracking-wider opacity-70">{label}</div>
    </div>
  );
}

function StatusPill({ status }: { status: Patient["status"] }) {
  switch (status) {
    case "active":       return <Pill intent="green">✓ Active</Pill>;
    case "unpaid":       return <Pill intent="amber">💳 Unpaid Intake</Pill>;
    case "disqualified": return <Pill intent="red">⚠ Disqualified</Pill>;
    case "in_progress":  return <Pill intent="blue">⏳ In Progress</Pill>;
    case "paused":
    case "inactive":     return <Pill intent="muted">Inactive</Pill>;
    case "churned":      return <Pill intent="muted">Churned</Pill>;
    case "pending":      return <Pill intent="amber">📋 Pending</Pill>;
    default:             return <Pill intent="muted">{status}</Pill>;
  }
}
