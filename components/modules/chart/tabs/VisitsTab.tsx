"use client";

import { Pill } from "@/components/ui/Pill";
import { toast } from "@/lib/hooks/useToast";
import { SectionCard } from "@/components/modules/chart/SectionCard";
import type { Patient, PatientExtra } from "@/lib/types";

export function VisitsTab({ patient, extra }: { patient: Patient; extra: PatientExtra }) {
  return (
    <div className="grid grid-cols-[1fr_1fr] gap-4 max-[1100px]:grid-cols-1">
      {/* LEFT: Scheduled visits */}
      <SectionCard
        title="Scheduled Visits"
        icon="📅"
        iconBg="var(--color-blue-soft)"
        iconColor="var(--color-blue)"
        action={
          <button className="btn btn-primary btn-sm" onClick={() => toast("📅 Schedule visit flow opened")}>
            + Schedule
          </button>
        }
      >
        {extra.scheduledVisits.length === 0 ? (
          <EmptyHint icon="📅" title="No visits scheduled" sub={`Click "+ Schedule" to book a visit with ${patient.provider}`} />
        ) : (
          <div className="-mx-5">
            {extra.scheduledVisits.map((v) => (
              <button
                key={v.id}
                onClick={() => toast(`📅 Opening visit ${v.id}`)}
                className="w-full flex items-center gap-3 py-3 px-5 border-b border-border last:border-none hover:bg-surface-2 transition-colors text-left"
              >
                <div
                  className="w-9 h-9 rounded-md flex items-center justify-center text-[14px] flex-shrink-0"
                  style={{
                    background: v.status === "urgent" ? "var(--color-red-soft)" : "var(--color-blue-soft)",
                    color: v.status === "urgent" ? "var(--color-red)" : "var(--color-blue)",
                  }}
                >
                  {v.status === "urgent" ? "⚠" : "🎥"}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-[13.5px] font-semibold text-ink">{v.type}</div>
                  <div className="text-[11.5px] text-ink-muted mt-0.5">
                    {v.time} &nbsp;·&nbsp; {v.provider}
                  </div>
                </div>
                <Pill intent={v.status === "urgent" ? "red" : v.status === "completed" ? "green" : "blue"} dot>
                  {v.status[0].toUpperCase() + v.status.slice(1)}
                </Pill>
              </button>
            ))}
          </div>
        )}
      </SectionCard>

      {/* Visit history beneath scheduled */}
      <div>
        <SectionCard
          title="SOAP Notes"
          icon="📝"
          iconBg="var(--color-green-soft)"
          iconColor="var(--color-green)"
          action={
            <button className="btn btn-primary btn-sm" onClick={() => toast("📝 New SOAP note draft started")}>
              + New Note
            </button>
          }
        >
          {extra.soapNotes.length === 0 ? (
            <EmptyHint icon="📝" title="No SOAP notes on file" sub="Click '+ New Note' to start a new clinical note" />
          ) : (
            <div className="-mx-5">
              {extra.soapNotes.map((n) => (
                <button
                  key={n.id}
                  onClick={() => toast(`📝 Opening note ${n.id}`)}
                  className="w-full flex items-center gap-3 py-3 px-5 border-b border-border last:border-none hover:bg-surface-2 transition-colors text-left"
                >
                  <div className="w-9 h-9 rounded-md flex items-center justify-center text-[14px] flex-shrink-0 bg-surface-3">
                    📝
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-[13.5px] font-semibold text-ink">{n.type}</div>
                    <div className="text-[11.5px] text-ink-muted mt-0.5">{n.date}</div>
                  </div>
                  <Pill intent={n.status === "signed" ? "green" : n.status === "draft" ? "muted" : "amber"}>
                    {n.status === "signed" ? "✓ Signed" : n.status[0].toUpperCase() + n.status.slice(1)}
                  </Pill>
                </button>
              ))}
            </div>
          )}
        </SectionCard>

        <SectionCard
          title="Visit History"
          icon="🩺"
          iconBg="var(--color-teal-soft)"
          iconColor="var(--color-teal)"
        >
          {extra.visits.length === 0 ? (
            <EmptyHint icon="🩺" title="No past visits" sub="Visit history will appear after the first completed visit" />
          ) : (
            <div className="-mx-5">
              {extra.visits.map((v, i) => (
                <div key={i} className="flex items-start gap-3 py-3 px-5 border-b border-border last:border-none">
                  <div className="text-[14px] mt-0.5">🗓</div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <div className="text-[13px] font-semibold text-ink">{v.type}</div>
                      <span className="text-[11px] text-ink-muted">·</span>
                      <div className="text-[11.5px] text-ink-muted">{v.duration} min</div>
                    </div>
                    <div className="text-[12px] text-ink-muted mt-0.5">{v.provider}</div>
                    <div className="text-[12px] text-ink-2 mt-1.5 leading-relaxed">{v.notes}</div>
                  </div>
                  <div className="text-[10.5px] font-mono text-ink-muted flex-shrink-0">{v.date}</div>
                </div>
              ))}
            </div>
          )}
        </SectionCard>
      </div>
    </div>
  );
}

function EmptyHint({ icon, title, sub }: { icon: string; title: string; sub: string }) {
  return (
    <div className="py-8 text-center text-ink-muted">
      <div className="text-[36px] opacity-40 mb-2">{icon}</div>
      <div className="text-[13px] font-bold mb-1 text-ink">{title}</div>
      <div className="text-[11.5px]">{sub}</div>
    </div>
  );
}
