"use client";

import { useEffect, useState } from "react";
import { Pill } from "@/components/ui/Pill";
import { Toast } from "@/components/ui/Toast";
import { toast } from "@/lib/hooks/useToast";

interface BrandStatus {
  id: string;
  name: string;
  slug: string;
  isDefault: boolean;
  domains: string[];
  from: string;
  supportEmail: string;
  intakeFormSlug: string | null;
  pharmacyId: string;
  theme: { brand: string; accent?: string };
  email: { provider: string; configured: boolean; from: string };
  sms: { provider: string; configured: boolean; from: string | null };
  env: { sendgridKey: string; emailFrom: string; twilioSid: string; twilioToken: string; twilioFrom: string };
}

function Row({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex gap-2">
      <span className="text-ink-muted-2 w-[124px] flex-shrink-0">{label}</span>
      <span className={mono ? "font-mono text-[11.5px] break-all" : "break-all"}>{value}</span>
    </div>
  );
}

function EnvLine({ name, set, optional }: { name: string; set: boolean; optional?: boolean }) {
  return (
    <div className="flex items-center gap-2">
      <span style={{ color: set ? "#1E7A50" : undefined }} className={set ? "" : "text-ink-muted-2"}>
        {set ? "✓" : optional ? "·" : "—"}
      </span>
      <span>{name}</span>
      {optional && !set && <span className="text-ink-muted-2 text-[10px]">optional</span>}
    </div>
  );
}

export default function BrandsPage() {
  const [brands, setBrands] = useState<BrandStatus[] | null>(null);
  const [testTo, setTestTo] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/brands/status")
      .then((r) => r.json())
      .then((d) => setBrands(d.brands || []))
      .catch(() => setBrands([]));
  }, []);

  async function sendTest(id: string) {
    const to = (testTo[id] || "").trim();
    if (!to) { toast("Enter a recipient email"); return; }
    setBusy(id);
    const r = await fetch("/api/brands/test", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ brandId: id, to }),
    }).then((res) => res.json()).catch(() => ({ ok: false, error: "Request failed" }));
    setBusy(null);
    if (r.ok) toast(r.provider === "mock" ? "Sent (mock — no live key for this brand yet)" : "✓ Test email sent");
    else toast(`✕ ${r.error || "Send failed"}`);
  }

  return (
    <div className="px-7 py-6 text-[14px] max-w-[920px]">
      <h1 className="text-[21px] font-extrabold tracking-tight">Brands</h1>
      <div className="text-[12px] text-ink-muted mt-0.5 mb-5">
        One EMR behind multiple consumer brands. Each brand sends patient email &amp; SMS from its own domain and
        registration, orders are tagged by brand, and patient records are kept separate per brand. Fulfillment routes to
        DripVitals&rsquo; pharmacy for all brands.
      </div>

      {!brands && <div className="text-[13px] text-ink-muted">Loading…</div>}

      {brands && brands.map((b) => (
        <div key={b.id} className="bg-surface border border-border rounded-2xl p-5 mb-4">
          {/* header */}
          <div className="flex items-center gap-2.5 mb-3 flex-wrap">
            <span className="w-4 h-4 rounded-full border border-border flex-shrink-0" style={{ background: b.theme.brand }} />
            <span className="font-bold text-[16px]">{b.name}</span>
            {b.isDefault && <Pill intent="brand">Default</Pill>}
            <div className="flex-1" />
            <Pill intent={b.email.configured ? "green" : "muted"} dot>Email {b.email.configured ? "live" : "not set"}</Pill>
            <Pill intent={b.sms.configured ? "green" : "muted"} dot>SMS {b.sms.configured ? "live" : "not set"}</Pill>
          </div>

          {/* config */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2 text-[12.5px] mb-3">
            <Row label="Domains" value={b.domains.join(", ")} />
            <Row label="Sends from" value={b.from} />
            <Row label="Support" value={b.supportEmail} />
            <Row label="Intake form slug" value={b.intakeFormSlug || "—"} mono />
            <Row label="SMS from" value={b.sms.from || "—"} mono />
            <Row label="Pharmacy" value={b.pharmacyId} />
          </div>

          {/* env checklist */}
          <div className="bg-surface-3 border border-border rounded-xl p-3 mb-3">
            <div className="text-[10px] uppercase tracking-[1px] text-ink-muted-2 font-bold mb-1.5">
              Environment variables{b.isDefault ? " · base names" : ""}
            </div>
            <div className="grid grid-cols-1 gap-1 text-[12px] font-mono">
              <EnvLine name={b.env.sendgridKey} set={b.email.configured} />
              <EnvLine name={b.env.emailFrom} set={!!b.from} optional />
              <EnvLine name={b.env.twilioSid} set={b.sms.configured} />
              <EnvLine name={b.env.twilioToken} set={b.sms.configured} />
              <EnvLine name={b.env.twilioFrom} set={!!b.sms.from} />
            </div>
          </div>

          {/* test send */}
          <div className="flex items-end gap-2">
            <div className="flex-1">
              <label className="fl">Send a test email from {b.name}</label>
              <input
                className="fi"
                placeholder="you@example.com"
                value={testTo[b.id] || ""}
                onChange={(e) => setTestTo((s) => ({ ...s, [b.id]: e.target.value }))}
              />
            </div>
            <button className="btn btn-primary" disabled={busy === b.id} onClick={() => sendTest(b.id)}>
              {busy === b.id ? "Sending…" : "Send test"}
            </button>
          </div>
        </div>
      ))}

      <div className="text-[11px] text-ink-muted-2 mt-1">
        To add a brand, add an entry to <span className="font-mono">lib/brands/registry.ts</span> and set its environment
        variables above on your host. Each brand needs its sending domain authenticated (SPF/DKIM) in its own SendGrid
        account before email goes live.
      </div>
      <Toast />
    </div>
  );
}
