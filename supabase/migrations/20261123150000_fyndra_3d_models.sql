-- Fyndra 3D agent — model fields, generation queue, and Storage bucket.
--
-- Additive only: no existing table, column, or row is dropped or rewritten.
-- Safe to re-run: every object is created behind an idempotent guard.
--
-- Remote inference happens in a worker on Hugging Face ZeroGPU. This
-- migration stores state and finished artefacts only; it performs no
-- inference and downloads no model weights.

-- ---------------------------------------------------------------------------
-- 0. Preflight — confirm the FK target really is a UUID primary key
-- ---------------------------------------------------------------------------
--
-- affiliate_products.id must be a uuid primary key before we can attach
-- product_model_jobs.product_id to it. If the live schema ever drifts (for
-- example a text id, or a different primary key column), fail loudly here
-- instead of creating a queue that silently cannot join.

do $$
declare
  id_is_uuid_pk boolean;
begin
  select exists (
    select 1
    from pg_constraint c
    join pg_attribute a
      on a.attrelid = c.conrelid
     and a.attnum = c.conkey[1]
    where c.conrelid = 'public.affiliate_products'::regclass
      and c.contype = 'p'
      -- Single-column primary key, so the queue's one-column FK can match it.
      and cardinality(c.conkey) = 1
      and a.attname = 'id'
      and a.atttypid = 'uuid'::regtype
  ) into id_is_uuid_pk;

  if not id_is_uuid_pk then
    raise exception
      'Expected public.affiliate_products.id to be the uuid primary key; refusing to create the 3D queue.';
  end if;
end;
$$;

-- ---------------------------------------------------------------------------
-- 1. Product model fields
-- ---------------------------------------------------------------------------

alter table public.affiliate_products
  add column if not exists model_url text,
  add column if not exists model_format text,
  add column if not exists model_type text,
  add column if not exists model_status text,
  add column if not exists model_provider text,
  add column if not exists model_generated_at timestamptz,
  add column if not exists model_error text,
  add column if not exists source_image_hash text;

-- Constrain the status values to the agreed lifecycle. The existence check is
-- scoped to this table's OID so a same-named constraint on any other table
-- cannot suppress the constraint here.
do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'affiliate_products_model_status_check'
      and conrelid = 'public.affiliate_products'::regclass
  ) then
    alter table public.affiliate_products
      add constraint affiliate_products_model_status_check
      check (
        model_status is null
        or model_status in ('pending', 'processing', 'completed', 'failed', 'quota_exhausted', 'image_fallback')
      );
  end if;
end;
$$;

comment on column public.affiliate_products.model_status is
  '3D model lifecycle: pending | processing | completed | failed | quota_exhausted | image_fallback';
comment on column public.affiliate_products.source_image_hash is
  'SHA-256 of the source image used for generation; dedupes jobs';

-- ---------------------------------------------------------------------------
-- 2. Generation queue
-- ---------------------------------------------------------------------------

create table if not exists public.product_model_jobs (
  id uuid primary key default gen_random_uuid(),
  -- Type and target must match affiliate_products.id, which section 0 proved
  -- is a uuid primary key. `on delete cascade` keeps the queue consistent
  -- when a product is removed.
  product_id uuid not null references public.affiliate_products (id) on delete cascade,
  source_image_hash text not null,
  source_image_url text not null,
  status text not null default 'pending'
    check (status in ('pending', 'processing', 'completed', 'failed', 'quota_exhausted', 'image_fallback')),
  attempts int not null default 0,
  provider text,
  model_path text,
  error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- One job per (product, image). Re-enqueuing the same image is a no-op.
  constraint product_model_jobs_product_id_source_image_hash_key
    unique (product_id, source_image_hash)
);

create index if not exists product_model_jobs_status_created_idx
  on public.product_model_jobs (status, created_at);

alter table public.product_model_jobs enable row level security;

-- The worker and admin paths use the service role, which bypasses RLS.
-- No anon/authenticated policy is created: the queue is never publicly read.

-- Verify the foreign key really points at affiliate_products' primary key
-- (section 0 proved that key is the single uuid column `id`).
do $$
declare
  fk_ok boolean;
begin
  select exists (
    select 1
    from pg_constraint fk
    join pg_class t on t.oid = fk.conrelid
    join pg_namespace n on n.oid = t.relnamespace
    join pg_constraint pk
      on pk.conrelid = fk.confrelid
     and pk.contype = 'p'
    join pg_attribute src
      on src.attrelid = fk.conrelid
     and src.attnum = fk.conkey[1]
    where fk.contype = 'f'
      and n.nspname = 'public'
      and t.relname = 'product_model_jobs'
      and src.attname = 'product_id'
      -- confkey (referenced columns) must be the exact primary-key columns.
      and fk.confkey = pk.conkey
  ) into fk_ok;

  if not fk_ok then
    raise exception
      'product_model_jobs.product_id must reference public.affiliate_products(id).';
  end if;
end;
$$;

-- ---------------------------------------------------------------------------
-- 3. Automatic updated_at for the queue
-- ---------------------------------------------------------------------------
--
-- Workers and API routes only ever send the fields they change. `updated_at`
-- advances on every UPDATE because the trigger owns it, so no caller can
-- forget it or forge it.

create or replace function public.set_product_model_jobs_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

comment on function public.set_product_model_jobs_updated_at() is
  'BEFORE UPDATE trigger: stamps product_model_jobs.updated_at = now().';

drop trigger if exists product_model_jobs_set_updated_at on public.product_model_jobs;

create trigger product_model_jobs_set_updated_at
  before update on public.product_model_jobs
  for each row
  execute function public.set_product_model_jobs_updated_at();

-- ---------------------------------------------------------------------------
-- 4. Storage bucket for generated GLBs
-- ---------------------------------------------------------------------------
--
-- Public bucket, because product pages load GLBs directly and these are
-- public product assets. A public bucket serves objects without an extra
-- storage.objects SELECT policy, so no policy is created here.
--
-- No INSERT/UPDATE/DELETE policy is created for anon or authenticated.
-- Uploads use the server-side service-role credential, which bypasses RLS.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'product-models',
  'product-models',
  true,
  26214400, -- 25 MB
  array['model/gltf-binary', 'application/octet-stream']
)
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- Older revisions of this migration added an explicit SELECT policy. The
-- bucket is public, so that policy is redundant; remove it if it exists.
drop policy if exists product_models_public_read on storage.objects;

-- ---------------------------------------------------------------------------
-- 5. Public catalogue view (column-level security)
-- ---------------------------------------------------------------------------
--
-- RLS is row-level only. Supabase grants anon/authenticated table SELECT by
-- default, so `products_read_approved` alone would expose *every* column of an
-- approved row -- including research fields (evidence_notes, score,
-- research_confidence, decision), the operator-facing model_error and
-- `commission_info`, which holds signed advertiser feed URLs.
--
-- Fix: expose only customer-facing columns through a view, and stop granting
-- anon/authenticated direct SELECT on the base table. The service role keeps
-- full table access for imports, the 3D worker and admin reads.
--
-- The view is a *security barrier*: PostgreSQL 15+ views default to
-- `security_invoker = false`, which is what we want here -- the view owner
-- reads the base table under the caller's RLS, but the column list is fixed by
-- the view itself, so a caller cannot add a column to the projection.

create or replace view public.catalogue_products
with (security_barrier = true)
as
select
  id,
  slug,
  title,
  description,
  category_slug,
  subcategory,
  image_urls,
  merchant,
  program_slug,
  affiliate_url,
  source_url,
  price,
  currency,
  previous_price,
  original_price,
  specs,
  pros,
  cons,
  availability,
  region,
  keywords,
  use_cases,
  budget_tier,
  price_verified_at,
  approval_status,
  data_source,
  source,
  external_product_id,
  advertiser_id,
  last_synced_at,
  created_at,
  updated_at,
  ai_headline,
  ai_description,
  ai_quality_flags,
  -- Display-only 3D state. model_error is intentionally absent: it is
  -- operator-facing and must never be readable by anon/authenticated.
  model_url,
  model_format,
  model_type,
  model_status,
  model_provider,
  model_generated_at,
  source_image_hash
from public.affiliate_products
where approval_status = 'approved';

comment on view public.catalogue_products is
  'Customer-facing catalogue. Omits research columns (evidence_notes, score, research_confidence, decision), model_error and commission_info (signed feed provenance). Only approved rows.';

-- Only approved, customer-facing rows are reachable through the view, so it
-- can be readable by the public roles without a second policy.
alter view public.catalogue_products owner to postgres;
grant select on public.catalogue_products to anon, authenticated;

-- Stop direct reads of the base table by public roles. Writes were already
-- service_role-only. `revoke ... from public` also removes inherited grants.
--
-- `products_read_approved` is deliberately KEPT: it is no longer the only
-- boundary, but it must remain so that a future accidental re-grant to anon or
-- authenticated still cannot reach unapproved rows.
revoke all on public.affiliate_products from anon, authenticated;

-- Belt and braces for databases created before Supabase's default privileges
-- applied: revoke any table-level grant these roles still hold.
do $$
declare
  role_name text;
begin
  foreach role_name in array array['anon', 'authenticated']
  loop
    if exists (select 1 from pg_roles where rolname = role_name) then
      execute format('revoke all on public.affiliate_products from %I', role_name);
    end if;
  end loop;
end;
$$;
