// One-time database setup for DripVitals.
//
//   node scripts/db-migrate.mjs            # create tables (idempotent)
//   node scripts/db-migrate.mjs --from-kv  # also copy existing Upstash data in
//
// Requires DATABASE_URL. The --from-kv copy additionally requires your Upstash
// REST creds (KV_REST_API_URL/TOKEN or UPSTASH_REDIS_REST_URL/TOKEN). Safe to
// re-run; uses upserts.

import postgres from "postgres";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dir = dirname(fileURLToPath(import.meta.url));

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) { console.error("✕ DATABASE_URL is required."); process.exit(1); }

const sql = postgres(DATABASE_URL, {
  prepare: false,
  max: 1,
  ssl: process.env.DATABASE_SSL === "disable" ? false : "require",
});

// Keep in sync with the ALLOW list in app/api/store/[domain]/route.ts
const DOMAINS = [
  "treatment-requests", "soap-notes", "prescriptions", "labs", "orders",
  "shipments", "tasks", "subscriptions", "visit-queue", "treatments",
  "intake-forms", "emails", "sms", "medications", "pharmacies", "doctors",
  "providers", "staff", "integrations", "rbac", "knowledge-base", "reviews",
  "leads", "consent", "inventory", "patient-documents", "titration",
  "referrals", "adverse", "campaigns", "affiliates", "billing",
];

const kvUrl = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
const kvToken = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;

async function kv(path) {
  if (!kvUrl || !kvToken) return null;
  const res = await fetch(`${kvUrl}/${path}`, { headers: { Authorization: `Bearer ${kvToken}` } });
  if (!res.ok) return null;
  const j = await res.json().catch(() => null);
  return j?.result ?? null;
}

async function main() {
  console.log("→ Applying schema…");
  const schema = readFileSync(join(__dir, "..", "lib", "db", "schema.sql"), "utf8");
  await sql.unsafe(schema);
  console.log("✓ Tables ready: store_domains, patients");

  if (process.argv.includes("--from-kv")) {
    if (!kvUrl || !kvToken) { console.error("✕ --from-kv needs Upstash REST creds in env."); process.exit(1); }
    console.log("→ Copying existing KV data into Postgres…");

    let domainsCopied = 0;
    for (const d of DOMAINS) {
      const raw = await kv(`get/${encodeURIComponent("store:" + d)}`);
      if (raw == null) continue;
      let data; try { data = typeof raw === "string" ? JSON.parse(raw) : raw; } catch { data = raw; }
      await sql`
        insert into store_domains (domain, data, updated_at)
        values (${d}, ${sql.json(data)}, now())
        on conflict (domain) do update set data = excluded.data, updated_at = now()
      `;
      domainsCopied++;
      console.log(`   • ${d}`);
    }

    // Patients live in a Redis hash (crm:patients:v1): [field, value, field, value, ...]
    const flat = await kv("hgetall/crm:patients:v1");
    let patientsCopied = 0;
    if (Array.isArray(flat)) {
      for (let i = 0; i < flat.length; i += 2) {
        let p; try { p = JSON.parse(flat[i + 1]); } catch { continue; }
        if (!p?.id) continue;
        await sql`
          insert into patients (id, brand_id, email, data, updated_at)
          values (${p.id}, ${p.brandId ?? "dripvitals"}, ${p.email ?? null}, ${sql.json(p)}, now())
          on conflict (id) do update set
            brand_id = excluded.brand_id, email = excluded.email,
            data = excluded.data, updated_at = now()
        `;
        patientsCopied++;
      }
    }
    console.log(`✓ Copied ${domainsCopied} collection(s) and ${patientsCopied} patient(s).`);
  }

  await sql.end();
  console.log("✓ Done.");
}

main().catch((e) => { console.error(e); process.exit(1); });
