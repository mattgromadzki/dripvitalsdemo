"use client";

import type { ReactNode } from "react";

import { Pill } from "@/components/ui/Pill";
import { SectionCard } from "@/components/modules/chart/SectionCard";
import type { Patient, PatientExtra } from "@/lib/types";

export function ProgressTab({ patient, extra }: { patient: Patient; extra: PatientExtra }) {
  const startW = patient.wtStart || patient.wt;
  const lostLbs = startW - patient.wt;
  const goalRem = extra.goalWt ? patient.wt - extra.goalWt : 0;
  const pct = extra.goalWt && startW > extra.goalWt
    ? Math.round((lostLbs / (startW - extra.goalWt)) * 100)
    : 0;

  return (
    <div className="grid grid-cols-[1fr_1fr] gap-4 max-[1100px]:grid-cols-1">
      {/* LEFT column */}
      <div>
        <SectionCard
          title="Weight Loss Progress"
          icon="📉"
          iconBg="var(--color-green-soft)"
          iconColor="var(--color-green)"
        >
          <WeightChart data={extra.weightLog} dates={extra.weightDates} goal={extra.goalWt} />

          <div className="grid grid-cols-2 gap-3 mt-4">
            <Stat label="Starting Weight" value={`${startW} lbs`} />
            <Stat label="Current Weight" value={`${patient.wt} lbs`} accent="green" />
            <Stat label="Lost So Far"    value={`−${lostLbs.toFixed(1)} lbs`} accent="green" big />
            <Stat label="Goal Weight"    value={extra.goalWt ? `${extra.goalWt} lbs` : "—"} accent="brand" />
            <Stat label="To Goal"        value={extra.goalWt ? `${goalRem.toFixed(1)} lbs remaining` : "—"} accent="amber" />
            <Stat label="BMI"            value={String(patient.bmi)} />
          </div>

          <div className="mt-4">
            <div className="flex justify-between items-center text-[12px] font-semibold mb-1.5">
              <span>Progress to Goal</span>
              <span className="text-brand">{pct}%</span>
            </div>
            <div className="h-2.5 bg-surface-3 rounded overflow-hidden">
              <div
                className="h-full transition-all duration-500 rounded"
                style={{
                  width: `${Math.min(pct, 100)}%`,
                  background: "linear-gradient(90deg, var(--color-brand), var(--color-green))",
                }}
              />
            </div>
          </div>
        </SectionCard>

        <SectionCard
          title="Side Effect Tracker"
          icon="⚠️"
          iconBg="var(--color-amber-soft)"
          iconColor="var(--color-amber)"
        >
          {extra.sideEffects.length === 0 ? (
            <div className="py-6 text-center text-[12.5px] text-ink-muted">
              <div className="text-[28px] opacity-40 mb-2">✓</div>
              No side effects reported
            </div>
          ) : (
            <div className="overflow-x-auto -mx-5">
              <table className="w-full border-collapse text-[12.5px]">
                <thead className="bg-surface-2">
                  <tr>
                    <Th>Date</Th>
                    <Th>Side Effect</Th>
                    <Th>Severity</Th>
                    <Th>Resolved</Th>
                  </tr>
                </thead>
                <tbody>
                  {extra.sideEffects.map((s, i) => (
                    <tr key={i} className="hover:bg-surface-2 transition-colors">
                      <Td><span className="font-mono text-[11px] text-ink-muted">{s.date}</span></Td>
                      <Td>{s.sx}</Td>
                      <Td>
                        <Pill intent={s.severity === "severe" ? "red" : s.severity === "moderate" ? "amber" : "muted"}>
                          {s.severity}
                        </Pill>
                      </Td>
                      <Td>
                        {s.resolved
                          ? <Pill intent="green">✓ Resolved</Pill>
                          : <Pill intent="red">Ongoing</Pill>}
                      </Td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </SectionCard>
      </div>

      {/* RIGHT column */}
      <div>
        <SectionCard
          title="Milestones & Streaks"
          icon="🏆"
          iconBg="var(--color-blue-soft)"
          iconColor="var(--color-blue)"
        >
          <div className="text-center py-4">
            <div className="text-[42px] mb-1">🔥</div>
            <div className="text-[28px] font-extrabold text-amber tracking-tight leading-none">{extra.streakWeeks} Week</div>
            <div className="text-[13px] text-ink-muted mt-1">Injection Streak</div>
          </div>
          <div className="flex flex-col gap-2 mt-2">
            {extra.milestones.length === 0 ? (
              <div className="text-center text-ink-muted py-3 text-[12px]">
                No milestones yet — keep going!
              </div>
            ) : (
              extra.milestones.map((m) => (
                <div
                  key={m}
                  className="flex items-center gap-2.5 bg-green-soft border border-green-soft rounded-md px-3.5 py-2.5"
                  style={{ borderColor: "rgba(31,138,112,.2)" }}
                >
                  <span className="text-[18px]">🥇</span>
                  <span className="text-[13px] font-bold text-green">{m}</span>
                </div>
              ))
            )}
          </div>
        </SectionCard>

        <SectionCard
          title="Weekly Check-ins"
          icon="📋"
          iconBg="var(--color-violet-soft)"
          iconColor="var(--color-violet)"
        >
          {extra.weeklyCheckins.length === 0 ? (
            <div className="py-6 text-center text-[12.5px] text-ink-muted">No check-ins yet</div>
          ) : (
            <div className="overflow-x-auto -mx-5">
              <table className="w-full border-collapse text-[12.5px]">
                <thead className="bg-surface-2">
                  <tr>
                    <Th>Week</Th>
                    <Th>Nausea</Th>
                    <Th>Energy</Th>
                    <Th>Appetite</Th>
                    <Th>Mood</Th>
                    <Th>Adherent</Th>
                  </tr>
                </thead>
                <tbody>
                  {extra.weeklyCheckins.map((c) => (
                    <tr key={c.week} className="hover:bg-surface-2 transition-colors">
                      <Td><span className="font-semibold">{c.week}</span></Td>
                      <Td><RatingBar val={c.nausea}   max={5} color="var(--color-red)" /></Td>
                      <Td><RatingBar val={c.energy}   max={5} color="var(--color-green)" /></Td>
                      <Td><RatingBar val={c.appetite} max={5} color="var(--color-brand)" /></Td>
                      <Td><RatingBar val={c.mood}     max={5} color="var(--color-violet)" /></Td>
                      <Td>
                        {c.adherence
                          ? <Pill intent="green">✓ Yes</Pill>
                          : <Pill intent="red">Missed</Pill>}
                      </Td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </SectionCard>
      </div>
    </div>
  );
}

function Stat({ label, value, accent, big }: { label: string; value: string; accent?: "green" | "brand" | "amber"; big?: boolean }) {
  const color = accent === "green" ? "var(--color-green)"
              : accent === "brand" ? "var(--color-brand)"
              : accent === "amber" ? "var(--color-amber)"
              : "var(--color-ink)";
  return (
    <div className="bg-surface-2 border border-border rounded-[10px] px-4 py-3">
      <div className="text-[10.5px] font-bold uppercase tracking-widest text-ink-muted mb-1">{label}</div>
      <div className={`font-semibold ${big ? "text-[18px] font-extrabold" : "text-[14px]"}`} style={{ color }}>
        {value}
      </div>
    </div>
  );
}

function RatingBar({ val, max, color }: { val: number; max: number; color: string }) {
  const pct = Math.round((val / max) * 100);
  return (
    <div className="flex items-center gap-1.5">
      <div className="w-[50px] h-1.5 bg-surface-3 rounded overflow-hidden">
        <div className="h-full rounded" style={{ width: `${pct}%`, background: color }} />
      </div>
      <span className="text-[11px] font-semibold text-ink-muted">{val}/{max}</span>
    </div>
  );
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

// ─── Weight Chart (SVG) ────────────────────────────────────────────────────
interface WeightChartProps {
  data: number[];
  dates: string[];
  goal?: number;
}

function WeightChart({ data, dates, goal }: WeightChartProps) {
  if (!data || data.length < 2) {
    return <div className="h-[180px] flex items-center justify-center text-ink-muted text-[12px]">Need at least 2 data points to draw chart</div>;
  }

  const W = 520;
  const H = 180;
  const pad = { t: 16, r: 16, b: 32, l: 42 };

  // Account for goal in y-range so the dashed line fits visibly
  const valsForBounds = goal ? [...data, goal] : data;
  const minV = Math.min(...valsForBounds) - 3;
  const maxV = Math.max(...valsForBounds) + 3;
  const range = maxV - minV;

  const innerW = W - pad.l - pad.r;
  const innerH = H - pad.t - pad.b;
  const xStep = innerW / (data.length - 1);

  function xOf(i: number) { return pad.l + i * xStep; }
  function yOf(v: number) { return H - pad.b - ((v - minV) / range) * innerH; }

  // Grid lines (4 horizontal)
  const gridLines: { y: number; label: number }[] = [];
  for (let i = 0; i <= 4; i++) {
    const y = pad.t + innerH * (i / 4);
    const label = Math.round(maxV - range * (i / 4));
    gridLines.push({ y, label });
  }

  // Path for the area + stroke
  let linePath = `M ${xOf(0)} ${yOf(data[0])}`;
  for (let i = 1; i < data.length; i++) {
    linePath += ` L ${xOf(i)} ${yOf(data[i])}`;
  }
  const areaPath = linePath + ` L ${xOf(data.length - 1)} ${H - pad.b} L ${xOf(0)} ${H - pad.b} Z`;

  // X label sampling — show every Nth label so they don't crowd
  const labelStep = Math.max(1, Math.floor(data.length / 6));

  return (
    <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="xMidYMid meet" width="100%" height="180" style={{ display: "block" }}>
      <defs>
        <linearGradient id="wt-grad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%"   stopColor="rgba(10,122,78,.18)" />
          <stop offset="100%" stopColor="rgba(10,122,78,.00)" />
        </linearGradient>
      </defs>

      {/* Grid lines */}
      {gridLines.map(({ y, label }) => (
        <g key={label}>
          <line x1={pad.l} y1={y} x2={W - pad.r} y2={y} stroke="#e4e9f4" strokeWidth="1" />
          <text x={pad.l - 5} y={y + 3} fontSize="10" fill="#8a96a8" textAnchor="end" fontFamily="var(--font-inter), sans-serif">
            {label}
          </text>
        </g>
      ))}

      {/* Goal line (dashed) */}
      {goal && yOf(goal) > pad.t && yOf(goal) < H - pad.b && (
        <g>
          <line
            x1={pad.l}
            y1={yOf(goal)}
            x2={W - pad.r}
            y2={yOf(goal)}
            stroke="var(--color-brand)"
            strokeWidth="1.5"
            strokeDasharray="5 4"
          />
          <text
            x={W - pad.r - 4}
            y={yOf(goal) - 4}
            fontSize="10"
            fill="var(--color-brand)"
            textAnchor="end"
            fontFamily="var(--font-inter), sans-serif"
          >
            Goal: {goal} lbs
          </text>
        </g>
      )}

      {/* Area fill */}
      <path d={areaPath} fill="url(#wt-grad)" />

      {/* Line */}
      <path d={linePath} fill="none" stroke="var(--color-green)" strokeWidth="2.5" strokeLinejoin="round" />

      {/* Dots */}
      {data.map((v, i) => (
        <circle key={i} cx={xOf(i)} cy={yOf(v)} r="4" fill="#fff" stroke="var(--color-green)" strokeWidth="2" />
      ))}

      {/* X labels */}
      {dates.map((d, i) => (
        (i % labelStep === 0) ? (
          <text
            key={i}
            x={xOf(i)}
            y={H - pad.b + 14}
            fontSize="9"
            fill="#8a96a8"
            textAnchor="middle"
            fontFamily="var(--font-inter), sans-serif"
          >
            {d}
          </text>
        ) : null
      ))}
    </svg>
  );
}
