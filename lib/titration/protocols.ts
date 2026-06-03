export interface TitrationStep { dose: string; weeks: number; maintenance?: boolean; }
export interface Protocol { id: string; med: string; label: string; steps: TitrationStep[]; }

export const PROTOCOLS: Protocol[] = [
  { id: "sema", med: "Compounded Semaglutide", label: "Semaglutide (weekly SQ)", steps: [
    { dose: "0.25 mg", weeks: 4 }, { dose: "0.5 mg", weeks: 4 }, { dose: "1.0 mg", weeks: 4 }, { dose: "1.7 mg", weeks: 4 }, { dose: "2.4 mg", weeks: 4, maintenance: true },
  ] },
  { id: "tirz", med: "Compounded Tirzepatide", label: "Tirzepatide (weekly SQ)", steps: [
    { dose: "2.5 mg", weeks: 4 }, { dose: "5 mg", weeks: 4 }, { dose: "7.5 mg", weeks: 4 }, { dose: "10 mg", weeks: 4 }, { dose: "12.5 mg", weeks: 4 }, { dose: "15 mg", weeks: 4, maintenance: true },
  ] },
];
export const getProtocol = (id: string) => PROTOCOLS.find((p) => p.id === id);

export function addDays(iso: string, days: number) { const d = new Date(iso); d.setDate(d.getDate() + days); return d.toISOString(); }
export function stepDue(currentStepStart: string, step: TitrationStep) { return addDays(currentStepStart, step.weeks * 7); }
export function weekOf(currentStepStart: string, step: TitrationStep) {
  const w = Math.floor((Date.now() - new Date(currentStepStart).getTime()) / (7 * 864e5)) + 1;
  return Math.min(Math.max(1, w), step.weeks);
}
