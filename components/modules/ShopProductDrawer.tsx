"use client";

import { useEffect, useRef, useState, type ChangeEvent } from "react";
import { fileToCompressedDataURL } from "@/lib/util/imageCompress";
import { toast } from "@/lib/hooks/useToast";
import type { ShopProduct, ShopProductInput, ShopFaq, ShopCategory, ShopThumbColor } from "@/lib/types";
import {
  SHOP_CATEGORY_LABEL,
  DEFAULT_BENEFITS,
  DEFAULT_FAQS,
  SHOP_THUMB_OPTIONS,
  SHOP_COLOR_OPTIONS,
  SHOP_THUMB_STYLE,
} from "@/lib/data/shopProducts";

interface ShopProductDrawerProps {
  open: boolean;
  /** null === creating a new product */
  product: ShopProduct | null;
  /** sort value pre-filled for a brand-new product */
  nextSort: number;
  onClose: () => void;
  onSave: (input: ShopProductInput, editingId: string | null) => void;
  onDelete: (id: string) => void;
}

interface FormState {
  name: string;
  cat: ShopCategory;
  tag: string;
  desc: string;
  longDesc: string;
  price: string;
  firstMonth: string;
  img: string;
  imageUrl: string;
  cls: ShopThumbColor;
  url: string;
  safety: string;
  sort: string;
  published: boolean;
  benefits: string[];
  faqs: ShopFaq[];
  clicks: number;
}

function buildInitialState(product: ShopProduct | null, nextSort: number): FormState {
  if (!product) {
    return {
      name: "",
      cat: "weight",
      tag: "",
      desc: "",
      longDesc: "",
      price: "99",
      firstMonth: "99",
      img: "💉",
      imageUrl: "",
      cls: "green",
      url: "",
      safety: "",
      sort: String(nextSort),
      published: false,
      benefits: [...DEFAULT_BENEFITS],
      faqs: DEFAULT_FAQS.map((f) => ({ ...f })),
      clicks: 0,
    };
  }
  return {
    name: product.name,
    cat: product.cat,
    tag: product.tag ?? "",
    desc: product.desc,
    longDesc: product.longDesc ?? "",
    price: String(product.price),
    firstMonth: String(product.firstMonth),
    img: product.img,
    imageUrl: product.imageUrl ?? "",
    cls: product.cls,
    url: product.url,
    safety: product.safety ?? "",
    sort: String(product.sort),
    published: product.published,
    benefits: product.benefits ? [...product.benefits] : [...DEFAULT_BENEFITS],
    faqs: product.faqs ? product.faqs.map((f) => ({ ...f })) : DEFAULT_FAQS.map((f) => ({ ...f })),
    clicks: product.clicks ?? 0,
  };
}

export function ShopProductDrawer({
  open,
  product,
  nextSort,
  onClose,
  onSave,
  onDelete,
}: ShopProductDrawerProps) {
  const [form, setForm] = useState<FormState>(() => buildInitialState(product, nextSort));
  const isEditing = product !== null;

  // Rebuild the form whenever the drawer is (re)opened for a target.
  useEffect(() => {
    if (open) setForm(buildInitialState(product, nextSort));
  }, [open, product, nextSort]);

  // Esc to close.
  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  function set<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  const fileRef = useRef<HTMLInputElement | null>(null);
  const [uploading, setUploading] = useState(false);
  async function onPickPhoto(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = ""; // allow re-picking the same file
    if (!file) return;
    if (!file.type.startsWith("image/")) { toast("Please choose an image file"); return; }
    setUploading(true);
    try {
      const dataUrl = await fileToCompressedDataURL(file, 600, 0.8);
      set("imageUrl", dataUrl);
      toast("📷 Photo added");
    } catch {
      toast("Couldn't process that image");
    } finally {
      setUploading(false);
    }
  }

  function cycleImg() {
    setForm((f) => {
      const idx = SHOP_THUMB_OPTIONS.indexOf(f.img as (typeof SHOP_THUMB_OPTIONS)[number]);
      const next = SHOP_THUMB_OPTIONS[(idx + 1) % SHOP_THUMB_OPTIONS.length];
      return { ...f, img: next };
    });
  }

  function updateBenefit(i: number, value: string) {
    setForm((f) => ({ ...f, benefits: f.benefits.map((b, j) => (j === i ? value : b)) }));
  }
  function addBenefit() {
    setForm((f) => ({ ...f, benefits: [...f.benefits, ""] }));
  }
  function removeBenefit(i: number) {
    setForm((f) => ({ ...f, benefits: f.benefits.filter((_, j) => j !== i) }));
  }

  function updateFaq(i: number, key: keyof ShopFaq, value: string) {
    setForm((f) => ({ ...f, faqs: f.faqs.map((q, j) => (j === i ? { ...q, [key]: value } : q)) }));
  }
  function addFaq() {
    setForm((f) => ({ ...f, faqs: [...f.faqs, { q: "", a: "" }] }));
  }
  function removeFaq(i: number) {
    setForm((f) => ({ ...f, faqs: f.faqs.filter((_, j) => j !== i) }));
  }

  function handleSave() {
    const input: ShopProductInput = {
      name: form.name.trim(),
      cat: form.cat,
      tag: form.tag.trim() || `${SHOP_CATEGORY_LABEL[form.cat].toUpperCase()} · RX`,
      desc: form.desc.trim(),
      longDesc: form.longDesc.trim() || undefined,
      price: Number(form.price) || 0,
      firstMonth: Number(form.firstMonth) || 0,
      img: form.img,
      imageUrl: form.imageUrl || undefined,
      cls: form.cls,
      url: form.url.trim(),
      published: form.published,
      sort: Number(form.sort) || 0,
      benefits: form.benefits.map((b) => b.trim()).filter(Boolean),
      faqs: form.faqs.filter((f) => f.q.trim()),
      safety: form.safety.trim() || undefined,
      clicks: form.clicks,
    };
    onSave(input, product?.id ?? null);
  }

  const thumb = SHOP_THUMB_STYLE[form.cls];

  return (
    <div className="treatments-intake-mod">
      <div className={`modal-ov ${open ? "show" : ""}`} onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
        <div className="modal lg">
          <div className="modal-head">
            <div className="modal-head-ic">🛍</div>
            <div className="modal-title">{isEditing ? "Edit Product" : "New Product"}</div>
            <button type="button" className="modal-close" onClick={onClose}>✕</button>
          </div>

          {/* Body */}
          <div className="modal-body">
          {/* Basic info */}
          <Section title="Basic info">
            <Field label="Product name">
              <input
                className="form-input"
                value={form.name}
                onChange={(e) => set("name", e.target.value)}
                placeholder="e.g. NAD+ Injection"
              />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Category">
                <select className="form-select" value={form.cat} onChange={(e) => set("cat", e.target.value as ShopCategory)}>
                  {(Object.keys(SHOP_CATEGORY_LABEL) as ShopCategory[]).map((k) => (
                    <option key={k} value={k}>
                      {SHOP_CATEGORY_LABEL[k]}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Tag override" hint="(optional)">
                <input
                  className="form-input"
                  value={form.tag}
                  onChange={(e) => set("tag", e.target.value)}
                  placeholder="Auto-generated from category"
                />
              </Field>
            </div>
          </Section>

          {/* Image */}
          <Section title="Image">
            <div className="grid grid-cols-[110px_1fr] gap-4 items-center">
              <div
                className="w-[110px] h-[110px] rounded-md flex items-center justify-center text-[52px] overflow-hidden"
                style={{ background: thumb.background, color: thumb.color }}
              >
                {form.imageUrl
                  ? <img src={form.imageUrl} alt="" className="w-full h-full object-cover" />
                  : form.img}
              </div>
              <div className="flex flex-col gap-2">
                <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={onPickPhoto} />
                <div className="flex gap-2">
                  <button className="btn btn-ghost btn-sm" onClick={cycleImg}>
                    Change icon
                  </button>
                  <button
                    className="btn btn-ghost btn-sm"
                    disabled={uploading}
                    onClick={() => fileRef.current?.click()}
                  >
                    {uploading ? "Uploading…" : form.imageUrl ? "Replace photo" : "Upload photo"}
                  </button>
                  {form.imageUrl && (
                    <button className="btn btn-ghost btn-sm text-red" onClick={() => set("imageUrl", "")}>
                      Remove photo
                    </button>
                  )}
                </div>
                <Helper>Recommended: 800×800px, transparent or white background. PNG/JPG up to 2MB. A photo overrides the icon + gradient.</Helper>
              </div>
            </div>
            <Field label="Background gradient" className="mt-3.5">
              <div className="flex gap-2 flex-wrap">
                {SHOP_COLOR_OPTIONS.map((c) => {
                  const active = form.cls === c;
                  return (
                    <button
                      key={c}
                      title={c}
                      onClick={() => set("cls", c)}
                      className={[
                        "w-8 h-8 rounded-sm cursor-pointer transition-transform border-2",
                        active ? "border-ink scale-110" : "border-transparent hover:scale-110",
                      ].join(" ")}
                      style={{ background: SHOP_THUMB_STYLE[c].background }}
                      aria-label={`${c} gradient`}
                      aria-pressed={active}
                    />
                  );
                })}
              </div>
            </Field>
          </Section>

          {/* Description */}
          <Section title="Description">
            <Field label="Card description" hint="— shown on the grid card">
              <textarea
                className="form-textarea"
                maxLength={120}
                rows={2}
                value={form.desc}
                onChange={(e) => set("desc", e.target.value)}
                placeholder="One short sentence…"
              />
              <Helper>Keep it under 120 characters — fits on 2 lines. ({form.desc.length}/120)</Helper>
            </Field>
            <Field label="Hero subtitle" hint="— shown on the product detail page">
              <textarea
                className="form-textarea"
                rows={3}
                value={form.longDesc}
                onChange={(e) => set("longDesc", e.target.value)}
                placeholder="A longer paragraph explaining the product…"
              />
            </Field>
          </Section>

          {/* Benefits */}
          <Section title="Benefits">
            <Helper className="mb-2.5">4–5 bullets shown on the product detail page hero.</Helper>
            <div className="flex flex-col gap-2.5">
              {form.benefits.map((b, i) => (
                <div key={i} className="grid grid-cols-[1fr_auto] gap-2 items-start">
                  <input
                    className="form-input"
                    value={b}
                    onChange={(e) => updateBenefit(i, e.target.value)}
                    placeholder="One benefit per line…"
                  />
                  <RemoveBtn onClick={() => removeBenefit(i)} />
                </div>
              ))}
            </div>
            <AddBtn onClick={addBenefit}>+ Add benefit</AddBtn>
          </Section>

          {/* Pricing */}
          <Section title="Pricing">
            <div className="grid grid-cols-2 gap-3">
              <Field label="First-month price">
                <input
                  className="form-input"
                  type="number"
                  value={form.firstMonth}
                  onChange={(e) => set("firstMonth", e.target.value)}
                />
                <Helper>Shown in big text in the price box.</Helper>
              </Field>
              <Field label="Monthly price">
                <input
                  className="form-input"
                  type="number"
                  value={form.price}
                  onChange={(e) => set("price", e.target.value)}
                />
                <Helper>Shown on card and &ldquo;Then $X/mo&rdquo; text.</Helper>
              </Field>
            </div>
          </Section>

          {/* FAQs */}
          <Section title="FAQs">
            <Helper className="mb-2.5">Q&amp;A pairs shown as an accordion on the product detail page.</Helper>
            <div className="flex flex-col gap-2.5">
              {form.faqs.map((f, i) => (
                <div
                  key={i}
                  className="grid grid-cols-[1fr_auto] gap-2 bg-surface-2 border border-border rounded-sm p-3"
                >
                  <div className="flex flex-col gap-2">
                    <input
                      className="form-input"
                      value={f.q}
                      onChange={(e) => updateFaq(i, "q", e.target.value)}
                      placeholder="Question…"
                    />
                    <textarea
                      className="form-textarea"
                      rows={2}
                      value={f.a}
                      onChange={(e) => updateFaq(i, "a", e.target.value)}
                      placeholder="Answer…"
                    />
                  </div>
                  <RemoveBtn onClick={() => removeFaq(i)} />
                </div>
              ))}
            </div>
            <AddBtn onClick={addFaq}>+ Add FAQ</AddBtn>
          </Section>

          {/* Safety */}
          <Section title="Safety information">
            <Field label="">
              <textarea
                className="form-textarea"
                rows={3}
                value={form.safety}
                onChange={(e) => set("safety", e.target.value)}
                placeholder="Contraindications and important safety information…"
              />
              <Helper>Shown in the amber safety card on the product detail page.</Helper>
            </Field>
          </Section>

          {/* Connect to intake */}
          <Section title="⚡ Connect to intake form" titleColor="var(--color-brand-dk)">
            <Field label="Get Started URL">
              <input
                className="form-input font-mono text-[12.5px]"
                value={form.url}
                onChange={(e) => set("url", e.target.value)}
                placeholder="/treatments/intake/your-form-id"
              />
              <Helper>
                When patients click <strong>Get Started</strong> on this product, they&rsquo;ll be redirected here.
                <br />
                Use a relative path like <code>/treatments/intake/glp1-form</code> or a full URL.
              </Helper>
            </Field>
          </Section>

          {/* Display */}
          <Section title="Display" last>
            <div className="flex items-center justify-between py-2.5 px-3.5 bg-surface-2 border border-border rounded-sm mb-3.5">
              <div>
                <div className="text-[13px] font-semibold text-ink">Published</div>
                <div className="text-[11.5px] text-ink-muted mt-0.5">
                  When off, this product is hidden from the patient portal.
                </div>
              </div>
              <button
                className={`toggle ${form.published ? "on" : ""}`}
                onClick={() => set("published", !form.published)}
                aria-pressed={form.published}
                aria-label="Toggle published"
              />
            </div>
            <Field label="Sort order">
              <input
                className="form-input max-w-[120px]"
                type="number"
                value={form.sort}
                onChange={(e) => set("sort", e.target.value)}
              />
              <Helper>Lower numbers appear earlier in the Shop grid.</Helper>
            </Field>
          </Section>
        </div>

          <div className="modal-footer">
            {isEditing && (
              <button className="btn btn-danger btn-sm" style={{ marginRight: "auto" }} onClick={() => onDelete(product!.id)}>
                Delete
              </button>
            )}
            <button className="btn btn-ghost btn-sm" onClick={onClose}>Cancel</button>
            <button className="btn btn-primary btn-sm" onClick={handleSave}>
              {isEditing ? "Save changes" : "Add product"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ── Small presentational helpers (local to the drawer) ── */

function Section({
  title,
  titleColor,
  last,
  children,
}: {
  title: string;
  titleColor?: string;
  last?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className={last ? "" : "pb-6 mb-[22px] border-b border-border"}>
      <div
        className="text-[10.5px] font-bold uppercase tracking-[1.4px] text-ink-muted mb-3.5"
        style={titleColor ? { color: titleColor } : undefined}
      >
        {title}
      </div>
      {children}
    </div>
  );
}

function Field({
  label,
  hint,
  className = "",
  children,
}: {
  label: string;
  hint?: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={`mb-3.5 last:mb-0 ${className}`}>
      {label && (
        <label className="block text-[12px] font-semibold text-ink-2 mb-1.5">
          {label}
          {hint && <span className="text-ink-muted font-normal"> {hint}</span>}
        </label>
      )}
      {children}
    </div>
  );
}

function Helper({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <div className={`text-[11.5px] text-ink-muted mt-1.5 leading-snug ${className}`}>{children}</div>;
}

function RemoveBtn({ onClick }: { onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="w-8 h-8 bg-surface border border-border-2 rounded-md text-red text-[14px] flex items-center justify-center hover:bg-red-soft hover:border-red transition-colors flex-shrink-0"
      aria-label="Remove"
    >
      ✕
    </button>
  );
}

function AddBtn({ onClick, children }: { onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className="self-start mt-2.5 py-2 px-3.5 bg-surface border border-dashed border-border-2 rounded-sm text-[12.5px] text-brand-dk font-semibold hover:bg-brand-softer hover:border-brand transition-colors"
    >
      {children}
    </button>
  );
}
