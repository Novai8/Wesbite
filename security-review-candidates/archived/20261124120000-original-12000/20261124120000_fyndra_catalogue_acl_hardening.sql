-- Close the anonymous/authenticated write path into public.catalogue_products
-- and remove TRUNCATE-class privileges from the public roles, for existing and
-- future objects alike.
--
-- Why this is urgent
-- ------------------
-- catalogue_products is a plain single-table view, so PostgreSQL treats it as
-- auto-updatable: INSERT/UPDATE/DELETE against the view are rewritten into the
-- same statement against public.affiliate_products (rewrite rule _RETURN).
-- The view is owned by postgres, and postgres has rolbypassrls = true, so the
-- rewrite runs as the owner rather than as the caller.
--
-- Supabase's default privileges in the public schema are
--   grant all on tables to anon, authenticated, service_role
-- and those defaults apply to views as well as to tables. The 3D migration
-- added "grant select on public.catalogue_products to anon, authenticated" but
-- never revoked the inherited arwdDxtm grant, so the effective ACL stayed
-- anon=arwdDxtm/postgres. GRANT is add-only in PostgreSQL; it cannot narrow an
-- existing grant.
--
-- Together those facts meant this succeeded:
--
--   begin; set local role anon;
--   delete from public.catalogue_products where true;
--   commit;
--
-- which destroyed every approved product row. The same statement is reachable
-- over PostgREST with the public anon key that ships in the browser bundle.
-- Revoking on the base table did not help: the caller never touches the base
-- table, the view owner does.
--
-- What this migration does
-- ------------------------
--   1. catalogue_products becomes SELECT-only for anon/authenticated. Because
--      GRANT cannot subtract, the inherited grant must be revoked.
--   2. anon/authenticated lose TRUNCATE, REFERENCES and TRIGGER on every table
--      in public. TRUNCATE is not filtered by RLS at all, so where it is
--      granted it is strictly worse than DELETE. REFERENCES and TRIGGER are
--      only needed by the schema owner.
--   3. New objects get exactly SELECT for anon/authenticated, so a future
--      auto-updatable view cannot reintroduce the same hole.
--
-- Default privileges: global and schema-scoped entries are UNIONED
-- ----------------------------------------------------------------
-- "alter default privileges ... in schema public revoke all" does NOT cancel a
-- global "alter default privileges grant all". Measured on PostgreSQL 18: with
-- a global grant-all in place, a schema-scoped revoke has no effect on newly
-- created objects, because the global and schema-scoped default-ACL entries are
-- unioned. A schema-scoped revoke on its own would look correct and silently do
-- nothing.
--
-- Note also that a targeted "revoke insert, update, delete" leaves MAINTAIN
-- behind on PostgreSQL 17+, so the itemised ACL is still NOT select-only. The
-- revokes here are therefore "revoke all", followed by an explicit
-- "grant select", at BOTH scopes. Revoking a privilege a default-ACL entry does
-- not contain is a no-op, so the global statements are harmless on a cluster
-- that only has schema-scoped defaults.
--
-- Idempotent and additive: every statement is revoke-then-grant. No row,
-- column, policy, function or trigger is modified, and re-running is a no-op.
--
-- Deliberately NOT changed here: service_role keeps arwdDxtm (imports, the 3D
-- worker and click logging all use the service-role key), and the
-- security_invoker = false design of the view stays as-is. Switching it to
-- security_invoker = true would be a regression: anon has no SELECT on the base
-- table, so every public catalogue read would fail with 42501.

-- ---------------------------------------------------------------------------
-- 1. catalogue_products: SELECT-only for the public roles
-- ---------------------------------------------------------------------------
-- Revoke first: a grant alone would leave DELETE in place.

revoke all on public.catalogue_products from anon, authenticated;
grant select on public.catalogue_products to anon, authenticated;

-- ---------------------------------------------------------------------------
-- 2. TRUNCATE / REFERENCES / TRIGGER on existing objects
-- ---------------------------------------------------------------------------
-- "all tables in schema public" also covers views without error; a view simply
-- has no TRUNCATE privilege to lose.

revoke truncate, references, trigger on all tables in schema public from anon, authenticated;
revoke truncate, references, trigger on all tables in schema public from public;

-- ---------------------------------------------------------------------------
-- 3. Default privileges for future objects: SELECT-only for public roles
-- ---------------------------------------------------------------------------
-- Global scope first: this is the entry a bare "alter default privileges"
-- creates, and the one a schema-scoped revoke cannot subtract from.

alter default privileges revoke all on tables from anon, authenticated;
alter default privileges revoke all on tables from public;
alter default privileges grant select on tables to anon, authenticated;

-- Then the schema-scoped entry for public, so the union of both scopes yields
-- exactly select for the public roles.

alter default privileges in schema public revoke all on tables from anon, authenticated;
alter default privileges in schema public revoke all on tables from public;
alter default privileges in schema public grant select on tables to anon, authenticated;

-- ---------------------------------------------------------------------------
-- 4. Self-check
-- ---------------------------------------------------------------------------
-- Raises (not warns) if an invariant is still violated, so a partially applied
-- migration cannot masquerade as a fixed one.

do $$
declare
  offenders text;
begin
  -- (a) no public role may hold a non-SELECT privilege on the view
  select string_agg(format('%s:%s', r.role, p.priv), ', ' order by r.role, p.priv)
    into offenders
    from (values ('anon'), ('authenticated')) as r(role)
    cross join (values ('INSERT'), ('UPDATE'), ('DELETE'), ('TRUNCATE'), ('REFERENCES'), ('TRIGGER')) as p(priv)
   where has_table_privilege(r.role, 'public.catalogue_products', p.priv);

  if offenders is not null then
    raise exception 'catalogue_products still grants write privileges to: %', offenders;
  end if;

  -- (b) public roles must still be able to read the catalogue
  if not has_table_privilege('anon', 'public.catalogue_products', 'SELECT')
     or not has_table_privilege('authenticated', 'public.catalogue_products', 'SELECT') then
    raise exception 'catalogue_products is no longer readable by anon/authenticated';
  end if;

  -- (c) no public role may hold TRUNCATE on any table in public
  select string_agg(format('%s:%s', r.role, c.relname), ', ' order by c.relname)
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

  -- (d) neither default-ACL scope may hand a public role anything but SELECT.
  --     Checked directly against pg_default_acl, because creating a probe table
  --     inside this function would be a side effect the migration must not have.
  select string_agg(format('%s:%s:%s', coalesce(d.defaclnamespace::regnamespace::text, 'GLOBAL'), a.grantee::regrole, a.privilege_type), ', ')
    into offenders
    from pg_default_acl d
    cross join lateral aclexplode(d.defaclacl) as a
   where d.defaclobjtype = 'r'
     and (d.defaclnamespace = 0 or d.defaclnamespace = 'public'::regnamespace)
     and a.grantee in ('anon'::regrole, 'authenticated'::regrole)
     and a.privilege_type <> 'SELECT';

  if offenders is not null then
    raise exception 'default privileges still grant a non-SELECT privilege: %', offenders;
  end if;
end;
$$;
