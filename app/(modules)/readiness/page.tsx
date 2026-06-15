"use client";

import { useEffect, useState } from "react";
import { Pill } from "@/components/ui/Pill";

interface Brand { id: string; name: string; email: boolean; sms: boolean; emailEnv: string; smsEnv: string }
interface Readiness {
  ok: boolean;
  db: { configured: boolean; ok: boolean };
  redis: boolean;
  brands: Brand[];
  payments: { provider: string | null; ready: boolean; detail: string; env: string[] };
  pharmacy: { ready: boolean; which: string | null; env: string[] };
  address: { ready: boolean; env: string[] };
  shipping: { ready: boolean; env: string[] };
  sentry: boolean;
  authSecret: boolean;
  appUrl: boolean;
  cron: boolean;
  demoData: boolean;
}

type State = "ready" | "missing" | "warn" | "info";

function Status({ state, label }: { state: State; label: string }) {
  const intent = state === "ready" ? "green" : state === "warn" ? "amber" : state === "info" ? "blue" : "muted";
  return <Pill intent={intent} dot={state !== "info"}>{label}</Pill>;
}

function Item({ name, state, label, detail, env }: { name: string; state: State; label: string; detail?: string; env?: string[] }) {
  return (
    <div className="flex items-start gap-3 py-2.5 border-b border-border last:border-0">
      <div className="flex-1 min-w-0">
        <div className="font-semibold text-[13.5px]">{name}</div>
        {detail && <div className="text-[12px] text-ink-muted mt-0.5">{detail}</div>}
        {state === "missing" && env && env.length > 0 && (
          <div className="text-[11px] font-mono text-ink-muted-2 mt-1 break-all">needs: {env.join(", ")}</div>
        )}
      </div>
      <Status state={state} label={label} />
    </div>
  );
}

function Group({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-surface border border-border rounded-2xl p-5 mb-4">
      <div className="text-[10px] uppercase tracking-[1px] text-ink-muted-2 font-bold mb-1.5">{title}</div>
      {children}
    </div>
  );
}

export default function ReadinessPage() {
  const [d, setD] = useState<Readiness | null>(null);
  const [err, setErr] = useState(false);

  useEffect(() => {
    fetch("/api/readiness").then((r) => r.json()).then((j) => (j?.ok ? setD(j) : setErr(true))).catch(() => setErr(true));
  }, []);

  // Required-for-launch items → progress count
  const requiredReady = d
    ? [d.db.ok, d.authSecret, d.brands[0]?.email, d.payments.ready, d.pharmacy.ready].filter(Boolean).length
    : 0;
  const requiredTotal = 5;

  return (
    <div className="px-7 py-6 text-[14px] max-w-[920px]">
      <h1 className="text-[21px] font-extrabold tracking-tight">Launch readiness</h1>
      <div className="text-[12px] text-ink-muted mt-0.5 mb-5">
        Live status of every integration. Greens are configured; greys still need credentials. Secrets are never shown — only whether each is set.
      </div>

      {err && <div className="text-[13px] text-ink-muted">Couldn&rsquo;t load readiness.</div>}
      {!d && !err && <div className="text-[13px] text-ink-muted">Loading…</div>}

      {d && (
        <>
          <div className="bg-surface border border-border rounded-2xl p-5 mb-4 flex items-center gap-4">
            <div className="text-[28px] font-extrabold tracking-tight">{requiredReady}/{requiredTotal}</div>
            <div>
              <div className="font-semibold text-[14px]">Launch-critical integrations ready</div>
              <div className="text-[12px] text-ink-muted">Database, auth, email, payments, and pharmacy must be live before real patients.</div>
            </div>
          </div>

          <Group title="Data foundation">
            <Item name="Database (Postgres)" state={d.db.ok ? "ready" : d.db.configured ? "warn" : "missing"}
              label={d.db.ok ? "Live" : d.db.configured ? "Error" : "Not set"}
              detail={d.db.ok ? "Connected to Postgres" : d.db.configured ? "DATABASE_URL set but not responding" : "Falling back to cache/memory"}
              env={["DATABASE_URL"]} />
            <Item name="Realtime cache (Upstash Redis)" state={d.redis ? "ready" : "missing"}
              label={d.redis ? "Live" : "Not set"} detail="Powers sync signals & rate limiting"
              env={["UPSTASH_REDIS_REST_URL", "UPSTASH_REDIS_REST_TOKEN"]} />
          </Group>

          <Group title="Messaging — per brand">
            {d.brands.map((b) => (
              <div key={b.id}>
                <Item name={`${b.name} · Email`} state={b.email ? "ready" : "missing"} label={b.email ? "Live" : "Not set"} env={[b.emailEnv]} />
                <Item name={`${b.name} · SMS`} state={b.sms ? "ready" : "missing"} label={b.sms ? "Live" : "Not set"} env={[b.smsEnv]} />
              </div>
            ))}
          </Group>

          <Group title="Payments">
            <Item name="Payment processor" state={d.payments.ready ? "ready" : "missing"}
              label={d.payments.ready ? "Live" : "Not set"} detail={d.payments.detail} env={d.payments.env} />
          </Group>

          <Group title="Pharmacy & fulfillment">
            <Item name="Pharmacy e-prescribing" state={d.pharmacy.ready ? "ready" : "missing"}
              label={d.pharmacy.ready ? "Live" : "Not set"} detail={d.pharmacy.which ? `${d.pharmacy.which} connected` : "LifeFile or eMed"} env={d.pharmacy.env} />
            <Item name="Address verification (Smarty)" state={d.address.ready ? "ready" : "missing"} label={d.address.ready ? "Live" : "Not set"} env={d.address.env} />
            <Item name="Shipping (USPS)" state={d.shipping.ready ? "ready" : "missing"} label={d.shipping.ready ? "Live" : "Not set"} env={d.shipping.env} />
          </Group>

          <Group title="Security & operations">
            <Item name="Auth secret" state={d.authSecret ? "ready" : "missing"} label={d.authSecret ? "Set" : "Missing"} detail="Signs login sessions" env={["AUTH_SECRET"]} />
            <Item name="App URL" state={d.appUrl ? "ready" : "missing"} label={d.appUrl ? "Set" : "Not set"} detail="Used in links & emails" env={["NEXT_PUBLIC_APP_URL"]} />
            <Item name="Scheduled jobs" state={d.cron ? "ready" : "missing"} label={d.cron ? "Set" : "Not set"} detail="Refill reminders & cron" env={["CRON_SECRET"]} />
            <Item name="Error monitoring (Sentry)" state={d.sentry ? "ready" : "info"} label={d.sentry ? "On" : "Off"} detail="Optional but recommended" env={["SENTRY_DSN", "NEXT_PUBLIC_SENTRY_DSN"]} />
            <Item name="Demo data" state="info" label={d.demoData ? "Seeded (demo)" : "Clean (production)"} detail={d.demoData ? "Stores ship with sample data — set NEXT_PUBLIC_SEED_DEMO_DATA=false for a clean launch" : "Starting empty for real data"} />
          </Group>
        </>
      )}
    </div>
  );
}
