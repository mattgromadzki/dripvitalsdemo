-- DripVitals — Postgres schema (phase 1)
-- Durable storage behind the app's existing persistence interface. Run this once
-- against your database (paste into your provider's SQL console, or use
-- `node scripts/db-migrate.mjs`). Safe to re-run.

-- Generic collections: one row per app "domain" (orders, prescriptions, labs,
-- treatment-requests, etc.), holding that collection's JSON. Mirrors the prior
-- key/value blob model, now transactional and backed up.
create table if not exists store_domains (
  domain      text primary key,
  data        jsonb not null,
  updated_at  timestamptz not null default now()
);

-- Patients: one row each (the first entity normalized out of the blob store).
-- brand_id + email are denormalized for querying / separate-records-per-brand;
-- the full patient profile lives in `data`.
create table if not exists patients (
  id          text primary key,
  brand_id    text not null default 'dripvitals',
  email       text,
  data        jsonb not null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index if not exists patients_brand_idx on patients (brand_id);
create index if not exists patients_email_idx on patients (lower(email));
