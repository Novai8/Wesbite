-- =============================================================================
-- 0001_admitad_integration.sql
--
-- Additive only. Creates the base catalogue tables if this database has never
-- had them (the app shipped with a seed-only catalogue and documented schema),
-- then adds everything the Admitad integration needs:
--
--   * affiliate_products.source / external_product_id  -> provenance + dedupe
--   * unique (source, external_product_id)             -> no duplicate imports
--   * advertiser_id, original_price, last_synced_at    -> Admitad fields
--   * ai_headline / ai_description / ai_quality_flags  -> AI copy, isolated
--   * admitad_import_runs / admitad_import_errors      -> execution audit
--
-- Nothing is dropped. Existing rows keep their values (new columns default to
-- NULL), and a trigger prevents an import from overwriting a manual record.
-- Safe to run more than once.
-- =============================================================================

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------------
-- Programmes
-- ---------------------------------------------------------------------------
create table if not exists public.affiliate_programs (
  slug                text primary key,
  name                text not null,
  network             text not null,
  destination_domain  text not null,
  active              boolean not null default true,
  commission_note     text,
  created_at          timestamptz not null default now()
);

alter table public.affiliate_programs enable row level security;

drop policy if exists "programs_read_active" on public.affiliate_programs;
create policy "programs_read_active"
  on public.affiliate_programs
  for select
  to anon, authenticated
  using (active = true);

drop policy if exists "programs_service_write" on public.affiliate_programs;
create policy "programs_service_write"
  on public.affiliate_programs
  for all
  to service_role
  using (true)
  with check (true);

insert into public.affiliate_programs (slug, name, network, destination_domain, active, commission_note)
values
  ('aliexpress', 'AliExpress Affiliate Program', 'AliExpress Portals', 'aliexpress.com', true,
   'Actual commission rates come from the AliExpress portal report, never from this app.'),
  ('admitad', 'Admitad', 'Admitad Publisher', 'ad.admitad.com', true,
   'Commission is reported by Admitad and is never estimated or hard-coded in this app.')
on conflict (slug) do update
  set destination_domain = excluded.destination_domain,
      network = excluded.network,
      active = excluded.active;

-- ---------------------------------------------------------------------------
-- Categories
-- ---------------------------------------------------------------------------
create table if not exists public.affiliate_categories (
  slug        text primary key,
  name        text not null,
  description text not null,
  icon        text not null default 'Package',
  sort_order  int not null default 0,
  created_at  timestamptz not null default now()
);

alter table public.affiliate_categories enable row level security;

drop policy if exists "categories_read_public" on public.affiliate_categories;
create policy "categories_read_public"
  on public.affiliate_categories
  for select
  to anon, authenticated
  using (true);

drop policy if exists "categories_service_write" on public.affiliate_categories;
create policy "categories_service_write"
  on public.affiliate_categories
  for all
  to service_role
  using (true)
  with check (true);

insert into public.affiliate_categories (slug, name, description, icon, sort_order)
values
  ('desk-setup', 'Desk & Workspace', 'Everything for a better desk: monitors, arms, keyboards, lighting and organisers.', 'Monitor', 1),
  ('gaming', 'Gaming', 'Controllers, headsets, mice and accessories that punch above their price.', 'Gamepad2', 2),
  ('storage-organisation', 'Storage & Organisation', 'Small-space storage, shelf systems and organisers for cramped rooms.', 'Archive', 3),
  ('study-stationery', 'Study & Stationery', 'Student essentials: note-taking, desk tools and focus aids.', 'BookOpen', 4),
  ('travel-accessories', 'Travel Accessories', 'Packing cubes, cable kits and useful things for people who move often.', 'Plane', 5),
  ('kitchen-utility', 'Kitchen & Utility', 'Small tools that solve daily kitchen problems cheaply.', 'Coffee', 6)
on conflict (slug) do nothing;

-- ---------------------------------------------------------------------------
-- Products
-- ---------------------------------------------------------------------------
create table if not exists public.affiliate_products (
  id                 text primary key,
  slug               text unique not null,
  title              text not null,
  description        text not null,
  category_slug      text not null,
  subcategory        text,
  image_urls         jsonb not null default '[]'::jsonb,
  merchant           text not null,
  program_slug       text not null,
  affiliate_url      text not null,
  source_url         text,
  price              numeric(12, 2) not null default 0 check (price >= 0),
  currency           text not null default 'USD',
  previous_price     numeric(12, 2),
  specs              jsonb not null default '{}'::jsonb,
  pros               jsonb not null default '[]'::jsonb,
  cons               jsonb not null default '[]'::jsonb,
  availability       text not null default 'unknown',
  region             jsonb not null default '[]'::jsonb,
  keywords           jsonb not null default '[]'::jsonb,
  use_cases          jsonb not null default '[]'::jsonb,
  budget_tier        text not null default 'budget',
  price_verified_at  timestamptz,
  approval_status    text not null default 'pending',
  data_source        text not null default 'manual',
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);

-- Admitad / multi-network provenance columns
alter table public.affiliate_products
  add column if not exists source              text,
  add column if not exists external_product_id text,
  add column if not exists advertiser_id       text,
  add column if not exists original_price      numeric(12, 2),
  add column if not exists commission_info     jsonb,
  add column if not exists last_synced_at      timestamptz,
  add column if not exists ai_headline         text,
  add column if not exists ai_description      text,
  add column if not exists ai_quality_flags    jsonb not null default '[]'::jsonb;

-- Dedupe: one row per (network, external id). Partial so manual rows
-- (external_product_id null) are unaffected.
create unique index if not exists affiliate_products_source_external_key
  on public.affiliate_products (source, external_product_id)
  where source is not null and external_product_id is not null;

create index if not exists affiliate_products_program_idx
  on public.affiliate_products (program_slug);

create index if not exists affiliate_products_category_idx
  on public.affiliate_products (category_slug);

alter table public.affiliate_products enable row level security;

drop policy if exists "products_read_approved" on public.affiliate_products;
create policy "products_read_approved"
  on public.affiliate_products
  for select
  to anon, authenticated
  using (approval_status = 'approved');

drop policy if exists "products_service_write" on public.affiliate_products;
create policy "products_service_write"
  on public.affiliate_products
  for all
  to service_role
  using (true)
  with check (true);

-- ---------------------------------------------------------------------------
-- Guard: imports may not rewrite a manual record
-- ---------------------------------------------------------------------------
create or replace function public.protect_manual_product()
returns trigger
language plpgsql
as $$
begin
  if old.data_source = 'manual' and new.data_source <> 'manual' then
    -- Manual rows are hand-curated. An automated upsert must not claim them;
    -- keep the original row intact and let the import create its own record.
    return null;
  end if;
  if old.data_source = 'manual' then
    -- Even for a manual-tagged update, never let a workflow flip source fields.
    new.source := old.source;
    new.external_product_id := old.external_product_id;
  end if;
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists protect_manual_product_trigger on public.affiliate_products;
create trigger protect_manual_product_trigger
  before update on public.affiliate_products
  for each row
  execute function public.protect_manual_product();

-- ---------------------------------------------------------------------------
-- Import audit
-- ---------------------------------------------------------------------------
create table if not exists public.admitad_import_runs (
  id                uuid primary key default gen_random_uuid(),
  campaign_id       bigint not null,
  programme_name    text,
  feed_format       text,
  total_rows        int not null default 0,
  imported          int not null default 0,
  duplicates        int not null default 0,
  skipped           int not null default 0,
  error_count       int not null default 0,
  blocked           boolean not null default false,
  blocked_reason    text,
  unmapped_columns  jsonb not null default '[]'::jsonb,
  started_at        timestamptz not null default now(),
  finished_at       timestamptz,
  created_at        timestamptz not null default now()
);

alter table public.admitad_import_runs enable row level security;

drop policy if exists "import_runs_service_all" on public.admitad_import_runs;
create policy "import_runs_service_all"
  on public.admitad_import_runs
  for all
  to service_role
  using (true)
  with check (true);

create table if not exists public.admitad_import_errors (
  id                  uuid primary key default gen_random_uuid(),
  run_id              uuid references public.admitad_import_runs(id) on delete cascade,
  row_index           int,
  external_product_id text,
  reason              text not null,
  created_at          timestamptz not null default now()
);

alter table public.admitad_import_errors enable row level security;

drop policy if exists "import_errors_service_all" on public.admitad_import_errors;
create policy "import_errors_service_all"
  on public.admitad_import_errors
  for all
  to service_role
  using (true)
  with check (true);

create index if not exists admitad_import_errors_run_idx
  on public.admitad_import_errors (run_id);

-- ---------------------------------------------------------------------------
-- Click log (referenced by lib/affiliate.ts)
-- ---------------------------------------------------------------------------
create table if not exists public.affiliate_clicks (
  id           uuid primary key default gen_random_uuid(),
  product_id   text,
  program_slug text not null,
  merchant     text,
  campaign     text,
  ts           timestamptz not null default now()
);

alter table public.affiliate_clicks enable row level security;

drop policy if exists "clicks_service_all" on public.affiliate_clicks;
create policy "clicks_service_all"
  on public.affiliate_clicks
  for all
  to service_role
  using (true)
  with check (true);

create index if not exists affiliate_clicks_ts_idx
  on public.affiliate_clicks (ts desc);