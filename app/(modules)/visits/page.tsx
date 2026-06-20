"use client";

import { useEffect, useMemo, useState, useCallback } from "react";
import Link from "next/link";
import { Pill } from "@/components/ui/Pill";

interface Visit {
  id: string; status: "started" | "unpaid" | "paid";
  startedAt: number; startedDisplay: string; paidAt?: number; paidDisplay?: string;
  patientId?: string; patientName?: string; email?: string; phone?: string;
  treatmentId?: string; treatmentName?: string; price?: number;
  intakeFormId?: string; intakeFormName?: string;
  shippingAddress?: { street?: string; line2?: string; city?: string; state?: string; zip?: string };
  updatedAt: number;
}

const TABS = [
  { key: "all", label: "All" },
  { key: "started", label: "Started / Unpaid" },
  { key: "paid", label: "Paid" },
];

export default function VisitsPage() {
  const [visits, setVisits] = useState<Visit[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState("all");
  const [search, setSearch] = useState("");

  const load = useCallback(async () => {
    try {
      const r = await fetch("/api/visits", { cache: "no-store" });
      const j = await r.json();
      if (j?.ok && Array.isArray(j.visits)) setVisits(j.visits);
    } catch { /* ignore */ }
    setLoading(false);
  }, []);
  useEffect(() => { load(); const t = setInterval(load, 20000); return () => clearInterval(t); }, [load]);

  const counts = useMemo(() => ({
    all: visits.length,
    started: visits.filter((v) => v.status !== "paid").length,
    paid: visits.filter((v) => v.status === "paid").length,
  }), [visits]);

  const filtered = useMemo(() => {
    let list = visits;
    if (tab === "started") list = list.filter((v) => v.status !== "paid");
    else if (tab === "paid") list = list.filter((v) => v.status === "paid");
    const q = search.trim().toLowerCase();
    if (q) list = list.filter((v) =>
      (v.patientName || "").toLowerCase().includes(q) ||
      (v.treatmentName || "").toLowerCase().includes(q) ||
      (v.email || "").toLowerCase().includes(q) ||
      v.id.toLowerCase().includes(q));
    return list;
  }, [visits, tab, search]);

  const del = useCallback(async (id: string) => {
    if (!window.confirm("Delete this visit from the EMR?\n\nThis permanently removes the intake record.")) return;
    try { await fetch(`/api/visits?id=${encodeURIComponent(id)}`, { method: "DELETE" }); } catch { /* ignore */ }
    load();
  }, [load]);

  return (
    <div className="px-5 py-5 text-[14px]">
      <div className="flex items-start gap-3.5 mb-4 flex-wrap">
        <div>
          <h1 className="text-[23px] font-extrabold tracking-tight">Visits</h1>
          <div className="text-[12.5px] text-ink-muted mt-1 max-w-[700px]">A visit begins the moment a patient starts an intake form — timestamped in Eastern Time. One intake = one visit (two treatments = two visits). The visit records the treatment selected and flips to Paid when the patient pays. Unpaid visits can be deleted.</div>
        </div>
        <div className="flex-1" />
        <button className="btn btn-ghost btn-sm" onClick={load}>Refresh</button>
      </div>

      <div className="grid grid-cols-3 gap-2.5 mb-4">
        {[
          { label: "Total visits", value: counts.all, color: "text-ink" },
          { label: "Started / Unpaid", value: counts.started, color: "text-amber" },
          { label: "Paid", value: counts.paid, color: "text-green" },
        ].map((k) => (
          <div key={k.label} className="bg-surface border border-border rounded-2xl px-4 py-3">
            <div className="text-[10px] font-bold uppercase tracking-wide text-ink-muted">{k.label}</div>
            <div className={`text-[26px] font-extrabold tracking-tight leading-none mt-1 ${k.color}`}>{k.value}</div>
          </div>
        ))}
      </div>

      <div className="flex items-center gap-2 mb-3 flex-wrap">
        <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search by patient, treatment, email, visit #…" className="bg-surface border border-border rounded-pill px-4 py-2 text-[12.5px] outline-none min-w-[280px] flex-1 max-w-[420px]" />
        <div className="flex gap-1.5">
          {TABS.map((t) => (
            <button key={t.key} onClick={() => setTab(t.key)} className={`btn btn-sm ${tab === t.key ? "btn-primary" : "btn-ghost"}`}>
              {t.label} {t.key === "all" ? counts.all : t.key === "started" ? counts.started : counts.paid}
            </button>
          ))}
        </div>
      </div>

      <div className="bg-surface border border-border rounded-2xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="border-collapse w-full min-w-[940px] text-[12.5px]">
            <thead>
              <tr className="bg-surface-2">
                {["Visit", "Time (ET)", "Patient", "Treatment", "Intake form", "Status", "Total", "Actions"].map((h) => (
                  <th key={h} className={`text-[10px] uppercase tracking-wide text-ink-muted font-bold text-left px-3 py-2.5 border-b border-border whitespace-nowrap ${h === "Total" ? "text-right" : ""}`}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((v) => {
                const paid = v.status === "paid";
                const when = paid ? (v.paidDisplay || v.startedDisplay) : v.startedDisplay;
                return (
                  <tr key={v.id} className="border-b border-border last:border-none hover:bg-surface-2">
                    <td className="px-3 py-2.5 font-mono text-[11.5px] text-ink-muted whitespace-nowrap">{v.id}</td>
                    <td className="px-3 py-2.5 whitespace-nowrap">
                      {when}
                      <span className="text-[10px] text-ink-muted ml-1">({paid ? "paid" : "started"})</span>
                    </td>
                    <td className="px-3 py-2.5">
                      <div className="font-semibold">{v.patientName || "—"}</div>
                      {v.email ? <div className="text-[11px] text-ink-muted">{v.email}</div> : null}
                    </td>
                    <td className="px-3 py-2.5">{v.treatmentName || <span className="text-ink-muted-2">Not selected</span>}</td>
                    <td className="px-3 py-2.5">{v.intakeFormName || "—"}</td>
                    <td className="px-3 py-2.5"><Pill intent={paid ? "green" : "amber"} dot>{paid ? "Paid · intake complete" : "Started · unpaid"}</Pill></td>
                    <td className="px-3 py-2.5 text-right font-semibold">{v.price != null ? `$${v.price}` : "—"}</td>
                    <td className="px-3 py-2.5 whitespace-nowrap">
                      <div className="flex gap-1.5 justify-end">
                        {v.patientId ? <Link href={`/patients/${v.patientId}`} className="btn btn-ghost btn-xs">Chart →</Link> : null}
                        <button className="btn btn-ghost btn-xs btn-danger" onClick={() => del(v.id)}>Delete</button>
                      </div>
                    </td>
                  </tr>
                );
              })}
              {filtered.length === 0 && (
                <tr><td colSpan={8} className="px-3 py-12 text-center text-ink-muted">{loading ? "Loading visits…" : "No visits yet. A visit appears as soon as a patient starts an intake form."}</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
