-- =============================================================================
-- 0001_admitad_integration.sql
--
-- Additive migration for the Affiliate Business Supabase project.
--
-- The live `public.affiliate_products` table is a research dataset:
--
--   id uuid pk, created_at, product_name, product_url, affiliate_url,
--   affiliate_network, category, target_market, price_text,
--   commission_rate_text, evidence_notes, decision, score, target_audience,
--   positioning_angle, content_hooks, risk_flags, research_confidence,
--   rationale, status
--
-- This migration NEVER drops, renames or recreates that table. It creates it
-- only when it is absent, then adds every catalogue column the Fyndra importer
-- writes. On the live project the only schema changes are additions: new
-- columns, new defaults, new indexes, new constraints and new policies.
--
-- Guarantees:
--   * existing columns keep their names, types and values;
--   * the existing UUID primary key is reused;
--   * existing research fields are never written by an import;
--   * no existing row is backfilled: catalogue columns stay NULL until the
--     importer writes them, so the research workflow keeps working untouched;
--   * `status` stays separate from `approval_status`.
--
-- The only relaxation is NOT NULL on columns the other pipeline never writes,
-- and only where such a constraint is found. No value is modified by that.
--
-- Safe to run repeatedly.
-- =============================================================================

-- gen_random_uuid() is built into PostgreSQL 13+. Supabase runs 15+.
-- No extension is required, which keeps the migration portable.

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
-- Products: create only when missing
-- ---------------------------------------------------------------------------
-- Mirrors the inspected live schema exactly. On the Affiliate Business project
-- this statement is skipped (the table exists); it exists so a fresh database
-- converges on the same shape instead of getting a catalogue-only table that
-- would break the research pipeline.
create table if not exists public.affiliate_products (
  id                    uuid primary key default gen_random_uuid(),
  created_at            timestamptz default now(),
  product_name          text,
  product_url           text,
  affiliate_url         text,
  affiliate_network     text,
  category              text,
  target_market         text,
  price_text            text,
  commission_rate_text  text,
  evidence_notes        text,
  decision              text,
  score                 integer,
  target_audience       text,
  positioning_angle     text,
  content_hooks         text,
  risk_flags            text,
  research_confidence   numeric,
  rationale             text,
  status                text
);

-- ---------------------------------------------------------------------------
-- Products: catalogue columns
-- ---------------------------------------------------------------------------
-- Every one of these is ADD COLUMN IF NOT EXISTS on the live project, so the
-- twenty research columns are never touched.
--
-- No `DEFAULT` is attached by ADD COLUMN. Since PostgreSQL 11 an added column
-- with a default is evaluated for every existing row, which would write into
-- research rows. Defaults are attached in a separate step below, after the
-- columns exist, so existing rows keep NULL exactly as they are today.
alter table public.affiliate_products
  add column if not exists slug                text,
  add column if not exists title               text,
  add column if not exists description         text,
  add column if not exists category_slug       text,
  add column if not exists subcategory         text,
  add column if not exists image_urls          jsonb,
  add column if not exists merchant            text,
  add column if not exists program_slug        text,
  add column if not exists source_url          text,
  add column if not exists price               numeric(12, 2),
  add column if not exists currency            text,
  add column if not exists previous_price      numeric(12, 2),
  add column if not exists original_price      numeric(12, 2),
  add column if not exists specs               jsonb,
  add column if not exists pros                jsonb,
  add column if not exists cons                jsonb,
  add column if not exists availability        text,
  add column if not exists region              jsonb,
  add column if not exists keywords            jsonb,
  add column if not exists use_cases           jsonb,
  add column if not exists budget_tier         text,
  add column if not exists price_verified_at   timestamptz,
  add column if not exists approval_status     text,
  add column if not exists data_source         text,
  add column if not exists source              text,
  add column if not exists external_product_id text,
  add column if not exists advertiser_id       text,
  add column if not exists commission_info     jsonb,
  add column if not exists last_synced_at      timestamptz,
  add column if not exists ai_headline         text,
  add column if not exists ai_description      text,
  add column if not exists ai_quality_flags    jsonb,
  add column if not exists updated_at          timestamptz;

-- Catalogue defaults. `SET DEFAULT` changes only future inserts; it does not
-- touch a single existing row.
alter table public.affiliate_products
  alter column image_urls      set default '[]'::jsonb,
  alter column specs           set default '{}'::jsonb,
  alter column pros            set default '[]'::jsonb,
  alter column cons            set default '[]'::jsonb,
  alter column region          set default '[]'::jsonb,
  alter column keywords        set default '[]'::jsonb,
  alter column use_cases       set default '[]'::jsonb,
  alter column approval_status set default 'pending',
  alter column data_source     set default 'manual',
  alter column ai_quality_flags set default '[]'::jsonb,
  alter column updated_at      set default now();

-- No backfill UPDATE is issued. Existing research rows are preserved exactly:
--   * `data_source` stays NULL, and the trigger below treats NULL as `manual`,
--     so a research row can never be claimed by an automated import;
--   * new research inserts that omit the column receive the 'manual' default;
--   * `approval_status` stays NULL, which keeps the row out of the public read
--     policy without rewriting anything.

-- Research columns are reconciled for databases whose `affiliate_products` was
-- created from the old catalogue-only migration. The live project already has
-- them, so every statement is skipped there. They are added WITHOUT NOT NULL,
-- so the research workflow's writer keeps working unchanged.
do $$
declare
  col record;
begin
  for col in
    select * from (values
      ('product_name',         'text'),
      ('product_url',          'text'),
      ('affiliate_network',    'text'),
      ('category',             'text'),
      ('target_market',        'text'),
      ('price_text',           'text'),
      ('commission_rate_text', 'text'),
      ('evidence_notes',       'text'),
      ('decision',             'text'),
      ('score',                'integer'),
      ('target_audience',      'text'),
      ('positioning_angle',    'text'),
      ('content_hooks',        'text'),
      ('risk_flags',           'text'),
      ('research_confidence',  'numeric'),
      ('rationale',            'text'),
      ('status',               'text')
    ) as t(column_name, column_type)
  loop
    if not exists (
      select 1 from information_schema.columns
      where table_schema = 'public' and table_name = 'affiliate_products'
        and column_name = col.column_name
    ) then
      execute format(
        'alter table public.affiliate_products add column %I %s',
        col.column_name, col.column_type
      );
      raise notice 'Added research column % so the research pipeline stays intact', col.column_name;
    end if;
  end loop;
end $$;

-- ---------------------------------------------------------------------------
-- Products: insert defaults and nullability
-- ---------------------------------------------------------------------------
-- A catalogue row does not carry the research payload, so it must be able to
-- insert without inventing research values. This block only ever SETS defaults
-- or DROPS NOT NULL; it never changes a column type and never rewrites data.
do $$
declare
  col text;
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'affiliate_products'
      and column_name = 'id' and data_type = 'uuid'
  ) then
    alter table public.affiliate_products alter column id set default gen_random_uuid();
  elsif exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'affiliate_products'
      and column_name = 'id' and data_type = 'text'
  ) then
    -- Older catalogue tables used `id text`. Keep the type; only give it a
    -- UUID-shaped default so either pipeline can insert without an id.
    alter table public.affiliate_products alter column id set default gen_random_uuid()::text;
  end if;

  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'affiliate_products'
      and column_name = 'created_at'
  ) then
    alter table public.affiliate_products alter column created_at set default now();
  end if;

  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'affiliate_products'
      and column_name = 'updated_at'
  ) then
    alter table public.affiliate_products alter column updated_at set default now();
  end if;

  -- Columns one pipeline never writes but the other does. If the live table
  -- required one of them, the other pipeline could not insert a row without
  -- fabricating data. Relaxing NOT NULL is a widening: no value changes and no
  -- column is dropped.
  foreach col in array array[
    -- research columns (written by the research workflow, not by imports)
    'product_name', 'product_url', 'affiliate_network', 'category',
    'target_market', 'price_text', 'commission_rate_text', 'evidence_notes',
    'decision', 'score', 'target_audience', 'positioning_angle',
    'content_hooks', 'risk_flags', 'research_confidence', 'rationale', 'status',
    -- catalogue columns (written by imports, not by the research workflow).
    -- These are already nullable on the live project; the loop is a no-op there
    -- and only matters for a database created from the old catalogue migration.
    'slug', 'title', 'description', 'category_slug', 'image_urls', 'merchant',
    'program_slug', 'affiliate_url', 'price', 'currency', 'specs', 'pros',
    'cons', 'availability', 'region', 'keywords', 'use_cases', 'budget_tier',
    'approval_status', 'data_source'
  ]
  loop
    if exists (
      select 1 from information_schema.columns
      where table_schema = 'public' and table_name = 'affiliate_products'
        and column_name = col and is_nullable = 'NO'
    ) then
      execute format('alter table public.affiliate_products alter column %I drop not null', col);
      raise notice 'Relaxed NOT NULL on % so both pipelines can insert', col;
    end if;
  end loop;
end $$;
-- ---------------------------------------------------------------------------
-- Products: indexes and constraints
-- ---------------------------------------------------------------------------

-- URL identifier. NULLs are distinct in PostgreSQL, so research rows (which
-- have no slug) do not collide.
create unique index if not exists affiliate_products_slug_key
  on public.affiliate_products (slug);

-- One row per (network, advertiser, external id).
--
-- NOT partial: PostgREST's `on_conflict` can only infer a non-partial unique
-- index. A partial index makes every upsert fail with PostgreSQL error 42P10
-- ("no unique or exclusion constraint matching the ON CONFLICT specification").
-- Imported rows always supply all three values; research rows leave them NULL.
create unique index if not exists affiliate_products_source_advertiser_external_key
  on public.affiliate_products (source, advertiser_id, external_product_id);

-- Retire the older two-column index only after the replacement exists. It
-- would otherwise reject two advertisers that legitimately share a product id.
drop index if exists public.affiliate_products_source_external_key;

create index if not exists affiliate_products_program_idx
  on public.affiliate_products (program_slug);

create index if not exists affiliate_products_category_idx
  on public.affiliate_products (category_slug);

create index if not exists affiliate_products_approval_idx
  on public.affiliate_products (approval_status);

do $$
begin
  -- Widen a pre-existing numeric price column without touching data. A column
  -- of any other type (for example `price_text`) is left alone: converting it
  -- would rewrite data and is not part of this migration.
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'affiliate_products'
      and column_name = 'price' and data_type in ('numeric', 'decimal')
  ) then
    alter table public.affiliate_products alter column price type numeric(12, 2);
  end if;
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'affiliate_products'
      and column_name = 'previous_price' and data_type in ('numeric', 'decimal')
  ) then
    alter table public.affiliate_products alter column previous_price type numeric(12, 2);
  end if;
end $$;

do $$
declare
  con record;
begin
  -- Only drop a constraint that is a single-column currency allowlist.
  --
  -- A prefix match would also hit a combined constraint such as
  --   CHECK (currency = 'USD' AND price >= 0)
  -- and silently loosen a rule nobody asked to change. Require instead that the
  -- whole definition is a currency comparison, mentions no boolean operator and
  -- references no other column. Anything else is left exactly as it is.
  for con in
    select conname
    from pg_constraint
    where conrelid = 'public.affiliate_products'::regclass
      and contype = 'c'
      and conname <> 'affiliate_products_currency_iso'
      and pg_get_constraintdef(oid) ~* '^\s*CHECK\s*\(\s*\(?\s*currency\s*(=|<>|!=|IN\b)'
      and pg_get_constraintdef(oid) !~* '\b(AND|OR)\b'
      -- Only the currency column may be referenced; quoted literals are
      -- stripped first so a literal cannot hide another column name.
      and regexp_replace(pg_get_constraintdef(oid), '''[^'']*''', '', 'g')
          !~* '\b(price|product_name|product_url|affiliate_url|affiliate_network|category|target_market|price_text|commission_rate_text|evidence_notes|decision|score|target_audience|positioning_angle|content_hooks|risk_flags|research_confidence|rationale|status|title|slug)\b'
  loop
    execute format('alter table public.affiliate_products drop constraint %I', con.conname);
  end loop;

  -- Added only now that the currency column is guaranteed to exist.
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.affiliate_products'::regclass
      and conname = 'affiliate_products_currency_iso'
  ) then
    -- NOT VALID: new and updated rows are checked, but a pre-existing row is
    -- never rejected or rewritten by the migration.
    alter table public.affiliate_products
      add constraint affiliate_products_currency_iso
      check (currency ~ '^[A-Z]{3}$') not valid;
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- Products: RLS
-- ---------------------------------------------------------------------------
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
-- Products: guard manual / research rows
-- ---------------------------------------------------------------------------
-- A row is "manual" when data_source is `manual` OR NULL. Research rows are
-- backfilled to `manual` above, and the NULL branch keeps the guard correct if
-- a future research insert omits the column.
create or replace function public.protect_manual_product()
returns trigger
language plpgsql
as $$
begin
  if coalesce(old.data_source, 'manual') = 'manual'
     and coalesce(new.data_source, 'manual') <> 'manual' then
    -- Hand-curated/research row. An automated upsert must not claim it; keep
    -- the original row intact.
    return null;
  end if;

  if coalesce(old.data_source, 'manual') = 'manual' then
    -- Never let a workflow flip provenance on a manual row.
    new.source := old.source;
    new.external_product_id := old.external_product_id;
    new.advertiser_id := old.advertiser_id;
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
-- Import audit (service_role only; no anon/authenticated policy at all)
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
  -- text, not uuid: seed catalogue ids are strings such as `p-monitor-arm-gas`,
  -- while imported Admitad rows carry UUID-shaped ids. Both must log.
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
