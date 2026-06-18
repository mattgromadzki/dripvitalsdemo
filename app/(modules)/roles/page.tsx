"use client";

import { useCallback, useEffect, useMemo, useState, Fragment } from "react";
import { Pill } from "@/components/ui/Pill";
import { Modal } from "@/components/ui/Modal";
import { Toast } from "@/components/ui/Toast";
import { toast } from "@/lib/hooks/useToast";
import { useRbac } from "@/lib/hooks/useRbac";
import { ROLES, PERMISSION_GROUPS, ALL_PERMS } from "@/lib/rbac/permissions";

const AV = ["#2f6df6", "#0e9f6e", "#7c3aed", "#f59e0b", "#ef4444", "#0ea5e9", "#db2777", "#14b8a6"];
function avatar(name: string) { let h = 0; for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) >>> 0; return { initial: (name.trim()[0] || "?").toUpperCase(), color: AV[h % AV.length] }; }

interface Account { email: string; name: string; role: string; active: boolean; twofa: boolean; locked: boolean; }

export default function RolesPage() {
  // Role → permission matrix stays in the local RBAC store.
  const rolePerms = useRbac((s) => s.rolePerms);
  const togglePerm = useRbac((s) => s.togglePerm);

  const [tab, setTab] = useState<"team" | "permissions">("team");

  // Real staff accounts (persistent, from the auth system).
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadErr, setLoadErr] = useState<string | null>(null);

  const reload = useCallback(async () => {
    setLoading(true); setLoadErr(null);
    try {
      const r = await fetch("/api/auth/accounts", { cache: "no-store" });
      const d = await r.json();
      if (!r.ok || !d.ok) { setLoadErr(d?.error || "Could not load team."); setAccounts([]); }
      else setAccounts(Array.isArray(d.accounts) ? d.accounts : []);
    } catch { setLoadErr("Network error loading team."); setAccounts([]); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { reload(); }, [reload]);

  const act = useCallback(async (body: Record<string, unknown>, okMsg?: string) => {
    try {
      const r = await fetch("/api/auth/accounts", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const d = await r.json();
      if (!r.ok || !d.ok) { toast(d?.error || "Action failed."); return false; }
      if (okMsg) toast(okMsg);
      await reload();
      return true;
    } catch { toast("Network error — please try again."); return false; }
  }, [reload]);

  const [inv, setInv] = useState(false);
  const [iName, setIName] = useState(""); const [iEmail, setIEmail] = useState(""); const [iRole, setIRole] = useState("support"); const [iPwd, setIPwd] = useState(""); const [busy, setBusy] = useState(false);
  function genPwd() { setIPwd(Math.random().toString(36).slice(2, 9) + Math.floor(Math.random() * 90 + 10) + "!"); }
  async function sendInvite() {
    if (!iName.trim() || !iEmail.trim()) { toast("Name and email required"); return; }
    if (iPwd.trim().length < 6) { toast("Set a temporary password (min 6 characters)"); return; }
    setBusy(true);
    const ok = await act({ action: "create", email: iEmail.trim(), name: iName.trim(), role: iRole, password: iPwd.trim() }, `Account created for ${iEmail.trim()}`);
    setBusy(false);
    if (ok) { setInv(false); setIName(""); setIEmail(""); setIRole("support"); setIPwd(""); }
  }

  const twoFaPct = useMemo(() => { const a = accounts.filter((m) => m.active); return a.length ? Math.round((a.filter((m) => m.twofa).length / a.length) * 100) : 0; }, [accounts]);
  const has = (role: string, key: string) => (rolePerms[role] || []).includes(key);

  const KPI = ({ label, value, intent }: { label: string; value: string; intent?: string }) => <div className="bg-surface border border-border rounded-2xl px-4 py-3 min-w-[130px]"><div className={`text-[22px] font-extrabold leading-none ${intent || ""}`}>{value}</div><div className="text-[11px] text-ink-muted mt-1.5">{label}</div></div>;

  return (
    <div className="px-7 py-6 text-[14px]">
      <div className="flex items-center gap-3 mb-4 flex-wrap">
        <div><h1 className="text-[21px] font-extrabold tracking-tight">Roles &amp; Access</h1><div className="text-[12px] text-ink-muted mt-0.5">Team members, role-based permissions, and 2FA</div></div>
        <div className="flex gap-2">{(["team", "permissions"] as const).map((t) => <button key={t} onClick={() => setTab(t)} className={`text-[12.5px] font-semibold px-3.5 py-1.5 rounded-full capitalize ${tab === t ? "bg-brand text-white" : "bg-surface-3 text-ink-muted"}`}>{t === "team" ? "Team" : "Roles & Permissions"}</button>)}</div>
        <div className="flex-1" />{tab === "team" && <button className="btn btn-primary btn-sm" onClick={() => { genPwd(); setInv(true); }}>＋ Add member</button>}
      </div>

      <div className="flex flex-wrap gap-2.5 mb-4">
        <KPI label="Team members" value={String(accounts.length)} />
        <KPI label="Admins" value={String(accounts.filter((m) => m.role === "owner").length)} />
        <KPI label="2FA adoption" value={`${twoFaPct}%`} intent={twoFaPct < 100 ? "text-amber" : "text-green"} />
        <KPI label="Roles" value={String(ROLES.length)} />
      </div>

      {tab === "team" ? (
        <div className="bg-surface border border-border rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full border-collapse min-w-[760px]">
              <thead><tr className="bg-surface-2">{["Member", "Role", "2FA", "Status", "Actions"].map((h) => <th key={h} className="text-left text-[10px] uppercase tracking-wide text-ink-muted font-bold px-3 py-2.5 border-b border-border">{h}</th>)}</tr></thead>
              <tbody>
                {accounts.map((m) => { const av = avatar(m.name); return (
                  <tr key={m.email} className="border-b border-border last:border-none hover:bg-surface-2">
                    <td className="px-3 py-2.5"><div className="flex items-center gap-2.5"><div className="w-8 h-8 rounded-full flex items-center justify-center text-white text-[12px] font-bold" style={{ background: av.color }}>{av.initial}</div><div><div className="font-semibold">{m.name}</div><div className="text-[11px] text-ink-muted">{m.email}</div></div></div></td>
                    <td className="px-3 py-2.5"><select className="fsel py-1" value={m.role} onChange={(e) => act({ action: "role", email: m.email, role: e.target.value }, "Role updated")}>{ROLES.map((r) => <option key={r.id} value={r.id}>{r.label}</option>)}{!ROLES.some((r) => r.id === m.role) && <option value={m.role}>{m.role}</option>}</select></td>
                    <td className="px-3 py-2.5">{m.twofa ? <Pill intent="green" dot>On</Pill> : <Pill intent="amber" dot>Off</Pill>}</td>
                    <td className="px-3 py-2.5">{m.locked ? <Pill intent="red">Locked</Pill> : m.active ? <Pill intent="green">Active</Pill> : <Pill intent="red">Suspended</Pill>}</td>
                    <td className="px-3 py-2.5 text-[11px] whitespace-nowrap">
                      {m.active
                        ? <button className="text-red hover:underline" onClick={() => act({ action: "active", email: m.email, active: false }, "Account suspended")}>suspend</button>
                        : <button className="text-green hover:underline" onClick={() => act({ action: "active", email: m.email, active: true }, "Account reactivated")}>reactivate</button>}
                      {m.locked && <button className="ml-2.5 text-brand hover:underline" onClick={() => act({ action: "unlock", email: m.email }, "Account unlocked")}>unlock</button>}
                      {m.twofa && <button className="ml-2.5 text-ink-muted hover:underline" onClick={() => { if (confirm(`Reset 2FA for ${m.name}? They'll need to set up their authenticator again on next login.`)) act({ action: "disable2fa", email: m.email }, "2FA reset"); }}>reset 2FA</button>}
                    </td>
                  </tr>
                ); })}
                {!loading && !loadErr && accounts.length === 0 && (
                  <tr><td colSpan={5} className="px-3 py-10 text-center text-[12.5px] text-ink-muted">No team members yet. Use <span className="font-semibold text-ink">Add member</span> to create staff logins.</td></tr>
                )}
                {loading && <tr><td colSpan={5} className="px-3 py-10 text-center text-[12.5px] text-ink-muted">Loading team…</td></tr>}
                {loadErr && !loading && (
                  <tr><td colSpan={5} className="px-3 py-10 text-center text-[12.5px] text-red">{loadErr}{loadErr.toLowerCase().includes("author") ? " You need the “Manage users & roles” permission." : ""}</td></tr>
                )}
              </tbody>
            </table>
          </div>
          <div className="px-3 py-2 text-[11px] text-ink-muted-2 border-t border-border">These are real staff logins. New members sign in with the temporary password you set, then can enable 2FA from their account.</div>
        </div>
      ) : (
        <div className="bg-surface border border-border rounded-xl overflow-x-auto">
          <table className="w-full border-collapse min-w-[680px]">
            <thead><tr className="bg-surface-2"><th className="text-left text-[10px] uppercase tracking-wide text-ink-muted font-bold px-3 py-2.5 border-b border-border">Permission</th>{ROLES.map((r) => <th key={r.id} className="text-center text-[10px] uppercase tracking-wide text-ink-muted font-bold px-3 py-2.5 border-b border-border">{r.label}</th>)}</tr></thead>
            <tbody>
              {PERMISSION_GROUPS.map((g) => (
                <Fragment key={g.group}>
                  <tr><td colSpan={1 + ROLES.length} className="px-3 py-1.5 bg-surface-2/60 text-[10px] uppercase tracking-wide text-ink-muted font-bold">{g.group}</td></tr>
                  {g.perms.map((p) => (
                    <tr key={p.key} className="border-b border-border last:border-none">
                      <td className="px-3 py-2 text-[12.5px]">{p.label}</td>
                      {ROLES.map((r) => (
                        <td key={r.id} className="text-center px-3 py-2">
                          <input type="checkbox" checked={has(r.id, p.key)} disabled={r.id === "owner"} onChange={() => togglePerm(r.id, p.key)} title={r.id === "owner" ? "Owner always has full access" : ""} />
                        </td>
                      ))}
                    </tr>
                  ))}
                </Fragment>
              ))}
            </tbody>
          </table>
          <div className="px-3 py-2 text-[11px] text-ink-muted-2 border-t border-border">Owner has full access by default. Changes apply to everyone with that role. ({ALL_PERMS.length} permissions)</div>
        </div>
      )}

      <Modal open={inv} onClose={() => setInv(false)} title="Add team member" icon="👤" width={440}
        footer={<><button className="btn btn-ghost" onClick={() => setInv(false)}>Cancel</button><button className="btn btn-primary" onClick={sendInvite} disabled={busy}>{busy ? "Creating…" : "Create account"}</button></>}>
        <label className="fl">Name</label><input className="fi mb-2.5" value={iName} onChange={(e) => setIName(e.target.value)} placeholder="Full name" />
        <label className="fl">Email</label><input className="fi mb-2.5" type="email" value={iEmail} onChange={(e) => setIEmail(e.target.value)} placeholder="name@dripvitals.com" />
        <label className="fl">Role</label><select className="fsel w-full mb-2.5" value={iRole} onChange={(e) => setIRole(e.target.value)}>{ROLES.map((r) => <option key={r.id} value={r.id}>{r.label}</option>)}</select>
        <label className="fl">Temporary password</label>
        <div className="flex gap-2">
          <input className="fi flex-1" value={iPwd} onChange={(e) => setIPwd(e.target.value)} placeholder="At least 6 characters" />
          <button type="button" className="btn btn-ghost btn-sm whitespace-nowrap" onClick={genPwd}>Generate</button>
        </div>
        <div className="text-[11px] text-ink-muted-2 mt-2">Share this password securely with the new member. They'll log in with it, then can change it and enable 2FA from their account.</div>
      </Modal>
      <Toast />
    </div>
  );
}
