"use client";

import { useMemo, useState, Fragment } from "react";
import { Pill } from "@/components/ui/Pill";
import { Modal } from "@/components/ui/Modal";
import { Toast } from "@/components/ui/Toast";
import { toast } from "@/lib/hooks/useToast";
import { useRbac } from "@/lib/hooks/useRbac";
import { ROLES, PERMISSION_GROUPS, ALL_PERMS } from "@/lib/rbac/permissions";

const AV = ["#2f6df6", "#0e9f6e", "#7c3aed", "#f59e0b", "#ef4444", "#0ea5e9", "#db2777", "#14b8a6"];
function avatar(name: string) { let h = 0; for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) >>> 0; return { initial: (name.trim()[0] || "?").toUpperCase(), color: AV[h % AV.length] }; }
const roleLabel = (id: string) => ROLES.find((r) => r.id === id)?.label || id;
const ago = (iso: string) => { if (!iso) return "never"; const h = Math.round((Date.now() - new Date(iso).getTime()) / 36e5); return h < 1 ? "just now" : h < 24 ? `${h}h ago` : `${Math.round(h / 24)}d ago`; };

export default function RolesPage() {
  const rolePerms = useRbac((s) => s.rolePerms);
  const members = useRbac((s) => s.members);
  const togglePerm = useRbac((s) => s.togglePerm);
  const setRole = useRbac((s) => s.setRole);
  const toggle2FA = useRbac((s) => s.toggle2FA);
  const setStatus = useRbac((s) => s.setStatus);
  const invite = useRbac((s) => s.invite);

  const [tab, setTab] = useState<"team" | "permissions">("team");
  const [inv, setInv] = useState(false);
  const [iName, setIName] = useState(""); const [iEmail, setIEmail] = useState(""); const [iRole, setIRole] = useState("support");

  const twoFaPct = useMemo(() => { const a = members.filter((m) => m.status === "active"); return a.length ? Math.round((a.filter((m) => m.twoFactor).length / a.length) * 100) : 0; }, [members]);
  const has = (role: string, key: string) => (rolePerms[role] || []).includes(key);

  function sendInvite() { if (!iName.trim() || !iEmail.trim()) { toast("Name and email required"); return; } invite(iName.trim(), iEmail.trim(), iRole); setInv(false); setIName(""); setIEmail(""); toast("Invitation sent"); }

  const KPI = ({ label, value, intent }: { label: string; value: string; intent?: string }) => <div className="bg-surface border border-border rounded-2xl px-4 py-3 min-w-[130px]"><div className={`text-[22px] font-extrabold leading-none ${intent || ""}`}>{value}</div><div className="text-[11px] text-ink-muted mt-1.5">{label}</div></div>;

  return (
    <div className="px-7 py-6 text-[14px]">
      <div className="flex items-center gap-3 mb-4 flex-wrap">
        <div><h1 className="text-[21px] font-extrabold tracking-tight">Roles &amp; Access</h1><div className="text-[12px] text-ink-muted mt-0.5">Team members, role-based permissions, and 2FA</div></div>
        <div className="flex gap-2">{(["team", "permissions"] as const).map((t) => <button key={t} onClick={() => setTab(t)} className={`text-[12.5px] font-semibold px-3.5 py-1.5 rounded-full capitalize ${tab === t ? "bg-brand text-white" : "bg-surface-3 text-ink-muted"}`}>{t === "team" ? "Team" : "Roles & Permissions"}</button>)}</div>
        <div className="flex-1" />{tab === "team" && <button className="btn btn-primary btn-sm" onClick={() => setInv(true)}>＋ Invite member</button>}
      </div>

      <div className="flex flex-wrap gap-2.5 mb-4">
        <KPI label="Team members" value={String(members.filter((m) => m.status !== "invited").length)} />
        <KPI label="Admins" value={String(members.filter((m) => m.role === "owner").length)} />
        <KPI label="2FA adoption" value={`${twoFaPct}%`} intent={twoFaPct < 100 ? "text-amber" : "text-green"} />
        <KPI label="Roles" value={String(ROLES.length)} />
      </div>

      {tab === "team" ? (
        <div className="bg-surface border border-border rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full border-collapse min-w-[760px]">
              <thead><tr className="bg-surface-2">{["Member", "Role", "2FA", "Status", "Last active"].map((h) => <th key={h} className="text-left text-[10px] uppercase tracking-wide text-ink-muted font-bold px-3 py-2.5 border-b border-border">{h}</th>)}</tr></thead>
              <tbody>
                {members.map((m) => { const av = avatar(m.name); return (
                  <tr key={m.id} className="border-b border-border last:border-none hover:bg-surface-2">
                    <td className="px-3 py-2.5"><div className="flex items-center gap-2.5"><div className="w-8 h-8 rounded-full flex items-center justify-center text-white text-[12px] font-bold" style={{ background: av.color }}>{av.initial}</div><div><div className="font-semibold">{m.name}</div><div className="text-[11px] text-ink-muted">{m.email}</div></div></div></td>
                    <td className="px-3 py-2.5"><select className="fsel py-1" value={m.role} onChange={(e) => setRole(m.id, e.target.value)}>{ROLES.map((r) => <option key={r.id} value={r.id}>{r.label}</option>)}</select></td>
                    <td className="px-3 py-2.5"><button onClick={() => toggle2FA(m.id)}>{m.twoFactor ? <Pill intent="green" dot>On</Pill> : <Pill intent="amber" dot>Off</Pill>}</button></td>
                    <td className="px-3 py-2.5">{m.status === "active" ? <Pill intent="green">Active</Pill> : m.status === "invited" ? <Pill intent="blue">Invited</Pill> : <Pill intent="red">Suspended</Pill>}</td>
                    <td className="px-3 py-2.5 text-ink-muted text-[12px]">{ago(m.lastActive)}{m.status === "active" && <button className="ml-2 text-[11px] text-red hover:underline" onClick={() => setStatus(m.id, "suspended")}>suspend</button>}{m.status === "suspended" && <button className="ml-2 text-[11px] text-green hover:underline" onClick={() => setStatus(m.id, "active")}>reactivate</button>}</td>
                  </tr>
                ); })}
              </tbody>
            </table>
          </div>
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

      <Modal open={inv} onClose={() => setInv(false)} title="Invite team member" icon="✉️" width={420}
        footer={<><button className="btn btn-ghost" onClick={() => setInv(false)}>Cancel</button><button className="btn btn-primary" onClick={sendInvite}>Send invite</button></>}>
        <label className="fl">Name</label><input className="fi mb-2.5" value={iName} onChange={(e) => setIName(e.target.value)} placeholder="Full name" />
        <label className="fl">Email</label><input className="fi mb-2.5" value={iEmail} onChange={(e) => setIEmail(e.target.value)} placeholder="name@dripvitals.com" />
        <label className="fl">Role</label><select className="fsel w-full" value={iRole} onChange={(e) => setIRole(e.target.value)}>{ROLES.map((r) => <option key={r.id} value={r.id}>{r.label}</option>)}</select>
      </Modal>
      <Toast />
    </div>
  );
}
