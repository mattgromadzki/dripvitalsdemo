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

-- Farming (cold outreach) contacts: one row each, built to hold millions.
-- Denormalized columns (email/phone/status/opted_out/group_ids/last_campaign_id)
-- drive indexed queries; the full FarmContact lives in `data`.
create table if not exists farming_contacts (
  id               text primary key,
  email            text,
  phone            text,               -- normalized last-10 digits (for STOP/reply matching)
  status           text not null default 'new',
  opted_out        boolean not null default false,
  group_ids        text[] not null default '{}',
  last_campaign_id text,
  data             jsonb not null,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);
-- Dedupe key: at most one contact per email (partial — SMS-only rows have no email).
create unique index if not exists farming_contacts_email_uk on farming_contacts (lower(email)) where email is not null and email <> '';
create index if not exists farming_contacts_phone_idx  on farming_contacts (phone);
create index if not exists farming_contacts_status_idx on farming_contacts (status);
create index if not exists farming_contacts_opt_idx    on farming_contacts (opted_out);
create index if not exists farming_contacts_groups_idx on farming_contacts using gin (group_ids);
create index if not exists farming_contacts_keyset_idx on farming_contacts (created_at desc, id desc);
-- Fast substring search at scale (name/email/company).
create extension if not exists pg_trgm;
create index if not exists farming_contacts_search_idx on farming_contacts using gin ((lower(coalesce(email,'') || ' ' || coalesce(data->>'firstName','') || ' ' || coalesce(data->>'lastName','') || ' ' || coalesce(data->>'company',''))) gin_trgm_ops);
-- Search including location (city/county/state) — matches the whereFor() expression.
create index if not exists farming_contacts_search_loc_idx on farming_contacts using gin ((lower(coalesce(email,'') || ' ' || coalesce(data->>'firstName','') || ' ' || coalesce(data->>'lastName','') || ' ' || coalesce(data->>'company','') || ' ' || coalesce(data->'custom'->>'city','') || ' ' || coalesce(data->'custom'->>'county','') || ' ' || coalesce(data->'custom'->>'state',''))) gin_trgm_ops);
-- Location filter dropdowns (State/County/City) — btree on lowered expressions
-- accelerates equality filtering + facet narrowing.
create index if not exists farming_contacts_state_idx  on farming_contacts ((lower(data->'custom'->>'state')));
create index if not exists farming_contacts_county_idx on farming_contacts ((lower(data->'custom'->>'county')));
create index if not exists farming_contacts_city_idx   on farming_contacts ((lower(data->'custom'->>'city')));

-- Farming sends: one row per (campaign, recipient). Replaces the per-recipient
-- maps that used to live on the campaign blob, so campaigning to millions and
-- its open/click/delivery/reply tracking stay row-scoped and idempotent.
create table if not exists farming_sends (
  campaign_id     text not null,
  contact_id      text not null,
  status          text not null default 'sent',
  sent_at         timestamptz,
  delivered_at    timestamptz,
  opened_at       timestamptz,
  clicked_at      timestamptz,
  replied_at      timestamptz,
  bounced_at      timestamptz,
  unsubscribed_at timestamptz,
  primary key (campaign_id, contact_id)
);
create index if not exists farming_sends_campaign_idx on farming_sends (campaign_id);
-- Added later — safe on existing installs.
alter table farming_sends add column if not exists bounced_at timestamptz;
alter table farming_sends add column if not exists unsubscribed_at timestamptz;

-- Daily backups of the Upstash Redis store (all EMR/app data lives in Redis).
-- A cron snapshots every Redis key into `data` (jsonb, auto-compressed by TOAST)
-- so patient records, visits, documents, payments, etc. always have a restorable
-- point-in-time copy in a second, durable database. Retention is pruned in the cron.
create table if not exists redis_backups (
  id          bigserial primary key,
  created_at  timestamptz not null default now(),
  key_count   int not null default 0,
  data        jsonb not null
);
create index if not exists redis_backups_created_idx on redis_backups (created_at desc);
