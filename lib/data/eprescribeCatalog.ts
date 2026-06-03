// e-Prescribe catalog data — ported from the original EPrescribe.jsx template.

export interface DrugCatalogEntry {
  id: string;
  name: string;
  detail: string;
  icon: string;
  drugClass: string;
  badge: "Compounded" | "Brand" | "Generic";
  badgeIntent: "purple" | "blue" | "coral" | "green";
  iconColor: string;
  iconBg: string;
}

export const DRUG_CATALOG: DrugCatalogEntry[] = [
  { id: "sem-cmp",  name: "Semaglutide Injection",        detail: "0.25mg, 0.5mg, 1.0mg/dose · GLP-1 · Compounded",   icon: "💉", drugClass: "GLP-1",     badge: "Compounded", badgeIntent: "purple", iconColor: "var(--color-purple)", iconBg: "var(--color-purple-soft)" },
  { id: "sem-brd",  name: "Semaglutide (Ozempic®)",       detail: "0.5mg, 1.0mg/dose · Prefilled pen · Novo Nordisk", icon: "💉", drugClass: "GLP-1",     badge: "Brand",      badgeIntent: "blue",   iconColor: "var(--color-blue)",   iconBg: "var(--color-blue-soft)" },
  { id: "tirz",     name: "Tirzepatide (Mounjaro®)",      detail: "2.5mg, 5mg, 7.5mg, 10mg · GIP/GLP-1 Dual Agonist", icon: "💉", drugClass: "GLP-1",     badge: "Brand",      badgeIntent: "coral",  iconColor: "var(--color-coral)",  iconBg: "var(--color-coral-soft)" },
  { id: "tirz-cmp", name: "Tirzepatide Injection",        detail: "2.5mg, 5mg, 10mg · Compounded",                   icon: "💉", drugClass: "GLP-1",     badge: "Compounded", badgeIntent: "purple", iconColor: "var(--color-purple)", iconBg: "var(--color-purple-soft)" },
  { id: "met",      name: "Metformin HCl",                detail: "500mg, 850mg, 1000mg · Oral tablet · Biguanide",   icon: "💊", drugClass: "Biguanide", badge: "Generic",    badgeIntent: "green",  iconColor: "var(--color-green)",  iconBg: "var(--color-green-soft)" },
  { id: "lis",      name: "Lisinopril",                   detail: "5mg, 10mg, 20mg · Oral tablet · ACE Inhibitor",    icon: "💊", drugClass: "ACE-I",     badge: "Generic",    badgeIntent: "green",  iconColor: "var(--color-green)",  iconBg: "var(--color-green-soft)" },
  { id: "b12",      name: "Cyanocobalamin B12 Injection", detail: "1000mcg/mL · IM injection · Compounded",          icon: "💉", drugClass: "Vitamin",   badge: "Compounded", badgeIntent: "purple", iconColor: "var(--color-purple)", iconBg: "var(--color-purple-soft)" },
  { id: "nad",      name: "NAD+ Injection",               detail: "100mg/mL · SC/IM · Compounded",                   icon: "⚡", drugClass: "Wellness",  badge: "Compounded", badgeIntent: "purple", iconColor: "var(--color-purple)", iconBg: "var(--color-purple-soft)" },
];

export interface SupplyOption {
  value: string;
  icon: string;
  category: string;
  label: string;
}

export const SUPPLY_OPTIONS: SupplyOption[] = [
  { value: "syringe-1ml",  icon: "🪡", category: "Injection",  label: '1mL Syringe with 27G ½" Needle (BD Ultra-Fine)' },
  { value: "syringe-3ml",  icon: "🪡", category: "Injection",  label: '3mL Syringe with 25G 1" Needle' },
  { value: "needle-27g",   icon: "📍", category: "Needle",     label: '27G ½" Detachable Needle (10-pack)' },
  { value: "needle-30g",   icon: "📍", category: "Needle",     label: "30G 5/16\" Pen Needle (BD Nano)" },
  { value: "alcohol-pads", icon: "🧻", category: "Antiseptic", label: "Alcohol Prep Pads (sterile, 100ct)" },
  { value: "sharps",       icon: "🗑", category: "Disposal",   label: "Sharps Container — 1 Quart" },
  { value: "sharps-2",     icon: "🗑", category: "Disposal",   label: "Sharps Container — 1 Gallon" },
  { value: "cool-pack",    icon: "🧊", category: "Storage",    label: "Travel Cooler Pack for Refrigerated Meds" },
  { value: "gauze",        icon: "🩹", category: "Wound",      label: "Sterile Gauze Pads (2x2, 25ct)" },
  { value: "bandaids",     icon: "🩹", category: "Wound",      label: "Adhesive Bandages — Variety Pack" },
];

export interface DosePreset {
  label: string;
  strength: string;
  freq: string;
  qty: number;
  sig: string;
}

export const DOSE_PRESETS: DosePreset[] = [
  { label: "0.25mg Starter", strength: "0.25mg", freq: "Once weekly", qty: 4, sig: "Inject 0.25mg subcutaneously once weekly for 4 weeks (starter dose). Rotate injection sites." },
  { label: "0.5mg Weekly",   strength: "0.5mg",  freq: "Once weekly", qty: 4, sig: "Inject 0.5mg subcutaneously once weekly. Rotate injection sites. Refrigerate after opening." },
  { label: "1.0mg Weekly",   strength: "1.0mg",  freq: "Once weekly", qty: 4, sig: "Inject 1.0mg subcutaneously once weekly. Continue dose escalation per protocol." },
  { label: "2.5mg Starter",  strength: "2.5mg",  freq: "Once weekly", qty: 4, sig: "Inject 2.5mg subcutaneously once weekly for 4 weeks (Tirzepatide starter). Rotate injection sites." },
  { label: "5mg Weekly",     strength: "5mg",    freq: "Once weekly", qty: 4, sig: "Inject 5mg subcutaneously once weekly. Continue per protocol." },
  { label: "Custom",         strength: "",       freq: "",            qty: 0, sig: "" },
];

export interface SavedDocument {
  id: string;
  category: "rx" | "intake" | "labs" | "other";
  title: string;
  date: string;
  meta: string;
  icon: string;
  // Rx-specific (populated when category === "rx")
  rxId?: string;
  pharmacy?: string;
  submittedAt?: string;
}

export const SEED_DOCUMENTS: SavedDocument[] = [
  { id: "doc-intake-1", category: "intake", title: "GLP-1 Medication Intake",       date: "May 9, 2026 · 10:42 AM", meta: "15 questions completed · Qualified",      icon: "📝" },
  { id: "doc-intake-2", category: "intake", title: "Consent — Telehealth Services", date: "May 9, 2026 · 10:48 AM", meta: "Signed electronically",                    icon: "✍" },
  { id: "doc-lab-1",    category: "labs",   title: "Comprehensive Metabolic Panel", date: "May 8, 2026",            meta: "A1C: 5.4% · Glucose: 92 · Reviewed",       icon: "🧪" },
  { id: "doc-lab-2",    category: "labs",   title: "Lipid Panel",                   date: "May 8, 2026",            meta: "LDL: 108 · HDL: 56 · Reviewed",            icon: "🧪" },
  { id: "doc-lab-3",    category: "labs",   title: "CBC with Differential",         date: "May 8, 2026",            meta: "WBC: 6.2 · All values normal",             icon: "🧪" },
  { id: "doc-other-1",  category: "other",  title: "Photo ID — Driver License",     date: "May 9, 2026",            meta: "Verified · Expires 2028",                  icon: "🪪" },
];

// Map a Treatment medication string to a catalog entry where possible.
export function findCatalogDrug(medication: string): DrugCatalogEntry | null {
  const m = medication.toLowerCase();
  if (m.includes("semaglutide") && m.includes("compound")) return DRUG_CATALOG.find((d) => d.id === "sem-cmp") || null;
  if (m.includes("semaglutide") || m.includes("ozempic"))  return DRUG_CATALOG.find((d) => d.id === "sem-brd") || null;
  if (m.includes("tirzepatide") && m.includes("compound")) return DRUG_CATALOG.find((d) => d.id === "tirz-cmp") || null;
  if (m.includes("tirzepatide") || m.includes("mounjaro")) return DRUG_CATALOG.find((d) => d.id === "tirz") || null;
  if (m.includes("metformin"))                              return DRUG_CATALOG.find((d) => d.id === "met") || null;
  if (m.includes("lisinopril"))                             return DRUG_CATALOG.find((d) => d.id === "lis") || null;
  if (m.includes("b12") || m.includes("cyanocobalamin"))    return DRUG_CATALOG.find((d) => d.id === "b12") || null;
  if (m.includes("nad"))                                    return DRUG_CATALOG.find((d) => d.id === "nad") || null;
  return null;
}
