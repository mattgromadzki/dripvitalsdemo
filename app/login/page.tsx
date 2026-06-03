"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { AuthShell } from "@/components/auth/AuthShell";
import { useAuth, DEMO_ACCOUNTS } from "@/lib/hooks/useAuth";

export default function LoginPage() {
  const router = useRouter();
  const user = useAuth((s) => s.user);
  const hydrated = useAuth((s) => s.hydrated);
  const hydrate = useAuth((s) => s.hydrate);
  const login = useAuth((s) => s.login);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => { hydrate(); }, [hydrate]);
  useEffect(() => { if (hydrated && user) router.replace("/dashboard"); }, [hydrated, user, router]);

  function submit() {
    setBusy(true);
    const res = login(email, password);
    if (!res.ok) { setErr(res.error || "Sign in failed."); setBusy(false); return; }
    router.replace("/dashboard");
  }

  return (
    <AuthShell title="Sign in" subtitle="Provider & staff console">
      {err && <div className="mb-3 px-3 py-2 rounded-md bg-red-soft text-red text-[12.5px] font-medium">{err}</div>}
      <label className="fl">Email</label>
      <input className="fi mb-3" type="email" value={email} autoComplete="username" onChange={(e) => setEmail(e.target.value)} onKeyDown={(e) => e.key === "Enter" && submit()} placeholder="you@dripvitals.com" />
      <div className="flex items-center justify-between">
        <label className="fl">Password</label>
        <Link href="/forgot-password" className="text-[11.5px] text-brand font-medium">Forgot password?</Link>
      </div>
      <input className="fi mb-4" type="password" value={password} autoComplete="current-password" onChange={(e) => setPassword(e.target.value)} onKeyDown={(e) => e.key === "Enter" && submit()} placeholder="••••••••" />
      <button className="btn btn-primary w-full" onClick={submit} disabled={busy}>{busy ? "Signing in…" : "Sign in"}</button>

      <div className="mt-5 pt-4 border-t border-border">
        <div className="text-[10.5px] uppercase tracking-wide text-ink-muted font-bold mb-1.5">Demo accounts</div>
        <div className="text-[11.5px] text-ink-muted leading-relaxed">
          {DEMO_ACCOUNTS.map((a) => (
            <button key={a.email} onClick={() => { setEmail(a.email); setPassword("demo1234"); setErr(null); }} className="block text-left hover:text-brand">
              {a.email} <span className="text-ink-muted-2">· {a.role}</span>
            </button>
          ))}
          <div className="mt-1.5 text-ink-muted-2">Password for all: <b className="text-ink">demo1234</b> · click one to autofill</div>
        </div>
      </div>
    </AuthShell>
  );
}
