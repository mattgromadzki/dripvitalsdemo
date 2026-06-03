"use client";

import { useEffect, useMemo, useState } from "react";
import { Pill } from "@/components/ui/Pill";
import { Toast } from "@/components/ui/Toast";
import { toast } from "@/lib/hooks/useToast";
import { getHealth, testConnector } from "@/lib/integrations/healthClient";
import type { HealthItem } from "@/lib/integrations/health";

const CAT_ICON: Record<string, string> = { Email: "✉️", SMS: "📲", Payments: "💳", Pharmacy: "💊" };

export default function ConnectionsPage() {
  const [items, setItems] = useState<HealthItem[]>([]);
  const [testing, setTesting] = useState<string | null>(null);

  useEffect(() => { getHealth().then(setItems); }, []);

  const groups = useMemo(() => {
    const m: Record<string, HealthItem[]> = {};
    items.forEach((i) => { (m[i.category] ||= []).push(i); });
    return Object.entries(m);
  }, [items]);

  const connected = items.filter((i) => i.status === "connected").length;

  async function test(id: string) {
    setTesting(id);
    const r = await testConnector(id);
    setTesting(null);
    toast(r.ok ? `✓ ${r.message}` : `✕ ${r.error}`);
  }

  const KPI = ({ label, value, intent }: { label: string; value: string; intent?: string }) => <div className="bg-surface border border-border rounded-2xl px-4 py-3 min-w-[130px]"><div className={`text-[22px] font-extrabold leading-none ${intent || ""}`}>{value}</div><div className="text-[11px] text-ink-muted mt-1.5">{label}</div></div>;

  return (
    <div className="px-7 py-6 text-[14px]">
      <h1 className="text-[21px] font-extrabold tracking-tight">Connection Health</h1>
      <div className="text-[12px] text-ink-muted mt-0.5 mb-4">Live status for every external integration · test from one place</div>

      <div className="flex flex-wrap gap-2.5 mb-5">
        <KPI label="Connected" value={`${connected}/${items.length}`} intent="text-green" />
        <KPI label="Using mock" value={String(items.length - connected)} intent={items.length - connected ? "text-amber" : ""} />
        <KPI label="Integrations" value={String(items.length)} />
      </div>

      {groups.map(([cat, list]) => (
        <div key={cat} className="mb-5">
          <div className="text-[11px] uppercase tracking-wide text-ink-muted font-bold mb-2">{CAT_ICON[cat]} {cat}</div>
          <div className="grid grid-cols-2 gap-3">
            {list.map((it) => (
              <div key={it.id} className="bg-surface border border-border rounded-xl p-4">
                <div className="flex items-center gap-2 mb-1.5">
                  <span className="font-bold text-[14px]">{it.name}</span>
                  <div className="flex-1" />
                  {it.status === "connected" ? <Pill intent="green" dot>Connected</Pill> : <Pill intent="amber" dot>Mock</Pill>}
                </div>
                <div className="text-[12px] text-ink-muted mb-0.5">{it.mode}</div>
                <div className="text-[11.5px] font-mono text-ink-muted-2 truncate">{it.endpoint}</div>
                {it.detail && <div className="text-[11px] text-ink-muted mt-1">{it.detail}</div>}
                <button className="btn btn-ghost btn-sm mt-3" onClick={() => test(it.id)} disabled={testing === it.id}>{testing === it.id ? "Testing…" : "Test connection"}</button>
              </div>
            ))}
          </div>
        </div>
      ))}

      <div className="text-[11px] text-ink-muted-2">Status reflects whether live credentials are present (set them under <b>API Keys</b> or in <code>.env.local</code>). “Connected” means real calls will be made from your server; “Mock” means a safe simulated response. Tests run from your server, not the browser.</div>
      <Toast />
    </div>
  );
}
