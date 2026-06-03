// Seeded 6-month trend series (no real history in the prototype stores).
export const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun"];
export const MRR_SERIES = [18200, 21400, 24900, 27600, 31200, 34800];   // dollars
export const NEW_SUBS = [9, 11, 10, 13, 15, 14];
export const CHURNED_SUBS = [2, 3, 2, 4, 3, 2];
export const SPEND = [4200, 4800, 5100, 5600, 6000, 6300];              // ad spend (for CAC)
export const money = (n: number) => "$" + Math.round(n).toLocaleString("en-US");
export const pct = (n: number) => (n * 100).toFixed(1) + "%";
