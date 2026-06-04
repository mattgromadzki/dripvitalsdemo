"use client";

import { useEffect, useState } from "react";

interface PendingIntake {
  id: string; name: string; email: string; phone?: string;
  progress?: string; startedAt: number; updatedAt?: number;
  completed: boolean; remindedAt: number | null;
}

function ago(ms: number) {
  const s = Math.max(0, Math.floor((Date.now() - ms) / 1000));
  if (s < 60) return "just now";
  const m = Math.floor(s / 60); if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60); if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24); return `${d}d ago`;
}

export function IntakeInProgressPanel() {
  const [pending, setPending] = useState<PendingIntake[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let alive = true;
    const load = async () => {
      try {
        const r = await fetch("/api/intake/pending", { cache: "no-store" });
        const d = await r.json();
        if (alive && d?.pending) setPending(d.pending);
      } catch { /* ignore */ }
      if (alive) setLoaded(true);
    };
    load();
    const t = setInterval(load, 12000);
    return () => { alive = false; clearInterval(t); };
  }, []);

  const active = pending
    .filter((p) => !p.completed)
    .sort((a, b) => (b.updatedAt || b.startedAt) - (a.updatedAt || a.startedAt));

  if (!loaded || active.length === 0) return null;

  return (
    <div className="mb-3.5 bg-surface border border-border rounded-xl overflow-hidden">
      <div className="px-4 py-2.5 border-b border-border flex items-center gap-2">
        <span className="text-[13px] font-bold">⏳ Intakes in progress</span>
        <span className="text-[11px] font-bold py-[1px] px-1.5 rounded-pill bg-amber-soft text-amber">{active.length}</span>
        <span className="text-[11px] text-ink-muted-2 ml-1">live across all devices</span>
      </div>
      <div className="divide-y divide-border">
        {active.map((p) => {
          const last = p.updatedAt || p.startedAt;
          const abandoned = Date.now() - last >= 24 * 60 * 60 * 1000;
          return (
            <div key={p.id} className="flex items-center gap-3 px-4 py-2.5 text-[12.5px]">
              <div className="min-w-0 flex-1">
                <div className="font-semibold truncate">{p.name || "Unnamed lead"}</div>
                <div className="text-[11px] text-ink-muted truncate">{p.email}{p.phone ? ` · ${p.phone}` : ""}</div>
              </div>
              <div className="text-[11.5px] text-ink-2 whitespace-nowrap">{p.progress || "Started"}</div>
              <div className="text-[11px] text-ink-muted whitespace-nowrap w-[64px] text-right">{ago(last)}</div>
              {abandoned
                ? <span className="text-[10px] font-bold py-[1px] px-1.5 rounded-pill bg-red-soft text-red whitespace-nowrap">Abandoned</span>
                : <span className="text-[10px] font-bold py-[1px] px-1.5 rounded-pill bg-amber-soft text-amber whitespace-nowrap">In progress</span>}
            </div>
          );
        })}
      </div>
    </div>
  );
}
