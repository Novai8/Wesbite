-- =============================================================================
-- Fyndra: catalogue ACL lockdown, fail-closed  (CANONICAL)
-- =============================================================================
-- Depends on 0001_admitad_integration.sql and
-- 20261123150000_fyndra_3d_models.sql. Purely additive: privileges and view
-- options only. No table, column, row, policy, trigger or function is created
-- or dropped, and no historical migration is edited.
--
-- The function search_path pinning lives in its own migration
-- (20261124090000_fyndra_function_search_path.sql) and is deliberately not
-- merged here.
--
-- -----------------------------------------------------------------------------
-- The vulnerability this closes
-- -----------------------------------------------------------------------------
-- public.catalogue_products is a simple single-table view, so PostgreSQL makes
-- it auto-updatable: INSERT/UPDATE/DELETE written against the view are rewritten
-- into the same statement against public.affiliate_products (rewrite rule
-- _RETURN). The view is owned by postgres, which also owns the base table, and a
-- table's owner is exempt from that table's RLS policies. Writes therefore ran
-- as the owner with RLS bypassed, and products_read_approved was never
-- consulted for the caller.
--
-- Separately, Supabase's default privileges granted arwdDxtm on every new table
-- -- and "on tables" covers views -- to anon and authenticated. The 3D migration
-- added "grant select on catalogue_products to anon, authenticated" but never
-- revoked the inherited grant. GRANT is additive and cannot narrow it, so the
-- effective ACL stayed anon=arwdDxtm/postgres. This therefore worked:
--
--   begin; set local role anon;
--   delete from public.catalogue_products where true; commit;
--
-- and deleted the entire approved catalogue. It was reachable over PostgREST
-- with the publishable key that ships in the browser bundle. Revoking on the
-- base table did not help: the caller touches the view, the owner touches the
-- table.
--
-- -----------------------------------------------------------------------------
-- Design: two independent defences, neither of which is a grant
-- -----------------------------------------------------------------------------
--   1. The view stops being auto-updatable in the caller's hands. It becomes
--      security_invoker = true, so every statement through it is privilege-
--      checked and RLS-filtered AS THE CALLER. The rewrite-as-owner path is
--      gone, which means a future re-grant cannot resurrect the DELETE.
--   2. The grant layer is fail-closed. anon and authenticated get SELECT on
--      catalogue_products and the minimal column-level SELECT on the base table
--      that the view projects, and nothing else anywhere in schema public.
--
-- RLS is kept, not replaced. security_invoker = true means
-- products_read_approved is now actually evaluated for the caller, so it is
-- enforced defence in depth rather than dead weight. RLS is row-level only and
-- cannot restrict TRUNCATE at all, which is why the grant layer still matters.
--
-- -----------------------------------------------------------------------------
-- Fail-closed defaults, for the role that actually runs migrations
-- -----------------------------------------------------------------------------
-- PostgreSQL's built-in default is already fail-closed: a new table grants
-- nothing to PUBLIC or to anon/authenticated. The exposure comes only from
-- per-role entries in pg_default_acl. So the fix is to delete those entries, not
-- to narrow them to SELECT -- a default SELECT is an un-reviewed grant to
-- whatever table a future migration happens to create.
--
-- Two measured constraints (verified on PostgreSQL 17.12 and 18.6):
--
--   1. Global and schema-scoped default-ACL entries are UNIONED. A
--      schema-scoped "revoke all" does NOT cancel a global "grant all"; it
--      silently does nothing. Both scopes must be revoked.
--
--   2. ALTER DEFAULT PRIVILEGES FOR ROLE x requires membership in x (or
--      superuser); otherwise it fails with 42501. On Supabase the migration
--      role is postgres, which is NOT a member of supabase_admin.
--
-- This migration therefore enforces fail-closed defaults for postgres -- the
-- actual Fyndra migration role -- as a hard requirement, and treats every other
-- creator role as best-effort: attempted, recorded if it fails with 42501, and
-- never assumed to be changeable. The self-check asserts only over the roles
-- this migration actually managed.
--
-- LIMITATION, stated plainly and not papered over: objects created by
-- supabase_admin may still be born with permissive grants. A PostgreSQL
-- migration run as postgres cannot modify supabase_admin's default privileges
-- or its objects' ACLs, and this migration does not pretend otherwise. That is
-- a platform-level gap and must be closed at the platform level -- by Supabase
-- running the equivalent ALTER DEFAULT PRIVILEGES as supabase_admin, or by
-- granting the migration role membership in supabase_admin.
--
-- -----------------------------------------------------------------------------
-- MAINTAIN and TRUNCATE (PostgreSQL 17+ / all versions)
-- -----------------------------------------------------------------------------
-- TRUNCATE is not filtered by RLS at all, so where it is granted it is strictly
-- worse than DELETE. MAINTAIN is new in 17 and permits VACUUM, ANALYZE, CLUSTER,
-- REINDEX, REFRESH MATERIALIZED VIEW and LOCK TABLE. LOCK TABLE is the
-- dangerous part: ACCESS EXCLUSIVE on affiliate_products blocks every catalogue
-- reader. Both are denial-of-service primitives. Every MAINTAIN statement is
-- gated on server_version_num >= 170000, because the keyword is a syntax error
-- on 16 and earlier.
--
-- -----------------------------------------------------------------------------
-- Idempotency
-- -----------------------------------------------------------------------------
-- Every statement is revoke-then-grant, a catalog-guarded loop, or an
-- idempotent ALTER VIEW. Re-running is a no-op. The relation list is explicit
-- rather than "everything not allowlisted", so re-running after a later,
-- reviewed grant cannot silently revoke that grant.
-- =============================================================================


-- -----------------------------------------------------------------------------
-- 0. Preflight
-- -----------------------------------------------------------------------------
-- Fail with an actionable message rather than a bare "relation does not exist"
-- if this is applied before the migrations that create its inputs.

do $$
begin
  if to_regclass('public.catalogue_products') is null then
    raise exception
      'public.catalogue_products is missing: apply 20261123150000_fyndra_3d_models.sql first';
  end if;

  if to_regclass('public.affiliate_products') is null then
    raise exception
      'public.affiliate_products is missing: apply 0001_admitad_integration.sql first';
  end if;

  if current_setting('server_version_num')::int < 150000 then
    raise exception
      'security_invoker requires PostgreSQL 15 or newer; this server is %',
      current_setting('server_version');
  end if;

  if not exists (select 1 from pg_roles where rolname = 'anon')
     or not exists (select 1 from pg_roles where rolname = 'authenticated') then
    raise exception
      'roles anon/authenticated are missing: this migration targets a Supabase database';
  end if;
end;
$$;


-- -----------------------------------------------------------------------------
-- 1. The view runs as the caller
-- -----------------------------------------------------------------------------
-- security_invoker = true is the structural fix: it removes the rewrite-as-
-- owner path that made DELETE possible, and it puts products_read_approved back
-- in the decision path. security_barrier = true is retained from the 3D
-- migration; it guards predicate leakage on reads and is unrelated to
-- writability.
--
-- security_invoker requires the caller to hold SELECT on every column the view
-- projects, which section 2 grants. Without that, every anonymous read would
-- fail with 42501.

revoke all on public.catalogue_products from public;
revoke all on public.catalogue_products from anon, authenticated;

alter view public.catalogue_products set (security_invoker = true);
alter view public.catalogue_products set (security_barrier = true);

grant select on public.catalogue_products to anon, authenticated;


-- -----------------------------------------------------------------------------
-- 2. Base table: minimal column-level SELECT, derived from the view
-- -----------------------------------------------------------------------------
-- The base table carries research columns, model_error and commission_info
-- (signed advertiser feed URLs). None of them may be reachable by a public
-- role. Rather than hand-maintaining a column list that can drift from the
-- view's projection, the grant is derived from the view definition itself, so
-- the two cannot disagree.
--
-- Table-level SELECT stays revoked; only the projected columns are granted.
-- Combined with RLS, an approved row is readable and anything else is not.

revoke all on public.affiliate_products from public;
revoke all on public.affiliate_products from anon, authenticated;

do $$
declare
  projected text;
begin
  select string_agg(quote_ident(a.attname), ', ' order by a.attnum)
    into projected
    from pg_attribute a
   where a.attrelid = 'public.catalogue_products'::regclass
     and a.attnum > 0
     and not a.attisdropped;

  if projected is null then
    raise exception 'public.catalogue_products projects no columns';
  end if;

  execute format(
    'grant select (%s) on public.affiliate_products to anon, authenticated',
    projected);
end;
$$;


-- -----------------------------------------------------------------------------
-- 3. RLS stays, and is now actually enforced
-- -----------------------------------------------------------------------------
-- products_read_approved is created by 0001 and must not be dropped. Asserted
-- rather than recreated, so this migration never owns the policy's definition.

do $$
begin
  if not exists (
    select 1
      from pg_policies
     where schemaname = 'public'
       and tablename = 'affiliate_products'
       and policyname = 'products_read_approved'
  ) then
    raise exception
      'products_read_approved is missing from public.affiliate_products: apply 0001_admitad_integration.sql first';
  end if;

  if not exists (
    select 1 from pg_class
     where oid = 'public.affiliate_products'::regclass
       and relrowsecurity
  ) then
    raise exception 'row level security is not enabled on public.affiliate_products';
  end if;
end;
$$;


-- -----------------------------------------------------------------------------
-- 4. Internal relations: no privileges for the public roles
-- -----------------------------------------------------------------------------
-- Queue internals, import audit rows, click logs, programme and category
-- records. None is read by the browser: catalogue reads go through the view, and
-- programme/category content is served from seed data
-- (getPrograms()/getCategories() in src/lib/catalogue.ts never touch Supabase).
-- Existing RLS on these tables is retained as defence in depth, but it is not
-- the control -- RLS is evaluated only after the table-level privilege check
-- passes, and it cannot restrict TRUNCATE.
--
-- Names are listed explicitly and guarded with to_regclass, so this block is
-- itself the audit record of what was reviewed.

do $$
declare
  internal_relations constant text[] := array[
    'affiliate_programs',
    'affiliate_categories',
    'admitad_import_runs',
    'admitad_import_errors',
    'affiliate_clicks',
    'product_model_jobs'
  ];
  relation text;
begin
  foreach relation in array internal_relations
  loop
    if to_regclass('public.' || relation) is null then
      continue;
    end if;

    execute format(
      'revoke all on public.%I from public, anon, authenticated',
      relation);
  end loop;
end;
$$;


-- -----------------------------------------------------------------------------
-- 5. TRUNCATE / REFERENCES / TRIGGER, schema-wide
-- -----------------------------------------------------------------------------
-- TRUNCATE bypasses RLS entirely. REFERENCES and TRIGGER are schema-owner
-- concerns and are never needed by a request-serving role. "all tables in
-- schema public" covers views without error.

revoke truncate, references, trigger on all tables in schema public
  from public, anon, authenticated;


-- -----------------------------------------------------------------------------
-- 6. MAINTAIN, PostgreSQL 17+
-- -----------------------------------------------------------------------------
-- REVOKE ALL above already covers MAINTAIN, because ALL means every privilege
-- the server knows about. This is repeated explicitly so the intent is greppable
-- and a reviewer can see MAINTAIN was considered rather than inherited.

do $$
begin
  if current_setting('server_version_num')::int >= 170000 then
    execute 'revoke maintain on all tables in schema public from public, anon, authenticated';
  end if;
end;
$$;


-- -----------------------------------------------------------------------------
-- 7. Sequences
-- -----------------------------------------------------------------------------
-- USAGE on a sequence lets a public role consume values and read the current
-- one, which leaks insert counts. No sequence in public is used by a public role
-- today (ids are UUIDs), but a future bigserial column must not become public by
-- inheritance.

revoke all on all sequences in schema public from public, anon, authenticated;


-- -----------------------------------------------------------------------------
-- 8. Fail-closed default privileges
-- -----------------------------------------------------------------------------
-- Nothing is granted. For each creator role: delete the default-ACL entry at
-- both the global and schema scope, for tables and sequences, leaving
-- PostgreSQL's built-in fail-closed behaviour.
--
-- postgres is the actual Fyndra migration role and MUST succeed; a failure there
-- is raised. Every other role is best-effort: a 42501 is recorded and reported,
-- never assumed away.

do $$
declare
  creator      record;
  managed      text[] := array[]::text[];
  unmanageable text[] := array[]::text[];
  offenders    text;
  remaining    text;
begin
  for creator in
    select d.defaclrole::regrole::text as role_name
      from pg_default_acl d
     group by d.defaclrole
    union
    select current_user::regrole::text
    union
    select 'postgres'
   where exists (select 1 from pg_roles where rolname = 'postgres' or rolname = current_user)
  loop
    begin
      execute format(
        'alter default privileges for role %I revoke all on tables from public, anon, authenticated',
        creator.role_name);
      execute format(
        'alter default privileges for role %I revoke all on sequences from public, anon, authenticated',
        creator.role_name);
      execute format(
        'alter default privileges for role %I in schema public revoke all on tables from public, anon, authenticated',
        creator.role_name);
      execute format(
        'alter default privileges for role %I in schema public revoke all on sequences from public, anon, authenticated',
        creator.role_name);

      managed := managed || creator.role_name;
    exception
      when insufficient_privilege then
        if creator.role_name in (current_user::regrole::text, 'postgres') then
          raise exception
            'cannot change default privileges for the migration role % (42501); fail-closed defaults were not established',
            creator.role_name;
        end if;

        unmanageable := unmanageable || creator.role_name;
        raise warning
          'default privileges for reserved role % cannot be changed by % (42501); objects it creates may still be born visible to anon/authenticated -- platform fix required',
          creator.role_name, current_user;
    end;
  end loop;

  -- Assert only over the roles actually managed. Assuming every creator role is
  -- changeable is exactly the mistake this block exists to avoid.
  select string_agg(
           format('%s:%s:%s',
                  coalesce(d.defaclnamespace::regnamespace::text, 'GLOBAL'),
                  d.defaclrole::regrole::text,
                  a.privilege_type),
           ', ' order by 1)
    into offenders
    from pg_default_acl d
    cross join lateral aclexplode(d.defaclacl) as a
   where d.defaclobjtype in ('r', 'S')
     and (d.defaclnamespace = 0 or d.defaclnamespace = 'public'::regnamespace)
     and a.grantee <> 0
     and a.grantee in ('anon'::regrole, 'authenticated'::regrole)
     and d.defaclrole::regrole::text = any(managed);

  if offenders is not null then
    raise exception
      'default privileges still grant to a public role after hardening: %', offenders;
  end if;

  if array_length(unmanageable, 1) is not null then
    select string_agg(
             format('%s:%s:%s',
                    coalesce(d.defaclnamespace::regnamespace::text, 'GLOBAL'),
                    d.defaclrole::regrole::text,
                    a.privilege_type),
             ', ' order by 1)
      into remaining
      from pg_default_acl d
      cross join lateral aclexplode(d.defaclacl) as a
     where d.defaclobjtype in ('r', 'S')
       and (d.defaclnamespace = 0 or d.defaclnamespace = 'public'::regnamespace)
       and a.grantee <> 0
       and a.grantee in ('anon'::regrole, 'authenticated'::regrole)
       and d.defaclrole::regrole::text = any(unmanageable);

    if remaining is not null then
      raise warning
        'unmanaged default privileges remain (reserved role, platform fix required): %', remaining;
    end if;
  end if;

  raise notice 'default privileges hardened for: %',
    coalesce(array_to_string(managed, ', '), '(none)');
end;
$$;


-- -----------------------------------------------------------------------------
-- 9. Extension-owned objects in public
-- -----------------------------------------------------------------------------
-- An extension installed into schema public (rather than the dedicated
-- `extensions` schema) brings its own relations and functions, and Supabase's
-- default privileges may have granted the public roles access to them. This does
-- NOT revoke those automatically: an extension-owned object may be a supported
-- API surface, and revoking blindly would be a reliability change disguised as a
-- hardening change. It reports them so a reviewer can decide.
--
-- Recommendation, recorded here and in docs/DATABASE-SCHEMA.md: install
-- extensions into `extensions` (create extension ... with schema extensions) so
-- they are outside the exposed schema entirely. `alter extension ... set schema`
-- can move an existing extension when the extension supports it.

do $$
declare
  owned text;
begin
  select string_agg(
           format('%s (extension %s)', c.relname, e.extname),
           ', ' order by c.relname)
    into owned
    from pg_depend dep
    join pg_class c on c.oid = dep.objid
    join pg_namespace n on n.oid = c.relnamespace
    join pg_extension e on e.oid = dep.refobjid
   where dep.classid = 'pg_class'::regclass
     and dep.refclassid = 'pg_extension'::regclass
     and dep.deptype = 'e'
     and n.nspname = 'public';

  if owned is not null then
    raise warning
      'extension-owned relations live in schema public: % -- consider installing into the extensions schema',
      owned;
  else
    raise notice 'no extension-owned relations found in schema public';
  end if;
end;
$$;


-- -----------------------------------------------------------------------------
-- 10. Audit trail
-- -----------------------------------------------------------------------------
-- Emits the post-migration privilege set for the public roles, one line per
-- relation, into the migration log. A relation this migration never reviewed is
-- reported as UNREVIEWED rather than revoked silently, so grants added by a
-- later reviewed migration are not clobbered by a re-run.

do $$
declare
  reviewed constant text[] := array[
    'affiliate_products',
    'affiliate_programs',
    'affiliate_categories',
    'admitad_import_runs',
    'admitad_import_errors',
    'affiliate_clicks',
    'product_model_jobs',
    'catalogue_products'
  ];
  rel        record;
  held       text;
  summary    text := '';
  unreviewed text[] := array[]::text[];
begin
  for rel in
    select c.oid, c.relname
      from pg_class c
      join pg_namespace n on n.oid = c.relnamespace
     where n.nspname = 'public'
       and c.relkind in ('r', 'p', 'v', 'm', 'f')
     order by c.relname
  loop
    select coalesce(string_agg(a.privilege_type, '/' order by a.privilege_type), 'none')
      into held
      from aclexplode((select relacl from pg_class where oid = rel.oid)) as a
     where a.grantee <> 0
       and a.grantee in ('anon'::regrole, 'authenticated'::regrole);

    summary := summary
      || format('%s anon+authenticated=%s', rel.relname, coalesce(held, 'none'))
      || chr(10);

    if not (rel.relname = any(reviewed)) then
      unreviewed := unreviewed || rel.relname;
    end if;
  end loop;

  raise notice 'public privileges after lockdown:%', chr(10) || summary;

  if array_length(unreviewed, 1) is not null then
    raise warning
      'UNREVIEWED public relations (not in this migration''s allowlist): %',
      array_to_string(unreviewed, ', ');
  end if;
end;
$$;


-- -----------------------------------------------------------------------------
-- 11. Self-check
-- -----------------------------------------------------------------------------
-- Raises (does not warn) if any invariant is violated, so a partially applied
-- migration cannot masquerade as a hardened one.

do $$
declare
  internal_relations constant text[] := array[
    'affiliate_programs',
    'affiliate_categories',
    'admitad_import_runs',
    'admitad_import_errors',
    'affiliate_clicks',
    'product_model_jobs'
  ];
  write_privileges constant text[] := array[
    'INSERT', 'UPDATE', 'DELETE', 'TRUNCATE', 'REFERENCES', 'TRIGGER'
  ];
  all_privileges constant text[] := array[
    'SELECT', 'INSERT', 'UPDATE', 'DELETE', 'TRUNCATE', 'REFERENCES', 'TRIGGER'
  ];
  offenders   text;
  relation    text;
  privilege   text;
  version_num int := current_setting('server_version_num')::int;
  invoker     text;
begin
  -- (a) the view must run as the caller
  select option_value
    into invoker
    from pg_options_to_table(
           (select reloptions from pg_class
             where oid = 'public.catalogue_products'::regclass))
   where option_name = 'security_invoker';

  if coalesce(invoker, 'false') <> 'true' then
    raise exception
      'catalogue_products is not security_invoker = true (got %)', coalesce(invoker, 'unset');
  end if;

  -- (b) public roles hold nothing on the view except SELECT
  select string_agg(format('%s:%s', r.role, p.priv), ', ' order by 1, 2)
    into offenders
    from (values ('anon'), ('authenticated')) as r(role)
    cross join (values ('INSERT'), ('UPDATE'), ('DELETE'), ('TRUNCATE'), ('REFERENCES'), ('TRIGGER')) as p(priv)
   where has_table_privilege(r.role, 'public.catalogue_products', p.priv);

  if offenders is not null then
    raise exception 'catalogue_products still grants write privileges to: %', offenders;
  end if;

  -- (c) the public read still works
  if not has_table_privilege('anon', 'public.catalogue_products', 'SELECT')
     or not has_table_privilege('authenticated', 'public.catalogue_products', 'SELECT') then
    raise exception 'catalogue_products is no longer readable by anon/authenticated';
  end if;

  -- (d) PUBLIC holds nothing on the view
  select string_agg(a.privilege_type, ', ' order by a.privilege_type)
    into offenders
    from pg_class c
    cross join lateral aclexplode(c.relacl) as a
   where c.oid = 'public.catalogue_products'::regclass
     and a.grantee = 0;

  if offenders is not null then
    raise exception 'catalogue_products grants privileges to PUBLIC: %', offenders;
  end if;

  -- (e) the base table has no table-level SELECT, and no write privileges at all
  select string_agg(format('%s:%s', r.role, p.priv), ', ' order by 1, 2)
    into offenders
    from (values ('anon'), ('authenticated')) as r(role)
    cross join (values ('SELECT'), ('INSERT'), ('UPDATE'), ('DELETE'),
                       ('TRUNCATE'), ('REFERENCES'), ('TRIGGER')) as p(priv)
   where has_table_privilege(r.role, 'public.affiliate_products', p.priv);

  if offenders is not null then
    raise exception 'affiliate_products still grants table-level privileges to: %', offenders;
  end if;

  -- (f) every internal relation denies every privilege to the public roles
  foreach relation in array internal_relations
  loop
    if to_regclass('public.' || relation) is null then
      continue;
    end if;

    foreach privilege in array all_privileges
    loop
      if has_table_privilege('anon', 'public.' || relation, privilege)
         or has_table_privilege('authenticated', 'public.' || relation, privilege) then
        raise exception
          'public role still holds % on internal relation public.%', privilege, relation;
      end if;
    end loop;

    select string_agg(a.privilege_type, ', ' order by a.privilege_type)
      into offenders
      from pg_class c
      cross join lateral aclexplode(c.relacl) as a
     where c.oid = to_regclass('public.' || relation)
       and a.grantee = 0;

    if offenders is not null then
      raise exception
        'internal relation public.% grants privileges to PUBLIC: %', relation, offenders;
    end if;
  end loop;

  -- (g) TRUNCATE absent everywhere
  select string_agg(format('%s:%s', r.role, c.relname), ', ' order by 2, 1)
    into offenders
    from (values ('anon'), ('authenticated')) as r(role)
    cross join lateral (
      select c.oid, c.relname
        from pg_class c
        join pg_namespace n on n.oid = c.relnamespace
       where n.nspname = 'public'
         and c.relkind = 'r'
         and has_table_privilege(r.role, c.oid, 'TRUNCATE')
    ) as c;

  if offenders is not null then
    raise exception 'TRUNCATE is still granted to a public role on: %', offenders;
  end if;

  -- (h) MAINTAIN absent wherever the server supports it
  if version_num >= 170000 then
    select string_agg(format('%s:%s', r.role, c.relname), ', ' order by 2, 1)
      into offenders
      from (values ('anon'), ('authenticated')) as r(role)
      cross join lateral (
        select c.oid, c.relname
          from pg_class c
          join pg_namespace n on n.oid = c.relnamespace
         where n.nspname = 'public'
           and c.relkind = 'r'
           and has_table_privilege(r.role, c.oid, 'MAINTAIN')
      ) as c;

    if offenders is not null then
      raise exception 'MAINTAIN is still granted to a public role on: %', offenders;
    end if;
  end if;

  -- (i) service_role must keep full access on both the view and the base table
  foreach privilege in array write_privileges
  loop
    if not has_table_privilege('service_role', 'public.catalogue_products', privilege)
       or not has_table_privilege('service_role', 'public.affiliate_products', privilege) then
      raise exception
        'service_role lost %; imports, the 3D worker or click logging would break', privilege;
    end if;
  end loop;
end;
$$;
