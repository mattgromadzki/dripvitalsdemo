"use client";

import { useMemo, useState } from "react";
import { Pill } from "@/components/ui/Pill";
import { Toast } from "@/components/ui/Toast";
import { toast } from "@/lib/hooks/useToast";
import { useLeads, STAGES, type Lead, type LeadStage } from "@/lib/hooks/useLeads";

const AV = ["#2f6df6", "#0e9f6e", "#7c3aed", "#f59e0b", "#ef4444", "#0ea5e9", "#db2777", "#14b8a6"];
function avatar(name: string) { let h = 0; for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) >>> 0; return { initial: (name.trim()[0] || "?").toUpperCase(), color: AV[h % AV.length] }; }
const STAGE_ACCENT: Record<LeadStage, string> = { new: "#0ea5e9", contacted: "#7c3aed", consult: "#f59e0b", converted: "#0e9f6e", lost: "#94a3b8" };

export default function PipelinePage() {
  const leads = useLeads((s) => s.leads);
  const setStage = useLeads((s) => s.setStage);
  const [search, setSearch] = useState("");
  const [dragId, setDragId] = useState<string | null>(null);
  const [overStage, setOverStage] = useState<LeadStage | null>(null);

  const filtered = useMemo(() => leads.filter((l) => !search || l.name.toLowerCase().includes(search.toLowerCase()) || l.phone.includes(search) || (l.source || "").toLowerCase().includes(search.toLowerCase())), [leads, search]);
  const byStage = (st: LeadStage) => filtered.filter((l) => (l.stage || "new") === st);

  const total = leads.length;
  const inPipe = leads.filter((l) => ["new", "contacted", "consult"].includes(l.stage || "new")).length;
  const converted = leads.filter((l) => l.stage === "converted").length;
  const convRate = total ? Math.round((converted / total) * 100) : 0;

  function drop(st: LeadStage) { if (dragId) { setStage(dragId, st); toast(`Moved to ${STAGES.find((s) => s.key === st)?.label}`); } setDragId(null); setOverStage(null); }

  const KPI = ({ label, value, intent }: { label: string; value: string; intent?: string }) => <div className="bg-surface border border-border rounded-2xl px-4 py-3 min-w-[130px]"><div className={`text-[22px] font-extrabold leading-none ${intent || ""}`}>{value}</div><div className="text-[11px] text-ink-muted mt-1.5">{label}</div></div>;

  function Card({ l }: { l: Lead }) {
    const av = avatar(l.name); const stage = l.stage || "new";
    return (
      <div draggable onDragStart={() => setDragId(l.id)} onDragEnd={() => { setDragId(null); setOverStage(null); }}
        className={`bg-surface border border-border rounded-lg p-2.5 mb-2 cursor-grab active:cursor-grabbing ${dragId === l.id ? "opacity-50" : ""}`}>
        <div className="flex items-center gap-2 mb-1.5">
          <div className="w-7 h-7 rounded-full flex items-center justify-center text-white text-[11px] font-bold shrink-0" style={{ background: av.color }}>{av.initial}</div>
          <div className="flex-1 min-w-0"><div className="text-[12.5px] font-semibold truncate">{l.name}</div><div className="text-[10.5px] text-ink-muted truncate">{l.phone}</div></div>
          {l.tag && <Pill intent={l.tag === "Hot" ? "red" : l.tag === "Warm" ? "amber" : "muted"}>{l.tag}</Pill>}
        </div>
        {l.source && <div className="text-[10.5px] text-ink-muted mb-1.5">via {l.source}</div>}
        <select className="fsel w-full text-[11px] py-1" value={stage} onChange={(e) => setStage(l.id, e.target.value as LeadStage)}>
          {STAGES.map((s) => <option key={s.key} value={s.key}>{s.label}</option>)}
        </select>
      </div>
    );
  }

  return (
    <div className="px-7 py-6 text-[14px]">
      <div className="flex items-center gap-3 mb-4 flex-wrap">
        <div><h1 className="text-[21px] font-extrabold tracking-tight">Lead Pipeline</h1><div className="text-[12px] text-ink-muted mt-0.5">Drag leads across stages · CRM for cold leads</div></div>
        <div className="flex-1" />
        <div className="flex items-center gap-2 bg-surface border border-border rounded-lg px-2.5 py-1.5"><span className="text-ink-muted text-[13px]">🔍</span><input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search leads" className="bg-transparent outline-none text-[12.5px] w-[180px]" /></div>
      </div>

      <div className="flex flex-wrap gap-2.5 mb-4">
        <KPI label="Total leads" value={String(total)} />
        <KPI label="In pipeline" value={String(inPipe)} intent="text-blue" />
        <KPI label="Converted" value={String(converted)} intent="text-green" />
        <KPI label="Conversion rate" value={`${convRate}%`} />
      </div>

      <div className="grid gap-3" style={{ gridTemplateColumns: "repeat(5, minmax(180px, 1fr))" }}>
        {STAGES.map((st) => {
          const items = byStage(st.key);
          return (
            <div key={st.key} onDragOver={(e) => { e.preventDefault(); setOverStage(st.key); }} onDragLeave={() => setOverStage((s) => s === st.key ? null : s)} onDrop={() => drop(st.key)}
              className={`rounded-xl border ${overStage === st.key ? "border-brand bg-brand-soft/40" : "border-border bg-surface-2/40"} p-2 min-h-[300px]`}>
              <div className="flex items-center gap-2 px-1 py-1.5 mb-1">
                <span className="w-2 h-2 rounded-full" style={{ background: STAGE_ACCENT[st.key] }} />
                <span className="font-bold text-[12.5px]">{st.label}</span>
                <span className="text-[11px] text-ink-muted">{items.length}</span>
              </div>
              {items.map((l) => <Card key={l.id} l={l} />)}
              {items.length === 0 && <div className="text-[11px] text-ink-muted-2 text-center py-6">Drop here</div>}
            </div>
          );
        })}
      </div>
      <div className="text-[11px] text-ink-muted-2 mt-3">Drag a card between columns, or use the dropdown on each card. Leads are shared with the SMS Contacts &amp; Campaigns tools.</div>
      <Toast />
    </div>
  );
}
