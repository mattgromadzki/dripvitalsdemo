// Eastern-time formatting for the Visit lifecycle. The clinic operates on EST/EDT,
// so visit start + payment timestamps are always displayed in America/New_York
// regardless of where the patient or admin is located.

const EST_FMT = new Intl.DateTimeFormat("en-US", {
  timeZone: "America/New_York",
  year: "numeric", month: "short", day: "numeric",
  hour: "numeric", minute: "2-digit", hour12: true,
});

/** Epoch ms + a human EST display string for a given moment (defaults to now). */
export function estParts(d: Date = new Date()): { ms: number; display: string } {
  return { ms: d.getTime(), display: EST_FMT.format(d) + " ET" };
}

/** Format an existing epoch-ms timestamp in Eastern time, e.g. "Jun 19, 2026, 9:22 PM ET". */
export function estDisplay(ms?: number | null): string {
  if (ms == null) return "—";
  const d = new Date(ms);
  if (isNaN(d.getTime())) return "—";
  return EST_FMT.format(d) + " ET";
}

const EST_DATE_FMT = new Intl.DateTimeFormat("en-US", {
  timeZone: "America/New_York",
  year: "numeric", month: "short", day: "numeric",
});

/** Date-only Eastern-time format, e.g. "Jan 21, 2026". */
export function estDate(ms?: number | null): string {
  if (ms == null) return "—";
  const d = new Date(ms);
  if (isNaN(d.getTime())) return "—";
  return EST_DATE_FMT.format(d);
}
