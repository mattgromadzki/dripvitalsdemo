"use client";

import { useCallback, useEffect, useState } from "react";
import { Pill } from "@/components/ui/Pill";
import type { PharmacyEvent } from "@/lib/pharmacy/events";

const STAGE: Record<string, { label: string; intent: "muted" | "amber" | "green" | "red" }> = {
  requested: { label: "Order received",    intent: "muted" },
  filling:   { label: "Being filled",      intent: "amber" },
  ready:     { label: "Packed & shipped",  intent: "amber" },
  shipped:   { label: "In transit",        intent: "amber" },
  delivered: { label: "Delivered",         intent: "green" },
  issue:     { label: "Shipping issue",    intent: "red"   },
  held:      { label: "On hold",           intent: "amber" },
  cancelled: { label: "Cancelled",         intent: "red"   },
  voided:    { label: "Voided (EMR)",      intent: "red"   },
};

function stageOf(e: PharmacyEvent): { label: string; intent: "muted" | "amber" | "green" | "red" } {
  return STAGE[(e.stage || "").toLowerCase()] || { label: e.status || e.event || "Update", intent: "muted" };
}

interface GsMsg { id: string; senderType: "clinic" | "pharmacy"; senderName?: string; message: string; createdAt: string; read?: boolean }

function fmtMsgTime(s: string): string {
  const d = new Date(s);
  if (isNaN(d.getTime())) return s;
  return d.toLocaleString(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
}

export function PatientPharmacyTracking({ patientId, defaultAddress }: { patientId: string; defaultAddress?: { street?: string; line2?: string; city?: string; state?: string; zip?: string } }) {
  const [events, setEvents] = useState<PharmacyEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [addrOpen, setAddrOpen] = useState(false);
  const [addr, setAddr] = useState({ street: "", line2: "", city: "", state: "", zip: "" });
  const [addrNote, setAddrNote] = useState("");
  const [addrSaving, setAddrSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await fetch("/api/store/pharmacy-events", { cache: "no-store" });
      const j = await r.json();
      const all: PharmacyEvent[] = Array.isArray(j?.data) ? j.data : [];
      const mine = all.filter(
        (e) => e?.patientId === patientId || (e?.internalOrderId || "").startsWith(`DV-${patientId}-`),
      );
      setEvents(mine);
    } catch { /* ignore */ }
    setLoading(false);
  }, [patientId]);

  useEffect(() => { load(); }, [load]);

  const [messages, setMessages] = useState<GsMsg[]>([]);
  const [msgLoading, setMsgLoading] = useState(false);
  const [msgDraft, setMsgDraft] = useState("");
  const [sending, setSending] = useState(false);

  // The pharmacy order id keys the message thread + cancel.
  const gsOrderId = events.find((e) => e.orderId != null && String(e.orderId).length > 0)?.orderId;

  const loadMessages = useCallback(async (oid: string | number) => {
    setMsgLoading(true);
    try {
      const r = await fetch(`/api/pharmacy/greenstone/messages?orderId=${encodeURIComponent(String(oid))}`, { cache: "no-store" });
      const j = await r.json();
      if (j?.ok && Array.isArray(j.messages)) setMessages(j.messages);
    } catch { /* ignore */ }
    setMsgLoading(false);
  }, []);

  useEffect(() => { if (gsOrderId != null) loadMessages(gsOrderId); }, [gsOrderId, loadMessages]);

  const sendMessage = useCallback(async () => {
    const msg = msgDraft.trim();
    if (!msg || gsOrderId == null) return;
    setSending(true);
    try {
      const r = await fetch("/api/pharmacy/greenstone/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderId: gsOrderId, message: msg }),
      });
      const j = await r.json().catch(() => ({}));
      if (j?.ok) { setMsgDraft(""); loadMessages(gsOrderId); }
      else window.alert("Message not sent: " + (j?.error || "the pharmacy rejected it."));
    } catch { window.alert("Message failed to send. Check your connection and try again."); }
    setSending(false);
  }, [msgDraft, gsOrderId, loadMessages]);

  const voidOrder = useCallback(async () => {
    const stageKey = (events[0]?.stage || "").toLowerCase();
    const status = events[0]?.status || "the current stage";

    // Terminal — nothing to cancel.
    if (["delivered", "cancelled", "voided"].includes(stageKey)) {
      window.alert(stageKey === "delivered"
        ? "This order is already delivered and can't be cancelled."
        : "This order is already cancelled.");
      return;
    }

    // Labeled / in transit / on hold — a direct cancel will be rejected, so
    // route it as a pharmacist-reviewed cancellation request via the order
    // message thread. The chart flips to Cancelled when they process it.
    const labeled = ["ready", "shipped", "issue", "held"].includes(stageKey);
    if (labeled) {
      if (!window.confirm("This order already has a shipping label or is in progress, so it can't be cancelled directly.\n\nSend a cancellation request to the pharmacist to review? They'll pull the order, and you'll see it flip to Cancelled here once they confirm.")) return;
      const note = window.prompt("Add a note for the pharmacist (optional):", "Please cancel this order — patient request.") || "Please cancel this order.";
      setSending(true);
      try {
        const r = await fetch("/api/pharmacy/greenstone/messages", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ orderId: gsOrderId, message: `⚠ CANCELLATION REQUEST from clinic (order is ${status}): ${note}` }),
        });
        const j = await r.json().catch(() => ({}));
        if (j?.ok) { window.alert("Cancellation request sent to the pharmacist. The order will show as Cancelled here once they process it."); if (gsOrderId != null) loadMessages(gsOrderId); }
        else window.alert("Couldn't send the cancellation request: " + (j?.error || "use the message thread below or contact GreenstoneRX directly."));
      } catch { window.alert("Request failed. Use the message thread below or contact GreenstoneRX directly."); }
      setSending(false);
      return;
    }

    // Pre-label — direct cancel via update_one.
    if (!window.confirm("Cancel this order at GreenstoneRX?\n\nThis sends a direct cancellation. If accepted, the order is marked Cancelled here and in the patient portal.")) return;
    try {
      const r = await fetch("/api/pharmacy/greenstone/void", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          patientId,
          orderId: gsOrderId ?? events.find((e) => e.orderId != null)?.orderId,
          internalOrderId: events.find((e) => e.internalOrderId)?.internalOrderId,
          patientName: events.find((e) => e.patientName)?.patientName,
        }),
      });
      const j = await r.json().catch(() => ({}));
      if (!j?.ok) window.alert("Cancellation not completed: " + (j?.error || "the pharmacy did not accept it. Try the message thread below or contact GreenstoneRX."));
    } catch { window.alert("Cancellation request failed. Check your connection and try again."); }
    load();
  }, [events, gsOrderId, patientId, load, loadMessages]);

  const openAddr = useCallback(() => {
    setAddr({
      street: defaultAddress?.street || "",
      line2: defaultAddress?.line2 || "",
      city: defaultAddress?.city || "",
      state: defaultAddress?.state || "",
      zip: defaultAddress?.zip || "",
    });
    setAddrNote("");
    setAddrOpen(true);
  }, [defaultAddress]);

  const saveAddress = useCallback(async () => {
    if (gsOrderId == null) return;
    if (!addr.street.trim() || !addr.city.trim() || !addr.state.trim() || !addr.zip.trim()) { window.alert("Street, city, state, and ZIP are all required."); return; }
    const labeled = ["ready", "shipped", "issue", "held"].includes((events[0]?.stage || "").toLowerCase());
    if (labeled && !addrNote.trim()) { window.alert("This order already has a shipping label — add a note for the pharmacist who will review the address change."); return; }
    setAddrSaving(true);
    try {
      const r = await fetch("/api/pharmacy/greenstone/address", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderId: gsOrderId, address: addr.street, line2: addr.line2, city: addr.city, state: addr.state, zipCode: addr.zip, force: labeled, note: addrNote }),
      });
      const j = await r.json().catch(() => ({}));
      if (j?.ok) {
        window.alert(j.pullLive ? "Address change sent to the pharmacist for review (the order already has a label)." : "Shipping address updated at the pharmacy.");
        setAddrOpen(false); setAddrNote(""); load();
      } else window.alert("Address not updated: " + (j?.error || "the pharmacy rejected it."));
    } catch { window.alert("Address update failed. Check your connection and try again."); }
    setAddrSaving(false);
  }, [gsOrderId, addr, addrNote, events, load]);

  if (loading) {
    return <div className="bg-surface border border-border rounded-2xl p-4 mb-4 text-[12.5px] text-ink-muted">Loading pharmacy status…</div>;
  }
  if (events.length === 0) return null; // nothing to show — don't clutter the chart

  const latest = events[0];
  const latestStage = stageOf(latest);
  const tracking = events.find((e) => e.trackingNumber)?.trackingNumber;
  const trackingUrl = events.find((e) => e.trackingUrl)?.trackingUrl;

  return (
    <div className="bg-surface border border-border rounded-2xl p-5 mb-4">
      <div className="flex items-center justify-between gap-3 mb-3">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-[16px]">💊</span>
          <span className="font-semibold text-ink">Pharmacy fulfillment</span>
          {gsOrderId ? <span className="text-[12px] text-ink-muted font-mono">GreenstoneRX #{gsOrderId}</span> : null}
          <Pill intent={latestStage.intent} dot>{latestStage.label}</Pill>
        </div>
        <div className="flex gap-1.5">
          <button className="btn btn-ghost text-[12px]" onClick={load}>Refresh</button>
          {gsOrderId != null && <button className="btn btn-ghost text-[12px]" onClick={openAddr}>Edit address</button>}
          <button className="btn btn-ghost btn-danger text-[12px]" onClick={voidOrder}>Cancel order</button>
        </div>
      </div>

      {addrOpen && (
        <div className="bg-surface-2 border border-border rounded-xl p-3 mb-3">
          <div className="text-[11px] uppercase tracking-wide text-ink-muted mb-2">Update shipping address</div>
          <div className="grid gap-2">
            <input className="border border-border rounded-[8px] px-2.5 py-1.5 text-[12.5px] bg-surface" placeholder="Street address" value={addr.street} onChange={(e) => setAddr({ ...addr, street: e.target.value })} />
            <input className="border border-border rounded-[8px] px-2.5 py-1.5 text-[12.5px] bg-surface" placeholder="Apt / suite / floor (optional)" value={addr.line2} onChange={(e) => setAddr({ ...addr, line2: e.target.value })} />
            <div className="grid grid-cols-[1fr_70px_90px] gap-2">
              <input className="border border-border rounded-[8px] px-2.5 py-1.5 text-[12.5px] bg-surface" placeholder="City" value={addr.city} onChange={(e) => setAddr({ ...addr, city: e.target.value })} />
              <input className="border border-border rounded-[8px] px-2.5 py-1.5 text-[12.5px] bg-surface uppercase" placeholder="ST" maxLength={2} value={addr.state} onChange={(e) => setAddr({ ...addr, state: e.target.value })} />
              <input className="border border-border rounded-[8px] px-2.5 py-1.5 text-[12.5px] bg-surface" placeholder="ZIP" value={addr.zip} onChange={(e) => setAddr({ ...addr, zip: e.target.value })} />
            </div>
            {["ready", "shipped", "issue", "held"].includes((events[0]?.stage || "").toLowerCase()) && (
              <textarea className="border border-border rounded-[8px] px-2.5 py-1.5 text-[12.5px] bg-surface resize-none" rows={2} placeholder="Note for the pharmacist (required — order has a label)…" value={addrNote} onChange={(e) => setAddrNote(e.target.value.slice(0, 2000))} />
            )}
          </div>
          <div className="flex gap-2 mt-2 justify-end">
            <button className="btn btn-ghost text-[12px]" onClick={() => setAddrOpen(false)}>Cancel</button>
            <button className="btn btn-primary text-[12px]" disabled={addrSaving} onClick={saveAddress}>{addrSaving ? "Saving…" : "Update address"}</button>
          </div>
        </div>
      )}

      {tracking && (
        <div className="text-[12.5px] mb-3">
          Tracking: <span className="font-mono">{tracking}</span>
          {trackingUrl && (
            <>{" · "}<a href={trackingUrl} target="_blank" rel="noreferrer" className="text-brand underline">Track package →</a></>
          )}
        </div>
      )}

      <div className="text-[11px] uppercase tracking-wide text-ink-muted mb-1.5">Status history</div>
      <div className="divide-y divide-border border border-border rounded-xl overflow-hidden">
        {events.map((e) => {
          const st = stageOf(e);
          return (
            <div key={e.id} className="flex items-center justify-between gap-3 px-3 py-2 text-[12.5px]">
              <div className="flex items-center gap-2 min-w-0">
                <Pill intent={st.intent}>{st.label}</Pill>
                <span className="text-ink-muted truncate">
                  {e.status || e.event}
                  {e.trackingNumber ? <> · {e.trackingNumber}</> : null}
                  {e.comment ? <> · {e.comment}</> : null}
                </span>
              </div>
              <span className="text-ink-muted whitespace-nowrap">{new Date(e.at).toLocaleString()}</span>
            </div>
          );
        })}
      </div>
      <div className="text-[11px] text-ink-muted mt-2">Patients are texted and emailed automatically when their order ships or is delivered.</div>

      {gsOrderId != null && (
        <div className="mt-4 border-t border-border pt-3">
          <div className="flex items-center justify-between mb-1.5">
            <div className="text-[11px] uppercase tracking-wide text-ink-muted">Messages with pharmacy</div>
            <button className="btn btn-ghost text-[11px]" onClick={() => loadMessages(gsOrderId)}>Refresh</button>
          </div>
          <div className="flex flex-col gap-1.5 max-h-[240px] overflow-auto mb-2 px-0.5">
            {msgLoading && messages.length === 0 && <div className="text-[12px] text-ink-muted py-2">Loading messages…</div>}
            {!msgLoading && messages.length === 0 && <div className="text-[12px] text-ink-muted py-2">No messages yet. Send the pharmacist a note about this order.</div>}
            {messages.map((m) => (
              <div key={m.id} className={`max-w-[85%] rounded-xl px-3 py-2 text-[12.5px] ${m.senderType === "clinic" ? "self-end bg-brand-soft" : "self-start bg-surface-2 border border-border"}`}>
                <div className="text-[10px] uppercase tracking-wide text-ink-muted mb-0.5">
                  {m.senderType === "clinic" ? "You" : "Pharmacy"}{m.senderName ? ` · ${m.senderName}` : ""} · {fmtMsgTime(m.createdAt)}
                  {m.senderType === "pharmacy" && m.read === false ? <span className="text-brand"> · new</span> : null}
                </div>
                <div className="whitespace-pre-wrap break-words">{m.message}</div>
              </div>
            ))}
          </div>
          <div className="flex gap-2 items-end">
            <textarea value={msgDraft} onChange={(e) => setMsgDraft(e.target.value.slice(0, 2000))} rows={2}
              placeholder="Message the pharmacist about this order…"
              className="flex-1 border border-border rounded-[9px] px-3 py-2 text-[12.5px] bg-surface resize-none" />
            <button className="btn btn-primary text-[12px]" disabled={sending || !msgDraft.trim()} onClick={sendMessage}>{sending ? "Sending…" : "Send"}</button>
          </div>
          <div className="text-[10px] text-ink-muted mt-1">{msgDraft.length}/2000</div>
        </div>
      )}
    </div>
  );
}
