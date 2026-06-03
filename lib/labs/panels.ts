export interface Analyte { name: string; unit: string; low?: number; high?: number; range: string; }
export interface Panel { id: string; name: string; analytes: Analyte[]; }
export type Flag = "normal" | "high" | "low";

export const PANELS: Panel[] = [
  { id: "a1c", name: "Hemoglobin A1C", analytes: [{ name: "HbA1c", unit: "%", high: 5.6, range: "4.0–5.6" }] },
  { id: "lipase", name: "Lipase (pancreatitis monitor)", analytes: [{ name: "Lipase", unit: "U/L", low: 10, high: 140, range: "10–140" }] },
  { id: "cmp", name: "Comprehensive Metabolic Panel", analytes: [
    { name: "Glucose", unit: "mg/dL", low: 70, high: 99, range: "70–99" },
    { name: "BUN", unit: "mg/dL", low: 7, high: 20, range: "7–20" },
    { name: "Creatinine", unit: "mg/dL", low: 0.6, high: 1.3, range: "0.6–1.3" },
    { name: "eGFR", unit: "mL/min", low: 60, range: "≥60" },
    { name: "Sodium", unit: "mmol/L", low: 135, high: 145, range: "135–145" },
    { name: "Potassium", unit: "mmol/L", low: 3.5, high: 5.1, range: "3.5–5.1" },
    { name: "ALT", unit: "U/L", low: 7, high: 56, range: "7–56" },
    { name: "AST", unit: "U/L", low: 10, high: 40, range: "10–40" },
  ] },
  { id: "lipid", name: "Lipid Panel", analytes: [
    { name: "Total Cholesterol", unit: "mg/dL", high: 200, range: "<200" },
    { name: "LDL", unit: "mg/dL", high: 100, range: "<100" },
    { name: "HDL", unit: "mg/dL", low: 40, range: "≥40" },
    { name: "Triglycerides", unit: "mg/dL", high: 150, range: "<150" },
  ] },
  { id: "tsh", name: "Thyroid (TSH)", analytes: [{ name: "TSH", unit: "mIU/L", low: 0.4, high: 4.0, range: "0.4–4.0" }] },
];
export const getPanel = (id: string) => PANELS.find((p) => p.id === id);
export const flagOf = (a: Analyte, v: number): Flag => (a.high != null && v > a.high ? "high" : a.low != null && v < a.low ? "low" : "normal");

// Generate plausible results: mostly in-range, ~22% nudged out of range for realism.
export function generateResults(panel: Panel) {
  return panel.analytes.map((a) => {
    const lo = a.low ?? (a.high != null ? a.high * 0.5 : 1);
    const hi = a.high ?? (a.low != null ? a.low * 1.5 : 100);
    let v = lo + Math.random() * (hi - lo);
    if (Math.random() < 0.22) v = Math.random() < 0.5 ? hi * (1.05 + Math.random() * 0.3) : Math.max(0, lo * (0.6 + Math.random() * 0.3));
    const value = a.unit === "%" || a.name === "Creatinine" ? +v.toFixed(1) : Math.round(v);
    return { analyte: a.name, unit: a.unit, range: a.range, value, flag: flagOf(a, value) };
  });
}
