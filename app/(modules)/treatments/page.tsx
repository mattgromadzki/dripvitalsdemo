"use client";

import { useMemo, useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import type { Key, ReactNode } from "react";
import { Toast } from "@/components/ui/Toast";
import { toast } from "@/lib/hooks/useToast";
import { PatientIntakeFlow } from "@/components/modules/PatientIntakeFlow";
import { useTreatmentsIntake, useHydrateTreatmentsStore, resetTreatmentsStoreToDefaults } from "@/lib/hooks/useTreatmentsIntake";
import type {
  BaskTreatment, BaskIntakeForm, BaskClient, BaskQuestion,
  BaskColorKey, BaskBillingCycle, BaskOption, BaskCheckboxOption,
  BaskQuestionType, BaskImpact, BaskOptionFlag, BaskClientStatus, BaskRule,
} from "@/lib/types/treatmentsIntake";

// ─── Color & label maps (1:1 bask) ──────────────────────────────────────
const COLOR_MAP: Record<BaskColorKey, { fg: string; bg: string; strip: string }> = {
  brand:  { fg: "var(--color-brand)",  bg: "var(--color-brand-soft)",  strip: "#4a8ec7" },
  blue:   { fg: "var(--color-blue)",   bg: "var(--color-blue-soft)",   strip: "#2b6cb0" },
  purple: { fg: "var(--color-purple)", bg: "var(--color-purple-soft)", strip: "#6b4ea8" },
  amber:  { fg: "var(--color-amber)",  bg: "var(--color-amber-soft)",  strip: "#b86e1e" },
  coral:  { fg: "var(--color-coral)",  bg: "var(--color-coral-soft)",  strip: "#c75d3a" },
  teal:   { fg: "var(--color-teal)",   bg: "var(--color-teal-soft)",   strip: "#0e7c8f" },
  pink:   { fg: "var(--color-pink)",   bg: "var(--color-pink-soft)",   strip: "#a8458d" },
};
const BILLING_LABEL: Record<BaskBillingCycle, string> = {
  monthly: "/ month", quarterly: "/ quarter", "semi-annual": "/ 6 months", annual: "/ year", "one-time": "one-time",
};
const BILLING_LONG: Record<BaskBillingCycle, string> = {
  monthly: "Billed monthly", quarterly: "Billed quarterly", "semi-annual": "Billed every 6 months", annual: "Billed annually", "one-time": "One-time payment",
};

type TopTab = "treatments" | "forms" | "clients";
type TxFilter = "all" | "active" | "featured" | "compounded" | "inactive";
type ClientFilter = "all" | BaskClientStatus;

function nowStamp(): string {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;
}
function getDurLabel(d: string): string {
  return ({ "1":"1 Month","3":"3 Months","6":"6 Months","12":"12 Months" } as Record<string, string>)[d] || `${d} Months`;
}
function CheckIcon() {
  return (
    <svg viewBox="0 0 16 16" fill="none" width="11" height="11" style={{ flexShrink: 0 }}>
      <path d="M3 8l3 3 7-7" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

// ════════════════════════════════════════════════════════════════════════
// MAIN PAGE
// ════════════════════════════════════════════════════════════════════════
export default function TreatmentsIntakePage() {
  // Hydrate the store from localStorage on mount. Initial render uses SEED
  // data (so SSR matches), then after mount this effect applies any
  // persisted treatments/forms/clients and subscribes to save changes.
  useHydrateTreatmentsStore();

  // Build verification — if you see this log in your browser's dev tools
  // console, you are running the new build with localStorage support and
  // the reorganized seed (engagement-first patient flow).
  useEffect(() => {
    if (typeof window !== "undefined") {
      // eslint-disable-next-line no-console
      console.log("%c[DripVitals Treatments] v6 — BMI Calculator question type with live calculation, unit toggle (imperial/metric), and category badge", "color:#2e7d32;font-weight:600;");
    }
  }, []);

  const treatments = useTreatmentsIntake((s) => s.treatments);
  const forms      = useTreatmentsIntake((s) => s.forms);
  const clients    = useTreatmentsIntake((s) => s.clients);

  const [tab, setTab] = useState<TopTab>("treatments");

  // Treatment modal state
  const [txModalOpen,   setTxModalOpen]   = useState(false);
  const [editingTxId,   setEditingTxId]   = useState<number | null>(null);

  // Form editor state
  const [editorOpen,    setEditorOpen]    = useState(false);
  const [editorFormId,  setEditorFormId]  = useState<number | null>(null);
  // Tracks the most recently edited form so the top-level "Preview as patient"
  // button previews THAT form instead of the alphabetically first active one.
  const [lastEditedFormId, setLastEditedFormId] = useState<number | null>(null);

  // Question modal state
  const [qModalOpen,    setQModalOpen]    = useState(false);
  const [editingQId,    setEditingQId]    = useState<number | null>(null);

  // Client detail state
  const [clientDetailId, setClientDetailId] = useState<number | null>(null);

  // Patient preview state
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewFormId, setPreviewFormId] = useState<number | null>(null);
  // Session counter: bumped each time startPreview is called. Used as a React
  // key on <PatientIntakeFlow /> so each preview session gets a completely fresh
  // component instance — guarantees the patient flow reads the latest form
  // data from zustand instead of any cached/stale state from a prior session.
  const [previewSession, setPreviewSession] = useState(0);

  const totalTreatments = treatments.length;
  const totalForms      = forms.length;
  const totalClients    = clients.length;

  function primaryCreate() {
    if (tab === "treatments") { setEditingTxId(null); setTxModalOpen(true); }
    else if (tab === "forms") { openForm("new"); }
    else { toast("Clients are created automatically when someone starts an intake"); }
  }

  function openForm(idOrNew: "new" | number, preselectTxId?: number) {
    if (idOrNew === "new") {
      const f = useTreatmentsIntake.getState().addForm({
        name: "", slug: "", desc: "", active: true,
        treatmentIds: preselectTxId ? [preselectTxId] : [],
        submissions: 0, qualified: 0, questions: [],
      });
      setEditorFormId(f.id);
      setLastEditedFormId(f.id);
    } else {
      setEditorFormId(idOrNew);
      setLastEditedFormId(idOrNew);
    }
    setEditorOpen(true);
    setTab("forms");
  }

  function startPreview(formId: number) {
    setPreviewFormId(formId);
    setPreviewOpen(true);
    setPreviewSession((s) => s + 1);  // force fresh PatientPreview mount
  }

  return (
    <div className="treatments-intake-mod">
      {/* ═══ PATIENT PREVIEW (portal-rendered full-screen takeover) ═══ */}
      {previewOpen && previewFormId !== null ? (
        // Wrapper div carries the session key so each preview opens with a
        // fresh PatientPreview instance (no stale state from prior sessions).
        <div key={`preview-${previewFormId}-${previewSession}`} style={{ display: "contents" }}>
          <PatientIntakeFlow
            formId={previewFormId}
            onExit={() => { setPreviewOpen(false); setPreviewFormId(null); }}
          />
        </div>
      ) : (
        <>
          {/* Tab bar with action buttons on the right.
              No duplicate topbar — the EMR's global Topbar already shows
              the breadcrumb + admin badge + user pill above this.       */}
          <div className="tab-bar">
            <TopTabBtn icon="💉" label="Treatments"   badge={totalTreatments} active={tab === "treatments" && !editorOpen && !clientDetailId} onClick={() => { setTab("treatments"); setEditorOpen(false); setClientDetailId(null); }} />
            <TopTabBtn icon="📝" label="Intake Forms" badge={totalForms}      active={tab === "forms"      && !editorOpen}                     onClick={() => { setTab("forms");      setEditorOpen(false); setClientDetailId(null); }} />
            <TopTabBtn icon="👥" label="Clients"      badge={totalClients}    active={tab === "clients"    && !clientDetailId}                 onClick={() => { setTab("clients");    setEditorOpen(false); setClientDetailId(null); }} />
            <div className="tab-bar-spacer" />
            <div className="tab-bar-actions">
              <span
                title="Build with treatment thumbnails + merged Questionnaires + localStorage."
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  padding: "4px 10px",
                  background: "#e8f5e9",
                  color: "#2e7d32",
                  border: "1px solid #a5d6a7",
                  borderRadius: 12,
                  fontSize: 11,
                  fontWeight: 600,
                  letterSpacing: 0.3,
                }}
              >
                v6 · BMI calc
              </span>
              <button
                onClick={() => {
                  if (!confirm("Reset all treatments, forms, and clients to factory defaults? This will wipe any changes you've made and reload the page.")) return;
                  resetTreatmentsStoreToDefaults();
                  window.location.reload();
                }}
                title="Wipe localStorage and reload with seed data"
                style={{
                  background: "#fff7ed",
                  border: "2px solid #fb923c",
                  color: "#c2410c",
                  fontWeight: 600,
                  padding: "8px 14px",
                  borderRadius: 8,
                  cursor: "pointer",
                  fontSize: 13,
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 4,
                }}
              >
                ↺ Reset to defaults
              </button>
              <button className="btn btn-primary btn-sm" onClick={primaryCreate}>+ Create</button>
            </div>
          </div>

          {editorOpen && editorFormId !== null ? (
            <FormEditor
              formId={editorFormId}
              onClose={() => { setEditorOpen(false); setEditorFormId(null); setTab("forms"); }}
              onOpenQuestionModal={(qid) => { setEditingQId(qid); setQModalOpen(true); }}
              onPreview={() => startPreview(editorFormId)}
            />
          ) : clientDetailId !== null ? (
            <ClientDetail clientId={clientDetailId} onBack={() => setClientDetailId(null)} />
          ) : tab === "treatments" ? (
            <TreatmentsList
              onEdit={(id) => { setEditingTxId(id); setTxModalOpen(true); }}
              onOpenForm={openForm}
            />
          ) : tab === "forms" ? (
            <FormsList onOpenForm={(id) => openForm(id)} onPreview={startPreview} />
          ) : (
            <ClientsList onOpen={(id) => setClientDetailId(id)} />
          )}
        </>
      )}

      {txModalOpen && (
        <TreatmentModal
          editId={editingTxId}
          onClose={() => { setTxModalOpen(false); setEditingTxId(null); }}
        />
      )}

      {qModalOpen && editingQId !== null && editorFormId !== null && (
        <QuestionModal
          formId={editorFormId}
          qid={editingQId}
          onClose={() => { setQModalOpen(false); setEditingQId(null); }}
        />
      )}

      <Toast />
    </div>
  );
}

function TopTabBtn({ icon, label, badge, active, onClick }: {
  icon: string; label: string; badge: number; active: boolean; onClick: () => void;
}) {
  return (
    <div className={`tab${active ? " on" : ""}`} onClick={onClick}>
      {icon} {label}
      <span className="tab-badge">{badge}</span>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════════
// TREATMENTS LIST
// ════════════════════════════════════════════════════════════════════════
function TreatmentsList({ onEdit, onOpenForm }: {
  onEdit: (id: number) => void;
  onOpenForm: (idOrNew: "new" | number, preselectTxId?: number) => void;
}) {
  const treatments = useTreatmentsIntake((s) => s.treatments);
  const forms      = useTreatmentsIntake((s) => s.forms);
  const dup        = useTreatmentsIntake((s) => s.duplicateTreatment);
  const del        = useTreatmentsIntake((s) => s.deleteTreatment);

  const [filter, setFilter] = useState<TxFilter>("all");
  const [search, setSearch] = useState("");

  const filtered = useMemo(() => treatments.filter((t) => {
    if (filter === "active"     && !t.active)     return false;
    if (filter === "inactive"   &&  t.active)     return false;
    if (filter === "featured"   && !t.featured)   return false;
    if (filter === "compounded" && !t.compounded) return false;
    if (search && !(t.name + " " + t.med).toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  }), [treatments, filter, search]);

  const kpis = useMemo(() => {
    const total = treatments.length;
    const active = treatments.filter((t) => t.active).length;
    const subs = treatments.reduce((a, t) => a + t.subscribers, 0);
    let mrr = 0;
    treatments.filter((t) => t.active).forEach((t) => {
      const p = parseFloat(t.price.replace(/[$,]/g, "")) || 0;
      const div = { monthly: 1, quarterly: 3, "semi-annual": 6, annual: 12, "one-time": 1 }[t.billing] || 1;
      mrr += (p / div) * t.subscribers;
    });
    const featured = treatments.filter((t) => t.featured && t.active).length;
    const compounded = treatments.filter((t) => t.compounded && t.active).length;
    return { total, active, subs, mrr: Math.round(mrr / 1000), featured, compounded };
  }, [treatments]);

  return (
    <div className="page-wrap">
      <div className="page-head">
        <div>
          <div className="page-title">Treatments</div>
          <div className="page-sub">Care plans clients can purchase after completing an intake form</div>
        </div>
        <div className="page-actions">
          <button className="btn btn-ghost btn-sm" onClick={() => toast("Catalog exported")}>Export</button>
          <button className="btn btn-primary" onClick={() => onEdit(-1)}>+ New Treatment</button>
        </div>
      </div>

      <div className="kpi-grid">
        <Kpi label="Total Treatments"   value={kpis.total}      sub={`${kpis.active} active`} icon="💉" tone="green" />
        <Kpi label="Active Subscribers" value={kpis.subs.toLocaleString()} sub="Across all plans" icon="👥" tone="blue" />
        <Kpi label="Estimated MRR"      value={`$${kpis.mrr}k`}  sub="From active plans" icon="💵" tone="purple" up />
        <Kpi label="Featured"           value={kpis.featured}   sub="Highlighted to clients" icon="⭐" tone="amber" />
        <Kpi label="Compounded"         value={kpis.compounded} sub="Via partner pharmacy" icon="🧪" tone="teal" />
      </div>

      <div className="filter-bar">
        {(["all","active","featured","compounded","inactive"] as TxFilter[]).map((k) => (
          <div key={k} className={`fc${filter === k ? " on" : ""}`} onClick={() => setFilter(k)}>
            {k === "all" ? "All" : k.charAt(0).toUpperCase() + k.slice(1)}
          </div>
        ))}
        <div className="bar-sp" />
        <div className="search-w">
          <span className="search-w-icon">🔍</span>
          <input type="text" placeholder="Search treatments…" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
      </div>

      <div className="tx-grid">
        {filtered.length === 0 ? (
          <div style={{ gridColumn: "1/-1" }}>
            <div className="empty-state">
              <div className="empty-ic">🔍</div>
              <div className="empty-title">No treatments match your filter</div>
              <div className="empty-sub">Try clearing your filter or search.</div>
            </div>
          </div>
        ) : (
          filtered.map((t, i) => {
            const c = COLOR_MAP[t.color] || COLOR_MAP.brand;
            const linkedForm = forms.find((f) => f.treatmentIds.includes(t.id));
            return (
              <div key={t.id} className={`tx-card${t.active ? "" : " inactive"}`} style={{ animationDelay: `${i * 30}ms` }}>
                <div className="tx-strip" style={{ background: c.strip }} />
                {t.featured && <div className="tx-featured">⭐ FEATURED</div>}
                <div className="tx-body">
                  <div className="tx-head">
                    {t.thumbnail ? (
                      <div
                        className="tx-icon"
                        style={{
                          background: `#fff center/cover no-repeat url(${t.thumbnail})`,
                          border: `1px solid ${c.bg}`,
                        }}
                        title={t.name}
                      />
                    ) : (
                      <div className="tx-icon" style={{ background: c.bg, color: c.fg }}>{t.icon}</div>
                    )}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div className="tx-name">{t.name}</div>
                      <div className="tx-meta">{t.med} · {t.strength || ""}</div>
                    </div>
                  </div>
                  <div className="tx-tags">
                    {t.active ? <span className="pill pill-green"><span className="dot" />Active</span> : <span className="pill pill-muted">Inactive</span>}
                    {t.compounded && <span className="pill pill-purple">Compounded</span>}
                    <span className="pill pill-blue">{getDurLabel(t.duration)}</span>
                  </div>
                  <div className="tx-desc">{t.desc}</div>
                  <div className="tx-price-row">
                    <span className="tx-price">{t.price}</span>
                    {t.compare && <span className="tx-compare">{t.compare}</span>}
                  </div>
                  <div className="tx-billing">{BILLING_LONG[t.billing] || ""}</div>
                  <div className="tx-detail-grid">
                    <div className="tx-detail"><div className="tx-detail-lbl">Frequency</div><div className="tx-detail-val">{t.freq || "—"}</div></div>
                    <div className="tx-detail"><div className="tx-detail-lbl">Pharmacy</div><div className="tx-detail-val">{t.pharmacy || "—"}</div></div>
                    <div className="tx-detail"><div className="tx-detail-lbl">Subscribers</div><div className="tx-detail-val">{t.subscribers}</div></div>
                    <div className="tx-detail"><div className="tx-detail-lbl">Duration</div><div className="tx-detail-val">{getDurLabel(t.duration)}</div></div>
                  </div>
                  <div className="tx-includes">
                    <div className="tx-include-lbl">What&apos;s Included</div>
                    {t.includes.slice(0, 3).map((inc, j) => (
                      <div key={j} className="tx-include"><CheckIcon /> {inc}</div>
                    ))}
                    {t.includes.length > 3 && <div className="tx-include" style={{ color: "var(--color-ink-muted)" }}>+ {t.includes.length - 3} more</div>}
                  </div>
                  {linkedForm ? (
                    <div className="tx-questionnaire-row">
                      <span className="qr-ic">📝</span>
                      <span className="qr-text">{linkedForm.name}</span>
                    </div>
                  ) : (
                    <div className="tx-questionnaire-row empty">
                      <span className="qr-ic">📝</span>
                      <span className="qr-text">No intake form assigned</span>
                    </div>
                  )}
                  <div className="tx-actions">
                    <button className="tx-action-btn" onClick={() => onEdit(t.id)}>✏ Edit</button>
                    <button className="tx-action-btn" onClick={() => { dup(t.id); toast("Treatment duplicated"); }}>⊕ Duplicate</button>
                    <button className="tx-action-btn danger" onClick={() => {
                      if (confirm("Delete this treatment? This cannot be undone.")) {
                        del(t.id); toast("Treatment deleted");
                      }
                    }}>🗑</button>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════════
// KPI CARD
// ════════════════════════════════════════════════════════════════════════
function Kpi({ label, value, sub, icon, tone, up }: {
  key?: Key; label: string; value: string | number; sub: string; icon: string;
  tone: "green" | "blue" | "purple" | "amber" | "teal" | "red"; up?: boolean;
}) {
  return (
    <div className="kpi-card">
      <div className="kpi-head"><span className="kpi-lbl">{label}</span><div className={`kpi-ic ic-${tone}`}>{icon}</div></div>
      <div className="kpi-val">{value}</div>
      <div className={`kpi-sub${up ? " up" : ""}`}>{sub}</div>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════════
// TREATMENT MODAL
// ════════════════════════════════════════════════════════════════════════
function TreatmentModal({ editId, onClose }: { editId: number | null; onClose: () => void }) {
  const treatments = useTreatmentsIntake((s) => s.treatments);
  const add        = useTreatmentsIntake((s) => s.addTreatment);
  const upd        = useTreatmentsIntake((s) => s.updateTreatment);
  const isEdit = editId != null && editId > 0;
  const existing = isEdit ? treatments.find((t) => t.id === editId) || null : null;

  const [name, setName]           = useState(existing?.name || "");
  const [med, setMed]             = useState(existing?.med || "Semaglutide");
  const [strength, setStrength]   = useState(existing?.strength || "");
  const [freq, setFreq]           = useState(existing?.freq || "");
  const [duration, setDuration]   = useState(existing?.duration || "3");
  const [price, setPrice]         = useState(existing?.price || "");
  const [compare, setCompare]     = useState(existing?.compare || "");
  const [billing, setBilling]     = useState<BaskBillingCycle>(existing?.billing || "quarterly");
  const [pharmacy, setPharmacy]   = useState(existing?.pharmacy || "Partner Network FL");
  const [desc, setDesc]           = useState(existing?.desc || "");
  const [includesStr, setIncludesStr] = useState((existing?.includes || []).join("\n"));
  const [icon, setIcon]           = useState(existing?.icon || "💉");
  const [color, setColor]         = useState<BaskColorKey>(existing?.color || "brand");
  const [active, setActive]       = useState(existing ? existing.active : true);
  const [featured, setFeatured]   = useState(existing?.featured || false);
  const [compounded, setCompounded] = useState(existing ? existing.compounded : true);
  const [thumbnail, setThumbnail] = useState<string>(existing?.thumbnail || "");
  const [uploading, setUploading] = useState(false);

  async function onThumbFile(file: File | undefined) {
    if (!file) return;
    if (!file.type.startsWith("image/")) { toast("Please choose an image file"); return; }
    if (file.size > 10 * 1024 * 1024)    { toast("Image is larger than 10 MB"); return; }
    setUploading(true);
    try {
      const { fileToCompressedDataURL } = await import("@/lib/util/imageCompress");
      const compressed = await fileToCompressedDataURL(file);
      setThumbnail(compressed);
      toast("Thumbnail uploaded");
    } catch (err) {
      console.error(err);
      toast("Could not process that image");
    } finally {
      setUploading(false);
    }
  }

  function save() {
    if (!name.trim()) { toast("Name and price are required"); return; }
    if (!price.trim()) { toast("Name and price are required"); return; }
    const data: Omit<BaskTreatment, "id" | "subscribers"> & { subscribers?: number } = {
      name: name.trim(), med, strength: strength.trim(), freq: freq.trim(),
      duration, price: price.trim(), compare: compare.trim(), billing,
      pharmacy: pharmacy.trim(), desc: desc.trim(),
      includes: includesStr.split("\n").map((s) => s.trim()).filter(Boolean),
      icon, color, active, featured, compounded,
      thumbnail: thumbnail || undefined,
    };
    if (isEdit && existing) {
      upd(existing.id, data);
      toast("Treatment updated");
    } else {
      add({ ...data, subscribers: 0 } as Omit<BaskTreatment, "id">);
      toast("Treatment created");
    }
    onClose();
  }

  return (
    <ModalShell title={isEdit ? "Edit Treatment" : "New Treatment"} icon="💉" wide onClose={onClose} footer={
      <>
        <button className="btn btn-ghost" onClick={onClose}>Cancel</button>
        <button className="btn btn-primary" onClick={save}>Save Treatment</button>
      </>
    }>
      <div className="fr2">
        <FG label="Treatment Name" req><input className="fi" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. 3-Month Semaglutide Treatment" /></FG>
        <FG label="Medication"><select className="fsel" value={med} onChange={(e) => setMed(e.target.value)}>
          <option>Semaglutide</option><option>Tirzepatide</option><option>NAD+</option><option>Metformin</option><option>Testosterone</option><option>Other</option>
        </select></FG>
      </div>
      <div className="fr2">
        <FG label="Strength"><input className="fi" value={strength} onChange={(e) => setStrength(e.target.value)} placeholder="e.g. 0.5–1.0mg" /></FG>
        <FG label="Frequency"><input className="fi" value={freq} onChange={(e) => setFreq(e.target.value)} placeholder="e.g. Once weekly" /></FG>
      </div>
      <div className="fr3">
        <FG label="Duration"><select className="fsel" value={duration} onChange={(e) => setDuration(e.target.value)}>
          <option value="1">1 Month</option><option value="3">3 Months</option><option value="6">6 Months</option><option value="12">12 Months</option>
        </select></FG>
        <FG label="Price" req><input className="fi" value={price} onChange={(e) => setPrice(e.target.value)} placeholder="$499" /></FG>
        <FG label="Compare-at"><input className="fi" value={compare} onChange={(e) => setCompare(e.target.value)} placeholder="$747" /></FG>
      </div>
      <div className="fr2">
        <FG label="Billing"><select className="fsel" value={billing} onChange={(e) => setBilling(e.target.value as BaskBillingCycle)}>
          <option value="monthly">Monthly</option><option value="quarterly">Quarterly</option><option value="semi-annual">Semi-Annual</option><option value="annual">Annual</option><option value="one-time">One-Time</option>
        </select></FG>
        <FG label="Pharmacy"><input className="fi" value={pharmacy} onChange={(e) => setPharmacy(e.target.value)} /></FG>
      </div>
      <FG label="Description"><textarea className="fta" value={desc} onChange={(e) => setDesc(e.target.value)} placeholder="Short description shown to clients during treatment selection" /></FG>

      {/* Thumbnail uploader — base64 stored in localStorage. Compressed on upload. */}
      <FG label="Thumbnail Image">
        <div style={{ display: "flex", gap: 14, alignItems: "flex-start" }}>
          <div
            style={{
              width: 120, height: 120, borderRadius: 12,
              background: thumbnail ? `#fafbfc center/cover no-repeat url(${thumbnail})` : "var(--color-surface-2)",
              border: "2px dashed var(--color-border-2)",
              display: "flex", alignItems: "center", justifyContent: "center",
              flexShrink: 0,
              color: "var(--color-ink-muted)", fontSize: 26,
            }}
          >
            {!thumbnail && (icon || "📷")}
          </div>
          <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 8 }}>
            <label
              className="btn btn-ghost btn-sm"
              style={{ alignSelf: "flex-start", cursor: uploading ? "wait" : "pointer", opacity: uploading ? 0.7 : 1 }}
            >
              <input
                type="file"
                accept="image/png,image/jpeg,image/webp"
                style={{ display: "none" }}
                onChange={(e) => onThumbFile(e.target.files?.[0])}
                disabled={uploading}
              />
              {thumbnail ? "📷 Replace image" : "📷 Upload thumbnail"}
            </label>
            {thumbnail && (
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                onClick={() => { setThumbnail(""); toast("Thumbnail removed"); }}
                style={{ alignSelf: "flex-start", color: "var(--color-red)" }}
              >
                🗑 Remove image
              </button>
            )}
            <div style={{ fontSize: 11, color: "var(--color-ink-muted)", lineHeight: 1.5 }}>
              Shown to patients during treatment selection and in admin cards. PNG, JPG, or WebP up to 10 MB. Auto-compressed to ~50 KB. Falls back to emoji icon below if not set.
            </div>
          </div>
        </div>
      </FG>

      <FG label="What&apos;s Included (one per line)"><textarea className="fta" value={includesStr} onChange={(e) => setIncludesStr(e.target.value)} placeholder={"Semaglutide with dose escalation\n3 physician visits\nPriority shipping"} style={{ minHeight: 100 }} /></FG>
      <div className="fr2">
        <FG label="Icon"><select className="fsel" value={icon} onChange={(e) => setIcon(e.target.value)}>
          <option>💉</option><option>🧬</option><option>⚡</option><option>💪</option><option>🌿</option><option>💊</option><option>🧴</option><option>🔬</option>
        </select></FG>
        <FG label="Color Theme"><select className="fsel" value={color} onChange={(e) => setColor(e.target.value as BaskColorKey)}>
          <option value="brand">Mint</option><option value="blue">Blue</option><option value="purple">Plum</option><option value="amber">Sand</option><option value="coral">Coral</option><option value="teal">Teal</option><option value="pink">Rose</option>
        </select></FG>
      </div>
      <div style={{ display: "flex", gap: 18, padding: "12px 14px", background: "var(--color-surface-2)", border: "1px solid var(--color-border)", borderRadius: 10, marginTop: 6 }}>
        <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12.5, cursor: "pointer" }}><input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} style={{ accentColor: "var(--color-brand)" }} /> Active</label>
        <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12.5, cursor: "pointer" }}><input type="checkbox" checked={featured} onChange={(e) => setFeatured(e.target.checked)} style={{ accentColor: "var(--color-brand)" }} /> Featured</label>
        <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12.5, cursor: "pointer" }}><input type="checkbox" checked={compounded} onChange={(e) => setCompounded(e.target.checked)} style={{ accentColor: "var(--color-brand)" }} /> Compounded</label>
      </div>
    </ModalShell>
  );
}

function FG({ label, req, children }: { label: string; req?: boolean; children: ReactNode }) {
  return (
    <div className="fg">
      <label className="fl">{label}{req && <span className="req">*</span>}</label>
      {children}
    </div>
  );
}

function ModalShell({ title, icon, wide, onClose, footer, children }: {
  title: string; icon: string; wide?: boolean; onClose: () => void; footer: ReactNode; children: ReactNode;
}) {
  useEffect(() => {
    function onKey(e: KeyboardEvent) { if (e.key === "Escape") onClose(); }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);
  return (
    <div className="modal-ov show" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className={`modal${wide ? " lg" : ""}`}>
        <div className="modal-head">
          <div className="modal-head-ic">{icon}</div>
          <div className="modal-title">{title}</div>
          <button type="button" className="modal-close" onClick={onClose}>✕</button>
        </div>
        <div className="modal-body">{children}</div>
        <div className="modal-footer">{footer}</div>
      </div>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════════
// FORMS LIST
// ════════════════════════════════════════════════════════════════════════
function FormsList({ onOpenForm, onPreview }: { onOpenForm: (id: number) => void; onPreview: (id: number) => void }) {
  const forms       = useTreatmentsIntake((s) => s.forms);
  const treatments  = useTreatmentsIntake((s) => s.treatments);
  const delForm     = useTreatmentsIntake((s) => s.deleteForm);

  const totalSub  = forms.reduce((a, f) => a + f.submissions, 0);
  const totalQual = forms.reduce((a, f) => a + f.qualified, 0);
  const qualRate  = totalSub ? Math.round((totalQual / totalSub) * 100) : 0;
  const activeForms = forms.filter((f) => f.active).length;

  return (
    <div className="page-wrap">
      <div className="page-head">
        <div>
          <div className="page-title">Intake Forms</div>
          <div className="page-sub">Questionnaires that screen and qualify clients before treatment selection</div>
        </div>
        <div className="page-actions">
          <button className="btn btn-primary" onClick={() => onOpenForm(-1 as number)}>+ New Intake Form</button>
        </div>
      </div>

      <div className="kpi-grid" style={{ gridTemplateColumns: "repeat(4,1fr)" }}>
        <Kpi label="Total Forms"   value={forms.length}            sub={`${activeForms} active`} icon="📝" tone="green" />
        <Kpi label="Submissions"   value={totalSub.toLocaleString()} sub="All time" icon="📥" tone="blue" />
        <Kpi label="Qualified"     value={totalQual.toLocaleString()} sub={`${qualRate}% qualification rate`} icon="✅" tone="purple" up />
        <Kpi label="Disqualified"  value={(totalSub - totalQual).toLocaleString()} sub="Auto-screened out" icon="⚠" tone="red" />
      </div>

      <div className="q-list-card">
        {forms.length === 0 ? (
          <div className="empty-state">
            <div className="empty-ic">📝</div>
            <div className="empty-title">No intake forms yet</div>
            <div className="empty-sub">Create your first form to start collecting client intakes.</div>
            <button className="btn btn-primary" onClick={() => onOpenForm(-1)}>+ New Intake Form</button>
          </div>
        ) : (
          forms.map((f) => {
            const url = `app.dripvitals.com/intake-form/${f.slug}`;
            const qual = f.submissions ? Math.round((f.qualified / f.submissions) * 100) : 0;
            const linked = f.treatmentIds.map((tid) => treatments.find((t) => t.id === tid)).filter(Boolean) as BaskTreatment[];
            return (
              <div key={f.id} className="q-row" onClick={() => onOpenForm(f.id)}>
                <div className="q-icon">📝</div>
                <div className="q-info">
                  <div className="q-name">{f.name || "(untitled)"}</div>
                  <div className="q-meta">{f.questions.length} questions · {linked.length} treatment{linked.length === 1 ? "" : "s"} assigned</div>
                  <div className="q-url-row" onClick={(e) => e.stopPropagation()}>
                    <span className="url-ic">🔗</span>
                    <span className="url-text">{url}</span>
                    <button className="url-copy" onClick={(e) => {
                      e.stopPropagation();
                      navigator.clipboard?.writeText("https://" + url).then(() => toast("URL copied to clipboard"));
                    }}>Copy</button>
                    <a className="url-copy" href={`/intake-form/${f.slug}`} target="_blank" rel="noreferrer" onClick={(e) => e.stopPropagation()}>Open ↗</a>
                  </div>
                  <div className="q-tags">
                    {f.active ? <span className="pill pill-green"><span className="dot" />Active</span> : <span className="pill pill-muted">Inactive</span>}
                    {linked.slice(0, 3).map((t) => <span key={t.id} className="pill pill-purple">{t.med}</span>)}
                    {linked.length > 3 && <span className="pill pill-muted">+{linked.length - 3} more</span>}
                  </div>
                </div>
                <div className="q-stats">
                  <div style={{ textAlign: "center" }}>
                    <div className="q-stat-val">{f.submissions}</div>
                    <div className="q-stat-lbl">Submissions</div>
                  </div>
                  <div style={{ textAlign: "center" }}>
                    <div className="q-stat-val" style={{ color: "var(--color-brand)" }}>{qual}%</div>
                    <div className="q-stat-lbl">Qualified</div>
                  </div>
                </div>
                <div className="q-actions">
                  <button className="tx-action-btn" onClick={(e) => { e.stopPropagation(); onPreview(f.id); }}>👁 Preview</button>
                  <button className="tx-action-btn" onClick={(e) => { e.stopPropagation(); onOpenForm(f.id); }}>✏ Edit</button>
                  <button className="tx-action-btn danger" onClick={(e) => {
                    e.stopPropagation();
                    if (confirm("Delete this intake form? This cannot be undone.")) { delForm(f.id); toast("Form deleted"); }
                  }}>🗑</button>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════════
// FORM EDITOR
// ════════════════════════════════════════════════════════════════════════
function FormEditor({ formId, onClose, onOpenQuestionModal, onPreview }: {
  formId: number;
  onClose: () => void;
  onOpenQuestionModal: (qid: number) => void;
  onPreview: () => void;
}) {
  const forms       = useTreatmentsIntake((s) => s.forms);
  const treatments  = useTreatmentsIntake((s) => s.treatments);
  const clients     = useTreatmentsIntake((s) => s.clients);
  const updateForm  = useTreatmentsIntake((s) => s.updateForm);
  const addQuestion = useTreatmentsIntake((s) => s.addQuestion);
  const delQuestion = useTreatmentsIntake((s) => s.deleteQuestion);
  const dupQuestion = useTreatmentsIntake((s) => s.duplicateQuestion);
  const moveQuestion = useTreatmentsIntake((s) => s.moveQuestion);
  const toggleAssign = useTreatmentsIntake((s) => s.toggleAssign);
  const toggleHard   = useTreatmentsIntake((s) => s.toggleHardRule);
  const toggleDrug   = useTreatmentsIntake((s) => s.toggleDrugRule);
  const toggleReview = useTreatmentsIntake((s) => s.toggleReviewRule);

  const form = forms.find((f) => f.id === formId);
  const [name, setName] = useState(form?.name || "");
  const [slug, setSlug] = useState(form?.slug || "");
  const [desc, setDesc] = useState(form?.desc || "");
  const [activeTab, setActiveTab] = useState<EditorTab>("builder");

  useEffect(() => {
    if (form) { setName(form.name); setSlug(form.slug); setDesc(form.desc); }
  }, [form?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const dragSrcIdx = useRef<number | null>(null);

  if (!form) return null;

  const slugPreview = slug || "your-slug";

  function autoSlug(text: string) {
    return text.toLowerCase()
      .replace(/[^a-z0-9\s-]/g, "")
      .replace(/\s+/g, "-")
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 60);
  }
  function manualSlug(text: string) {
    return text.toLowerCase().replace(/[^a-z0-9-]/g, "-").replace(/-+/g, "-");
  }
  function handleNameInput(v: string) { setName(v); setSlug(autoSlug(v)); }
  function handleSlugInput(v: string) { setSlug(manualSlug(v)); }

  function save() {
    if (!name.trim()) { toast("Form name is required"); return; }
    if (!slug.trim()) { toast("URL slug is required"); return; }
    const dup = forms.find((f) => f.slug === slug && f.id !== form!.id);
    if (dup) { toast("URL slug already in use — pick a unique one"); return; }
    updateForm(form!.id, { name: name.trim(), slug: slug.trim(), desc: desc.trim() });
    toast(`Form saved · app.dripvitals.com/intake-form/${slug}`);
    onClose();
  }
  function copyShareUrl() {
    if (!slug) { toast("Set a URL slug first"); return; }
    navigator.clipboard?.writeText(`https://app.dripvitals.com/intake-form/${slug}`)
      .then(() => toast("URL copied to clipboard"));
  }

  function handleAddQ(type: BaskQuestionType) {
    const base: Omit<BaskQuestion, "id"> = {
      type, text: "", helper: "", impact: "none", required: type !== "section", options: [],
    };
    if (type === "section")  { base.text = "New Section"; base.sectionIcon = "📋"; base.required = false; }
    if (type === "personal_info") { base.text = "Personal Information"; base.helper = "Your name and contact details"; }
    if (type === "state")    { base.text = "Which state do you live in?"; base.helper = "We match you with a provider licensed in your state."; }
    if (type === "multiple" || type === "dropdown") base.options = ["Option 1", "Option 2"];
    if (type === "checkbox") base.options = [{ label: "Option 1", flag: "ok" }, { label: "Option 2", flag: "ok" }];
    if (type === "yesno")    base.options = [];
    const created = addQuestion(form!.id, base);
    onOpenQuestionModal(created.id);
  }

  // Counts for tab badges
  const formClients = clients.filter((c) => c.formId === formId);
  const respCount = formClients.length;

  return (
    <div className="q-editor show">
      <div className="q-editor-head">
        <button className="back" onClick={onClose}>←</button>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div className="page-title" style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {form.name || "Untitled Form"}
          </div>
          <div className="page-sub">Build, configure, and monitor this intake form</div>
        </div>
        <button className="btn btn-ghost btn-sm" onClick={copyShareUrl}>🔗 Copy URL</button>
        <button className="btn btn-ghost btn-sm" onClick={() => { updateForm(form.id, { name: name.trim() || "Untitled Form", slug: slug.trim() || "untitled" }); onPreview(); }}>👁 Preview</button>
        <button className="btn btn-primary" onClick={save}>Save Form</button>
      </div>

      <div className="q-tab-layout">
        {/* LEFT: tab navigation */}
        <aside className="q-tab-nav">
          <div className="q-tab-section">
            <div className="q-tab-section-label">Build</div>
            <TabBtn icon="🔨" label="Form Builder"        active={activeTab === "builder"} onClick={() => setActiveTab("builder")} />
            <TabBtn icon="⚡" label="Qualification Logic" active={activeTab === "logic"}   onClick={() => setActiveTab("logic")} />
            <TabBtn icon="👁" label="Preview"             onClick={() => { updateForm(form.id, { name: name.trim() || "Untitled Form", slug: slug.trim() || "untitled" }); onPreview(); }} />
          </div>
          <div className="q-tab-section">
            <div className="q-tab-section-label">Responses</div>
            <TabBtn icon="📋" label="All Responses"   badge={respCount}                                                    active={activeTab === "responses"}    onClick={() => setActiveTab("responses")} />
            <TabBtn icon="✅" label="Qualified"       badge={formClients.filter((c) => c.status === "paid" || c.status === "unpaid").length} active={activeTab === "qualified"}    onClick={() => setActiveTab("qualified")} />
            <TabBtn icon="🚫" label="Disqualified"    badge={formClients.filter((c) => c.status === "disqualified").length}                  active={activeTab === "disqualified"} onClick={() => setActiveTab("disqualified")} />
            <TabBtn icon="👁" label="Needs Review"    badge={formClients.filter((c) => c.status === "in_progress").length}                   active={activeTab === "review"}       onClick={() => setActiveTab("review")} />
          </div>
          <div className="q-tab-section">
            <div className="q-tab-section-label">Configuration</div>
            <TabBtn icon="⚙️" label="Form Settings"  active={activeTab === "settings"}      onClick={() => setActiveTab("settings")} />
            <TabBtn icon="📧" label="Notifications"   active={activeTab === "notifications"} onClick={() => setActiveTab("notifications")} />
            <TabBtn icon="🔗" label="Embed & Share"   active={activeTab === "embed"}         onClick={() => setActiveTab("embed")} />
            <TabBtn icon="📊" label="Analytics"       active={activeTab === "analytics"}     onClick={() => setActiveTab("analytics")} />
          </div>
        </aside>

        {/* RIGHT: tab content */}
        <main className="q-tab-content">
          {activeTab === "builder" && (
            <BuilderTab
              form={form}
              dragSrcIdx={dragSrcIdx}
              moveQuestion={moveQuestion}
              onOpenQuestionModal={onOpenQuestionModal}
              dupQuestion={dupQuestion}
              delQuestion={delQuestion}
              handleAddQ={handleAddQ}
            />
          )}
          {activeTab === "logic" && (
            <LogicTab
              form={form}
              onToggleHard={(id) => { toggleHard(form.id, id); toast("🔄 Rule updated"); }}
              onToggleDrug={(id) => { toggleDrug(form.id, id); toast("🔄 Rule updated"); }}
              onToggleReview={(id) => { toggleReview(form.id, id); toast("🔄 Rule updated"); }}
            />
          )}
          {(activeTab === "responses" || activeTab === "qualified" || activeTab === "disqualified" || activeTab === "review") && (
            <ResponsesTab
              clients={formClients}
              filter={
                activeTab === "qualified"    ? "qualified"
                : activeTab === "disqualified" ? "disqualified"
                : activeTab === "review"       ? "review"
                : "all"
              }
            />
          )}
          {activeTab === "settings" && (
            <SettingsTab
              form={form}
              name={name} slug={slug} desc={desc} slugPreview={slugPreview}
              onNameInput={handleNameInput}
              onSlugInput={handleSlugInput}
              onDescInput={setDesc}
              treatments={treatments}
              onToggleAssign={(txId) => toggleAssign(form.id, txId)}
              onToggleActive={() => updateForm(form.id, { active: !form.active })}
            />
          )}
          {activeTab === "notifications" && <NotificationsTab form={form} />}
          {activeTab === "embed"          && <EmbedTab form={form} />}
          {activeTab === "analytics"      && <AnalyticsTab form={form} />}
        </main>
      </div>
    </div>
  );
}

// ─── Tab navigation button ──────────────────────────────────────────────
type EditorTab = "builder" | "logic" | "responses" | "qualified" | "disqualified" | "review" | "settings" | "notifications" | "embed" | "analytics";

function TabBtn({ icon, label, active, onClick, badge }: { icon: string; label: string; active?: boolean; onClick: () => void; badge?: number }) {
  return (
    <button className={`q-tab-btn${active ? " active" : ""}`} onClick={onClick}>
      <span className="q-tab-btn-icon">{icon}</span>
      <span className="q-tab-btn-label">{label}</span>
      {badge !== undefined && badge > 0 && <span className="q-tab-btn-badge">{badge}</span>}
    </button>
  );
}

// ─── BUILDER TAB ────────────────────────────────────────────────────────
function BuilderTab({ form, dragSrcIdx, moveQuestion, onOpenQuestionModal, dupQuestion, delQuestion, handleAddQ }: {
  form: BaskIntakeForm;
  dragSrcIdx: { current: number | null };
  moveQuestion: (formId: number, fromIdx: number, toIdx: number) => void;
  onOpenQuestionModal: (qid: number) => void;
  dupQuestion: (formId: number, qid: number) => void;
  delQuestion: (formId: number, qid: number) => void;
  handleAddQ: (type: BaskQuestionType) => void;
}) {
  let qNum = 0;
  return (
    <div>
      <div className="q-tab-title">Form Builder</div>
      <div className="q-tab-sub">Drag to reorder · click ✏ to edit · question types support text inputs, multi-select, address, signature, file upload, and more</div>

      <div className="q-builder">
        <div className="q-builder-head">
          <div className="card-ic" style={{ background: "var(--color-amber-soft)", color: "var(--color-amber)" }}>❓</div>
          <div style={{ flex: 1 }}>
            <div className="card-title">Questions</div>
            <div className="card-sub">{form.questions.length ? `${form.questions.length} item${form.questions.length === 1 ? "" : "s"} · Drag to reorder` : "No questions yet — add your first one below"}</div>
          </div>
        </div>
        <div className="q-builder-body">
          <div className="q-items">
            {form.questions.length === 0 ? (
              <div className="empty-state" style={{ padding: "32px 24px" }}>
                <div className="empty-ic">❓</div>
                <div className="empty-title">No questions yet</div>
                <div className="empty-sub">Use the buttons below to add your first question.</div>
              </div>
            ) : (
              form.questions.map((q, i) => {
                const isSection = q.type === "section";
                if (!isSection) qNum++;
                const typeLabel = TYPE_LABEL[q.type] || q.type;
                return (
                  <div
                    key={q.id}
                    className={`q-item${isSection ? " section" : ""}`}
                    draggable
                    onDragStart={(e) => { dragSrcIdx.current = i; e.currentTarget.classList.add("dragging"); e.dataTransfer.effectAllowed = "move"; }}
                    onDragOver={(e) => { e.preventDefault(); e.dataTransfer.dropEffect = "move"; }}
                    onDrop={(e) => {
                      e.preventDefault();
                      const src = dragSrcIdx.current;
                      if (src === null || src === i) return;
                      moveQuestion(form.id, src, i);
                      dragSrcIdx.current = null;
                    }}
                    onDragEnd={(e) => { e.currentTarget.classList.remove("dragging"); }}
                  >
                    <div className="q-item-head">
                      <div className="q-drag">⋮⋮</div>
                      <div className="q-num">{isSection ? (q.sectionIcon || "§") : qNum}</div>
                      <div className="q-text">{q.text || "(untitled)"}</div>
                      <div className="q-item-actions">
                        <button className="q-mini-btn" title="Edit"      onClick={() => onOpenQuestionModal(q.id)}>✏</button>
                        <button className="q-mini-btn" title="Duplicate" onClick={() => { dupQuestion(form.id, q.id); toast("Question duplicated"); }}>⊕</button>
                        <button className="q-mini-btn danger" title="Delete" onClick={() => delQuestion(form.id, q.id)}>🗑</button>
                      </div>
                    </div>
                    {!isSection && (
                      <div className="q-item-detail">
                        <span className="q-type-pill">{typeLabel}</span>
                        {q.required && <span className="pill pill-muted">Required</span>}
                        {q.impact === "disqualifier" && <span className="pill q-impact-disq">⛔ Disqualifier</span>}
                        {q.impact === "review"       && <span className="pill q-impact-review">⚠ Review</span>}
                        {q.impact === "qualify"      && <span className="pill q-impact-qualify">✓ Qualifies</span>}
                        {q.helper && <span style={{ fontSize: 11, color: "var(--color-ink-muted)" }}>{q.helper}</span>}
                        {q.options && q.options.length > 0 && (
                          <span style={{ fontSize: 11, color: "var(--color-ink-muted)" }}>{q.options.length} option{q.options.length === 1 ? "" : "s"}</span>
                        )}
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
          <div className="q-add-row">
            <button className="q-add-btn" onClick={() => handleAddQ("section")}>＋ Section</button>
            <button className="q-add-btn" onClick={() => handleAddQ("personal_info")}>＋ Personal Info</button>
            <button className="q-add-btn" onClick={() => handleAddQ("text")}>＋ Short Text</button>
            <button className="q-add-btn" onClick={() => handleAddQ("long_text")}>＋ Long Text</button>
            <button className="q-add-btn" onClick={() => handleAddQ("number")}>＋ Number</button>
            <button className="q-add-btn" onClick={() => handleAddQ("date")}>＋ Date</button>
            <button className="q-add-btn" onClick={() => handleAddQ("yesno")}>＋ Yes / No</button>
            <button className="q-add-btn" onClick={() => handleAddQ("multiple")}>＋ Single Choice</button>
            <button className="q-add-btn" onClick={() => handleAddQ("checkbox")}>＋ Multi-Select</button>
            <button className="q-add-btn" onClick={() => handleAddQ("dropdown")}>＋ Dropdown</button>
            <button className="q-add-btn" onClick={() => handleAddQ("scale")}>＋ Scale 1–10</button>
            <button className="q-add-btn" onClick={() => handleAddQ("rating")}>＋ Star Rating</button>
            <button className="q-add-btn" onClick={() => handleAddQ("email")}>＋ Email</button>
            <button className="q-add-btn" onClick={() => handleAddQ("phone")}>＋ Phone</button>
            <button className="q-add-btn" onClick={() => handleAddQ("address")}>＋ Address</button>
            <button className="q-add-btn" onClick={() => handleAddQ("state")}>＋ State</button>
            <button className="q-add-btn" onClick={() => handleAddQ("signature")}>＋ Signature</button>
            <button className="q-add-btn" onClick={() => handleAddQ("file")}>＋ File Upload</button>
            <button className="q-add-btn" onClick={() => handleAddQ("bmi")}>＋ BMI Calculator</button>
          </div>
        </div>
      </div>
    </div>
  );
}

// Shared label map for question types (used in builder list + modal)
const TYPE_LABEL: Record<BaskQuestionType, string> = {
  section: "Section", text: "Short Text", long_text: "Long Text", number: "Number",
  date: "Date", yesno: "Yes / No", multiple: "Single Choice", checkbox: "Multi-Select",
  dropdown: "Dropdown", scale: "Scale 1–10", rating: "Star Rating",
  email: "Email", phone: "Phone", address: "Address", state: "State", signature: "Signature", file: "File Upload",
  bmi: "BMI Calculator", personal_info: "Personal Info",
};

// ─── LOGIC TAB ──────────────────────────────────────────────────────────
function LogicTab({ form, onToggleHard, onToggleDrug, onToggleReview }: {
  form: BaskIntakeForm;
  onToggleHard: (id: string) => void;
  onToggleDrug: (id: string) => void;
  onToggleReview: (id: string) => void;
}) {
  const hardRules   = form.hardRules   || [];
  const drugRules   = form.drugRules   || [];
  const reviewRules = form.reviewRules || [];
  const activeHard   = hardRules.filter((r) => r.active).length;
  const activeReview = reviewRules.filter((r) => r.active).length;
  const activeDrug   = drugRules.filter((r) => r.active).length;
  const total        = activeHard + activeReview + activeDrug;

  return (
    <div>
      <div className="q-tab-title">Qualification Logic</div>
      <div className="q-tab-sub">Define disqualifying conditions, drug interactions, and review flags — automation runs on every form submission</div>

      <div className="stat-grid">
        <div className="stat-card">
          <div className="stat-card-label">Total Rules</div>
          <div className="stat-card-num" style={{ color: "var(--color-brand-dk)" }}>{total}</div>
          <div className="stat-card-sub">Active logic rules</div>
        </div>
        <div className="stat-card">
          <div className="stat-card-label">Hard Disqualifiers</div>
          <div className="stat-card-num" style={{ color: "var(--color-red)" }}>{activeHard}</div>
          <div className="stat-card-sub">Auto-deny conditions</div>
        </div>
        <div className="stat-card">
          <div className="stat-card-label">Review Flags</div>
          <div className="stat-card-num" style={{ color: "var(--color-amber)" }}>{activeReview}</div>
          <div className="stat-card-sub">Require provider review</div>
        </div>
        <div className="stat-card">
          <div className="stat-card-label">Drug Interactions</div>
          <div className="stat-card-num" style={{ color: "var(--color-coral)" }}>{activeDrug}</div>
          <div className="stat-card-sub">Flagged drug classes</div>
        </div>
      </div>

      <RuleCard
        title="Hard Disqualifiers"
        sub="Patient is automatically denied — no provider review needed"
        icon="🚫"
        iconBg="var(--color-red-soft)"
        iconColor="var(--color-red)"
        emptyMsg="No hard disqualifiers configured for this form."
      >
        {hardRules.map((r) => (
          <RuleRow key={r.id} rule={r} accentColor="var(--color-red)" mutedColor="var(--color-border-2)"
            onToggle={() => onToggleHard(r.id)}
            statusPill={r.active ? <span className="pill q-impact-disq">Active</span> : <span className="pill pill-muted">Off</span>} />
        ))}
      </RuleCard>

      <RuleCard
        title="Drug Interactions"
        sub="Medications that interact with this form's treatments"
        icon="💊"
        iconBg="var(--color-coral-soft)"
        iconColor="var(--color-coral)"
        emptyMsg="No drug-interaction rules configured for this form."
      >
        {drugRules.map((r) => {
          const accent = r.level === "disq" ? "var(--color-red)" : r.level === "review" ? "var(--color-amber)" : "var(--color-green)";
          const pill = r.level === "disq"
            ? <span className="pill q-impact-disq">🚫 Disqualifier</span>
            : r.level === "review"
              ? <span className="pill q-impact-review">⚠ Review</span>
              : <span className="pill q-impact-qualify">✅ Compatible</span>;
          return (
            <RuleRow key={r.id} rule={r} accentColor={accent} mutedColor="var(--color-border-2)" onToggle={() => onToggleDrug(r.id)} statusPill={pill} />
          );
        })}
      </RuleCard>

      <RuleCard
        title="Review Flags"
        sub="Conditions that need provider review before qualifying"
        icon="⚠"
        iconBg="var(--color-amber-soft)"
        iconColor="var(--color-amber)"
        emptyMsg="No review flags configured for this form."
      >
        {reviewRules.map((r) => (
          <RuleRow key={r.id} rule={r} accentColor="var(--color-amber)" mutedColor="var(--color-border-2)"
            onToggle={() => onToggleReview(r.id)}
            statusPill={r.active ? <span className="pill q-impact-review">Active</span> : <span className="pill pill-muted">Off</span>} />
        ))}
      </RuleCard>
    </div>
  );
}

function RuleCard({ title, sub, icon, iconBg, iconColor, emptyMsg, children }: { title: string; sub: string; icon: string; iconBg: string; iconColor: string; emptyMsg: string; children: ReactNode }) {
  const isEmpty = !children || (Array.isArray(children) && children.length === 0);
  return (
    <div className="rule-card">
      <div className="rule-card-head">
        <div className="rule-card-icon" style={{ background: iconBg, color: iconColor, borderColor: iconBg }}>{icon}</div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div className="rule-card-title">{title}</div>
          <div className="rule-card-sub">{sub}</div>
        </div>
      </div>
      <div className="rule-card-body">
        {isEmpty ? <div style={{ padding: "12px", fontSize: 12, color: "var(--color-ink-muted)", textAlign: "center" }}>{emptyMsg}</div> : children}
      </div>
    </div>
  );
}

function RuleRow({ rule: r, accentColor, mutedColor, onToggle, statusPill }: { key?: Key; rule: BaskRule; accentColor: string; mutedColor: string; onToggle: () => void; statusPill: ReactNode }) {
  return (
    <div className="rule-row" style={{ borderLeftColor: r.active ? accentColor : mutedColor }}>
      <div className="rule-row-icon">{r.icon}</div>
      <div className="rule-row-body">
        <div className="rule-row-title">{r.title}</div>
        <div className="rule-row-desc">{r.desc}</div>
      </div>
      <div className="rule-row-actions">
        <button
          role="switch"
          aria-checked={r.active}
          onClick={onToggle}
          className="toggle-switch"
          style={{
            background: r.active ? "var(--color-brand)" : "var(--color-surface-3)",
            borderColor: r.active ? "var(--color-brand)" : "var(--color-border-2)",
          }}
        >
          <span className="toggle-switch-knob" style={{ transform: r.active ? "translateX(16px)" : "translateX(0)" }} />
        </button>
        {statusPill}
      </div>
    </div>
  );
}

// ─── RESPONSES TAB ──────────────────────────────────────────────────────
function ResponsesTab({ clients, filter }: { clients: BaskClient[]; filter: "all" | "qualified" | "disqualified" | "review" }) {
  const filtered = clients.filter((c) => {
    if (filter === "all") return true;
    if (filter === "qualified")    return c.status === "paid" || c.status === "unpaid";
    if (filter === "disqualified") return c.status === "disqualified";
    if (filter === "review")       return c.status === "in_progress";
    return true;
  });

  const titleMap = { all: "All Responses", qualified: "Qualified Responses", disqualified: "Disqualified Responses", review: "Needs Review" };
  const subMap = {
    all: "Every patient who has started or finished this intake",
    qualified: "Patients who completed intake and qualified for treatment",
    disqualified: "Patients who were auto-disqualified by form rules",
    review: "Patients flagged for manual provider review",
  };

  return (
    <div>
      <div className="q-tab-title">{titleMap[filter]}</div>
      <div className="q-tab-sub">{subMap[filter]} · {filtered.length} total</div>

      {filtered.length === 0 ? (
        <div className="config-list" style={{ padding: "48px 16px", textAlign: "center", color: "var(--color-ink-muted)", fontSize: 13 }}>
          No responses yet for this filter.
        </div>
      ) : (
        <div className="resp-table">
          <div className="resp-row head">
            <div>Patient</div>
            <div>Email</div>
            <div>Started</div>
            <div>Status</div>
            <div>Treatment</div>
          </div>
          {filtered.map((c) => (
            <div className="resp-row" key={c.id} onClick={() => toast(`Viewing ${c.first} ${c.last}`)}>
              <div style={{ fontWeight: 600 }}>{c.first} {c.last}</div>
              <div style={{ color: "var(--color-ink-muted)" }}>{c.email || "—"}</div>
              <div style={{ color: "var(--color-ink-muted)" }}>{c.startedAt}</div>
              <div>{statusPill(c.status)}</div>
              <div style={{ color: "var(--color-ink-muted)", fontSize: 11.5 }}>
                {c.treatmentId ? `#${c.treatmentId}` : "—"}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── SETTINGS TAB ───────────────────────────────────────────────────────
function SettingsTab({ form, name, slug, desc, slugPreview, onNameInput, onSlugInput, onDescInput, treatments, onToggleAssign, onToggleActive }: {
  form: BaskIntakeForm;
  name: string; slug: string; desc: string; slugPreview: string;
  onNameInput: (v: string) => void;
  onSlugInput: (v: string) => void;
  onDescInput: (v: string) => void;
  treatments: BaskTreatment[];
  onToggleAssign: (txId: number) => void;
  onToggleActive: () => void;
}) {
  const activeOnly = treatments.filter((t) => t.active);
  return (
    <div>
      <div className="q-tab-title">Form Settings</div>
      <div className="q-tab-sub">Configure form metadata, status, and the treatments this form qualifies patients for</div>

      <div className="card" style={{ marginBottom: 14 }}>
        <div className="card-head">
          <div className="card-ic">📝</div>
          <div style={{ flex: 1 }}>
            <div className="card-title">Form Details</div>
            <div className="card-sub">Name, URL slug, and internal description</div>
          </div>
          <div onClick={onToggleActive} style={{ cursor: "pointer" }}>
            <span className={`pill ${form.active ? "q-impact-qualify" : "pill-muted"}`}>
              {form.active ? "Active" : "Inactive"} — click to toggle
            </span>
          </div>
        </div>
        <div className="card-body">
          <div className="fg">
            <label className="fl">Form Name<span className="req">*</span></label>
            <input className="fi" value={name} onChange={(e) => onNameInput(e.target.value)} placeholder="e.g. GLP-1 Medication Intake" />
          </div>
          <div className="fg">
            <label className="fl">URL Slug<span className="req">*</span></label>
            <input className="fi" value={slug} onChange={(e) => onSlugInput(e.target.value)} placeholder="glp-1-medication" />
            <div className="fhint">URL-friendly identifier — lowercase, hyphens only</div>
          </div>
          <div className="fg">
            <label className="fl">Public Intake URL</label>
            <div className="url-preview">
              <span className="url-ic">🔗</span>
              <div className="url-text">app.dripvitals.com/intake-form/<span className="editable">{slugPreview}</span></div>
            </div>
            <div className="fhint">This is what clients see when they start the intake from your website</div>
          </div>
          <div className="fg" style={{ marginBottom: 0 }}>
            <label className="fl">Description (internal)</label>
            <textarea className="fta" value={desc} onChange={(e) => onDescInput(e.target.value)} placeholder="Internal notes for your team — not shown to clients" />
          </div>
        </div>
      </div>

      <div className="card" style={{ marginBottom: 14 }}>
        <div className="card-head">
          <div className="card-ic" style={{ background: "var(--color-purple-soft)", color: "var(--color-purple)" }}>💉</div>
          <div style={{ flex: 1 }}>
            <div className="card-title">Assigned Treatments</div>
            <div className="card-sub">{form.treatmentIds.length} of {activeOnly.length} active treatments assigned</div>
          </div>
        </div>
        <div className="card-body">
          <div className="tx-chip-list">
            {activeOnly.map((t) => {
              const c = COLOR_MAP[t.color] || COLOR_MAP.brand;
              const isSel = form.treatmentIds.includes(t.id);
              return (
                <div key={t.id} className={`tx-chip${isSel ? " sel" : ""}`} onClick={() => onToggleAssign(t.id)}>
                  <div className="tx-chip-check">{isSel ? "✓" : ""}</div>
                  <div className="tx-chip-ic" style={{ background: c.bg, color: c.fg }}>{t.icon}</div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div className="tx-chip-name">{t.name}</div>
                    <div className="tx-chip-meta">{t.med} · {t.price} {BILLING_LABEL[t.billing] || ""}</div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      <div className="config-list">
        <div className="config-row">
          <span className="config-row-label">Submission limit per patient</span>
          <span className="config-row-value">{form.settings?.submissionLimitPerPatient || "Unlimited"}</span>
        </div>
        <div className="config-row">
          <span className="config-row-label">Auto-close after</span>
          <span className="config-row-value">{form.settings?.autoCloseAfter || "Off"}</span>
        </div>
        <div className="config-row">
          <span className="config-row-label">Required-field validation</span>
          <span className="config-row-value">
            {(form.settings?.strictValidation ?? true) ? "Strict — block submit until complete" : "Lenient — allow partial submit"}
          </span>
        </div>
        <div className="config-row">
          <span className="config-row-label">Auto-qualify mode</span>
          <span className="config-row-value">
            {form.settings?.autoMode === "automated" ? "Fully Automated"
              : form.settings?.autoMode === "manual"  ? "Manual Review Only"
              : "AI-Assisted + Provider Review"}
          </span>
        </div>
      </div>
    </div>
  );
}

// ─── NOTIFICATIONS / EMBED / ANALYTICS TABS ─────────────────────────────
function NotificationsTab({ form }: { form: BaskIntakeForm }) {
  const n = form.notifications;
  return (
    <div>
      <div className="q-tab-title">Notifications</div>
      <div className="q-tab-sub">Email and SMS rules when patients submit, qualify, or get flagged</div>
      <div className="config-list">
        <div className="config-row"><span className="config-row-label">Notify on qualified submission</span><span className="config-row-value">{n?.qualifyEmail ? `✓ ${n.qualifyEmail}` : "Not configured"}</span></div>
        <div className="config-row"><span className="config-row-label">Notify on disqualified submission</span><span className="config-row-value">{n?.disqualifyEmail ? `✓ ${n.disqualifyEmail}` : "Not configured"}</span></div>
        <div className="config-row"><span className="config-row-label">Notify on review flag</span><span className="config-row-value">{n?.reviewEmail ? `✓ ${n.reviewEmail}` : "Not configured"}</span></div>
        <div className="config-row"><span className="config-row-label">Patient confirmation email</span><span className="config-row-value green">{(n?.patientConfirmationEnabled ?? true) ? "✓ Sent immediately after submit" : "Off"}</span></div>
      </div>
    </div>
  );
}

function EmbedTab({ form }: { form: BaskIntakeForm }) {
  const url = `https://app.dripvitals.com/intake-form/${form.slug || "your-slug"}`;
  const embed = `<iframe src="${url}" width="100%" height="800" frameborder="0"></iframe>`;
  return (
    <div>
      <div className="q-tab-title">Embed &amp; Share</div>
      <div className="q-tab-sub">Get a shareable link, embed snippet, or QR code for this intake form</div>
      <div className="config-list">
        <div className="config-row">
          <span className="config-row-label">Public link</span>
          <span className="config-row-value mono">{url}</span>
        </div>
        <div className="config-row">
          <span className="config-row-label">Copy link</span>
          <button className="btn btn-sm" onClick={() => { navigator.clipboard?.writeText(url); toast("Link copied"); }}>🔗 Copy</button>
        </div>
        <div className="config-row">
          <span className="config-row-label">Embed snippet</span>
          <span className="config-row-value mono" style={{ maxWidth: 380, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{embed}</span>
        </div>
        <div className="config-row">
          <span className="config-row-label">Copy embed</span>
          <button className="btn btn-sm" onClick={() => { navigator.clipboard?.writeText(embed); toast("Embed snippet copied"); }}>📋 Copy</button>
        </div>
        <div className="config-row">
          <span className="config-row-label">QR code</span>
          <span className="config-row-value">Available for printing in clinic</span>
        </div>
      </div>
    </div>
  );
}

function AnalyticsTab({ form }: { form: BaskIntakeForm }) {
  const rate = form.submissions > 0 ? Math.round((form.qualified / form.submissions) * 100) : 0;
  return (
    <div>
      <div className="q-tab-title">Analytics</div>
      <div className="q-tab-sub">Submission trends, qualification rate, and drop-off points</div>
      <div className="stat-grid">
        <div className="stat-card">
          <div className="stat-card-label">Total Submissions</div>
          <div className="stat-card-num" style={{ color: "var(--color-brand-dk)" }}>{form.submissions}</div>
          <div className="stat-card-sub">All time</div>
        </div>
        <div className="stat-card">
          <div className="stat-card-label">Qualified</div>
          <div className="stat-card-num" style={{ color: "var(--color-green)" }}>{form.qualified}</div>
          <div className="stat-card-sub">{rate}% qualify rate</div>
        </div>
        <div className="stat-card">
          <div className="stat-card-label">Median Time</div>
          <div className="stat-card-num" style={{ color: "var(--color-ink)" }}>4.2m</div>
          <div className="stat-card-sub">To complete intake</div>
        </div>
        <div className="stat-card">
          <div className="stat-card-label">Completion</div>
          <div className="stat-card-num" style={{ color: "var(--color-amber)" }}>82%</div>
          <div className="stat-card-sub">Of starts</div>
        </div>
      </div>
      <div className="config-list">
        <div className="config-row"><span className="config-row-label">Most common drop-off</span><span className="config-row-value">Medical history section — 12% abandon</span></div>
        <div className="config-row"><span className="config-row-label">Average submissions per week</span><span className="config-row-value">~ {Math.round(form.submissions / 52)} per week</span></div>
        <div className="config-row"><span className="config-row-label">Top disqualifier</span><span className="config-row-value">History of pancreatitis (28% of disq)</span></div>
      </div>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════════
// QUESTION MODAL (edit question + options editor)
// ════════════════════════════════════════════════════════════════════════
function QuestionModal({ formId, qid, onClose }: { formId: number; qid: number; onClose: () => void }) {
  const forms = useTreatmentsIntake((s) => s.forms);
  const updateQuestion = useTreatmentsIntake((s) => s.updateQuestion);

  const form = forms.find((f) => f.id === formId);
  const q = form?.questions.find((x) => x.id === qid);

  const initialOptions: BaskCheckboxOption[] = useMemo(() => {
    if (!q) return [];
    return (q.options || []).map((o) => typeof o === "string" ? { label: o, flag: "ok" as BaskOptionFlag } : { label: o.label, flag: o.flag || "ok" });
  }, [q?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const [text, setText]         = useState(q?.text || "");
  const [helper, setHelper]     = useState(q?.helper || "");
  const [required, setRequired] = useState(q?.required ? "true" : "false");
  const [impact, setImpact]     = useState<BaskImpact>(q?.impact || "none");
  const [options, setOptions]   = useState<BaskCheckboxOption[]>(initialOptions);

  if (!q || !form) return null;

  const isSection = q.type === "section";
  const hasOptions = q.type === "multiple" || q.type === "checkbox" || q.type === "dropdown";

  function cycleFlag(idx: number) {
    const order: BaskOptionFlag[] = ["ok", "review", "disq"];
    setOptions((prev) => prev.map((o, i) => {
      if (i !== idx) return o;
      const next = order[(order.indexOf(o.flag) + 1) % order.length];
      return { ...o, flag: next };
    }));
  }

  function save() {
    if (!text.trim()) { toast(isSection ? "Section title required" : "Question text required"); return; }
    const patch: Partial<BaskQuestion> = {
      text: text.trim(),
      helper: helper.trim(),
      required: required === "true",
      impact,
    };
    if (q!.type === "multiple" || q!.type === "dropdown") {
      patch.options = options.map((o) => o.label).filter(Boolean);
    } else if (q!.type === "checkbox") {
      patch.options = options.filter((o) => o.label);
    }
    updateQuestion(formId, qid, patch);
    toast(isSection ? "Section saved" : "Question saved");
    onClose();
  }

  return (
    <ModalShell
      title={isSection ? "Edit Section" : "Edit Question"}
      icon={isSection ? "📋" : "❓"}
      onClose={onClose}
      footer={<>
        <button className="btn btn-ghost" onClick={onClose}>Cancel</button>
        <button className="btn btn-primary" onClick={save}>Save Question</button>
      </>}
    >
      <div className="fg">
        <label className="fl">{isSection ? "Section Title" : "Question Text"}<span className="req">*</span></label>
        <input className="fi" value={text} onChange={(e) => setText(e.target.value)} placeholder="What would you like to ask?" />
      </div>
      {!isSection && (
        <div className="fg">
          <label className="fl">Helper Text</label>
          <input className="fi" value={helper} onChange={(e) => setHelper(e.target.value)} placeholder="Optional helpful context shown below the question" />
        </div>
      )}
      {hasOptions && (
        <div className="fg">
          <label className="fl">Answer Options</label>
          <div>
            {options.map((o, i) => (
              <div key={i} className="opt-row">
                <input className="fi" value={o.label} onChange={(e) => setOptions((prev) => prev.map((x, j) => j === i ? { ...x, label: e.target.value } : x))} placeholder="Option text" />
                <span className={`opt-flag ${o.flag}`} onClick={() => cycleFlag(i)}>
                  {o.flag === "disq" ? "⛔ Disqualifies" : o.flag === "review" ? "⚠ Review" : "✅ OK"}
                </span>
                <button className="q-mini-btn danger" onClick={() => setOptions((prev) => prev.filter((_, j) => j !== i))}>×</button>
              </div>
            ))}
            <button className="btn btn-ghost btn-sm" onClick={() => setOptions((prev) => [...prev, { label: "", flag: "ok" }])} style={{ marginTop: 7, alignSelf: "flex-start" }}>+ Add Option</button>
          </div>
        </div>
      )}
      {!isSection && (
        <div className="fr2">
          <div className="fg">
            <label className="fl">Required</label>
            <select className="fsel" value={required} onChange={(e) => setRequired(e.target.value)}>
              <option value="true">Yes</option>
              <option value="false">No</option>
            </select>
          </div>
          <div className="fg">
            <label className="fl">Clinical Impact</label>
            <select className="fsel" value={impact} onChange={(e) => setImpact(e.target.value as BaskImpact)}>
              <option value="none">None — informational</option>
              <option value="disqualifier">Disqualifier</option>
              <option value="review">Provider review</option>
              <option value="qualify">Qualifying / consent</option>
            </select>
          </div>
        </div>
      )}
    </ModalShell>
  );
}

// ════════════════════════════════════════════════════════════════════════
// CLIENTS LIST
// ════════════════════════════════════════════════════════════════════════
function statusPill(status: BaskClientStatus): ReactNode {
  if (status === "paid")         return <span className="pill pill-green"><span className="dot" />Paid</span>;
  if (status === "unpaid")       return <span className="pill pill-amber"><span className="dot" />Unpaid</span>;
  if (status === "in_progress")  return <span className="pill pill-blue"><span className="dot" />In progress</span>;
  if (status === "disqualified") return <span className="pill pill-red"><span className="dot" />Disqualified</span>;
  if (status === "refunded")     return <span className="pill pill-muted">Refunded</span>;
  return <span className="pill pill-muted">Unknown</span>;
}

function ClientsList({ onOpen }: { onOpen: (id: number) => void }) {
  const clients     = useTreatmentsIntake((s) => s.clients);
  const treatments  = useTreatmentsIntake((s) => s.treatments);
  const updateClient = useTreatmentsIntake((s) => s.updateClient);

  const [filter, setFilter] = useState<ClientFilter>("all");
  const [search, setSearch] = useState("");

  const filtered = useMemo(() => {
    let list = [...clients];
    if (filter !== "all") list = list.filter((c) => c.status === filter);
    const q = search.toLowerCase().trim();
    if (q) list = list.filter((c) => (`${c.first} ${c.last} ${c.email} ${c.phone}`).toLowerCase().includes(q));
    list.sort((a, b) => (b.startedAt || "").localeCompare(a.startedAt || ""));
    return list;
  }, [clients, filter, search]);

  const total  = clients.length;
  const paid   = clients.filter((c) => c.status === "paid").length;
  const unpaid = clients.filter((c) => c.status === "unpaid").length;
  const inProg = clients.filter((c) => c.status === "in_progress").length;
  const disq   = clients.filter((c) => c.status === "disqualified").length;

  function sendReminder(id: number) {
    const c = clients.find((x) => x.id === id);
    if (!c || c.status !== "unpaid") return;
    const remList = [...(c.reminders || []), { at: nowStamp(), channel: c.email ? "email" : "phone" }];
    updateClient(id, { reminders: remList });
    toast(`Payment reminder sent to ${c.first} ${c.last}`);
  }
  function markPaid(id: number) {
    const c = clients.find((x) => x.id === id);
    if (!c) return;
    if (!c.treatmentId) { toast("Cannot mark paid — no treatment was selected"); return; }
    updateClient(id, { status: "paid", paidAt: nowStamp(), lastFour: c.lastFour || "MANUAL", cardBrand: c.cardBrand || "Manual entry" });
    toast(`${c.first} ${c.last} marked as paid`);
  }

  return (
    <div className="page-wrap">
      <div className="page-head">
        <div>
          <div className="page-title">Clients</div>
          <div className="page-sub">Every person who started an intake form — paid, unpaid, or in progress</div>
        </div>
        <div className="page-actions">
          <button className="btn btn-ghost btn-sm" onClick={() => toast("Client list exported")}>Export CSV</button>
        </div>
      </div>

      <div className="kpi-grid" style={{ gridTemplateColumns: "repeat(5,1fr)" }}>
        <Kpi label="Total Clients" value={total}  sub={`${paid} paid · ${unpaid + inProg} pending`} icon="👥" tone="green" />
        <Kpi label="Paid"          value={paid}   sub="Active treatments" icon="✓" tone="green" up />
        <Kpi label="Unpaid"        value={unpaid} sub="Recovery opportunity" icon="💳" tone="amber" />
        <Kpi label="In Progress"   value={inProg} sub="Filling out intake" icon="⏳" tone="blue" />
        <Kpi label="Disqualified"  value={disq}   sub="Auto-screened" icon="⚠" tone="red" />
      </div>

      <div className="filter-bar">
        {(["all","paid","unpaid","in_progress","disqualified"] as ClientFilter[]).map((k) => (
          <div key={k} className={`fc${filter === k ? " on" : ""}`} onClick={() => setFilter(k)}>
            {k === "all" ? "All" : k === "in_progress" ? "In progress" : k.charAt(0).toUpperCase() + k.slice(1)}
          </div>
        ))}
        <div className="bar-sp" />
        <div className="search-w">
          <span className="search-w-icon">🔍</span>
          <input type="text" placeholder="Search clients…" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
      </div>

      <div className="q-list-card">
        {filtered.length === 0 ? (
          <div className="empty-state">
            <div className="empty-ic">👥</div>
            <div className="empty-title">No clients match this view</div>
            <div className="empty-sub">Clients appear here automatically when someone starts an intake form.</div>
          </div>
        ) : (
          filtered.map((c) => {
            const tx = c.treatmentId ? treatments.find((t) => t.id === c.treatmentId) : null;
            const initials = ((c.first || "?")[0] + (c.last || "?")[0]).toUpperCase();
            const fullName = `${c.first || "Unknown"} ${c.last || ""}`.trim();
            return (
              <div key={c.id} className="q-row" onClick={() => onOpen(c.id)}>
                <div className="q-icon" style={{ background: "var(--color-brand)", color: "#fff", fontFamily: "var(--font-inter)", fontWeight: 700, fontSize: 15, letterSpacing: "-.5px" }}>{initials}</div>
                <div className="q-info">
                  <div className="q-name">{fullName}</div>
                  <div className="q-meta">{c.email || "—"} · {c.phone || "—"}</div>
                  <div className="q-tags">
                    {statusPill(c.status)}
                    <span className="pill pill-muted">{c.formName}</span>
                    {tx ? <span className="pill pill-purple">{tx.med}</span> : <span className="pill pill-muted">No treatment selected</span>}
                    {c.reminders && c.reminders.length > 0 && <span className="pill pill-amber">↻ {c.reminders.length} reminder{c.reminders.length === 1 ? "" : "s"}</span>}
                  </div>
                </div>
                <div className="q-stats">
                  <div style={{ textAlign: "center" }}>
                    <div className="q-stat-val" style={{ fontSize: 13 }}>{(c.startedAt || "").split(" ")[0] || "—"}</div>
                    <div className="q-stat-lbl">Started</div>
                  </div>
                  <div style={{ textAlign: "center" }}>
                    <div className="q-stat-val" style={{ color: c.status === "paid" ? "var(--color-brand)" : "var(--color-ink-muted)", fontSize: 13 }}>{tx ? tx.price : "—"}</div>
                    <div className="q-stat-lbl">{tx ? BILLING_LABEL[tx.billing] || "" : "—"}</div>
                  </div>
                </div>
                <div className="q-actions">
                  {c.status === "unpaid" && <button className="tx-action-btn" onClick={(e) => { e.stopPropagation(); sendReminder(c.id); }}>📩 Remind</button>}
                  {c.status === "unpaid" && <button className="tx-action-btn" onClick={(e) => { e.stopPropagation(); markPaid(c.id); }}>✓ Mark paid</button>}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════════
// CLIENT DETAIL
// ════════════════════════════════════════════════════════════════════════
function ClientDetail({ clientId, onBack }: { clientId: number; onBack: () => void }) {
  const clients      = useTreatmentsIntake((s) => s.clients);
  const treatments   = useTreatmentsIntake((s) => s.treatments);
  const updateClient = useTreatmentsIntake((s) => s.updateClient);

  const c = clients.find((x) => x.id === clientId);
  if (!c) return null;

  const tx = c.treatmentId ? treatments.find((t) => t.id === c.treatmentId) : null;
  const initials = ((c.first || "?")[0] + (c.last || "?")[0]).toUpperCase();
  const addr = c.address || { line1: "", apt: "", city: "", state: "", zip: "" };
  const hasAddress = !!(addr.line1 || addr.city);
  const fullName = `${c.first || "Unknown"} ${c.last || ""}`.trim();

  function doRemind() {
    if (c!.status !== "unpaid") { toast("Reminder only sends for unpaid clients"); return; }
    updateClient(c!.id, { reminders: [...(c!.reminders || []), { at: nowStamp(), channel: c!.email ? "email" : "phone" }] });
    toast(`Payment reminder sent to ${c!.first} ${c!.last}`);
  }
  function doMarkPaid() {
    if (!c!.treatmentId) { toast("Cannot mark paid — no treatment was selected"); return; }
    updateClient(c!.id, { status: "paid", paidAt: nowStamp(), lastFour: c!.lastFour || "MANUAL", cardBrand: c!.cardBrand || "Manual entry" });
    toast(`${c!.first} ${c!.last} marked as paid`);
  }
  function doRefund() {
    if (!confirm(`Issue refund to ${c!.first} ${c!.last}? This will mark the order as refunded.`)) return;
    updateClient(c!.id, { status: "refunded" });
    toast("Refund issued");
  }

  const orderBorder = c.status === "paid" ? "var(--color-brand-soft)" : "var(--color-amber-soft)";
  const orderBg     = c.status === "paid" ? "var(--color-brand-softer)" : "var(--color-surface)";
  const txColor = tx ? (COLOR_MAP[tx.color] || COLOR_MAP.brand) : COLOR_MAP.brand;

  return (
    <div className="page-wrap">
      <div className="q-editor-head" style={{ marginBottom: 22 }}>
        <button className="back" onClick={onBack}>←</button>
        <div style={{ flex: 1 }}>
          <div className="page-title">{fullName}</div>
          <div className="page-sub" style={{ display: "flex", gap: 8, alignItems: "center" }}>
            {statusPill(c.status)} · Started {c.startedAt || "—"} · {c.formName}
          </div>
        </div>
        {c.status === "unpaid" && <button className="btn btn-ghost btn-sm" onClick={doRemind}>📩 Send payment reminder</button>}
        {c.status === "unpaid" && <button className="btn btn-primary" onClick={doMarkPaid}>✓ Mark as paid</button>}
        {c.status === "paid"   && <button className="btn btn-ghost btn-sm" onClick={doRefund}>↩ Issue refund</button>}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "340px 1fr", gap: 20, alignItems: "flex-start" }} className="cd-grid">
        {/* LEFT */}
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <div className="card">
            <div className="card-body" style={{ textAlign: "center", padding: "24px 20px" }}>
              <div style={{ width: 80, height: 80, borderRadius: 20, background: "var(--color-brand)", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 30, fontWeight: 700, letterSpacing: "-.8px", margin: "0 auto 14px", boxShadow: "var(--shadow-md)" }}>{initials}</div>
              <div style={{ fontSize: 18, fontWeight: 700, letterSpacing: "-.3px", marginBottom: 4 }}>{fullName}</div>
              <div style={{ fontSize: 11.5, color: "var(--color-ink-muted)", marginBottom: 14 }}>Client ID #C-{String(c.id).padStart(4, "0")}</div>
              {statusPill(c.status)}
            </div>
          </div>

          <div className="card">
            <div className="card-head">
              <div className="card-ic">📞</div>
              <div style={{ flex: 1 }}><div className="card-title">Contact</div></div>
            </div>
            <div className="card-body" style={{ padding: "8px 18px 14px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 0", borderBottom: "1px solid var(--color-border)", fontSize: 12.5 }}>
                <span style={{ color: "var(--color-ink-muted)" }}>Email</span>
                <span style={{ fontWeight: 600, color: "var(--color-ink)" }}>{c.email || "—"}</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 0", borderBottom: "1px solid var(--color-border)", fontSize: 12.5 }}>
                <span style={{ color: "var(--color-ink-muted)" }}>Phone</span>
                <span style={{ fontWeight: 600, color: "var(--color-ink)" }}>{c.phone || "—"}</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", padding: "10px 0", fontSize: 12.5, gap: 14 }}>
                <span style={{ color: "var(--color-ink-muted)", flexShrink: 0 }}>Address</span>
                <span style={{ fontWeight: 600, color: "var(--color-ink)", textAlign: "right", lineHeight: 1.5 }}>
                  {hasAddress ? <>{addr.line1}{addr.apt ? `, ${addr.apt}` : ""}<br />{addr.city}, {addr.state} {addr.zip}</> : <span style={{ color: "var(--color-ink-muted)", fontWeight: 500 }}>Not provided</span>}
                </span>
              </div>
            </div>
          </div>

          <div className="card">
            <div className="card-head">
              <div className="card-ic" style={{ background: "var(--color-amber-soft)", color: "var(--color-amber)" }}>📩</div>
              <div style={{ flex: 1 }}><div className="card-title">Reminder History</div></div>
            </div>
            <div className="card-body" style={{ padding: "0 18px 12px" }}>
              {(c.reminders || []).length === 0 ? (
                <div style={{ textAlign: "center", color: "var(--color-ink-muted)", fontSize: 12, padding: "14px 0" }}>No reminders sent yet</div>
              ) : (
                [...(c.reminders || [])].reverse().map((r, i) => (
                  <div key={i} style={{ display: "flex", alignItems: "center", gap: 10, padding: "9px 0", borderBottom: "1px solid var(--color-border)", fontSize: 12 }}>
                    <span style={{ color: "var(--color-amber)" }}>📩</span>
                    <span style={{ flex: 1, color: "var(--color-ink-2)" }}>Reminder sent via <strong style={{ color: "var(--color-ink)" }}>{r.channel}</strong></span>
                    <span style={{ fontFamily: "var(--font-inter)", color: "var(--color-ink-muted)", fontSize: 11 }}>{r.at}</span>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        {/* RIGHT */}
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <div className="card">
            <div className="card-head">
              <div className="card-ic" style={{ background: "var(--color-purple-soft)", color: "var(--color-purple)" }}>📦</div>
              <div style={{ flex: 1 }}>
                <div className="card-title">Orders</div>
                <div className="card-sub">Treatments purchased or in cart</div>
              </div>
            </div>
            <div className="card-body">
              {tx ? (
                <div style={{ background: orderBg, border: `1.5px solid ${orderBorder}`, borderRadius: 12, padding: "18px 22px", marginBottom: 12 }}>
                  <div style={{ display: "flex", alignItems: "flex-start", gap: 16 }}>
                    <div style={{ width: 54, height: 54, borderRadius: 14, background: txColor.bg, color: txColor.fg, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 24, flexShrink: 0 }}>{tx.icon}</div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 5, flexWrap: "wrap" }}>
                        <div style={{ fontSize: 15, fontWeight: 700, color: "var(--color-ink)", letterSpacing: "-.2px" }}>{tx.name}</div>
                        {statusPill(c.status)}
                      </div>
                      <div style={{ fontSize: 12.5, color: "var(--color-ink-muted)", marginBottom: 10 }}>{tx.med} · {tx.strength || ""} · {tx.freq || ""}</div>
                      <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 8 }}>
                        <DetailMini label="Price"    value={tx.price} />
                        <DetailMini label="Billing"  value={BILLING_LONG[tx.billing] || "—"} />
                        <DetailMini label="Order Date" value={(c.startedAt || "").split(" ")[0] || "—"} />
                        <DetailMini label={c.status === "paid" ? "Paid On" : "Status"} value={c.status === "paid" ? (c.paidAt || "—") : "Awaiting payment"} valueColor={c.status === "paid" ? "var(--color-brand)" : "var(--color-amber)"} />
                      </div>
                      {c.status === "paid" && <div style={{ marginTop: 10, fontSize: 11.5, color: "var(--color-ink-2)" }}><strong>Paid with:</strong> {c.cardBrand || "Card"} ending in <span style={{ fontFamily: "var(--font-inter)" }}>{c.lastFour || "—"}</span></div>}
                    </div>
                  </div>
                </div>
              ) : c.status === "disqualified" ? (
                <div style={{ textAlign: "center", padding: "32px 24px", background: "var(--color-red-soft)", border: "1px dashed rgba(192,57,43,.2)", borderRadius: 12 }}>
                  <div style={{ fontSize: 32, marginBottom: 10 }}>⚠</div>
                  <div style={{ fontSize: 13.5, fontWeight: 700, color: "var(--color-red)", marginBottom: 4 }}>Client did not qualify</div>
                  <div style={{ fontSize: 12, color: "var(--color-ink-2)" }}>{c.disqReason || "Disqualified during intake"}</div>
                </div>
              ) : (
                <div style={{ textAlign: "center", padding: "32px 24px", background: "var(--color-surface-2)", border: "1px dashed var(--color-border-2)", borderRadius: 12 }}>
                  <div style={{ fontSize: 32, marginBottom: 10, opacity: 0.5 }}>📦</div>
                  <div style={{ fontSize: 13.5, fontWeight: 700, color: "var(--color-ink)", marginBottom: 4 }}>No treatment selected</div>
                  <div style={{ fontSize: 12, color: "var(--color-ink-muted)" }}>Client abandoned the intake before choosing a plan</div>
                </div>
              )}
            </div>
          </div>

          <div className="card">
            <div className="card-head">
              <div className="card-ic">📝</div>
              <div style={{ flex: 1 }}>
                <div className="card-title">Intake Submission</div>
                <div className="card-sub">{c.formName}</div>
              </div>
              <span className="pill pill-muted">{Object.keys(c.answers || {}).length} answers</span>
            </div>
            <div className="card-body">
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                <DetailMini label="Form"      value={c.formName} />
                <DetailMini label="Source URL" value={`/intake-form/${c.formSlug}`} valueColor="var(--color-brand)" mono />
                <DetailMini label="Started"   value={c.startedAt || "—"} mono />
                <DetailMini label={c.status === "paid" ? "Paid At" : "Status"} value={c.status === "paid" ? (c.paidAt || "—") : c.status.replace("_", " ")} valueColor={c.status === "paid" ? "var(--color-brand)" : "var(--color-amber)"} mono />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function DetailMini({ label, value, valueColor, mono }: { label: string; value: string; valueColor?: string; mono?: boolean }) {
  return (
    <div style={{ background: "var(--color-surface-2)", border: "1px solid var(--color-border)", borderRadius: 10, padding: "9px 12px" }}>
      <div style={{ fontSize: 9.5, fontWeight: 600, textTransform: "uppercase", letterSpacing: ".7px", color: "var(--color-ink-muted)", marginBottom: 3 }}>{label}</div>
      <div style={{ fontSize: mono ? 11.5 : 12.5, fontWeight: 600, color: valueColor || "var(--color-ink)", fontFamily: mono ? "var(--font-inter)" : undefined }}>{value}</div>
    </div>
  );
}

