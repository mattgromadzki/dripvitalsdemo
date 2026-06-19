"use client";

import { useState } from "react";
import { Modal } from "@/components/ui/Modal";
import { toast } from "@/lib/hooks/useToast";
import { useOrders } from "@/lib/hooks/useOrders";
import { useTreatmentsIntake } from "@/lib/hooks/useTreatmentsIntake";
import type { Patient, OrderRow, RxStatus, LabStatus } from "@/lib/types";

const RX_STATUSES: RxStatus[]   = ["pending", "active", "refill"];
const LAB_STATUSES: LabStatus[] = ["ordered", "pending", "in_lab"];

export function NewOrderModal({ patient, open, onClose }: { patient: Patient; open: boolean; onClose: () => void }) {
  const add = useOrders((s) => s.add);
  const activeTreatments = useTreatmentsIntake((s) => s.treatments).filter((t) => t.active);

  const [kind, setKind]               = useState<"rx" | "lab">("rx");
  const [treatmentId, setTreatmentId] = useState<number | "">("");
  const [query, setQuery]             = useState("");
  const [comboOpen, setComboOpen]     = useState(false);
  const [labItem, setLabItem]         = useState("");
  const [destination, setDest]        = useState("GreenstoneRX");
  const [refills, setRefills]         = useState(0);
  const [status, setStatus]           = useState<RxStatus | LabStatus>("pending");
  const [orderedBy, setOrderedBy]     = useState(patient.provider || "Dr. Tancinco");

  const selectedTreatment = activeTreatments.find((t) => t.id === treatmentId) || null;

  function switchKind(k: "rx" | "lab") {
    setKind(k);
    setStatus(k === "lab" ? "ordered" : "pending");
    setDest(k === "lab" ? "Quest Diagnostics" : (selectedTreatment?.pharmacy || "GreenstoneRX"));
  }

  const filteredTreatments = query.trim()
    ? activeTreatments.filter((t) => `${t.name} ${t.med} ${t.strength}`.toLowerCase().includes(query.trim().toLowerCase()))
    : activeTreatments;

  function selectTreatment(t: (typeof activeTreatments)[number]) {
    setTreatmentId(t.id);
    setQuery(t.name);
    setDest(t.pharmacy || "GreenstoneRX");
    setComboOpen(false);
  }

  function resetAll() {
    setKind("rx"); setTreatmentId(""); setQuery(""); setComboOpen(false); setLabItem(""); setDest("GreenstoneRX"); setRefills(0);
    setStatus("pending"); setOrderedBy(patient.provider || "Dr. Tancinco");
  }

  function submit() {
    const item = kind === "lab" ? labItem.trim() : (selectedTreatment?.name || "");
    if (!item) { toast(kind === "lab" ? "Enter the lab panels" : "Choose a treatment"); return; }
    if (!destination.trim()) { toast(kind === "lab" ? "Enter a lab" : "Enter a pharmacy"); return; }
    const now = Date.now();
    const order: Omit<OrderRow, "id"> = {
      kind,
      patientName: patient.name,
      patientId: patient.id,
      item,
      destination: destination.trim(),
      orderedDate: new Date(now).toLocaleDateString("en-US", { month: "short", day: "numeric" }),
      orderedAt: now,
      status,
      orderedBy: orderedBy.trim() || "—",
      ...(kind === "rx" ? { refills: Number(refills) || 0 } : {}),
    };
    add(order);
    toast(kind === "lab" ? "🧪 Lab order created" : "📦 Treatment order created — open e-Prescribe to pick the medication");
    resetAll();
    onClose();
  }

  const statuses: (RxStatus | LabStatus)[] = kind === "lab" ? LAB_STATUSES : RX_STATUSES;

  return (
    <Modal open={open} onClose={onClose} title="New order" icon="📦" width={560}
      footer={<>
        <button className="btn btn-ghost btn-sm" onClick={onClose}>Cancel</button>
        <button className="btn btn-primary btn-sm" onClick={submit}>Create order</button>
      </>}
    >
      <div className="text-[12px] text-ink-muted mb-3">
        Creating an order for <b className="text-ink-2">{patient.name}</b> ({patient.id}). Pick the treatment here, then open
        {" "}<b className="text-ink-2">e-Prescribe</b> from the order to choose the exact medication and send it to the pharmacy.
      </div>

      <label className="fl">Order type</label>
      <div className="flex gap-2 mb-2.5">
        <button
          className={`flex-1 py-2 px-3 rounded-md border text-[12.5px] font-semibold transition-colors ${kind === "rx" ? "border-brand bg-brand-soft text-brand-dk" : "border-border bg-surface text-ink-2"}`}
          onClick={() => switchKind("rx")}
        >💊 Treatment</button>
        <button
          className={`flex-1 py-2 px-3 rounded-md border text-[12.5px] font-semibold transition-colors ${kind === "lab" ? "border-brand bg-brand-soft text-brand-dk" : "border-border bg-surface text-ink-2"}`}
          onClick={() => switchKind("lab")}
        >🧪 Lab</button>
      </div>

      {kind === "rx" ? (
        <>
          <label className="fl">Treatment</label>
          <div className="relative mb-1">
            <input
              className="fi"
              placeholder="Search or select a treatment…"
              value={query}
              onChange={(e) => { setQuery(e.target.value); setComboOpen(true); if (treatmentId !== "") setTreatmentId(""); }}
              onFocus={() => setComboOpen(true)}
              onBlur={() => setTimeout(() => setComboOpen(false), 120)}
            />
            {comboOpen && (
              <div className="absolute z-[60] left-0 right-0 mt-1 max-h-[220px] overflow-y-auto bg-surface border border-border rounded-md shadow-lg">
                {filteredTreatments.length === 0 ? (
                  <div className="px-3 py-2.5 text-[12px] text-ink-muted">No treatments match &ldquo;{query}&rdquo;.</div>
                ) : filteredTreatments.map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    onMouseDown={(e) => { e.preventDefault(); selectTreatment(t); }}
                    className={`w-full text-left px-3 py-2 hover:bg-brand-soft transition-colors ${t.id === treatmentId ? "bg-brand-soft" : ""}`}
                  >
                    <div className="text-[12.5px] font-semibold text-ink">{t.name}</div>
                    <div className="text-[11px] text-ink-muted">{t.med} · {t.strength} · {t.price}</div>
                  </button>
                ))}
              </div>
            )}
          </div>
          {selectedTreatment && (
            <div className="text-[11px] text-ink-muted mb-2">{selectedTreatment.med} · {selectedTreatment.strength} · {selectedTreatment.price} · {selectedTreatment.pharmacy}</div>
          )}
          {activeTreatments.length === 0 && (
            <div className="text-[11px] text-amber mb-2">No active treatments — add one in the Treatments section first.</div>
          )}
        </>
      ) : (
        <>
          <label className="fl">Panels</label>
          <input className="fi mb-2" placeholder="CMP + Lipid + HbA1c" value={labItem} onChange={(e) => setLabItem(e.target.value)} />
        </>
      )}

      <div className="grid grid-cols-2 gap-3">
        <div><label className="fl">{kind === "lab" ? "Lab" : "Pharmacy"}</label><input className="fi" value={destination} onChange={(e) => setDest(e.target.value)} /></div>
        {kind === "rx"
          ? <div><label className="fl">Refills</label><input className="fi" type="number" min={0} value={refills} onChange={(e) => setRefills(Number(e.target.value))} /></div>
          : <div><label className="fl">Status</label><select className="fi" value={status} onChange={(e) => setStatus(e.target.value as LabStatus)}>{statuses.map((s) => <option key={s} value={s}>{s.replace("_", " ")}</option>)}</select></div>}
      </div>

      <div className="grid grid-cols-2 gap-3 mt-2">
        {kind === "rx" && (
          <div><label className="fl">Status</label><select className="fi" value={status} onChange={(e) => setStatus(e.target.value as RxStatus)}>{statuses.map((s) => <option key={s} value={s}>{s[0].toUpperCase() + s.slice(1)}</option>)}</select></div>
        )}
        <div><label className="fl">Ordered by</label><input className="fi" value={orderedBy} onChange={(e) => setOrderedBy(e.target.value)} /></div>
      </div>
    </Modal>
  );
}
