-- Lock down `search_path` on the two trigger functions this project owns.
--
-- Why: PostgreSQL resolves unqualified names inside a function body against the
-- caller's `search_path` unless the function pins it. Supabase's advisor raises
-- `function_search_path_mutable` (lint 0011) for that reason: a role able to
-- create objects in an earlier schema on the path could shadow a function or
-- operator the body calls. Neither function here calls anything outside
-- `pg_catalog`, but relying on that is an implicit assumption; pinning the path
-- makes it explicit and removes the warning.
--
-- Shape of the fix:
--   * `set search_path = ''` sets a bare empty path. Nothing outside
--     `pg_catalog` (always implicitly available) resolves.
--   * every function call in the bodies is schema-qualified (`pg_catalog.now()`)
--     so the bodies stay correct with no path at all.
--   * `create or replace` keeps this re-runnable, and it replaces the function's
--     settings as well as its body, so a database that already had the function
--     is pinned by the same statement. No separate `alter function` is needed.
--
-- Additive only: no table, column, row, trigger, policy or grant is changed.
-- The trigger definitions, function names, signatures and behaviour are
-- identical to `0001_admitad_integration.sql` and
-- `20261123150000_fyndra_3d_models.sql`; only the resolution path is pinned.
--
-- Deliberately untouched: `public.rls_auto_enable()`. It is a Supabase
-- platform helper (owned by `postgres`, driven by the `ensure_rls` event
-- trigger that ships with the platform) and already pins `search_path` to
-- `pg_catalog`. Rewriting a platform-managed function from an application
-- migration risks breaking RLS auto-enablement on future table creation.

-- ---------------------------------------------------------------------------
-- 1. protect_manual_product() — guards research/manual rows on affiliate_products
-- ---------------------------------------------------------------------------

do $$
begin
  if exists (
    select 1
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname = 'protect_manual_product'
      and pg_get_function_identity_arguments(p.oid) = ''
  ) then
    execute $fn$
      create or replace function public.protect_manual_product()
      returns trigger
      language plpgsql
      set search_path = ''
      as $body$
      begin
        if coalesce(old.data_source, 'manual') = 'manual'
           and coalesce(new.data_source, 'manual') <> 'manual' then
          -- Hand-curated/research row. An automated upsert must not claim it;
          -- keep the original row intact.
          return null;
        end if;

        if coalesce(old.data_source, 'manual') = 'manual' then
          -- Never let a workflow flip provenance on a manual row.
          new.source := old.source;
          new.external_product_id := old.external_product_id;
          new.advertiser_id := old.advertiser_id;
        end if;

        new.updated_at := pg_catalog.now();
        return new;
      end;
      $body$;
    $fn$;

  end if;
end;
$$;

comment on function public.protect_manual_product() is
  'BEFORE UPDATE trigger on affiliate_products: refuses to let automation claim a manual/research row and stamps updated_at. Pins search_path to empty; the body qualifies its function calls.';

-- ---------------------------------------------------------------------------
-- 2. set_product_model_jobs_updated_at() — queue timestamp
-- ---------------------------------------------------------------------------

do $$
begin
  if exists (
    select 1
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname = 'set_product_model_jobs_updated_at'
      and pg_get_function_identity_arguments(p.oid) = ''
  ) then
    execute $fn$
      create or replace function public.set_product_model_jobs_updated_at()
      returns trigger
      language plpgsql
      set search_path = ''
      as $body$
      begin
        new.updated_at = pg_catalog.now();
        return new;
      end;
      $body$;
    $fn$;

  end if;
end;
$$;

comment on function public.set_product_model_jobs_updated_at() is
  'BEFORE UPDATE trigger: stamps product_model_jobs.updated_at to the transaction timestamp. Pins search_path to empty; the body qualifies its function calls.';

-- ---------------------------------------------------------------------------
-- 3. Self-check
-- ---------------------------------------------------------------------------
-- Fails loudly if a function exists but the pin did not take, so a silent
-- no-op cannot masquerade as a fixed advisory.

do $$
declare
  unpinned text;
begin
  select string_agg(p.proname, ', ')
    into unpinned
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public'
     and p.proname in ('protect_manual_product', 'set_product_model_jobs_updated_at')
     and not coalesce(p.proconfig, '{}'::text[]) @> array['search_path=""'];

  if unpinned is not null then
    raise exception 'search_path is still mutable on: %', unpinned;
  end if;
end;
$$;
