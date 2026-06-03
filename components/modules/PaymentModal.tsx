"use client";

import { useEffect, useRef, useState } from "react";
import { Modal } from "@/components/ui/Modal";
import { getPaymentsConfig, charge } from "@/lib/payments/client";
import type { PaymentsPublicConfig, ChargeResult } from "@/lib/payments/types";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnySquare = any;

function loadSquareSdk(env: "sandbox" | "production"): Promise<AnySquare> {
  return new Promise((resolve, reject) => {
    const w = window as unknown as { Square?: AnySquare };
    if (w.Square) return resolve(w.Square);
    const src = env === "production" ? "https://web.squarecdn.com/v1/square.js" : "https://sandbox.web.squarecdn.com/v1/square.js";
    const s = document.createElement("script");
    s.src = src; s.async = true;
    s.onload = () => resolve((window as unknown as { Square?: AnySquare }).Square);
    s.onerror = () => reject(new Error("Failed to load Square SDK"));
    document.body.appendChild(s);
  });
}

export function PaymentModal({ open, onClose, amountCents, referenceId, note, onPaid }: {
  open: boolean; onClose: () => void; amountCents: number; referenceId?: string; note?: string;
  onPaid: (r: ChargeResult) => void;
}) {
  const [cfg, setCfg] = useState<PaymentsPublicConfig | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  // mock fields
  const [num, setNum] = useState("4111 1111 1111 1111");
  const [exp, setExp] = useState("12/27");
  const [cvc, setCvc] = useState("123");
  const [zip, setZip] = useState("33101");
  const cardRef = useRef<AnySquare>(null);

  const real = !!(cfg?.ready && cfg.provider === "square" && cfg.square?.appId);
  const dollars = (amountCents / 100).toLocaleString("en-US", { style: "currency", currency: "USD" });

  useEffect(() => { if (open) { setErr(""); setBusy(false); getPaymentsConfig().then(setCfg); } }, [open]);

  // Mount Square's hosted card field when configured for live cards.
  useEffect(() => {
    if (!open || !real || !cfg?.square) return;
    let card: AnySquare;
    let cancelled = false;
    (async () => {
      try {
        const Square = await loadSquareSdk(cfg.square!.env);
        const payments = Square.payments(cfg.square!.appId, cfg.square!.locationId);
        card = await payments.card();
        if (!cancelled) await card.attach("#sq-card-container");
        cardRef.current = card;
      } catch { setErr("Could not initialize the card field."); }
    })();
    return () => { cancelled = true; try { card?.destroy?.(); } catch { /* ignore */ } cardRef.current = null; };
  }, [open, real, cfg]);

  async function pay() {
    setBusy(true); setErr("");
    let sourceId: string;
    if (real) {
      try {
        const res = await cardRef.current.tokenize();
        if (res.status !== "OK") { setErr("Please complete the card details."); setBusy(false); return; }
        sourceId = res.token;
      } catch { setErr("Card tokenization failed."); setBusy(false); return; }
    } else {
      sourceId = num.replace(/\s/g, "").endsWith("0002") ? "mock-decline" : "mock-card-ok";
    }
    const r = await charge({ sourceId, amountCents, currency: "USD", referenceId, note });
    setBusy(false);
    if (!r.ok) { setErr(r.error || "Payment failed."); return; }
    onPaid(r);
    onClose();
  }

  return (
    <Modal open={open} onClose={onClose} title="Collect Payment" icon="💳" width={460}
      footer={<><button className="btn btn-ghost" onClick={onClose}>Cancel</button><button className="btn btn-primary" onClick={pay} disabled={busy}>{busy ? "Processing…" : `Charge ${dollars}`}</button></>}>
      <div className="mb-3 flex items-baseline justify-between">
        <span className="text-[12px] text-ink-muted">Amount due</span>
        <span className="text-[22px] font-extrabold tracking-tight">{dollars}</span>
      </div>
      {err && <div className="mb-3 px-3 py-2.5 rounded-md bg-red-soft text-red text-[12px] font-medium">⚠ {err}</div>}

      {real ? (
        <div>
          <label className="fl">Card</label>
          <div id="sq-card-container" className="min-h-[44px] border border-border rounded-md p-1" />
        </div>
      ) : (
        <>
          <label className="fl">Card number</label>
          <input className="fi mb-2" value={num} onChange={(e) => setNum(e.target.value)} placeholder="4111 1111 1111 1111" />
          <div className="grid grid-cols-3 gap-3">
            <div><label className="fl">Expiry</label><input className="fi" value={exp} onChange={(e) => setExp(e.target.value)} placeholder="MM/YY" /></div>
            <div><label className="fl">CVC</label><input className="fi" value={cvc} onChange={(e) => setCvc(e.target.value)} placeholder="123" /></div>
            <div><label className="fl">ZIP</label><input className="fi" value={zip} onChange={(e) => setZip(e.target.value)} placeholder="33101" /></div>
          </div>
        </>
      )}
      <div className="mt-3 text-[10.5px] text-ink-muted-2">
        {real
          ? `Live via Square (${cfg?.square?.env}). Card data is tokenized by Square and never touches our server.`
          : "Demo mode — add Square credentials to take live cards. Tip: a card ending 0002 simulates a decline."}
      </div>
    </Modal>
  );
}
