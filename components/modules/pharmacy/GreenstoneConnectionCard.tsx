"use client";

import { useCallback, useEffect, useState } from "react";
import { Pill } from "@/components/ui/Pill";
import { submitGreenstone } from "@/lib/pharmacy/client";
import type { GsOrderInput, GsSubmitResult } from "@/lib/pharmacy/greenstoneTypes";
import type { PharmacyEvent } from "@/lib/pharmacy/events";

interface Status {
  configured: boolean;
  live: boolean;
  sandbox: boolean;
  clinic: string;
  ncpdpid: string;
  baseUrl: string;
  webhookConfigured: boolean;
  tokenMasked: string;
}

function sampleOrder(): GsOrderInput {
  return {
    internalOrderId: `TEST-${Date.now()}`,
    firstName: "Connection",
    lastName: "Test",
    dob: "1990-01-01",
    email: "test@dripvitals.com",
    phoneNumber: "3055550100",
    address: { address: "100 Test St", city: "Miami", state: "FL", zipCode: "33128" },
    scripts: [{
      name: "Semaglutide 0.25 mg (CONNECTION TEST — do not fill)",
      dispense_quantity: "1",
      dispense_unit: "vial",
      sig: "Connection test from DripVitals — please disregard.",
      doctor: "DRIP-TEST",
      doctor_name: "Dr. Test Provider",
      doctor_npi: "1234567890",
      number_refills: 0,
      date_prescribed: new Date().toISOString().slice(0, 10),
    }],
    deliveryType: "clinic",
  };
}

export function GreenstoneConnectionCard() {
  const [status, setStatus] = useState<Status | null>(null);
  const [loadingStatus, setLoadingStatus] = useState(true);
  const [testing, setTesting] = useState(false);
  const [result, setResult] = useState<GsSubmitResult | null>(null);
  const [events, setEvents] = useState<PharmacyEvent[]>([]);
  const [loadingEvents, setLoadingEvents] = useState(false);

  const loadStatus = useCallback(async () => {
    setLoadingStatus(true);
    try {
      const r = await fetch("/api/pharmacy/greenstone/status", { cache: "no-store" });
      const j = await r.json();
      if (j?.ok) setStatus(j as Status);
    } catch { /* ignore */ }
    setLoadingStatus(false);
  }, []);

  const loadEvents = useCallback(async () => {
    setLoadingEvents(true);
    try {
      const r = await fetch("/api/store/pharmacy-events", { cache: "no-store" });
      const j = await r.json();
      const list = Array.isArray(j?.data) ? (j.data as PharmacyEvent[]) : [];
      setEvents(list.filter((e) => e?.connector === "greenstone").slice(0, 12));
    } catch { /* ignore */ }
    setLoadingEvents(false);
  }, []);

  useEffect(() => { loadStatus(); loadEvents(); }, [loadStatus, loadEvents]);

  async function sendTest() {
    setTesting(true);
    setResult(null);
    try {
      const res = await submitGreenstone(sampleOrder());
      setResult(res);
    } catch (e) {
      setResult({ ok: false, error: e instanceof Error ? e.message : "Request failed.", source: "greenstone" });
    }
    setTesting(false);
    // a successful real submission may produce a webhook shortly after
    setTimeout(loadEvents, 1500);
  }

  const live = status?.live;
  const mock = status && !status.configured;

  return (
    <div className="bg-surface border border-border rounded-2xl p-5 mb-6">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl grid place-items-center text-[20px]"
               style={{ background: "var(--color-green-soft)" }}>💊</div>
          <div>
            <div className="font-semibold text-ink flex items-center gap-2">
              GreenstoneRX (5Axis)
              {loadingStatus
                ? <Pill intent="muted">Checking…</Pill>
                : live
                  ? <Pill intent="green" dot>{status?.sandbox ? "Sandbox connected" : "Live connected"}</Pill>
                  : <Pill intent="amber" dot>Mock mode — not configured</Pill>}
            </div>
            <div className="text-[12px] text-ink-muted">5Axis Pharmacy Orders API v2 · submit, status polling, and 8 webhook events</div>
          </div>
        </div>
        <button className="btn btn-primary" disabled={testing} onClick={sendTest}>
          {testing ? "Sending test…" : "Send test order"}
        </button>
      </div>

      {/* config grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-x-4 gap-y-2 mt-4 text-[12.5px]">
        <Field label="Clinic ID" value={status?.clinic || "—"} />
        <Field label="Pharmacy NCPDPID" value={status?.ncpdpid || "—"} />
        <Field label="API token" value={status?.tokenMasked || "Not set"} />
        <Field label="Webhook secret" value={status?.webhookConfigured ? "Set ✓" : "Not set"} />
        <div className="col-span-2 sm:col-span-4">
          <div className="text-ink-muted">Endpoint</div>
          <div className="font-mono text-[11.5px] text-ink break-all">{status?.baseUrl || "—"}</div>
        </div>
      </div>

      {mock && (
        <div className="mt-3 text-[12.5px] rounded-xl px-3 py-2"
             style={{ background: "var(--color-amber-soft)" }}>
          Running in <strong>mock mode</strong>. Set <code>GREENSTONE_API_TOKEN</code> (plus <code>GREENSTONE_CLINIC</code> and <code>GREENSTONE_PHARMACY_NCPDPID</code>) in Vercel and redeploy to hit the real sandbox.
        </div>
      )}

      {/* test result */}
      {result && (
        <div className="mt-3 text-[12.5px] rounded-xl px-3 py-2.5 border"
             style={{
               borderColor: result.ok ? "var(--color-green)" : "var(--color-red)",
               background: result.ok ? "var(--color-green-soft)" : "var(--color-red-soft)",
             }}>
          {result.source === "mock" ? (
            <span>Returned a <strong>mock</strong> response (no token in this deployment). Order id <span className="font-mono">{String(result.orderId)}</span>.</span>
          ) : result.ok ? (
            result.orderId != null && String(result.orderId) !== "undefined" ? (
              <span>✓ Sandbox accepted the order. Real <strong>order_id</strong>: <span className="font-mono">{String(result.orderId)}</span>.</span>
            ) : (
              <span>✓ Sandbox accepted the order, but no recognizable <strong>order_id</strong> field was in the response — see the raw response below.</span>
            )
          ) : (
            <span>✗ {result.error || "Submission failed."}</span>
          )}
          {result.raw != null && (
            <details className="mt-2 text-[11px]">
              <summary className="cursor-pointer text-ink-muted">Raw pharmacy response</summary>
              <pre className="mt-1 overflow-auto whitespace-pre-wrap break-all max-h-56">{JSON.stringify(result.raw, null, 2)}</pre>
            </details>
          )}
        </div>
      )}

      {/* incoming webhook events */}
      <div className="mt-5">
        <div className="flex items-center justify-between mb-2">
          <div className="text-[12.5px] font-semibold text-ink">Incoming webhook events</div>
          <button className="btn btn-ghost text-[12px]" disabled={loadingEvents} onClick={loadEvents}>
            {loadingEvents ? "Refreshing…" : "Refresh"}
          </button>
        </div>
        {events.length === 0 ? (
          <div className="text-[12px] text-ink-muted rounded-xl border border-dashed border-border px-3 py-3">
            No events yet. When GreenstoneRX posts a status update to <code>/api/pharmacy/greenstone/webhook</code>, it shows up here.
          </div>
        ) : (
          <div className="divide-y divide-border border border-border rounded-xl overflow-hidden">
            {events.map((e) => (
              <div key={e.id} className="flex items-center justify-between gap-3 px-3 py-2 text-[12.5px]">
                <div className="flex items-center gap-2 min-w-0">
                  <Pill intent="muted">{e.status || e.event}</Pill>
                  <span className="text-ink-muted truncate">
                    order <span className="font-mono">{String(e.orderId ?? e.internalOrderId ?? "—")}</span>
                    {e.trackingNumber ? <> · {e.trackingNumber}</> : null}
                  </span>
                </div>
                <span className="text-ink-muted whitespace-nowrap">{new Date(e.at).toLocaleString()}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-ink-muted">{label}</div>
      <div className="text-ink font-medium break-all">{value}</div>
    </div>
  );
}
