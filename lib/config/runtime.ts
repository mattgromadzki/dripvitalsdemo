// Runtime configuration flags.
//
// SEED_DEMO controls whether the app's stores start populated with sample/demo
// data. It defaults to ON so local dev and the demo deploy are pre-filled.
//
// To start a deployment COMPLETELY CLEAN — no demo patients, orders, catalogs,
// staff, etc. — set this environment variable in your host:
//
//     NEXT_PUBLIC_SEED_DEMO_DATA=false
//
// Then each store starts empty and you enter your own real data. (This is a
// NEXT_PUBLIC_ var so it's available in the browser stores where seeding happens;
// changing it requires a redeploy.)
export const SEED_DEMO = process.env.NEXT_PUBLIC_SEED_DEMO_DATA !== "false";

/** Returns the seed list in demo mode, or an empty list in production. */
export function seedList<T>(list: T[]): T[] {
  return SEED_DEMO ? list : [];
}
