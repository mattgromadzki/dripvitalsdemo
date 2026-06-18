"use client";

import { useRouter } from "next/navigation";
import { Pill } from "@/components/ui/Pill";
import { SectionCard } from "@/components/modules/chart/SectionCard";
import { useSoapNotes } from "@/lib/hooks/useSoapNotes";
import { useClinical } from "@/lib/hooks/useClinical";
import { seedChart } from "@/lib/clinical/chartTypes";
import { prefillSections } from "@/lib/clinical/soapPrefill";
import type { Patient, PatientExtra } from "@/lib/types";

// Notes tab. Visit scheduling was removed — in this async-care model the intake
// submission is the encounter — so this surfaces SOAP notes / clinical documentation only.
export function VisitsTab({ patient }: { patient: Patient; extra: PatientExtra }) {
  const router = useRouter();
  const notes = useSoapNotes((s) => s.notes);
  const addNote = useSoapNotes((s) => s.add);
  const patientNotes = notes
    .filter((n) => n.patientId === patient.id)
    .sort((a, b) => b.dateOrdered - a.dateOrdered);

  function handleNewNote() {
    const today = new Date();
    const months = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
    const dateStr = `${months[today.getMonth()]} ${today.getDate()}, ${today.getFullYear()}`;
    const dateOrdered = parseInt(`${today.getFullYear()}${String(today.getMonth() + 1).padStart(2, "0")}${String(today.getDate()).padStart(2, "0")}`, 10);
    const chart = useClinical.getState().charts[patient.id] ?? seedChart(patient);
    const pre = prefillSections(chart);
    const created = addNote({
      patientName: patient.name,
      patientId: patient.id,
      date: dateStr,
      dateOrdered,
      type: "GLP-1 Check-in",
      status: "draft",
      provider: patient.provider || "Dr. Tancinco",
      s: "", o: pre.o, a: pre.a, p: pre.p,
    });
    router.push(`/soap?note=${created.id}`);
  }

  return (
    <SectionCard
      title="SOAP Notes"
      icon="📝"
      iconBg="var(--color-green-soft)"
      iconColor="var(--color-green)"
      action={
        <button className="btn btn-primary btn-sm" onClick={handleNewNote}>
          + New Note
        </button>
      }
    >
      {patientNotes.length === 0 ? (
        <EmptyHint icon="📝" title="No SOAP notes on file" sub="Click '+ New Note' to start a note prefilled from the problem & med lists" />
      ) : (
        <div className="-mx-5">
          {patientNotes.map((n) => (
            <button
              key={n.id}
              onClick={() => router.push(`/soap?note=${n.id}`)}
              className="w-full flex items-center gap-3 py-3 px-5 border-b border-border last:border-none hover:bg-surface-2 transition-colors text-left"
            >
              <div className="w-9 h-9 rounded-md flex items-center justify-center text-[14px] flex-shrink-0 bg-surface-3">
                📝
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-[13.5px] font-semibold text-ink">{n.type}</div>
                <div className="text-[11.5px] text-ink-muted mt-0.5">{n.date} · {n.provider}</div>
              </div>
              <Pill intent={n.status === "signed" ? "green" : n.status === "draft" ? "muted" : "amber"}>
                {n.status === "signed" ? "✓ Signed" : n.status[0].toUpperCase() + n.status.slice(1)}
              </Pill>
            </button>
          ))}
        </div>
      )}
    </SectionCard>
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
