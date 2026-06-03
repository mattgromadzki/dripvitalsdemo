"use client";

import { useEffect, useState } from "react";
import { Modal } from "@/components/ui/Modal";
import type { Affiliate, AffiliatePayout } from "@/lib/types";

interface PayCommissionModalProps {
  affiliate: Affiliate | null;
  onClose: () => void;
  onPay: (method: AffiliatePayout["method"], period: string) => void;
}

function defaultPeriod(): string {
  const d = new Date();
  d.setMonth(d.getMonth() - 1);
  const months = ["January","February","March","April","May","June","July","August","September","October","November","December"];
  return `${months[d.getMonth()]} ${d.getFullYear()}`;
}

const METHODS: AffiliatePayout["method"][] = ["Stripe Transfer", "PayPal", "Wire", "Check"];

export function PayCommissionModal({ affiliate, onClose, onPay }: PayCommissionModalProps) {
  const [method, setMethod] = useState<AffiliatePayout["method"]>("Stripe Transfer");
  const [period, setPeriod] = useState(defaultPeriod());

  useEffect(() => {
    if (affiliate) {
      setMethod("Stripe Transfer");
      setPeriod(defaultPeriod());
    }
  }, [affiliate]);

  if (!affiliate) return null;

  return (
    <Modal
      open={!!affiliate}
      onClose={onClose}
      title="Pay Commission"
      icon="💸"
      width={460}
      footer={
        <>
          <button className="btn btn-ghost" onClick={onClose}>Cancel</button>
          <button
            className="btn btn-primary"
            onClick={() => onPay(method, period)}
            disabled={affiliate.commissionPending <= 0}
          >
            💸 Pay ${affiliate.commissionPending.toLocaleString()}
          </button>
        </>
      }
    >
      <div className="mb-4 bg-surface-2 border border-border rounded-md p-3.5 flex items-center gap-3">
        <div
          className="w-10 h-10 rounded-full flex items-center justify-center text-[11px] font-bold text-white flex-shrink-0"
          style={{ background: affiliate.color }}
        >
          {affiliate.name.split(" ").map((s) => s[0]).join("").slice(0, 2)}
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-[13px] font-bold">{affiliate.name}</div>
          <div className="text-[11px] text-ink-muted">{affiliate.handle} · Code: <span className="font-mono">{affiliate.code}</span></div>
        </div>
        <div className="text-right">
          <div className="text-[18px] font-extrabold text-violet leading-none">${affiliate.commissionPending.toLocaleString()}</div>
          <div className="text-[10.5px] text-ink-muted mt-0.5">pending</div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 mb-3">
        <div>
          <label className="fl">Payment Method</label>
          <select className="fsel" value={method} onChange={(e) => setMethod(e.target.value as AffiliatePayout["method"])}>
            {METHODS.map((m) => <option key={m} value={m}>{m}</option>)}
          </select>
        </div>
        <div>
          <label className="fl">Commission Period</label>
          <input
            className="fi"
            placeholder="April 2026"
            value={period}
            onChange={(e) => setPeriod(e.target.value)}
          />
        </div>
      </div>

      {affiliate.contactEmail && (
        <div className="text-[11px] text-ink-muted mb-3">
          A payout receipt will be emailed to <strong className="text-ink-2">{affiliate.contactEmail}</strong>.
        </div>
      )}

      <div className="text-[11px] text-ink-muted bg-surface-2 border border-border rounded px-3 py-2 flex items-center gap-2">
        <span className="text-[13px]">💸</span>
        <span>
          Payout is recorded on the affiliate's history. Pending balance will reset to $0. This action cannot be undone — initiate via reversal request only.
        </span>
      </div>
    </Modal>
  );
}
