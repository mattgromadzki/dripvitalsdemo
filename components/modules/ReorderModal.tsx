"use client";

import { useEffect, useState } from "react";
import { Modal } from "@/components/ui/Modal";
import type { InventoryItem } from "@/lib/types";

interface ReorderModalProps {
  open: boolean;
  onClose: () => void;
  item: InventoryItem | null;
  onSubmit: (qty: number) => void;
}

export function ReorderModal({ open, onClose, item, onSubmit }: ReorderModalProps) {
  const [qty, setQty] = useState(0);
  const [error, setError] = useState("");

  useEffect(() => {
    if (open && item) {
      // Default to enough to top up to 2× reorder threshold
      setQty(Math.max(item.reorderAt * 2 - item.stock - (item.onOrder || 0), item.reorderAt));
      setError("");
    }
  }, [open, item]);

  if (!item) return null;

  function handleSubmit() {
    if (qty <= 0) { setError("Quantity must be greater than zero"); return; }
    onSubmit(qty);
    onClose();
  }

  const unitPrice = item.pricePerUnit || 0;
  const estCost = unitPrice * qty;
  const newProjected = item.stock + (item.onOrder || 0) + qty;

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={`Reorder ${item.name}`}
      icon="📦"
      width={460}
      footer={
        <>
          <button className="btn btn-ghost" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" onClick={handleSubmit}>📦 Place Reorder</button>
        </>
      }
    >
      {error && (
        <div className="mb-3 px-3 py-2.5 rounded-md bg-red-soft border border-red-soft text-red text-[12px] font-medium">
          ⚠ {error}
        </div>
      )}

      {/* Current stock summary */}
      <div className="grid grid-cols-3 gap-2.5 mb-4">
        <Box label="Current Stock" value={String(item.stock)} color={item.stock === 0 ? "var(--color-red)" : "var(--color-ink)"} />
        <Box label="Reorder At"    value={String(item.reorderAt)} color="var(--color-ink-muted)" />
        <Box label="On Order"      value={String(item.onOrder || 0)} color="var(--color-amber)" />
      </div>

      <div className="mb-3">
        <label className="fl">Pharmacy / Supplier</label>
        <input className="fi" value={item.pharmacy} disabled />
      </div>

      <div className="mb-3">
        <label className="fl">Quantity to Order<span className="text-red ml-0.5">*</span></label>
        <input
          type="number"
          min={1}
          className="fi"
          value={qty}
          onChange={(e) => setQty(parseInt(e.target.value, 10) || 0)}
        />
      </div>

      {/* Order summary */}
      <div className="bg-surface-2 border border-border rounded-md p-3.5">
        <div className="text-[10.5px] font-bold uppercase tracking-widest text-ink-muted mb-2">Order Summary</div>
        <SummaryRow label="Quantity"             value={`${qty} units`} />
        {unitPrice > 0 && <SummaryRow label="Unit Price" value={`$${unitPrice}`} />}
        {unitPrice > 0 && <SummaryRow label="Estimated Cost" value={`$${estCost.toLocaleString()}`} bold accent="brand" />}
        <SummaryRow label="Projected Stock"      value={`${newProjected} units after delivery`} />
        <SummaryRow label="ETA"                  value="3–5 business days" />
      </div>

      <div className="mt-3 text-[11px] text-ink-muted bg-blue-soft border border-blue rounded px-3 py-2 flex items-center gap-2" style={{ borderColor: "rgba(58,121,196,.25)" }}>
        <span className="text-[13px]">ℹ️</span>
        <span>Reorder confirmation will be emailed to <strong>{item.pharmacy}</strong>. PO number generated on submission.</span>
      </div>
    </Modal>
  );
}

function Box({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div className="bg-surface-2 border border-border rounded-md py-2.5 px-3 text-center">
      <div className="text-[10px] font-bold uppercase tracking-widest text-ink-muted mb-1">{label}</div>
      <div className="text-[17px] font-extrabold leading-none" style={{ color }}>{value}</div>
    </div>
  );
}

function SummaryRow({ label, value, bold, accent }: { label: string; value: string; bold?: boolean; accent?: "brand" }) {
  const color = accent === "brand" ? "var(--color-brand)" : "var(--color-ink)";
  return (
    <div className="flex justify-between items-center py-1 text-[12px]">
      <span className="text-ink-muted">{label}</span>
      <span className={`${bold ? "font-bold text-[13px]" : "font-semibold"}`} style={bold ? { color } : undefined}>{value}</span>
    </div>
  );
}
