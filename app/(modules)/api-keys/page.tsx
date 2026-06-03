"use client";

import { useEffect, useState } from "react";
import { Pill } from "@/components/ui/Pill";
import { Toast } from "@/components/ui/Toast";
import { toast } from "@/lib/hooks/useToast";
import { getIntegrations, saveIntegrations, testIntegration, type IntegrationStatus } from "@/lib/integrations/client";

export default function ApiKeysPage() {
  const [status, setStatus] = useState<IntegrationStatus | null>(null);

  // email form
  const [emProvider, setEmProvider] = useState<"sendgrid" | "resend">("sendgrid");
  const [emKey, setEmKey] = useState("");
  const [emFrom, setEmFrom] = useState("");
  const [emBusy, setEmBusy] = useState(false);

  // sms form
  const [sid, setSid] = useState("");
  const [token, setToken] = useState("");
  const [smsFrom, setSmsFrom] = useState("");
  const [smsBusy, setSmsBusy] = useState(false);

  useEffect(() => { getIntegrations().then((s) => { if (s) { setStatus(s); setEmProvider((s.email.provider as "sendgrid" | "resend") || "sendgrid"); setEmFrom(s.email.from || ""); setSmsFrom(s.sms.from || ""); } }); }, []);

  async function saveEmail() {
    setEmBusy(true);
    const s = await saveIntegrations({ email: { provider: emProvider, apiKey: emKey || undefined, from: emFrom || undefined } });
    setEmBusy(false); setEmKey("");
    if (s) { setStatus(s); toast("Email credentials saved"); } else toast("Save failed");
  }
  async function saveSms() {
    setSmsBusy(true);
    const s = await saveIntegrations({ sms: { accountSid: sid || undefined, authToken: token || undefined, from: smsFrom || undefined } });
    setSmsBusy(false); setSid(""); setToken("");
    if (s) { setStatus(s); toast("SMS credentials saved"); } else toast("Save failed");
  }
  async function test(which: "email" | "sms") {
    const r = await testIntegration(which);
    toast(r.ok ? `✓ ${r.message}` : `✕ ${r.error}`);
  }

  const StatusPill = ({ ok }: { ok: boolean }) => <Pill intent={ok ? "green" : "muted"} dot>{ok ? "Connected" : "Not configured"}</Pill>;

  return (
    <div className="px-7 py-6 text-[14px] max-w-[860px]">
      <h1 className="text-[21px] font-extrabold tracking-tight">API Keys</h1>
      <div className="text-[12px] text-ink-muted mt-0.5 mb-5">Credentials for your messaging providers. Used by the Email and SMS modules to send for real.</div>

      {/* Email / SendGrid */}
      <div className="bg-surface border border-border rounded-2xl p-5 mb-4">
        <div className="flex items-center gap-2.5 mb-3">
          <span className="text-[18px]">✉️</span>
          <span className="font-bold text-[15px]">Email — SendGrid</span>
          <div className="flex-1" />
          {status && <StatusPill ok={status.email.configured} />}
        </div>
        {status?.email.configured && <div className="text-[12px] text-ink-muted mb-3">Current key: <span className="font-mono">{status.email.keyMask}</span>{status.email.from ? ` · from ${status.email.from}` : ""}</div>}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="fl">Provider</label>
            <select className="fsel w-full" value={emProvider} onChange={(e) => setEmProvider(e.target.value as "sendgrid" | "resend")}>
              <option value="sendgrid">SendGrid</option><option value="resend">Resend</option>
            </select>
          </div>
          <div>
            <label className="fl">From (name &lt;email&gt;)</label>
            <input className="fi" value={emFrom} onChange={(e) => setEmFrom(e.target.value)} placeholder="DripVitals <care@yourdomain.com>" />
          </div>
        </div>
        <label className="fl mt-2.5">{emProvider === "sendgrid" ? "SendGrid API key" : "Resend API key"}</label>
        <input className="fi" type="password" value={emKey} onChange={(e) => setEmKey(e.target.value)} placeholder={status?.email.configured ? "•••••• (leave blank to keep)" : "SG.xxxx…"} autoComplete="off" />
        <div className="flex gap-2 mt-3">
          <button className="btn btn-primary" onClick={saveEmail} disabled={emBusy}>{emBusy ? "Saving…" : "Save"}</button>
          <button className="btn btn-ghost" onClick={() => test("email")}>Test connection</button>
        </div>
      </div>

      {/* SMS / Twilio */}
      <div className="bg-surface border border-border rounded-2xl p-5">
        <div className="flex items-center gap-2.5 mb-3">
          <span className="text-[18px]">📲</span>
          <span className="font-bold text-[15px]">SMS — Twilio</span>
          <div className="flex-1" />
          {status && <StatusPill ok={status.sms.configured} />}
        </div>
        {status?.sms.configured && <div className="text-[12px] text-ink-muted mb-3">Account SID: <span className="font-mono">{status.sms.sidMask}</span> · token {status.sms.tokenSet ? "set" : "not set"}{status.sms.from ? ` · from ${status.sms.from}` : ""}</div>}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="fl">Account SID</label>
            <input className="fi" value={sid} onChange={(e) => setSid(e.target.value)} placeholder={status?.sms.configured ? "•••• (leave blank to keep)" : "ACxxxx…"} autoComplete="off" />
          </div>
          <div>
            <label className="fl">From number</label>
            <input className="fi" value={smsFrom} onChange={(e) => setSmsFrom(e.target.value)} placeholder="+1XXXXXXXXXX" />
          </div>
        </div>
        <label className="fl mt-2.5">Auth Token</label>
        <input className="fi" type="password" value={token} onChange={(e) => setToken(e.target.value)} placeholder={status?.sms.tokenSet ? "•••••• (leave blank to keep)" : "your auth token"} autoComplete="off" />
        <div className="flex gap-2 mt-3">
          <button className="btn btn-primary" onClick={saveSms} disabled={smsBusy}>{smsBusy ? "Saving…" : "Save"}</button>
          <button className="btn btn-ghost" onClick={() => test("sms")}>Test connection</button>
        </div>
      </div>

      <div className="text-[11px] text-ink-muted-2 mt-4">Keys are stored server-side for this session and never shown in full. For production, store them in a secret manager — see notes.</div>
      <Toast />
    </div>
  );
}
