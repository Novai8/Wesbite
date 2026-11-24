-- =============================================================================
-- Fyndra: catalogue ACL hardening, fail-closed
--
-- Depends on 0001_admitad_integration.sql and
-- 20261123150000_fyndra_3d_models.sql. Purely additive: it changes privileges
-- only. No table, column, row, policy, trigger or function is created or
-- dropped.
--
-- -----------------------------------------------------------------------------
-- The vulnerability this closes
-- -----------------------------------------------------------------------------
-- public.catalogue_products is a simple single-table view, so PostgreSQL makes
-- it auto-updatable: INSERT/UPDATE/DELETE written against the view are
-- rewritten into the same statement against public.affiliate_products
-- (rewrite rule _RETURN). The view is owned by the migration role, which has
-- rolbypassrls, so the rewrite is privilege-checked as the OWNER and RLS on the
-- base table is never consulted for the caller.
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
-- Policy: fail-closed
-- -----------------------------------------------------------------------------
-- anon and authenticated get exactly one thing in schema public: SELECT on
-- catalogue_products. Every other relation is invisible to them, and new
-- objects are not born visible. Access is granted explicitly, per reviewed
-- resource, in a migration that says so.
--
-- This deliberately removes the previous "future tables are SELECT-only by
-- default" rule. A default SELECT is an un-reviewed grant to whatever table a
-- future migration happens to create; it is not a safe resting state.
--
-- RLS policies are left in place on the internal tables. They are not a
-- substitute for the grant -- RLS is row-level and cannot restrict TRUNCATE at
-- all -- but they remain a correct second line of defence if a grant is ever
-- reintroduced by mistake.
--
-- -----------------------------------------------------------------------------
-- Default privileges: what is actually reachable
-- -----------------------------------------------------------------------------
-- PostgreSQL's built-in default is already fail-closed: a new table grants
-- nothing to PUBLIC or to anon/authenticated. The exposure comes only from
-- per-role entries in pg_default_acl, which is what Supabase (and the previous
-- revision of this migration) added. So the fix is to delete those entries.
--
-- Two hard constraints learned from measurement on PostgreSQL 17 and 18:
--
--   1. Global and schema-scoped default-ACL entries are UNIONED. A
--      schema-scoped "revoke all" does NOT cancel a global "grant all"; it
--      silently does nothing. Both scopes must be revoked.
--
--   2. ALTER DEFAULT PRIVILEGES FOR ROLE x requires being a member of x (or
--      being superuser); otherwise it fails with 42501. On Supabase the
--      migration role is normally "postgres" and is NOT a member of
--      "supabase_admin", so supabase_admin's entries cannot be changed from
--      here. The loop below is best-effort per creator role and records what it
--      could not reach instead of failing the whole migration.
--
-- Residual risk, stated plainly: objects created by supabase_admin (or any
-- other role this migration cannot manage) may still be born with permissive
-- grants. That is a platform-level gap. It must be closed at the platform level
-- -- by asking Supabase to run the equivalent ALTER DEFAULT PRIVILEGES as
-- supabase_admin, or by granting this migration role membership in
-- supabase_admin -- not by widening this migration. Until then, every
-- relation created outside the managed roles needs the explicit revoke block
-- below re-checked by whoever reviews that migration.
--
-- -----------------------------------------------------------------------------
-- MAINTAIN (PostgreSQL 17+)
-- -----------------------------------------------------------------------------
-- MAINTAIN is new in 17 and is not implied by any other privilege. It allows
-- VACUUM, ANALYZE, CLUSTER, REINDEX, REFRESH MATERIALIZED VIEW and LOCK TABLE.
-- LOCK TABLE is the dangerous part: a role holding MAINTAIN can take ACCESS
-- EXCLUSIVE on a table and block every reader. It is a denial-of-service
-- primitive, and supabase's default grants included it (arwdDxtm). It is
-- absent on 16 and earlier, where the revoke would be a syntax error, so every
-- MAINTAIN statement is gated on server_version_num >= 170000.
--
-- -----------------------------------------------------------------------------
-- Idempotency
-- -----------------------------------------------------------------------------
-- Every statement is revoke-then-grant or a catalog-guarded loop. Re-running is
-- a no-op. The relation list is explicit rather than "everything not
-- allowlisted", so re-running this migration after a later, reviewed grant
-- cannot silently revoke that later grant.
-- =============================================================================


-- -----------------------------------------------------------------------------
-- 0. Preflight
-- -----------------------------------------------------------------------------
-- Fail with an actionable message rather than a bare "relation does not exist"
-- if this is applied before the migration that creates the view.

do $$
begin
  if to_regclass('public.catalogue_products') is null then
    raise exception
      'public.catalogue_products is missing: apply 20261123150000_fyndra_3d_models.sql first';
  end if;
end;
$$;


-- -----------------------------------------------------------------------------
-- 1. The one approved public surface
-- -----------------------------------------------------------------------------
-- catalogue_products: SELECT for anon and authenticated, nothing else. The
-- revoke comes first because GRANT cannot subtract; revoking from PUBLIC too,
-- so the read does not also ride on an implicit PUBLIC grant.

revoke all on public.catalogue_products from anon, authenticated, public;
grant select on public.catalogue_products to anon, authenticated;


-- -----------------------------------------------------------------------------
-- 2. Internal relations: no privileges for the public roles
-- -----------------------------------------------------------------------------
-- Queue internals, import audit rows, click logs, the research-bearing products
-- table, programme and category records. None of these is read by the browser
-- directly; catalogue reads go through the view and programme/category data is
-- served from seed content. RLS existing on a table is not a reason for the
-- table to be reachable: RLS filters rows, it does not gate TRUNCATE, and it is
-- evaluated only after the table-level privilege check passes.
--
-- Names are listed explicitly (and guarded with to_regclass) so this block is
-- itself an audit record of what was reviewed. A relation added later must be
-- reviewed on its own migration's terms.

do $$
declare
  internal_relations constant text[] := array[
    'affiliate_products',
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
      'revoke all on public.%I from anon, authenticated, public',
      relation);
  end loop;
end;
$$;


-- -----------------------------------------------------------------------------
-- 3. MAINTAIN on existing tables (PostgreSQL 17+)
-- -----------------------------------------------------------------------------
-- REVOKE ALL above already covers MAINTAIN, since ALL means all privileges the
-- server knows about. This is repeated explicitly so the intent is greppable and
-- so a reviewer can see MAINTAIN was considered rather than inherited by
-- accident. Guarded because the keyword does not exist before 17.

do $$
begin
  if current_setting('server_version_num')::int >= 170000 then
    execute 'revoke maintain on all tables in schema public from anon, authenticated, public';
  end if;
end;
$$;


-- -----------------------------------------------------------------------------
-- 4. Sequences
-- -----------------------------------------------------------------------------
-- A public role holding USAGE on a sequence can advance it and read its current
-- value, which leaks insert counts. No sequence in public is read by a public
-- role today; the id columns are UUIDs, so nothing here uses a sequence. Revoke
-- anyway so the next serial column does not become public by inheritance.

revoke all on all sequences in schema public from anon, authenticated, public;


-- -----------------------------------------------------------------------------
-- 5. Future objects: fail-closed default privileges, best effort per role
-- -----------------------------------------------------------------------------
-- Targets every role that already owns a default-ACL entry, plus the role
-- running this migration. For each: delete the entry at BOTH the global and the
-- schema scope, for tables and for sequences. Nothing is re-granted, so the
-- result is PostgreSQL's built-in fail-closed behaviour.
--
-- A role whose defaults cannot be changed (42501, e.g. supabase_admin when
-- running as postgres) is recorded and reported as a warning. It is NOT treated
-- as a migration failure, because failing here would leave the rest of the
-- hardening unapplied and would still not fix supabase_admin's entries.

do $$
declare
  creator       record;
  managed       text[] := array[]::text[];
  unmanageable  text[] := array[]::text[];
  offender      text;
  remaining     text;
begin
  for creator in
    select d.defaclrole::regrole::text as role_name
      from pg_default_acl d
     group by d.defaclrole
    union
    select current_user::regrole::text
  loop
    begin
      -- global scope
      execute format(
        'alter default privileges for role %I revoke all on tables from anon, authenticated, public',
        creator.role_name);
      execute format(
        'alter default privileges for role %I revoke all on sequences from anon, authenticated, public',
        creator.role_name);

      -- schema scope for public
      execute format(
        'alter default privileges for role %I in schema public revoke all on tables from anon, authenticated, public',
        creator.role_name);
      execute format(
        'alter default privileges for role %I in schema public revoke all on sequences from anon, authenticated, public',
        creator.role_name);

      managed := managed || creator.role_name;
    exception
      when insufficient_privilege then
        unmanageable := unmanageable || creator.role_name;
        raise warning
          'default privileges for role % cannot be changed by % (42501); objects % creates may still be born visible to anon/authenticated',
          creator.role_name, current_user, creator.role_name;
    end;
  end loop;

  -- Assert only over the roles actually managed. Assuming every creator role is
  -- manageable is exactly the mistake this block exists to avoid.
  select string_agg(
           format('%s:%s:%s',
                  coalesce(d.defaclnamespace::regnamespace::text, 'GLOBAL'),
                  d.defaclrole::regrole::text,
                  a.privilege_type),
           ', ' order by 1)
    into offender
    from pg_default_acl d
    cross join lateral aclexplode(d.defaclacl) as a
   where d.defaclobjtype in ('r', 'S')
     and (d.defaclnamespace = 0 or d.defaclnamespace = 'public'::regnamespace)
     and a.grantee <> 0
     and a.grantee in ('anon'::regrole, 'authenticated'::regrole)
     and d.defaclrole::regrole::text = any(managed);

  if offender is not null then
    raise exception
      'default privileges still grant to a public role after hardening: %', offender;
  end if;

  -- Same query restricted to the roles that could not be touched, reported but
  -- not raised.
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
        'unmanaged default privileges remain (platform fix required): %', remaining;
    end if;
  end if;

  raise notice 'default privileges hardened for: %', coalesce(array_to_string(managed, ', '), '(none)');
end;
$$;


-- -----------------------------------------------------------------------------
-- 6. Audit trail
-- -----------------------------------------------------------------------------
-- Emits the post-migration privilege set for the public roles, one line per
-- relation, into the migration log. This is the record a reviewer reads; the
-- self-check below is what actually enforces it.
--
-- Any public relation that is neither catalogue_products nor in the reviewed
-- list above is reported as UNREVIEWED. It is not revoked automatically --
-- that would make this migration destructive toward grants added by a later,
-- reviewed migration -- but it must not pass silently.

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
  rel      record;
  held     text;
  summary  text := '';
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

  raise notice 'public privileges after hardening:%', chr(10) || summary;

  if array_length(unreviewed, 1) is not null then
    raise warning
      'UNREVIEWED public relations (not in this migration''s allowlist): %',
      array_to_string(unreviewed, ', ');
  end if;
end;
$$;


-- -----------------------------------------------------------------------------
-- 7. Self-check
-- -----------------------------------------------------------------------------
-- Raises (does not warn) if any invariant is violated, so a partially applied
-- migration cannot masquerade as a hardened one.

do $$
declare
  internal_relations constant text[] := array[
    'affiliate_products',
    'affiliate_programs',
    'affiliate_categories',
    'admitad_import_runs',
    'admitad_import_errors',
    'affiliate_clicks',
    'product_model_jobs'
  ];
  all_privileges constant text[] := array[
    'SELECT', 'INSERT', 'UPDATE', 'DELETE', 'TRUNCATE', 'REFERENCES', 'TRIGGER'
  ];
  offenders   text;
  relation    text;
  privilege   text;
  version_num int := current_setting('server_version_num')::int;
begin
  -- (a) anon/authenticated hold nothing on the view except SELECT
  select string_agg(format('%s:%s', r.role, p.priv), ', ' order by 1, 2)
    into offenders
    from (values ('anon'), ('authenticated')) as r(role)
    cross join (values ('INSERT'), ('UPDATE'), ('DELETE'), ('TRUNCATE'), ('REFERENCES'), ('TRIGGER')) as p(priv)
   where has_table_privilege(r.role, 'public.catalogue_products', p.priv);

  if offenders is not null then
    raise exception 'catalogue_products still grants write privileges to: %', offenders;
  end if;

  -- (b) the public read still works
  if not has_table_privilege('anon', 'public.catalogue_products', 'SELECT')
     or not has_table_privilege('authenticated', 'public.catalogue_products', 'SELECT') then
    raise exception 'catalogue_products is no longer readable by anon/authenticated';
  end if;

  -- (c) PUBLIC holds nothing on the view
  select string_agg(a.privilege_type, ', ' order by a.privilege_type)
    into offenders
    from pg_class c
    cross join lateral aclexplode(c.relacl) as a
   where c.oid = 'public.catalogue_products'::regclass
     and a.grantee = 0;

  if offenders is not null then
    raise exception 'catalogue_products grants privileges to PUBLIC: %', offenders;
  end if;

  -- (d) every internal relation denies every privilege to the public roles
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

    -- PUBLIC, including MAINTAIN, checked through the ACL because PUBLIC is not
    -- a role name has_table_privilege accepts.
    select string_agg(a.privilege_type, ', ' order by a.privilege_type)
      into offenders
      from pg_class c
      cross join lateral aclexplode(c.relacl) as a
     where c.oid = to_regclass('public.' || relation)
       and a.grantee = 0;

    if offenders is not null then
      raise exception
        'public grants privileges to PUBLIC on internal relation public.%: %',
        relation, offenders;
    end if;
  end loop;

  -- (e) TRUNCATE is unfiltered by RLS, so it must be absent everywhere
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

  -- (f) MAINTAIN absent wherever the server supports it
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
end;
$$;
