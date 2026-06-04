"use client";

import { useEffect, useRef, useState } from "react";

interface Tmpl { type: string; label: string; description: string; placeholders: string[]; subject: string; html: string; }

const SAMPLE: Record<string, Record<string, string>> = {
  new_message: { name: "Matthew", message: "Your refill has been approved and ships today." },
  welcome: { name: "Matthew" },
  intake_reminder: { name: "Matthew" },
  approval: { name: "Matthew", treatment: " (Semaglutide 3-Month)" },
  rx_pharmacy: { name: "Matthew", medication: " (Semaglutide 0.25 mg)", pharmacy: "Hallandale Pharmacy" },
  order_processing: { name: "Matthew", orderId: "BX-1042", status: "Being prepared" },
  shipment: { name: "Matthew", carrier: "FedEx", tracking: "7712 3456 7890", eta: "Jun 9, 2026", orderId: "BX-1042" },
  delivered: { name: "Matthew", orderId: "BX-1042" },
  refill_10day: { name: "Matthew", medication: "Semaglutide 0.25 mg", refillDate: "Jul 1, 2026" },
  refill_5day: { name: "Matthew", medication: "Semaglutide 0.25 mg", refillDate: "Jul 1, 2026" },
  refill_overdue: { name: "Matthew", medication: "Semaglutide 0.25 mg" },
  checkin_30day: { name: "Matthew" },
  payment_failed: { name: "Matthew", amount: "$189.00", plan: "1-Month Semaglutide" },
  inactive_30day: { name: "Matthew" },
};

function render(s: string, data: Record<string, string>) {
  return s.replace(/\{\{\s*(\w+)\s*\}\}/g, (_, k) => (data[k] != null ? String(data[k]) : ""));
}

export default function EmailTemplatesPage() {
  const [templates, setTemplates] = useState<Tmpl[]>([]);
  const [defaults, setDefaults] = useState<Record<string, Tmpl>>({});
  const [buf, setBuf] = useState<Record<string, { subject: string; html: string }>>({});
  const [loading, setLoading] = useState(true);
  const [persistent, setPersistent] = useState(true);
  const [testEmail, setTestEmail] = useState("mattgromadzki@gmail.com");
  const [status, setStatus] = useState<Record<string, string>>({});
  const fileRefs = useRef<Record<string, HTMLInputElement | null>>({});

  useEffect(() => {
    (async () => {
      try {
        const [cur, def] = await Promise.all([
          fetch("/api/notify/templates", { cache: "no-store" }).then((r) => r.json()),
          fetch("/api/notify/templates?defaults=1", { cache: "no-store" }).then((r) => r.json()),
        ]);
        if (cur?.templates) {
          setTemplates(cur.templates);
          setPersistent(!!cur.persistent);
          const b: Record<string, { subject: string; html: string }> = {};
          cur.templates.forEach((t: Tmpl) => { b[t.type] = { subject: t.subject, html: t.html }; });
          setBuf(b);
        }
        if (def?.templates) {
          const d: Record<string, Tmpl> = {};
          def.templates.forEach((t: Tmpl) => { d[t.type] = t; });
          setDefaults(d);
        }
      } catch { /* ignore */ }
      setLoading(false);
    })();
  }, []);

  function setField(type: string, key: "subject" | "html", val: string) {
    setBuf((b) => ({ ...b, [type]: { ...b[type], [key]: val } }));
  }
  function flash(type: string, msg: string) {
    setStatus((s) => ({ ...s, [type]: msg }));
    setTimeout(() => setStatus((s) => ({ ...s, [type]: "" })), 2600);
  }

  async function save(t: Tmpl) {
    const body = { type: t.type, subject: buf[t.type].subject, html: buf[t.type].html };
    try {
      const r = await fetch("/api/notify/templates", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const d = await r.json();
      flash(t.type, d?.ok ? "✓ Saved" : `✕ ${d?.error || "Save failed"}`);
    } catch { flash(t.type, "✕ Save failed"); }
  }

  async function sendTest(t: Tmpl) {
    if (!testEmail) { flash(t.type, "Enter a test email above"); return; }
    try {
      const r = await fetch("/api/notify", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ type: t.type, to: testEmail, toName: "Test", data: SAMPLE[t.type] || {} }) });
      const d = await r.json();
      flash(t.type, d?.ok ? `✓ Test sent (${d.provider})` : `✕ ${d?.error || "Send failed"}`);
    } catch { flash(t.type, "✕ Send failed"); }
  }

  function upload(type: string, file: File) {
    const reader = new FileReader();
    reader.onload = () => { setField(type, "html", String(reader.result)); flash(type, "✓ File loaded — review & Save"); };
    reader.readAsText(file);
  }

  function reset(t: Tmpl) {
    const d = defaults[t.type];
    if (d) { setField(t.type, "subject", d.subject); setField(t.type, "html", d.html); flash(t.type, "Reverted to default — Save to apply"); }
  }

  if (loading) return <div className="p-6 text-ink-muted text-[13px]">Loading templates…</div>;

  return (
    <div className="p-6 max-w-[1100px]">
      <h1 className="text-[22px] font-extrabold tracking-tight">Email Templates</h1>
      <p className="text-[13px] text-ink-muted mt-1 mb-4">Customize the HTML for each alert email. Paste HTML or upload an <code>.html</code> file, preview with sample data, and send a test.</p>

      {!persistent && (
        <div className="mb-4 px-3 py-2.5 rounded-lg bg-amber-soft text-amber text-[12.5px]">
          ⚠ Templates aren&apos;t persisting — connect the Upstash database (Vercel → Storage) so saved templates survive deploys. They&apos;ll work locally meanwhile.
        </div>
      )}

      <div className="flex items-center gap-2 mb-5 p-3 rounded-xl bg-surface-2 border border-border">
        <label className="fl !mb-0 whitespace-nowrap">Send test emails to</label>
        <input className="fi !mb-0 max-w-[320px]" value={testEmail} onChange={(e) => setTestEmail(e.target.value)} placeholder="you@example.com" />
        <span className="text-[11.5px] text-ink-muted-2">Uses sample data to fill placeholders.</span>
      </div>

      <div className="flex flex-col gap-5">
        {templates.map((t) => {
          const b = buf[t.type] || { subject: "", html: "" };
          return (
            <div key={t.type} className="bg-surface border border-border rounded-2xl overflow-hidden">
              <div className="px-5 py-3.5 border-b border-border flex items-center justify-between gap-3 flex-wrap">
                <div>
                  <div className="text-[15px] font-bold">{t.label}</div>
                  <div className="text-[12px] text-ink-muted">{t.description}</div>
                </div>
                <div className="flex items-center gap-2">
                  {status[t.type] && <span className="text-[12px] font-semibold text-brand-dk">{status[t.type]}</span>}
                  <button className="btn btn-ghost btn-sm" onClick={() => reset(t)}>Reset</button>
                  <button className="btn btn-ghost btn-sm" onClick={() => sendTest(t)}>✉️ Send test</button>
                  <button className="btn btn-primary btn-sm" onClick={() => save(t)}>Save</button>
                </div>
              </div>

              <div className="px-5 py-4">
                <div className="text-[11px] uppercase tracking-wide text-ink-muted font-bold mb-1.5">
                  Placeholders (auto-filled): {t.placeholders.map((p) => <code key={p} className="mx-0.5 px-1.5 py-0.5 rounded bg-surface-3 text-ink-2 text-[11px]">{`{{${p}}}`}</code>)}
                </div>

                <label className="fl mt-3">Subject line</label>
                <input className="fi" value={b.subject} onChange={(e) => setField(t.type, "subject", e.target.value)} />

                <div className="grid md:grid-cols-2 gap-4 mt-3">
                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <label className="fl !mb-0">HTML</label>
                      <button className="text-[11.5px] text-brand font-semibold" onClick={() => fileRefs.current[t.type]?.click()}>⬆ Upload .html</button>
                      <input ref={(el) => { fileRefs.current[t.type] = el; }} type="file" accept=".html,.htm,text/html" hidden
                        onChange={(e) => { const f = e.target.files?.[0]; if (f) upload(t.type, f); e.currentTarget.value = ""; }} />
                    </div>
                    <textarea className="fi font-mono text-[11.5px] leading-relaxed" style={{ minHeight: 300, resize: "vertical", whiteSpace: "pre" }}
                      value={b.html} onChange={(e) => setField(t.type, "html", e.target.value)} spellCheck={false} />
                  </div>
                  <div>
                    <label className="fl">Live preview (sample data)</label>
                    <iframe title={`${t.type}-preview`} className="w-full bg-white border border-border rounded-lg" style={{ minHeight: 300 }}
                      srcDoc={render(b.html || "", SAMPLE[t.type] || {})} />
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
