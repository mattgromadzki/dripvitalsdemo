"use client";

import { useMemo, useState } from "react";
import { Pill } from "@/components/ui/Pill";
import { Toast } from "@/components/ui/Toast";
import { toast } from "@/lib/hooks/useToast";
import { useMedications } from "@/lib/hooks/useMedications";
import { MED_PROGRAM_INTENT, MED_PROGRAMS } from "@/lib/data/medications";
import { usePharmacies } from "@/lib/hooks/usePharmacies";
import { MedicationModal, type MedDraft } from "@/components/modules/medications/MedicationModal";
import type { Medication } from "@/lib/types";

const money = (n: number) => "$" + (Math.round(n * 100) / 100).toLocaleString("en-US");

export default function MedicationsPage() {
  const meds = useMedications((s) => s.meds);
  const add = useMedications((s) => s.add);
  const update = useMedications((s) => s.update);
  const remove = useMedications((s) => s.remove);
  const pharmaciesAll = usePharmacies((s) => s.pharmacies);
  const realPharmacies = pharmaciesAll.map((p) => p.name);
  const pharmacyFilterOpts = Array.from(new Set([...realPharmacies, ...meds.map((m) => m.pharmacy)]));

  const [search, setSearch] = useState("");
  const [programF, setProgramF] = useState("");
  const [pharmacyF, setPharmacyF] = useState("");
  const [statusF, setStatusF] = useState<"" | "active" | "discontinued">("");
  const [sortBy, setSortBy] = useState("units");
  const [modalOpen, setModalOpen] = useState(false);
  const [editMed, setEditMed] = useState<Medication | undefined>(undefined);

  const counts = useMemo(() => ({
    total: meds.length,
    active: meds.filter((m) => m.status === "active").length,
    disc: meds.filter((m) => m.status === "discontinued").length,
    units: meds.reduce((a, m) => a + m.sent, 0),
    avg: meds.length ? meds.reduce((a, m) => a + m.cost + m.ship, 0) / meds.length : 0,
    pharm: new Set(meds.map((m) => m.pharmacy)).size,
  }), [meds]);

  const KPIS: { label: string; value: string; status?: "active" | "discontinued"; clickable?: boolean }[] = [
    { label: "Total Medications", value: String(counts.total), clickable: true },
    { label: "Active", value: String(counts.active), status: "active", clickable: true },
    { label: "Discontinued", value: String(counts.disc), status: "discontinued", clickable: true },
    { label: "Units Sent Out", value: counts.units.toLocaleString("en-US") },
    { label: "Avg Cost", value: money(counts.avg) },
    { label: "Pharmacies", value: String(counts.pharm) },
  ];

  const filtered = useMemo(() => {
    let L = meds.filter((m) => {
      if (programF && m.program !== programF) return false;
      if (pharmacyF && m.pharmacy !== pharmacyF) return false;
      if (statusF && m.status !== statusF) return false;
      if (search) {
        const q = search.toLowerCase();
        if (!(m.name.toLowerCase().includes(q) || m.pharmacy.toLowerCase().includes(q))) return false;
      }
      return true;
    });
    if (sortBy === "units") L = [...L].sort((a, b) => b.sent - a.sent);
    else if (sortBy === "cost") L = [...L].sort((a, b) => (b.cost + b.ship) - (a.cost + a.ship));
    else if (sortBy === "name") L = [...L].sort((a, b) => a.name.localeCompare(b.name) || a.strength.localeCompare(b.strength));
    return L;
  }, [meds, programF, pharmacyF, statusF, search, sortBy]);

  const sel = "text-[12px] font-semibold text-ink-2 bg-surface border border-border rounded-[9px] px-3 py-2 cursor-pointer";

  function onSave(data: MedDraft) {
    if (editMed) { update(editMed.id, data); toast("💾 Medication updated"); }
    else { add({ ...data, sent: 0 }); toast("✅ Medication added"); }
  }

  return (
    <div className="px-7 py-6 text-[14px]">
      <div className="flex items-center gap-3.5 mb-4 flex-wrap">
        <div>
          <h1 className="text-[21px] font-extrabold tracking-tight">Medications</h1>
          <div className="text-[12px] text-ink-muted mt-0.5">Catalog &amp; pharmacy cost ledger · what each compounding pharmacy charges you, and how much you've dispensed</div>
        </div>
        <div className="flex-1" />
        <button className="btn btn-ghost btn-sm" onClick={() => toast("⬇ Exporting…")}>⬇ Export</button>
        <button className="btn btn-primary btn-sm" onClick={() => { setEditMed(undefined); setModalOpen(true); }}>+ Add medication</button>
      </div>

      {/* KPIs */}
      <div className="flex flex-wrap justify-between gap-2.5 mb-3.5">
        {KPIS.map((k) => {
          const on = k.clickable && (k.status ? statusF === k.status : statusF === "");
          return (
            <button key={k.label} disabled={!k.clickable}
              onClick={() => k.clickable && setStatusF(k.status ?? "")}
              className={`bg-surface border rounded-2xl px-4 py-3 text-left transition-shadow hover:shadow-md ${on ? "border-brand ring-2 ring-brand-soft" : "border-border"} ${k.clickable ? "" : "cursor-default"}`}>
              <div className="text-[22px] font-extrabold tracking-tight leading-none">{k.value}</div>
              <div className="text-[11px] text-ink-muted mt-1.5 whitespace-nowrap">{k.label}</div>
            </button>
          );
        })}
      </div>

      {/* Toolbar */}
      <div className="flex items-center gap-2 flex-wrap bg-surface border border-border rounded-xl p-2.5 mb-3">
        <div className="flex-1 min-w-[220px] flex items-center gap-2 bg-surface-2 border border-border rounded-[9px] px-3 py-2">
          <span className="text-ink-muted">🔍</span>
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search medication or pharmacy…" className="bg-transparent outline-none text-[12.5px] w-full" />
        </div>
        <select className={sel} value={programF} onChange={(e) => setProgramF(e.target.value)}>
          <option value="">Program</option>{MED_PROGRAMS.map((p) => <option key={p} value={p}>{p}</option>)}
        </select>
        <select className={sel} value={pharmacyF} onChange={(e) => setPharmacyF(e.target.value)}>
          <option value="">Pharmacy</option>{pharmacyFilterOpts.map((p) => <option key={p} value={p}>{p}</option>)}
        </select>
        <select className={sel} value={statusF} onChange={(e) => setStatusF(e.target.value as "" | "active" | "discontinued")}>
          <option value="">Status</option><option value="active">Active</option><option value="discontinued">Discontinued</option>
        </select>
        <select className={sel} value={sortBy} onChange={(e) => setSortBy(e.target.value)}>
          <option value="units">Sort: Units sent</option><option value="cost">Cost</option><option value="name">Name A–Z</option>
        </select>
      </div>

      {/* Table */}
      <div className="bg-surface border border-border rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="border-collapse w-full min-w-[1040px]">
            <thead><tr className="bg-surface-2">
              {["Medication", "Program", "Form", "Pharmacy", "Unit", "Cost", "Sent Out", "Status", ""].map((h, i) => (
                <th key={i} className={`text-[10px] uppercase tracking-wide text-ink-muted font-bold px-3 py-2.5 border-b border-border whitespace-nowrap ${h === "Cost" || h === "Sent Out" ? "text-right" : "text-left"}`}>{h}</th>
              ))}
            </tr></thead>
            <tbody>
              {filtered.map((m) => (
                <tr key={m.id} className="border-b border-border last:border-none hover:bg-surface-2">
                  <td className="px-3 py-2.5"><div className="font-bold whitespace-nowrap">{m.name}</div><div className="text-ink-muted text-[11px]">{m.strength}</div></td>
                  <td className="px-3 py-2.5"><Pill intent={MED_PROGRAM_INTENT[m.program] ?? "muted"}>{m.program}</Pill></td>
                  <td className="px-3 py-2.5 whitespace-nowrap">{m.form}</td>
                  <td className="px-3 py-2.5 whitespace-nowrap">{m.pharmacy}</td>
                  <td className="px-3 py-2.5 text-ink-muted text-[11px] whitespace-nowrap">{m.unit}</td>
                  <td className="px-3 py-2.5 text-right font-bold whitespace-nowrap">{money(m.cost + m.ship)}</td>
                  <td className="px-3 py-2.5 text-right whitespace-nowrap">{m.sent.toLocaleString("en-US")}</td>
                  <td className="px-3 py-2.5"><Pill intent={m.status === "active" ? "green" : "red"} dot>{m.status === "active" ? "Active" : "Discontinued"}</Pill></td>
                  <td className="px-3 py-2.5 text-right">
                    <div className="flex items-center justify-end gap-1.5">
                      <button className="text-[11.5px] font-semibold text-brand-dk border border-border rounded-[7px] px-2.5 py-1 hover:bg-brand-soft hover:border-brand" onClick={() => { setEditMed(m); setModalOpen(true); }}>Edit</button>
                      <button className="text-[11.5px] font-semibold text-red border border-border rounded-[7px] px-2.5 py-1 hover:bg-red-soft hover:border-red" onClick={() => { if (window.confirm(`Delete "${m.name}${m.strength ? " " + m.strength : ""}"? This removes it from the catalog and can't be undone.`)) { remove(m.id); toast("🗑 Medication deleted"); } }}>Delete</button>
                    </div>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && <tr><td colSpan={9} className="px-3 py-10 text-center text-ink-muted text-[12px]">No medications match these filters.</td></tr>}
            </tbody>
          </table>
        </div>
        <div className="flex items-center px-4 py-2.5 border-t border-border text-[12px] text-ink-muted">
          Showing <b className="text-ink-2 mx-1">{filtered.length}</b> of <b className="text-ink-2 mx-1">{meds.length}</b> medications
        </div>
      </div>

      <MedicationModal open={modalOpen} onClose={() => setModalOpen(false)} med={editMed} onSave={onSave} />
      <Toast />
    </div>
  );
}
