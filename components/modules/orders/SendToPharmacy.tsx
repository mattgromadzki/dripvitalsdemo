"use client";

import { useEffect, useState } from "react";
import { Modal } from "@/components/ui/Modal";
import { Pill } from "@/components/ui/Pill";
import { toast } from "@/lib/hooks/useToast";
import type { Patient } from "@/lib/types";
import type { FulfillmentOrder } from "@/lib/data/fulfillmentOrders";
import type { EmedOrderPayload, EmedOrderStatus, EmedRxStatus } from "@/lib/pharmacy/types";
import type { LFOrderBody, LFRx } from "@/lib/pharmacy/lifefileTypes";
import { submitOrder, getOrderStatus, getRxStatus, cancelOrder, submitLifeFile, setLifeFileStatus } from "@/lib/pharmacy/client";
import { alertOrderStatusToPatient } from "@/lib/notify/alert";
import type { SentOrder } from "@/lib/hooks/usePharmacyOrders";
import { LIFEFILE_SANDBOX_PRODUCTS, LIFEFILE_SHIP_SERVICES, LIFEFILE_STATUSES } from "@/lib/data/lifefileSandbox";
import { nextRxId } from "@/lib/data/rxId";

const PLACEHOLDER_JPG = "/9j/4AAQSkZJRgABAQAAAQABAAD/2wCEAAkGBxISEhUQEhIVFRUVFRUVFRUVFRUVFRUVFRUWFhUVFRUYHSggGBolGxUVITEhJSkrLi4uFx8zODMsNygtLisBCgoKDg0OGxAQGy0lHyUtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLf/AABEIAKAAoAMBIgACEQEDEQH/xABKAAEAAAAAAAAAAAAAAAAAAAALEAEAAAAAAAAAAAAAAAAAAAAAAQEAAAAAAAAAAAAAAAAAAAAAAQEAAAAAAAAAAAAAAAAAAAAA/9oADAMBAAIRAxEAPwCfAAD/2Q==";

type Connector = "emed" | "lifefile";
const sexFor = (g: Patient["gender"]) => (g === "M" ? "Male" : g === "F" ? "Female" : "Other");
const genderLF = (g: Patient["gender"]): "m" | "f" | "u" => (g === "M" ? "m" : g === "F" ? "f" : "u");
const STATUS_INTENT: Record<string, "muted" | "blue" | "amber" | "purple" | "teal" | "green"> = {
  Received: "muted", Reviewing: "blue", Filling: "amber", Verifying: "purple", Ready: "teal", "Picked Up": "green", Shipped: "green",
};

export function SendToPharmacyModal({ open, onClose, order, patient, onSent }: {
  open: boolean; onClose: () => void; order: FulfillmentOrder; patient: Patient; onSent: (s: SentOrder) => void;
}) {
  const [conn, setConn] = useState<Connector>("emed");
  const [sig, setSig] = useState("Inject as directed, weekly SQ");
  const [qty, setQty] = useState("1");
  const [refills, setRefills] = useState("0");
  const [controlled, setControlled] = useState(false);
  const [ndc, setNdc] = useState("");
  const [npi, setNpi] = useState("1234567890");
  const [dea, setDea] = useState("");
  const [signed, setSigned] = useState(false);
  const [prodIdx, setProdIdx] = useState(3); // Acetaminophen (simple, non-controlled)
  const [service, setService] = useState(6223); // Fedex 2 Day
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  useEffect(() => { if (open) { setErr(""); setSigned(false); setBusy(false); setConn("emed"); } }, [open]);

  const addr = `${patient.address || ""}${patient.apt ? ", " + patient.apt : ""}`.trim();
  const hasAddress = !!(patient.address && patient.city && patient.zip);
  const provider = (patient.provider || "Dr. Rivera").replace(/^Dr\.?\s*/i, "");
  const provFirst = provider.split(" ")[0] || "Provider";
  const provLast = provider.split(" ").slice(1).join(" ") || "Clinic";
  const today = new Date().toISOString().slice(0, 10);
  const prod = LIFEFILE_SANDBOX_PRODUCTS[prodIdx];
  const lfControlled = ["2", "3", "4", "5"].includes(prod.schedule);

  async function send() {
    if (!signed) { setErr("A prescriber signature is required before sending."); return; }
    if (!hasAddress) { setErr("Patient is missing a shipping address — verify the address first."); return; }
    setBusy(true); setErr("");

    if (conn === "emed") {
      if (controlled && !dea.trim()) { setErr("Controlled substances require the prescriber's DEA number."); setBusy(false); return; }
      const rxId = nextRxId();
      const payload: EmedOrderPayload = {
        Patient: {
          UniqueId: patient.id, FirstName: "TEST", LastName: "TEST", Sex: sexFor(patient.gender),
          DateOfBirth: patient.dob || "1980-01-01", Phone: patient.phone, Email: patient.email,
          Address: addr, City: patient.city || "", State: patient.state, Zip: patient.zip || "",
          Allergies: patient.allergies || "", MedicalConditions: "", CurrentMedications: "",
          ...(controlled ? { IdJpg: PLACEHOLDER_JPG } : {}),
        },
        Shipping: { Name: "TEST", Phone: patient.phone, Address: addr, City: patient.city || "", State: patient.state, Zip: patient.zip || "" },
        Prescriber: {
          FirstName: provFirst, LastName: provLast, Phone: "555-555-5555", Address: "1 Clinic Way",
          City: patient.city || "Miami", State: patient.state, Zip: patient.zip || "33101",
          NPI: npi.trim() || "1234567890", ...(controlled ? { DEA: dea.trim() } : {}), SignatureJpg: PLACEHOLDER_JPG,
        },
        Drug: [{
          Name: order.medication, DosageForm: "Solution", Sig: sig.trim() || "Use as directed",
          Notes: `DripVitals Rx #${rxId}`,
          Quantity: parseInt(qty, 10) || 1, Refills: parseInt(refills, 10) || 0,
          ...(controlled ? { IsControlled: true } : {}), ...(ndc.trim() ? { NDC: ndc.trim() } : {}),
        }],
      };
      const res = await submitOrder(payload);
      setBusy(false);
      if (!res.ok || res.OrderId == null) { setErr(res.error || "The pharmacy did not accept the order."); return; }
      onSent({ connector: "emed", pharmacyName: "RXCompound Store", orderId: res.OrderId, internalRxIds: [rxId], rx: res.Rx || [], sentAt: new Date().toISOString() });
      alertOrderStatusToPatient(patient, order, "Sent to pharmacy — preparing your order");
      toast(`💊 Sent to RXCompound Store — Rx #${rxId} · Order #${res.OrderId}`);
      onClose();
    } else {
      if (lfControlled && !dea.trim()) { setErr("This schedule requires the prescriber's DEA number."); setBusy(false); return; }
      const rxId = nextRxId();
      const rx: LFRx = {
        rxType: "new", drugName: prod.name, drugStrength: prod.strength, drugForm: prod.form, lfProductID: prod.id,
        foreignRxNumber: String(rxId),
        quantity: qty || "1", quantityUnits: prod.units, directions: sig.trim() || "Use as directed",
        refills: parseInt(refills, 10) || 0, dateWritten: today, scheduleCode: prod.schedule as LFRx["scheduleCode"],
      };
      const body: LFOrderBody = {
        message: { id: Math.floor(Date.now() / 1000), sentTime: new Date().toISOString() },
        order: {
          general: { referenceId: `${order.id} · Rx ${rxId}`, memo: `DripVitals Rx #${rxId}` },
          ...(lfControlled ? { document: { pdfBase64: PLACEHOLDER_JPG } } : {}),
          prescriber: { npi: npi.trim() || "1234567890", lastName: provLast, firstName: provFirst, state: patient.state, ...(dea.trim() ? { dea: dea.trim() } : {}) },
          patient: { lastName: "TEST", firstName: "TEST", gender: genderLF(patient.gender), dateOfBirth: patient.dob || "1980-01-01", address1: addr, city: patient.city || "", state: patient.state, zip: patient.zip || "", phoneMobile: patient.phone, email: patient.email },
          shipping: { recipientType: "patient", recipientFirstName: "TEST", recipientLastName: "TEST", recipientPhone: patient.phone, addressLine1: addr, city: patient.city || "", state: patient.state, zipCode: patient.zip || "", country: "US", service },
          billing: { payorType: "pat" },
          rxs: [rx],
        },
      };
      const res = await submitLifeFile(body);
      setBusy(false);
      if (!res.ok) { setErr(res.error || "Life File did not accept the order."); return; }
      onSent({ connector: "lifefile", pharmacyName: "Hallandale Pharmacy", orderId: res.orderId ?? "(submitted)", internalRxIds: [rxId], rx: [], message: res.message, sentAt: new Date().toISOString() });
      alertOrderStatusToPatient(patient, order, "Sent to pharmacy — preparing your order");
      toast(`💊 Sent to Hallandale Pharmacy — Rx #${rxId}`);
      onClose();
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="Send to Pharmacy" icon="💊" width={580}
      footer={<><button className="btn btn-ghost" onClick={onClose}>Cancel</button><button className="btn btn-primary" onClick={send} disabled={busy}>{busy ? "Sending…" : "Send prescription"}</button></>}>
      <div className="mb-3 px-3 py-2 rounded-md bg-amber-soft text-amber text-[12px] font-medium">
        Prototype: the patient name is forced to <b>TEST</b> so the pharmacy will not process this order.
      </div>
      {err && <div className="mb-3 px-3 py-2.5 rounded-md bg-red-soft text-red text-[12px] font-medium">⚠ {err}</div>}

      <label className="fl">Destination pharmacy</label>
      <select className="fsel w-full mb-3" value={conn} onChange={(e) => setConn(e.target.value as Connector)}>
        <option value="emed">RXCompound Store (eMed)</option>
        <option value="lifefile">Hallandale Pharmacy (Life File)</option>
      </select>

      <div className="text-[10px] uppercase tracking-wide text-ink-muted font-bold mb-1.5">Patient &amp; shipping</div>
      <div className="text-[12.5px] mb-3 p-2.5 rounded-md bg-surface-2 border border-border">
        <div className="font-semibold">{patient.name} <span className="text-ink-muted font-normal">({patient.id})</span></div>
        <div className="text-ink-2">{addr || "— no address —"}</div>
        <div className="text-ink-2">{patient.city}, {patient.state} {patient.zip}</div>
        {!hasAddress && <div className="text-red mt-1">Missing address — verify it on the patient before sending.</div>}
      </div>

      {conn === "emed" ? (
        <>
          <div className="text-[10px] uppercase tracking-wide text-ink-muted font-bold mb-1.5">Drug</div>
          <div className="mb-2 font-semibold text-[13px]">{order.medication}</div>
          <label className="fl">Sig (directions)</label>
          <input className="fi mb-2" value={sig} onChange={(e) => setSig(e.target.value)} />
          <div className="grid grid-cols-2 gap-3 mb-2">
            <div><label className="fl">Quantity</label><input className="fi" type="number" value={qty} onChange={(e) => setQty(e.target.value)} /></div>
            <div><label className="fl">Refills</label><input className="fi" type="number" value={refills} onChange={(e) => setRefills(e.target.value)} /></div>
          </div>
          <label className="flex items-center gap-2 text-[12.5px] mb-2 cursor-pointer">
            <input type="checkbox" checked={controlled} onChange={(e) => setControlled(e.target.checked)} /> Controlled substance
          </label>
          {controlled && (
            <div className="grid grid-cols-2 gap-3 mb-2">
              <div><label className="fl">NDC</label><input className="fi" value={ndc} onChange={(e) => setNdc(e.target.value)} placeholder="123458-382-23" /></div>
              <div><label className="fl">Prescriber DEA <span className="text-red">*</span></label><input className="fi" value={dea} onChange={(e) => setDea(e.target.value)} placeholder="FG2282082" /></div>
            </div>
          )}
        </>
      ) : (
        <>
          <div className="text-[10px] uppercase tracking-wide text-ink-muted font-bold mb-1.5">Drug (Life File sandbox products)</div>
          <select className="fsel w-full mb-2" value={prodIdx} onChange={(e) => setProdIdx(Number(e.target.value))}>
            {LIFEFILE_SANDBOX_PRODUCTS.map((p, i) => <option key={p.id} value={i}>{p.name} — {p.strength} ({p.form})</option>)}
          </select>
          <label className="fl">Directions (sig)</label>
          <input className="fi mb-2" value={sig} onChange={(e) => setSig(e.target.value)} />
          <div className="grid grid-cols-2 gap-3 mb-2">
            <div><label className="fl">Quantity ({prod.units})</label><input className="fi" value={qty} onChange={(e) => setQty(e.target.value)} /></div>
            <div><label className="fl">Refills</label><input className="fi" type="number" value={refills} onChange={(e) => setRefills(e.target.value)} /></div>
          </div>
          <label className="fl">Shipping service</label>
          <select className="fsel w-full mb-2" value={service} onChange={(e) => setService(Number(e.target.value))}>
            {LIFEFILE_SHIP_SERVICES.map(([id, name]) => <option key={id} value={id}>{name}</option>)}
          </select>
          {lfControlled && (
            <div><label className="fl">Prescriber DEA <span className="text-red">*</span> (schedule {prod.schedule})</label><input className="fi" value={dea} onChange={(e) => setDea(e.target.value)} placeholder="FG2282082" /></div>
          )}
        </>
      )}

      <div className="text-[10px] uppercase tracking-wide text-ink-muted font-bold mt-2 mb-1.5">Prescriber</div>
      <div className="grid grid-cols-2 gap-3 mb-2">
        <div><label className="fl">Name</label><input className="fi" value={provider} disabled /></div>
        <div><label className="fl">NPI</label><input className="fi" value={npi} onChange={(e) => setNpi(e.target.value)} /></div>
      </div>
      <label className="flex items-center gap-2 text-[12.5px] mt-1 cursor-pointer">
        <input type="checkbox" checked={signed} onChange={(e) => setSigned(e.target.checked)} /> Prescriber signature attached (required)
      </label>
    </Modal>
  );
}

export function PharmacyStatusPanel({ sent, onCancelled }: { sent: SentOrder; onCancelled: () => void }) {
  if (sent.connector === "lifefile") return <LifeFilePanel sent={sent} />;
  return <EmedPanel sent={sent} onCancelled={onCancelled} />;
}

function EmedPanel({ sent, onCancelled }: { sent: SentOrder; onCancelled: () => void }) {
  const [order, setOrder] = useState<EmedOrderStatus | null>(null);
  const [rxs, setRxs] = useState<EmedRxStatus[]>([]);
  const [loading, setLoading] = useState(true);
  const [cancelling, setCancelling] = useState(false);

  async function refresh() {
    setLoading(true);
    const [o, ...r] = await Promise.all([getOrderStatus(sent.orderId), ...sent.rx.map((x) => getRxStatus(x.Id))]);
    setOrder(o as EmedOrderStatus); setRxs(r as EmedRxStatus[]); setLoading(false);
  }
  useEffect(() => { refresh(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [sent.orderId]);

  async function doCancel() {
    setCancelling(true);
    const res = await cancelOrder(sent.orderId);
    setCancelling(false);
    if (res.ok) { toast("Order cancelled"); onCancelled(); } else toast(res.error || "Could not cancel");
  }
  const shipped = order?.ShipStatus === "Shipped" || order?.ShipStatus === "Picked Up";
  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <span className="font-mono text-[12px] font-bold">RXCompound · #{sent.orderId}</span>
        <button className="text-[11px] font-semibold text-brand-dk hover:underline" onClick={refresh} disabled={loading}>{loading ? "…" : "↻ Refresh"}</button>
      </div>
      <div className="flex justify-between py-[5px] text-[12.5px] border-b border-surface-3"><span className="text-ink-muted">Internal Rx</span><span className="font-mono font-semibold">{sent.internalRxIds.map((n) => `#${n}`).join(", ")}</span></div>
      <div className="flex justify-between py-[5px] text-[12.5px] border-b border-surface-3"><span className="text-ink-muted">Shipment</span><span className="font-semibold">{order?.ShipStatus || "—"}</span></div>
      {order?.TrackingNumber && <div className="flex justify-between py-[5px] text-[12.5px] border-b border-surface-3"><span className="text-ink-muted">Tracking</span><span className="font-semibold">{order.ShipmentType ? `${order.ShipmentType} · ` : ""}{order.TrackingNumber}</span></div>}
      <div className="mt-2.5 space-y-1.5">
        {(rxs.length ? rxs : sent.rx.map((r) => ({ ok: true, RxId: r.Id, DrugName: r.Drug, source: "mock" as const } as EmedRxStatus))).map((rx, i) => (
          <div key={i} className="flex items-center justify-between text-[12px]">
            <span className="truncate mr-2">{sent.rx[i]?.Drug || rx.DrugName}</span>
            {rx.OrderStatus ? <Pill intent={STATUS_INTENT[rx.OrderStatus] ?? "muted"} dot>{rx.OrderStatus}</Pill> : <span className="text-ink-muted">—</span>}
          </div>
        ))}
      </div>
      <button className="btn btn-ghost w-full mt-3 text-red" onClick={doCancel} disabled={cancelling || shipped}>
        {cancelling ? "Cancelling…" : shipped ? "Cannot cancel (already shipped)" : "Cancel order"}
      </button>
    </div>
  );
}

function LifeFilePanel({ sent }: { sent: SentOrder }) {
  const [busy, setBusy] = useState(false);
  async function setStatus(code: string, name: string) {
    setBusy(true);
    const res = await setLifeFileStatus(sent.orderId, code);
    setBusy(false);
    toast(res.ok ? `Status set: ${name}` : res.error || "Could not set status");
  }
  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <span className="font-mono text-[12px] font-bold">Hallandale · #{sent.orderId}</span>
        <Pill intent="green" dot>Submitted</Pill>
      </div>
      <div className="flex justify-between py-[5px] text-[12.5px] border-b border-surface-3"><span className="text-ink-muted">Internal Rx</span><span className="font-mono font-semibold">{sent.internalRxIds.map((n) => `#${n}`).join(", ")}</span></div>
      <div className="text-[12px] text-ink-2 mb-2">{sent.message || "Order submitted to Life File."}</div>
      <div className="text-[10px] uppercase tracking-wide text-ink-muted-2 font-bold mb-1.5">Set order status</div>
      <div className="flex gap-2">
        {LIFEFILE_STATUSES.map(([code, name]) => (
          <button key={code} className="btn btn-ghost flex-1 text-[11.5px]" onClick={() => setStatus(code, name)} disabled={busy}>{name.replace("11437 Sandbox ", "")}</button>
        ))}
      </div>
      <div className="text-[10.5px] text-ink-muted-2 mt-2">Life File has no pull-status endpoint — tracking is managed in the Life File portal; statuses can be pushed here.</div>
    </div>
  );
}
