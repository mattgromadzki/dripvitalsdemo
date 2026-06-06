"use client";

import { useMemo, useState } from "react";
import { Pill } from "@/components/ui/Pill";
import { Modal } from "@/components/ui/Modal";
import { Toast } from "@/components/ui/Toast";
import { toast } from "@/lib/hooks/useToast";
import { useRouter } from "next/navigation";
import { usePatients } from "@/lib/hooks/usePatients";
import { ALL_STATES, type Provider } from "@/lib/hooks/useProviders";
import { useDoctors, getLicenseStatus, formatLicenseExp } from "@/lib/hooks/useDoctors";
import { usePermission } from "@/lib/rbac/usePermission";
import type { Doctor, DoctorStateLicense } from "@/lib/types";

export default function LicensurePage() {
  const router = useRouter();
  const patients = usePatients((s) => s.patients);
  const doctors = useDoctors((s) => s.doctors);
  const updateDoctor = useDoctors((s) => s.update);
  const setLicenses = useDoctors((s) => s.setLicenses);

  // Providers here ARE the in-house doctors (managed on the Staff page), each
  // covering the states where they hold a non-expired license.
  const providers: Provider[] = useMemo(() => doctors.map((d) => ({
    id: d.id,
    name: `${d.first} ${d.last}${d.title ? ", " + d.title : ""}`.trim(),
    npi: d.npi || "—",
    active: d.active,
    states: d.licenses.filter((l) => getLicenseStatus(l).key !== "expired").map((l) => l.state),
  })), [doctors]);

  function toggleActive(id: string) { const d = doctors.find((x) => x.id === id); if (d) updateDoctor(id, { active: !d.active }); }

  const canRemind = usePermission("settings.manage");
  async function sendReminder(d: Doctor, lic: DoctorStateLicense) {
    const s = getLicenseStatus(lic);
    try {
      const res = await fetch("/api/license-reminder", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ to: d.email, toName: `${d.first} ${d.last}`.trim(), state: lic.state, license: lic.number, expDate: formatLicenseExp(lic.expDate), days: s.daysUntil ?? "" }) });
      const j = await res.json().catch(() => ({ ok: false }));
      toast(j.ok ? `🔔 Renewal reminder sent to ${d.first}` : `⚠️ ${j.error || "Couldn't send reminder"}`);
    } catch { toast("⚠️ Couldn't send reminder"); }
  }

  const [tab, setTab] = useState<"coverage" | "providers" | "routing">("coverage");
  const [edit, setEdit] = useState<Provider | null>(null);
  const [editStates, setEditStates] = useState<Set<string>>(new Set());

  const eligible = (st: string) => providers.filter((p) => p.active && p.states.includes(st));
  const coverage = useMemo(() => {
    const m: Record<string, Provider[]> = {};
    ALL_STATES.forEach((st) => (m[st] = eligible(st)));
    return m;
  }, [providers]);
  const coveredCount = ALL_STATES.filter((st) => coverage[st].length > 0).length;
  const gaps = useMemo(() => patients.filter((p) => eligible(p.state).length === 0), [patients, providers]);

  function openEdit(p: Provider) { setEdit(p); setEditStates(new Set(p.states)); }
  function saveEdit() {
    if (!edit) return;
    const d = doctors.find((x) => x.id === edit.id);
    if (d) {
      const selected = Array.from(editStates).sort();
      const next: DoctorStateLicense[] = selected.map((st) => d.licenses.find((l) => l.state === st) || { state: st, number: "—", expDate: "" });
      setLicenses(edit.id, next);
    }
    setEdit(null); toast("Licenses updated");
  }
  function toggleState(st: string) { const n = new Set(editStates); n.has(st) ? n.delete(st) : n.add(st); setEditStates(n); }

  const KPI = ({ label, value, intent }: { label: string; value: string; intent?: string }) => <div className="bg-surface border border-border rounded-2xl px-4 py-3 min-w-[140px]"><div className={`text-[22px] font-extrabold leading-none ${intent || ""}`}>{value}</div><div className="text-[11px] text-ink-muted mt-1.5">{label}</div></div>;

  return (
    <div className="px-7 py-6 text-[14px]">
      <div className="flex items-center gap-3 mb-4 flex-wrap">
        <div><h1 className="text-[21px] font-extrabold tracking-tight">State Licensure</h1><div className="text-[12px] text-ink-muted mt-0.5">Coverage by state for your in-house doctors · routes patients to a licensed provider</div></div>
        <div className="flex gap-2">{(["coverage", "providers", "routing"] as const).map((t) => <button key={t} onClick={() => setTab(t)} className={`text-[12.5px] font-semibold px-3.5 py-1.5 rounded-full capitalize ${tab === t ? "bg-brand text-white" : "bg-surface-3 text-ink-muted"}`}>{t}</button>)}</div>
        <div className="flex-1" />{tab === "providers" && <button className="btn btn-primary btn-sm" onClick={() => router.push("/staff")}>Manage doctors →</button>}
      </div>

      <div className="flex flex-wrap gap-2.5 mb-4">
        <KPI label="Providers" value={String(providers.filter((p) => p.active).length)} />
        <KPI label="States covered" value={`${coveredCount}/51`} intent="text-green" />
        <KPI label="Coverage gaps (patients)" value={String(gaps.length)} intent={gaps.length ? "text-red" : ""} />
      </div>

      {tab === "coverage" && (
        <div className="bg-surface border border-border rounded-xl p-4">
          <div className="text-[12px] text-ink-muted mb-3">Green = at least one licensed, active provider. Red = no coverage (cannot prescribe).</div>
          <div className="grid gap-1.5" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(74px, 1fr))" }}>
            {ALL_STATES.map((st) => {
              const provs = coverage[st]; const ok = provs.length > 0;
              return (
                <div key={st} className={`rounded-lg px-2 py-2 text-center border ${ok ? "bg-green-soft border-green/30" : "bg-red-soft border-red/30"}`} title={ok ? provs.map((p) => p.name).join(", ") : "No coverage"}>
                  <div className={`text-[13px] font-extrabold ${ok ? "text-green" : "text-red"}`}>{st}</div>
                  <div className="text-[10px] text-ink-muted">{ok ? `${provs.length} prov` : "none"}</div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {tab === "providers" && (
        <div className="space-y-2.5">
          {doctors.map((d) => {
            const dispName = `${d.first} ${d.last}${d.title ? ", " + d.title : ""}`.trim();
            const lic = d.licenses || [];
            const flags = lic.map((l) => getLicenseStatus(l));
            const hasExpired = flags.some((s) => s.key === "expired");
            const hasExpiring = flags.some((s) => s.key === "expiring");
            return (
              <div key={d.id} className="bg-surface border border-border rounded-xl p-4">
                <div className="flex items-center gap-2 mb-2 flex-wrap">
                  <span className="font-bold text-[14px]">{dispName}</span>
                  <span className="text-[11px] text-ink-muted">NPI {d.npi || "—"}</span>
                  <Pill intent={d.active ? "green" : "muted"} dot>{d.active ? "Active" : "Inactive"}</Pill>
                  <span className="text-[11px] text-ink-muted">· {lic.length} licenses</span>
                  {hasExpired ? <Pill intent="red" dot>License expired</Pill> : hasExpiring ? <Pill intent="amber" dot>Renewal due</Pill> : null}
                  <div className="flex-1" />
                  <button className="btn btn-ghost btn-sm" onClick={() => toggleActive(d.id)}>{d.active ? "Deactivate" : "Activate"}</button>
                  <button className="btn btn-ghost btn-sm" onClick={() => { const p = providers.find((pp) => pp.id === d.id); if (p) openEdit(p); }}>Edit licenses</button>
                </div>
                {lic.length ? (
                  <div className="flex flex-wrap gap-1.5">
                    {lic.map((l) => {
                      const s = getLicenseStatus(l);
                      const cls = s.key === "expired" ? "bg-red-soft text-red" : s.key === "expiring" ? "bg-amber-soft text-amber" : s.key === "active" ? "bg-green-soft text-green" : "bg-surface-3 text-ink-muted";
                      const due = s.key === "expiring" || s.key === "expired";
                      return (
                        <span key={l.state} className={`inline-flex items-center gap-1 text-[11px] font-semibold rounded-md px-2 py-1 ${cls}`} title={s.daysUntil != null ? `${s.label} · ${s.daysUntil} days` : s.label}>
                          {s.icon} {l.state} · exp {formatLicenseExp(l.expDate)}
                          {due && canRemind && d.email && (
                            <button onClick={() => sendReminder(d, l)} className="ml-1 underline hover:no-underline">remind</button>
                          )}
                        </span>
                      );
                    })}
                  </div>
                ) : <span className="text-[12px] text-ink-muted">No licenses assigned</span>}
              </div>
            );
          })}
        </div>
      )}

      {tab === "routing" && (
        <div className="bg-surface border border-border rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full border-collapse min-w-[640px]">
              <thead><tr className="bg-surface-2">{["Patient", "State", "Eligible provider", "Status"].map((h) => <th key={h} className="text-left text-[10px] uppercase tracking-wide text-ink-muted font-bold px-3 py-2.5 border-b border-border">{h}</th>)}</tr></thead>
              <tbody>
                {patients.map((p) => {
                  const elig = eligible(p.state);
                  return (
                    <tr key={p.id} className="border-b border-border last:border-none">
                      <td className="px-3 py-2.5 font-semibold">{p.name}</td>
                      <td className="px-3 py-2.5">{p.state}</td>
                      <td className="px-3 py-2.5">{elig.length ? elig[0].name + (elig.length > 1 ? ` +${elig.length - 1}` : "") : <span className="text-red">—</span>}</td>
                      <td className="px-3 py-2.5">{elig.length ? <Pill intent="green" dot>Covered</Pill> : <Pill intent="red" dot>No coverage</Pill>}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {edit && (
        <Modal open={!!edit} onClose={() => setEdit(null)} title={`Licenses — ${edit.name}`} icon="🗺️" width={560}
          footer={<><span className="text-[12px] text-ink-muted mr-auto">{editStates.size} states</span><button className="btn btn-ghost" onClick={() => setEdit(null)}>Cancel</button><button className="btn btn-primary" onClick={saveEdit}>Save</button></>}>
          <div className="grid gap-1.5" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(52px, 1fr))" }}>
            {ALL_STATES.map((st) => {
              const on = editStates.has(st);
              return <button key={st} onClick={() => toggleState(st)} className={`rounded-md py-1.5 text-[12px] font-bold border ${on ? "bg-brand text-white border-brand" : "bg-surface border-border text-ink-2"}`}>{st}</button>;
            })}
          </div>
        </Modal>
      )}

      <Toast />
    </div>
  );
}
