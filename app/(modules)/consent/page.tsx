"use client";

import { useMemo, useState } from "react";
import { Pill } from "@/components/ui/Pill";
import { Modal } from "@/components/ui/Modal";
import { Toast } from "@/components/ui/Toast";
import { toast } from "@/lib/hooks/useToast";
import { usePatients } from "@/lib/hooks/usePatients";
import { useConsent } from "@/lib/hooks/useConsent";
import { AGREEMENTS } from "@/lib/consent/docs";
import type { ConsentStatus } from "@/lib/consent/types";

const ST: Record<ConsentStatus, "green" | "amber" | "red" | "muted"> = { signed: "green", pending: "amber", declined: "red", expired: "muted" };
const fmt = (iso?: string) => (iso ? new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : "—");

export default function ConsentPage() {
  const patients = usePatients((s) => s.patients);
  const records = useConsent((s) => s.records);
  const request = useConsent((s) => s.request);
  const sign = useConsent((s) => s.sign);
  const decline = useConsent((s) => s.decline);

  const [view, setView] = useState<"records" | "matrix">("matrix");
  const [filter, setFilter] = useState<ConsentStatus | "all">("all");
  const [reqOpen, setReqOpen] = useState(false);
  const [rpPatient, setRpPatient] = useState(""); const [rpDocs, setRpDocs] = useState<Set<string>>(new Set());

  const required = AGREEMENTS.filter((a) => a.required);
  const counts = useMemo(() => ({
    signed: records.filter((r) => r.status === "signed").length,
    pending: records.filter((r) => r.status === "pending").length,
    declined: records.filter((r) => r.status === "declined").length,
  }), [records]);
  // completion across required docs for patients who have any record
  const completion = useMemo(() => {
    const pts = Array.from(new Set(records.map((r) => r.patientId)));
    let need = 0, have = 0;
    pts.forEach((pid) => required.forEach((a) => { need++; if (records.some((r) => r.patientId === pid && r.docId === a.id && r.status === "signed")) have++; }));
    return need ? Math.round((have / need) * 100) : 0;
  }, [records]);

  const list = useMemo(() => records.filter((r) => filter === "all" || r.status === filter), [records, filter]);
  const patientsWithRecords = useMemo(() => Array.from(new Set(records.map((r) => r.patientId))).map((pid) => ({ pid, name: records.find((r) => r.patientId === pid)!.patientName })), [records]);
  function cellStatus(pid: string, docId: string): ConsentStatus | null { return records.find((r) => r.patientId === pid && r.docId === docId)?.status ?? null; }

  function toggleDoc(id: string) { const n = new Set(rpDocs); n.has(id) ? n.delete(id) : n.add(id); setRpDocs(n); }
  function sendRequests() {
    const p = patients.find((x) => x.id === rpPatient); if (!p) { toast("Choose a patient"); return; }
    if (rpDocs.size === 0) { toast("Select at least one agreement"); return; }
    rpDocs.forEach((d) => request(p.id, p.name, d));
    setReqOpen(false); setRpPatient(""); setRpDocs(new Set()); toast(`Sent ${rpDocs.size} agreement(s) for signature`);
  }

  const KPI = ({ label, value, intent }: { label: string; value: string; intent?: string }) => <div className="bg-surface border border-border rounded-2xl px-4 py-3 min-w-[130px]"><div className={`text-[22px] font-extrabold leading-none ${intent || ""}`}>{value}</div><div className="text-[11px] text-ink-muted mt-1.5">{label}</div></div>;
  const Dot = ({ s }: { s: ConsentStatus | null }) => s === "signed" ? <span className="text-green" title="Signed">✓</span> : s === "pending" ? <span className="text-amber" title="Pending">●</span> : s === "declined" ? <span className="text-red" title="Declined">✕</span> : <span className="text-ink-muted-2" title="Not sent">–</span>;

  return (
    <div className="px-7 py-6 text-[14px]">
      <div className="flex items-center gap-3 mb-4 flex-wrap">
        <div><h1 className="text-[21px] font-extrabold tracking-tight">Consent & Agreements</h1><div className="text-[12px] text-ink-muted mt-0.5">Telehealth, HIPAA, treatment, auto-refill, ID & controlled-substance agreements</div></div>
        <div className="flex gap-2">{(["matrix", "records"] as const).map((v) => <button key={v} onClick={() => setView(v)} className={`text-[12.5px] font-semibold px-3.5 py-1.5 rounded-full capitalize ${view === v ? "bg-brand text-white" : "bg-surface-3 text-ink-muted"}`}>{v === "matrix" ? "By patient" : "All records"}</button>)}</div>
        <div className="flex-1" /><button className="btn btn-primary btn-sm" onClick={() => setReqOpen(true)}>✍️ Request signatures</button>
      </div>

      <div className="flex flex-wrap gap-2.5 mb-4">
        <KPI label="Signed" value={String(counts.signed)} intent="text-green" />
        <KPI label="Pending" value={String(counts.pending)} intent="text-amber" />
        <KPI label="Declined" value={String(counts.declined)} intent={counts.declined ? "text-red" : ""} />
        <KPI label="Required completion" value={`${completion}%`} />
      </div>

      {view === "matrix" ? (
        <div className="bg-surface border border-border rounded-xl overflow-x-auto">
          <table className="w-full border-collapse min-w-[820px]">
            <thead><tr className="bg-surface-2">
              <th className="text-left text-[10px] uppercase tracking-wide text-ink-muted font-bold px-3 py-2.5 border-b border-border">Patient</th>
              {AGREEMENTS.map((a) => <th key={a.id} className="text-center text-[10px] uppercase tracking-wide text-ink-muted font-bold px-2 py-2.5 border-b border-border" title={a.name}>{a.name.split(" ")[0]}{a.required ? "" : "*"}</th>)}
            </tr></thead>
            <tbody>
              {patientsWithRecords.map((p) => (
                <tr key={p.pid} className="border-b border-border last:border-none hover:bg-surface-2">
                  <td className="px-3 py-2.5 font-semibold">{p.name}</td>
                  {AGREEMENTS.map((a) => <td key={a.id} className="text-center px-2 py-2.5 text-[14px]"><Dot s={cellStatus(p.pid, a.id)} /></td>)}
                </tr>
              ))}
            </tbody>
          </table>
          <div className="px-3 py-2 text-[11px] text-ink-muted-2 border-t border-border">✓ signed · ● pending · ✕ declined · – not sent · *optional (controlled substances)</div>
        </div>
      ) : (
        <>
          <div className="flex gap-2 mb-3">{(["all", "signed", "pending", "declined"] as const).map((f) => <button key={f} onClick={() => setFilter(f)} className={`text-[12px] font-semibold px-3 py-1.5 rounded-full capitalize ${filter === f ? "bg-brand text-white" : "bg-surface-3 text-ink-muted"}`}>{f}</button>)}</div>
          <div className="bg-surface border border-border rounded-xl overflow-hidden">
            <table className="w-full border-collapse min-w-[760px]">
              <thead><tr className="bg-surface-2">{["Patient", "Agreement", "Version", "Status", "Signed", ""].map((h) => <th key={h} className="text-left text-[10px] uppercase tracking-wide text-ink-muted font-bold px-3 py-2.5 border-b border-border">{h}</th>)}</tr></thead>
              <tbody>
                {list.map((r) => (
                  <tr key={r.id} className="border-b border-border last:border-none hover:bg-surface-2">
                    <td className="px-3 py-2.5 font-semibold">{r.patientName}</td>
                    <td className="px-3 py-2.5">{r.docName}</td>
                    <td className="px-3 py-2.5 text-ink-muted">{r.version}</td>
                    <td className="px-3 py-2.5"><Pill intent={ST[r.status]} dot>{r.status}</Pill></td>
                    <td className="px-3 py-2.5 text-ink-muted text-[12px]">{fmt(r.signedAt)}{r.method ? ` · ${r.method}` : ""}</td>
                    <td className="px-3 py-2.5 text-right">{r.status === "pending" && <><button className="text-[11px] font-semibold text-green mr-2 hover:underline" onClick={() => { sign(r.id); toast("Marked signed"); }}>Mark signed</button><button className="text-[11px] font-semibold text-red hover:underline" onClick={() => { decline(r.id); toast("Declined"); }}>Decline</button></>}</td>
                  </tr>
                ))}
                {list.length === 0 && <tr><td colSpan={6} className="px-3 py-10 text-center text-ink-muted text-[12px]">No records.</td></tr>}
              </tbody>
            </table>
          </div>
        </>
      )}

      <Modal open={reqOpen} onClose={() => setReqOpen(false)} title="Request signatures" icon="✍️" width={480}
        footer={<><button className="btn btn-ghost" onClick={() => setReqOpen(false)}>Cancel</button><button className="btn btn-primary" onClick={sendRequests}>Send for signature</button></>}>
        <label className="fl">Patient</label>
        <select className="fsel w-full mb-3" value={rpPatient} onChange={(e) => setRpPatient(e.target.value)}><option value="">— choose —</option>{patients.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</select>
        <label className="fl">Agreements</label>
        <div className="space-y-1.5 mt-1">
          {AGREEMENTS.map((a) => (
            <label key={a.id} className="flex items-start gap-2 text-[12.5px] cursor-pointer p-2 rounded-md hover:bg-surface-2">
              <input type="checkbox" className="mt-0.5" checked={rpDocs.has(a.id)} onChange={() => toggleDoc(a.id)} />
              <span><span className="font-semibold">{a.name}</span> <span className="text-ink-muted">{a.version}{a.required ? "" : " · optional"}</span><br /><span className="text-ink-muted text-[11.5px]">{a.desc}</span></span>
            </label>
          ))}
        </div>
        <div className="mt-2 text-[11px] text-ink-muted-2">Creates pending records and sends the patient an e-sign request.</div>
      </Modal>
      <Toast />
    </div>
  );
}
