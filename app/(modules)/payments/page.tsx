"use client";

import { useEffect, useState, useCallback } from "react";
import { Pill } from "@/components/ui/Pill";
import { Toast } from "@/components/ui/Toast";
import { toast } from "@/lib/hooks/useToast";
import { usePermission } from "@/lib/rbac/usePermission";

interface Entry {
  id: string; kind: "subscription" | "payment" | "refund"; provider?: string; email: string; name?: string;
  customerId?: string; subscriptionId?: string; paymentId?: string; paymentIntentId?: string; chargeId?: string;
  planName?: string; amountCents?: number; currency?: string; status?: string; receiptUrl?: string; createdAt: string;
}

const money = (c?: number, cur = "usd") => c == null ? "—" : new Intl.NumberFormat("en-US", { style: "currency", currency: cur.toUpperCase() }).format(c / 100);
const fmtDate = (iso: string) => { const d = new Date(iso); return isNaN(d.getTime()) ? iso : d.toLocaleString([], { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" }); };

function statusIntent(s?: string): "green" | "amber" | "red" | "muted" | "blue" {
  if (!s) return "muted";
  if (["active", "paid", "trialing"].includes(s)) return "green";
  if (["past_due", "incomplete", "unpaid"].includes(s)) return "amber";
  if (["failed", "canceled", "refunded"].includes(s)) return s === "refunded" ? "blue" : "red";
  return "muted";
}

export default function PaymentsPage() {
  const canRefund = usePermission("payments.charge");
  const [data, setData] = useState<{ enabled: boolean; persistent: boolean; provider?: string; entries: Entry[] } | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(async () => {
    try { const r = await fetch("/api/stripe/ledger", { cache: "no-store" }); const j = await r.json(); if (j.ok) setData({ enabled: j.enabled, persistent: j.persistent, provider: j.provider, entries: j.entries || [] }); }
    catch { setData({ enabled: false, persistent: false, entries: [] }); }
  }, []);
  useEffect(() => { load(); }, [load]);

  async function refund(e: Entry) {
    if (!confirm(`Refund ${money(e.amountCents, e.currency)} to ${e.email || "customer"}?`)) return;
    setBusy(e.id);
    try {
      const r = await fetch("/api/payments/refund", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ paymentId: e.paymentId, chargeId: e.chargeId, paymentIntentId: e.paymentIntentId, amountCents: e.amountCents, currency: e.currency, email: e.email, name: e.name }) });
      const j = await r.json();
      toast(j.ok ? "💸 Refund issued" : "⚠️ " + (j.error || "Refund failed"));
      if (j.ok) load();
    } finally { setBusy(null); }
  }
  async function portal(e: Entry) {
    if (!e.customerId) { toast("Customer-portal management isn't available for this gateway"); return; }
    setBusy(e.id);
    try {
      const r = await fetch("/api/stripe/portal", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ customerId: e.customerId }) });
      const j = await r.json();
      if (j.ok && j.url) window.open(j.url, "_blank"); else toast("⚠️ " + (j.error || "Couldn't open portal"));
    } finally { setBusy(null); }
  }

  const entries = data?.entries || [];

  return (
    <div className="px-7 py-6 text-[14px]">
      <div className="mb-4">
        <h1 className="text-[21px] font-extrabold tracking-tight">Payments</h1>
        <div className="text-[12px] text-ink-muted mt-0.5">Live subscriptions, payments, and refunds processed through your payment gateway</div>
      </div>

      {data && !data.enabled && (
        <div className="bg-amber-soft text-amber border border-amber/30 rounded-xl p-4 mb-4 text-[13px] leading-relaxed">
          <b>Payment gateway not fully connected{data.provider ? ` (${data.provider})` : ""}.</b> Add your CorePay credentials in Vercel
          (<span className="font-mono">PAYMENTS_PROVIDER=corepay</span>, <span className="font-mono">COREPAY_CLIENT_ID</span>, <span className="font-mono">COREPAY_API_KEY</span>, <span className="font-mono">COREPAY_SITE_ID</span>, <span className="font-mono">COREPAY_MID_USD</span>) and confirm the API request/response mapping with CorePay's docs. Until then, recurring billing runs in safe mock mode and live activity appears here once charges go through.
        </div>
      )}
      {data?.enabled && !data.persistent && (
        <div className="bg-amber-soft text-amber border border-amber/30 rounded-xl p-3 mb-4 text-[12.5px]">The gateway is connected, but Upstash isn't — live records won't persist across sessions until it is.</div>
      )}

      {entries.length === 0 ? (
        <div className="bg-surface border border-border rounded-xl py-12 text-center text-ink-muted">
          <div className="text-[34px] opacity-40 mb-2">💳</div>
          <div className="text-[13px] font-bold text-ink mb-1">No live payment activity yet</div>
          <div className="text-[11.5px]">Subscriptions, payments, and refunds will show here once charges run through your gateway.</div>
        </div>
      ) : (
        <div className="bg-surface border border-border rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full border-collapse min-w-[760px]">
              <thead><tr className="bg-surface-2">{["Type", "Customer", "Plan", "Amount", "Status", "Date", ""].map((h) => <th key={h} className="text-left text-[10px] uppercase tracking-wide text-ink-muted font-bold px-3 py-2.5 border-b border-border">{h}</th>)}</tr></thead>
              <tbody>
                {entries.map((e) => (
                  <tr key={e.id} className="border-b border-border last:border-none hover:bg-surface-2 transition-colors">
                    <td className="px-3 py-2.5 capitalize">{e.kind === "subscription" ? "📄 Subscription" : e.kind === "refund" ? "↩️ Refund" : "💵 Payment"}</td>
                    <td className="px-3 py-2.5"><div className="font-semibold text-[12.5px]">{e.name || "—"}</div><div className="text-[11px] text-ink-muted">{e.email}</div></td>
                    <td className="px-3 py-2.5 text-[12.5px]">{e.planName || "—"}</td>
                    <td className="px-3 py-2.5 font-semibold">{money(e.amountCents, e.currency)}</td>
                    <td className="px-3 py-2.5"><Pill intent={statusIntent(e.status)} dot>{e.status || "—"}</Pill></td>
                    <td className="px-3 py-2.5 text-[11.5px] text-ink-muted whitespace-nowrap">{fmtDate(e.createdAt)}</td>
                    <td className="px-3 py-2.5 whitespace-nowrap text-right">
                      {e.kind === "payment" && e.status === "paid" && canRefund && (e.paymentId || e.paymentIntentId || e.chargeId) && (
                        <button className="btn btn-ghost btn-sm" disabled={busy === e.id} onClick={() => refund(e)}>Refund</button>
                      )}
                      {e.kind === "subscription" && e.customerId && (
                        <button className="btn btn-ghost btn-sm" disabled={busy === e.id} onClick={() => portal(e)}>Manage</button>
                      )}
                      {e.receiptUrl && <a className="btn btn-ghost btn-sm" href={e.receiptUrl} target="_blank" rel="noreferrer">Invoice</a>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
      <Toast />
    </div>
  );
}
