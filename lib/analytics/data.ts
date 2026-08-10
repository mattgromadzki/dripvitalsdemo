// Formatters + the one figure analytics can't derive from real data.
// Trend series (revenue, new subs, failed payments) are now computed live from
// the subscription records — see lib/analytics/derive.ts.

// There is no ad-spend / marketing-cost source anywhere in the app, so CAC and
// LTV:CAC are estimated against this assumed monthly acquisition spend. Update
// it (or wire a real spend source) to make those two KPIs exact.
export const ASSUMED_MONTHLY_AD_SPEND = 6300; // dollars

export const money = (n: number) => "$" + Math.round(n).toLocaleString("en-US");
export const pct = (n: number) => (n * 100).toFixed(1) + "%";
