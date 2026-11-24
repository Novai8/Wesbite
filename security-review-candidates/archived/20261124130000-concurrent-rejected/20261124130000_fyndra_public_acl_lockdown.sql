-- =============================================================================
-- 20261124130000_fyndra_public_acl_lockdown.sql
--
-- Forward-only remediation for the anonymous write path into the public
-- catalogue, plus the fail-closed default-privilege design approved for this
-- project.
--
-- Supersedes the exploratory candidate 20261124120000_fyndra_catalogue_acl_hardening.sql.
-- Ship exactly one of the two; this file is the consolidated replacement.
--
-- ---------------------------------------------------------------------------
-- Defects closed
-- ---------------------------------------------------------------------------
-- 1. WRITABLE SECURITY-DEFINER VIEW
--    public.catalogue_products is a simple single-table view, so PostgreSQL
--    treats it as auto-updatable: INSERT/UPDATE/DELETE written against the view
--    are rewritten onto public.affiliate_products. The view is owned by
--    `postgres`, which also owns that table, and a table's owner is exempt from
--    the table's own RLS policies. Writes therefore executed as the owner with
--    RLS bypassed and `products_read_approved` was never consulted.
--
--    Measured on PostgreSQL 18 with a plain NOSUPERUSER NOBYPASSRLS owner: a
--    DELETE issued through the view removed a row (DELETE 1) while the same
--    statement against the table directly was refused. The exemption is table
--    ownership, not superuser status, so `security_definer_view` alone is the
--    root cause.
--
-- 2. INHERITED WRITE GRANTS ON PUBLIC OBJECTS
--    anon/authenticated held arwdDxtm on the view and on every table in
--    `public`, inherited from default privileges. GRANT is additive, so the 3D
--    migration's `grant select` on the view could not narrow it. On PostgreSQL
--    17+ they also held MAINTAIN, which permits VACUUM/ANALYZE/CLUSTER/REINDEX
--    and LOCK TABLE -- an unprivileged role could take an ACCESS EXCLUSIVE lock
--    on the 3D queue. TRUNCATE is not filtered by RLS at all.
--
-- 3. OPEN-ENDED FUTURE DEFAULTS
--    Default privileges granted all of the above to every future object, from
--    more than one grantor role.
--
-- ---------------------------------------------------------------------------
-- Design
-- ---------------------------------------------------------------------------
-- FAIL CLOSED. Future tables and views receive no privileges for anon or
-- authenticated. Public access is granted only by the explicit, reviewed
-- allowlist in section 5 -- adding an entry there is a security decision.
--
-- Enforcement is two-layered:
--   * Default privileges are revoked for every grantor role that has a
--     public-schema entry, at BOTH global and schema scope. PostgreSQL unions
--     those scopes, so a schema-scoped revoke alone does NOT cancel a global
--     grant-all (verified: global grant-all + schema revoke-all still left a
--     new table fully writable).
--   * A ddl_command_end event trigger strips public-role privileges from any
--     table/view created in `public`. This is grantor-agnostic, so objects
--     created by supabase_admin or any other role are covered. It runs AFTER
--     the creator's default privileges are applied, so it is the backstop.
--
-- The view becomes `security_invoker`, so reads and any future write path are
-- privilege-checked and RLS-filtered as the caller. Callers receive
-- column-level SELECT for exactly the columns the view projects; research
-- columns, model_error and commission_info stay ungranted. RLS still limits
-- anon to approved rows -- column grants widen columns, never rows.
--
-- ---------------------------------------------------------------------------
-- Deployment requirement
-- ---------------------------------------------------------------------------
-- `CREATE EVENT TRIGGER` requires the SUPERUSER attribute; it is not granted by
-- membership. Supabase's `postgres` role is superuser and already owns the
-- platform `ensure_rls` event trigger, so this migration applies normally
-- there. On a database where it is not superuser, section 2 raises with an
-- actionable message rather than silently shipping without the guarantee.
-- The event trigger is created inside this transaction and cannot be rolled
-- back separately from it.
--
-- ---------------------------------------------------------------------------
-- Not in this migration
-- ---------------------------------------------------------------------------
-- search_path pinning is 20261124090000_fyndra_function_search_path.sql and is
-- deliberately kept separate.
--
-- ---------------------------------------------------------------------------
-- Data safety
-- ---------------------------------------------------------------------------
-- No table, column, row, policy or trigger is dropped or renamed. The only
-- privileges removed are excess privileges of anon/authenticated/public.
-- service_role is untouched: imports, the 3D worker and click logging all use
-- the service-role key.
--
-- Idempotent: revoke-then-grant throughout; re-running is a no-op.
-- =============================================================================

begin;

-- ---------------------------------------------------------------------------
-- 1. Preflight
-- ---------------------------------------------------------------------------
do $$
begin
  if to_regclass('public.affiliate_products') is null then
    raise exception 'public.affiliate_products is missing: apply 0001_admitad_integration.sql first';
  end if;
  if to_regclass('public.catalogue_products') is null then
    raise exception 'public.catalogue_products is missing: apply 20261123150000_fyndra_3d_models.sql first';
  end if;
  if not exists (select 1 from pg_roles where rolname = 'anon')
     or not exists (select 1 from pg_roles where rolname = 'authenticated')
     or not exists (select 1 from pg_roles where rolname = 'service_role') then
    raise exception 'roles anon/authenticated/service_role are missing: this migration targets a Supabase database';
  end if;

  -- CREATE EVENT TRIGGER requires the SUPERUSER attribute (membership in a
  -- superuser role is not enough; measured on PostgreSQL 18). Check it here so
  -- the failure is explicit rather than a confusing "permission denied for
  -- schema public" from the trigger's SECURITY DEFINER body.
  if not coalesce((select rolsuper from pg_roles where rolname = current_user), false) then
    raise exception
      'this migration must run as a SUPERUSER (Supabase postgres). Role % is not; fail-closed defaults for future objects need CREATE EVENT TRIGGER.',
      current_user;
  end if;
end;
$$;

-- ---------------------------------------------------------------------------
-- 2. Grantor-agnostic guard for future objects
-- ---------------------------------------------------------------------------
-- SECURITY DEFINER so the revoke is not limited by the creator's rights, with
-- an empty search_path and a fully qualified body so no object resolution can
-- be hijacked. objid::regclass renders schema-qualified under this path, so the
-- dynamic SQL cannot be redirected by a crafted relation name.
create or replace function public.enforce_public_schema_acl()
returns event_trigger
language plpgsql
security definer
set search_path = pg_catalog
as $fn$
declare
  obj record;
  privs text := 'select, insert, update, delete, truncate, references, trigger';
begin
  if current_setting('server_version_num')::int >= 170000 then
    privs := privs || ', maintain';
  end if;

  for obj in
    select c.oid
      from pg_event_trigger_ddl_commands() e
      join pg_class c on c.oid = e.objid
      join pg_namespace n on n.oid = c.relnamespace
     where n.nspname = 'public'
       and c.relkind in ('r', 'p', 'v', 'm', 'f')
  loop
    execute format('revoke %s on %s from public, anon, authenticated',
                   privs, obj.oid::regclass::text);
  end loop;

  -- Sequences are separate objects with their own privileges. A future
  -- `bigserial` column creates one, and USAGE on it lets a public role consume
  -- values (nextval), so they are stripped too.
  for obj in
    select c.oid
      from pg_event_trigger_ddl_commands() e
      join pg_class c on c.oid = e.objid
      join pg_namespace n on n.oid = c.relnamespace
     where n.nspname = 'public'
       and c.relkind = 'S'
  loop
    execute format('revoke all on sequence %s from public, anon, authenticated',
                   obj.oid::regclass::text);
  end loop;
end;
$fn$;

revoke all on function public.enforce_public_schema_acl() from public;
revoke all on function public.enforce_public_schema_acl() from anon, authenticated;

do $$
begin
  if exists (select 1 from pg_event_trigger where evtname = 'enforce_public_schema_acl') then
    return;
  end if;

  begin
    create event trigger enforce_public_schema_acl
      on ddl_command_end
      when tag in ('CREATE TABLE', 'CREATE VIEW', 'CREATE MATERIALIZED VIEW', 'CREATE SEQUENCE')
      execute function public.enforce_public_schema_acl();
  exception
    when insufficient_privilege then
      raise exception
        'CREATE EVENT TRIGGER requires SUPERUSER; run this migration as the Supabase postgres role or a superuser. Fail-closed defaults for future objects cannot be guaranteed without it.';
  end;
end;
$$;

-- ---------------------------------------------------------------------------
-- 3. Strip public-role privileges from every existing object in public
-- ---------------------------------------------------------------------------
-- Includes SELECT: public reads are re-granted by the explicit allowlist in
-- section 5. An object owned by another role cannot be revoked by a
-- non-superuser non-member, so those cases are collected and raised rather than
-- silently skipped.
do $$
declare
  privs text := 'select, insert, update, delete, truncate, references, trigger';
  obj record;
  failed text[] := array[]::text[];
begin
  if current_setting('server_version_num')::int >= 170000 then
    privs := privs || ', maintain';
  end if;

  for obj in
    select c.oid, c.relkind
      from pg_class c
      join pg_namespace n on n.oid = c.relnamespace
     where n.nspname = 'public'
       and c.relkind in ('r', 'p', 'v', 'm', 'f', 'S')
  loop
    begin
      if obj.relkind = 'S' then
        execute format('revoke all on sequence %s from public, anon, authenticated',
                       obj.oid::regclass::text);
      else
        execute format('revoke %s on %s from public, anon, authenticated',
                       privs, obj.oid::regclass::text);
      end if;
    exception
      when insufficient_privilege then
        failed := failed || obj.oid::regclass::text;
    end;
  end loop;

  if cardinality(failed) > 0 then
    raise exception 'could not revoke public-role privileges on: % (run as superuser or as the owning role)',
                    array_to_string(failed, ', ');
  end if;
end;
$$;

-- ---------------------------------------------------------------------------
-- 4. The view runs as the caller
-- ---------------------------------------------------------------------------
revoke all on public.catalogue_products from public;
revoke all on public.catalogue_products from anon, authenticated;

alter view public.catalogue_products set (security_invoker = true);
alter view public.catalogue_products set (security_barrier = true);

-- ---------------------------------------------------------------------------
-- 5. Explicit, reviewed allowlist of public resources
-- ---------------------------------------------------------------------------
-- Every entry is a deliberate decision to expose customer-facing data through
-- the public Data API. Nothing is granted implicitly.
grant select on public.catalogue_products   to anon, authenticated;
grant select on public.affiliate_programs    to anon, authenticated;
grant select on public.affiliate_categories  to anon, authenticated;

-- ---------------------------------------------------------------------------
-- 6. Column-level SELECT on the base table, derived from the view
-- ---------------------------------------------------------------------------
-- security_invoker requires the caller to hold SELECT on each column the view
-- references. Deriving the list from pg_attribute ties the grants to the view
-- definition, so they cannot drift, and any column the view does not project
-- stays ungranted. Verified separately: RLS still returns approved rows only.
do $$
declare
  cols text;
begin
  select string_agg(quote_ident(v.attname), ', ' order by v.attnum)
    into cols
    from pg_attribute v
   where v.attrelid = 'public.catalogue_products'::regclass
     and v.attnum > 0
     and not v.attisdropped
     and exists (
       select 1 from pg_attribute b
        where b.attrelid = 'public.affiliate_products'::regclass
          and b.attname = v.attname
          and b.attnum > 0
          and not b.attisdropped
     );

  if cols is null then
    raise exception 'catalogue_products projects no affiliate_products columns';
  end if;

  execute format('grant select (%s) on public.affiliate_products to anon, authenticated', cols);
end;
$$;

-- ---------------------------------------------------------------------------
-- 7. Default privileges: every grantor role, both scopes
-- ---------------------------------------------------------------------------
-- One default-ACL entry exists per grantor role, and the global and
-- schema-scoped entries are unioned. All grantors with a public-schema entry are
-- handled, plus postgres and supabase_admin when they exist. A grantor whose
-- defaults cannot be altered is collected and raised.
do $$
declare
  privs text := 'select, insert, update, delete, truncate, references, trigger';
  grantor text;
  grantors text[] := array[]::text[];
  failed text[] := array[]::text[];
begin
  if current_setting('server_version_num')::int >= 170000 then
    privs := privs || ', maintain';
  end if;

  select coalesce(array_agg(distinct pg_get_userbyid(d.defaclrole)), array[]::text[])
    into grantors
    from pg_default_acl d
   where d.defaclobjtype in ('r', 'S')
     and (d.defaclnamespace = 0 or d.defaclnamespace = 'public'::regnamespace);

  foreach grantor in array array['postgres', 'supabase_admin'] loop
    if exists (select 1 from pg_roles where rolname = grantor) then
      grantors := array_append(grantors, grantor);
    end if;
  end loop;

  grantors := array(select distinct g from unnest(grantors) g order by g);

  foreach grantor in array grantors loop
    begin
      execute format('alter default privileges for role %I revoke %s on tables from public, anon, authenticated', grantor, privs);
      execute format('alter default privileges for role %I in schema public revoke %s on tables from public, anon, authenticated', grantor, privs);
      execute format('alter default privileges for role %I revoke all on sequences from public, anon, authenticated', grantor);
      execute format('alter default privileges for role %I in schema public revoke all on sequences from public, anon, authenticated', grantor);
    exception
      when insufficient_privilege then
        failed := failed || grantor;
    end;
  end loop;

  if cardinality(failed) > 0 then
    raise exception 'cannot alter default privileges for grantor role(s): % (run as superuser or as those roles)',
                    array_to_string(failed, ', ');
  end if;
end;
$$;

-- ---------------------------------------------------------------------------
-- 8. Self-check: prove the outcome with real probe objects
-- ---------------------------------------------------------------------------
-- The probe table and view exercise the event trigger and the union of every
-- grantor's defaults. They are dropped before commit; if any assertion fails
-- the whole migration rolls back.
do $$
declare
  bad text;
  chk_privs text[];
  probe_table constant text := 'public.__acl_probe_table';
  probe_view  constant text := 'public.__acl_probe_view';
begin
  chk_privs := array['insert','update','delete','truncate','references','trigger'];
  if current_setting('server_version_num')::int >= 170000 then
    chk_privs := array_append(chk_privs, 'maintain');
  end if;

  -- (a) the view must be SELECT-only for public roles
  select string_agg(p, ', ')
    into bad
    from unnest(chk_privs) p
   where has_table_privilege('anon', 'public.catalogue_products', p)
      or has_table_privilege('authenticated', 'public.catalogue_products', p);
  if bad is not null then
    raise exception 'catalogue_products still grants % to a public role', bad;
  end if;

  -- (b) the catalogue must still be readable by both public roles
  if not has_table_privilege('anon', 'public.catalogue_products', 'select')
     or not has_table_privilege('authenticated', 'public.catalogue_products', 'select') then
    raise exception 'catalogue_products is no longer readable by anon/authenticated';
  end if;

  -- (c) no public role may hold a write/DDL privilege anywhere in public
  select string_agg(format('%s on %s', p, c.relname), ', ')
    into bad
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    cross join unnest(array['insert','update','delete','truncate','references','trigger']) p
   where n.nspname = 'public'
     and c.relkind in ('r','p','v','m','f')
     and (has_table_privilege('anon', c.oid, p) or has_table_privilege('authenticated', c.oid, p));
  if bad is not null then
    raise exception 'public roles still hold write privileges: %', bad;
  end if;

  -- (d) a newly created table and view must grant the public roles nothing
  execute format('create table %s (id int)', probe_table);
  execute format('create view %s as select id from %s', probe_view, probe_table);

  chk_privs := array['select','insert','update','delete','truncate','references','trigger'];
  if current_setting('server_version_num')::int >= 170000 then
    chk_privs := array_append(chk_privs, 'maintain');
  end if;

  select string_agg(format('%s:%s:%s', r, rel, p), ', ')
    into bad
    from (values (probe_table), (probe_view)) as t(rel)
    cross join (values ('anon'), ('authenticated')) as rr(r)
    cross join unnest(chk_privs) p
   where has_table_privilege(rr.r, t.rel::regclass, p);
  if bad is not null then
    raise exception 'a newly created object still grants privileges to a public role: %', bad;
  end if;

  -- A future serial column creates a sequence; it must not be usable either.
  execute 'create table public.__acl_probe_serial (id bigserial primary key)';
  select string_agg(format('%s:%s', r, p), ', ')
    into bad
    from (values ('anon'), ('authenticated')) as rr(r)
    cross join unnest(array['usage', 'select', 'update']) p
   where has_sequence_privilege(rr.r, pg_get_serial_sequence('public.__acl_probe_serial', 'id'), p);
  if bad is not null then
    raise exception 'a newly created sequence still grants privileges to a public role: %', bad;
  end if;
  execute 'drop table public.__acl_probe_serial';

  execute format('drop view %s', probe_view);
  execute format('drop table %s', probe_table);

  -- (e) MAINTAIN anywhere in public (PG 17+)
  if current_setting('server_version_num')::int >= 170000 then
    select string_agg(c.relname, ', ')
      into bad
      from pg_class c
      join pg_namespace n on n.oid = c.relnamespace
     where n.nspname = 'public'
       and c.relkind in ('r','p','v','m','f')
       and (has_table_privilege('anon', c.oid, 'maintain')
            or has_table_privilege('authenticated', c.oid, 'maintain'));
    if bad is not null then
      raise exception 'public roles still hold MAINTAIN on: %', bad;
    end if;
  end if;

  -- (f) service_role must keep what the backend needs
  if not has_table_privilege('service_role', 'public.affiliate_products', 'insert')
     or not has_table_privilege('service_role', 'public.affiliate_products', 'update')
     or not has_table_privilege('service_role', 'public.affiliate_products', 'delete')
     or not has_table_privilege('service_role', 'public.catalogue_products', 'select') then
    raise exception 'service_role lost required access';
  end if;
end;
$$;

commit;