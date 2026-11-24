"""
Access-control regression tests for the consolidated public-ACL lockdown.

Two layers, both permanent:

1. Static contract tests parse the shipped migration text. They run everywhere
   (no server, no Docker) and fail if a future edit silently widens the
   boundary -- for example by dropping the event trigger, re-granting a write
   privilege, or reverting the view to security_invoker = false.

2. Live database tests run the REAL migration files against a disposable
   PostgreSQL database, because the defect lived in the interaction between
   Supabase's default privileges and the 3D migration's `grant select` on the
   view. A hand-written fixture would reproduce whatever the fixture author
   believed rather than what actually ships.

What is under test
------------------
    begin; set local role anon;
    delete from public.catalogue_products where true;
    commit;

succeeded because the view is auto-updatable and owned by a role that also owns
the base table. A table's owner is exempt from the table's own RLS policies, so
the rewrite ran with RLS bypassed and `products_read_approved` never applied.

Connection
----------
Standard libpq environment variables are honoured:

    PGHOST PGPORT PGUSER PGPASSWORD PGDATABASE

The live tests need a role that can CREATE DATABASE, CREATE ROLE, CREATE EVENT
TRIGGER and ALTER DEFAULT PRIVILEGES -- a superuser satisfies all of these.
Each test class creates a uniquely named database, never touches an existing
one, and drops it afterwards. Live tests skip automatically when no server is
reachable, so `python -m unittest discover` stays green on a bare checkout.

Run: python -m unittest tests.test_catalogue_acl_lockdown -v
"""

from __future__ import annotations

import os
import pathlib
import re
import subprocess
import unittest
import uuid

MIGRATIONS = pathlib.Path(__file__).resolve().parents[1] / "supabase" / "migrations"

# Applied in this order, exactly as the repo ships them.
BASE_MIGRATIONS = [
    "0001_admitad_integration.sql",
    "20261123150000_fyndra_3d_models.sql",
    "20261124090000_fyndra_function_search_path.sql",
]
LOCKDOWN_FILE = "20261124130000_fyndra_public_acl_lockdown.sql"

# Local stand-in for the Supabase baseline. The default-privilege line is what
# makes the vulnerability reproduce at all: without it anon has no write grant.


BASELINE_SQL = """
do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'anon') then
    create role anon nologin noinherit;
  end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then
    create role authenticated nologin noinherit;
  end if;
  if not exists (select 1 from pg_roles where rolname = 'service_role') then
    create role service_role nologin noinherit bypassrls;
  end if;
end;
$$;
grant usage on schema public to anon, authenticated, service_role;
create schema if not exists storage;
grant usage on schema storage to anon, authenticated, service_role;
create table if not exists storage.buckets (
  id text primary key,
  name text not null,
  public boolean not null default false,
  file_size_limit bigint,
  allowed_mime_types text[],
  created_at timestamptz not null default now()
);
create table if not exists storage.objects (
  id uuid primary key default gen_random_uuid(),
  bucket_id text not null references storage.buckets (id),
  name text not null,
  owner uuid,
  created_at timestamptz not null default now()
);
alter table storage.objects enable row level security;
grant all on all tables in schema storage to service_role;
alter default privileges in schema public grant all on tables
  to anon, authenticated, service_role;
"""


SEED_SQL = """
insert into public.affiliate_products
  (id, slug, title, price, currency, approval_status, data_source)
values
  (gen_random_uuid(), 'acl-approved', 'ACL APPROVED', 1, 'USD', 'approved', 'api'),
  (gen_random_uuid(), 'acl-pending',  'ACL PENDING',  2, 'USD', 'pending',  'api');
"""


def _psql_binary() -> str | None:
    name = "psql" + (".exe" if os.name == "nt" else "")
    for directory in os.environ.get("PATH", "").split(os.pathsep):
        candidate = pathlib.Path(directory) / name
        if candidate.is_file():
            return str(candidate)
    return None


def _env() -> dict[str, str]:
    env = {k: v for k, v in os.environ.items() if not k.startswith("PG")}
    for key in ("PGHOST", "PGPORT", "PGUSER", "PGPASSWORD", "PGDATABASE", "PGSSLMODE"):
        if key in os.environ:
            env[key] = os.environ[key]
    return env


def _run(sql: str, *, database: str | None = None, check: bool = True):
    psql = _psql_binary()
    if psql is None:
        raise unittest.SkipTest("psql is not on PATH")
    args = [psql, "-X", "-q", "-A", "-t", "-v", "ON_ERROR_STOP=1"]
    if database:
        args += ["-d", database]
    result = subprocess.run(
        args, input=sql, capture_output=True, text=True, env=_env(), timeout=300
    )
    if check and result.returncode != 0:
        raise AssertionError(f"psql failed: {result.stderr.strip()}")
    return result.returncode, result.stdout, result.stderr


def _scalar(sql: str, *, database: str | None = None) -> str:
    _, out, _ = _run(sql, database=database)
    lines = [line for line in out.splitlines() if line.strip()]
    return lines[-1].strip() if lines else ""


def _apply_file(name: str, database: str) -> None:
    path = MIGRATIONS / name
    if not path.is_file():
        raise AssertionError(f"migration not found: {path}")
    _run(path.read_text(encoding="utf-8"), database=database)


# ===========================================================================
# Static contract tests -- no database required
# ===========================================================================


def migration_sql() -> str:
    return (MIGRATIONS / LOCKDOWN_FILE).read_text(encoding="utf-8")


def executable_sql() -> str:
    """Migration text without comment-only lines.

    Comments legitimately mention the vulnerable statements (they document the
    incident), so assertions must only inspect executable SQL.
    """
    return "\n".join(
        line for line in migration_sql().splitlines()
        if not line.lstrip().startswith("--")
    )


def normalised() -> str:
    return re.sub(r"\s+", " ", executable_sql().lower())


class MigrationIsPresent(unittest.TestCase):
    def test_lockdown_migration_exists(self) -> None:
        self.assertTrue((MIGRATIONS / LOCKDOWN_FILE).is_file(), f"missing {LOCKDOWN_FILE}")

    def test_timestamp_is_unique_among_migrations(self) -> None:
        prefix = LOCKDOWN_FILE.split("_", 1)[0]
        clashes = [
            p.name for p in MIGRATIONS.glob(f"{prefix}_*.sql")
            if p.name != LOCKDOWN_FILE
        ]
        self.assertEqual(clashes, [], f"duplicate migration version {prefix}: {clashes}")

    def test_search_path_migration_stays_separate(self) -> None:
        body = normalised()
        self.assertNotIn("set search_path", body.replace("set search_path = pg_catalog", ""))
        self.assertTrue(
            (MIGRATIONS / "20261124090000_fyndra_function_search_path.sql").is_file()
        )


class MigrationIsForwardOnly(unittest.TestCase):
    def test_no_destructive_statements(self) -> None:
        """Only the migration's own probe objects may be dropped.

        The probe table/view are created and dropped inside the self-check so
        the transaction proves the real defaults; that is the one legitimate
        use of DROP. Nothing that holds application data may be dropped.
        """
        body = normalised()
        body = normalised()
        # Only identifier-shaped targets matter. Dynamic SQL such as
        # "drop table %s" resolves to the probe objects, which are declared
        # below and are safe by construction.
        drops = re.findall(
            r"drop\s+(?:table|view|materialized view|column|schema)\s+(?:if exists\s+)?([a-z_][a-z0-9_.]*)",
            body,
        )
        allowed = {"public.__acl_probe_table", "public.__acl_probe_view", "public.__acl_probe_serial"}
        for target in drops:
            self.assertIn(target, allowed, f"migration must stay additive: drops {target!r}")

        for statement in ("truncate ", "delete from", "alter column", "drop constraint",
                          "drop policy", "drop trigger"):
            self.assertNotIn(statement, body, f"migration must stay additive: found {statement!r}")

    def test_does_not_touch_earlier_migrations(self) -> None:
        """The earlier migrations must exist and must not be rewritten.

        The lockdown only *names* them in preflight error text; it must never
        contain executable SQL that alters or replaces them.
        """
        for name in BASE_MIGRATIONS:
            path = MIGRATIONS / name
            self.assertTrue(path.is_file(), f"missing upstream migration {name}")

        body = normalised()
        for name in BASE_MIGRATIONS:
            for verb in ("alter table", "alter view", "create table", "create view",
                         "create or replace view", "drop table", "drop view"):
                self.assertNotRegex(
                    body, rf"{verb}[^;]*\b{re.escape(name)}",
                    f"lockdown must not {verb} anything in {name}")

    def test_is_idempotent_by_construction(self) -> None:
        """Every non-replaceable statement is guarded by an existence check.

        CREATE EVENT TRIGGER has no IF NOT EXISTS, so it must be preceded by a
        pg_event_trigger lookup that returns early.
        """
        body = normalised()
        self.assertIn("create or replace function public.enforce_public_schema_acl()", body)

        guard = body.index("from pg_event_trigger where evtname = 'enforce_public_schema_acl'")
        create = body.index("create event trigger enforce_public_schema_acl")
        self.assertLess(guard, create, "CREATE EVENT TRIGGER must be existence-guarded")

        # Triggers/policies that DDL cannot re-create must be dropped first.
        self.assertNotRegex(body, r"create trigger (?!.*drop trigger if exists)")


class MigrationSecuresTheView(unittest.TestCase):
    def test_view_becomes_security_invoker(self) -> None:
        body = normalised()
        self.assertIn("alter view public.catalogue_products set (security_invoker = true)", body)

    def test_security_barrier_is_kept(self) -> None:
        self.assertIn("security_barrier = true", normalised())

    def test_view_is_revoked_before_being_granted(self) -> None:
        body = normalised()
        revoke = body.index("revoke all on public.catalogue_products")
        grant = body.index("grant select on public.catalogue_products")
        self.assertLess(revoke, grant, "revoke must precede grant: GRANT cannot subtract")

    def test_public_roles_get_select_only(self) -> None:
        body = normalised()
        self.assertNotRegex(
            body,
            r"grant\s+(insert|update|delete|all)[^;]*on public\.catalogue_products",
        )


class MigrationSecuresColumnGrants(unittest.TestCase):
    def test_column_grants_are_derived_from_the_view(self) -> None:
        body = normalised()
        self.assertIn("pg_attribute", body)
        self.assertIn("grant select (%s) on public.affiliate_products", body)

    def test_research_columns_are_not_granted(self) -> None:
        body = normalised()
        for column in ("evidence_notes", "commission_info", "model_error", "research_confidence"):
            self.assertNotRegex(
                body, rf"grant select[^;]*\b{column}\b",
                f"{column} must never appear in a column grant",
            )


class MigrationHandlesDefaults(unittest.TestCase):
    def test_both_scopes_are_revoked(self) -> None:
        body = normalised()
        self.assertIn("alter default privileges for role %i revoke", body)
        self.assertIn("in schema public revoke", body)

    def test_sequences_are_covered(self) -> None:
        self.assertIn("on sequences", normalised())

    def test_maintain_is_gated_on_version(self) -> None:
        body = normalised()
        self.assertIn("server_version_num", body)
        self.assertIn("maintain", body)

    def test_creator_roles_include_supabase_admin(self) -> None:
        self.assertIn("supabase_admin", normalised())

    def test_failure_to_alter_defaults_is_raised(self) -> None:
        body = normalised()
        self.assertIn("cannot alter default privileges for grantor role", body)


class MigrationEventTrigger(unittest.TestCase):
    def test_event_trigger_exists_and_is_scoped(self) -> None:
        body = normalised()
        self.assertIn("create event trigger enforce_public_schema_acl", body)
        self.assertIn("on ddl_command_end", body)
        self.assertIn("'create table'", body)
        self.assertIn("'create view'", body)

    def test_event_function_is_security_definer_with_pinned_path(self) -> None:
        body = normalised()
        self.assertIn("returns event_trigger", body)
        self.assertIn("security definer", body)
        self.assertIn("set search_path = pg_catalog", body)

    def test_event_function_is_not_executable_by_public(self) -> None:
        body = normalised()
        self.assertIn("revoke all on function public.enforce_public_schema_acl() from public", body)

    def test_superuser_requirement_is_checked_explicitly(self) -> None:
        body = normalised()
        self.assertIn("must run as a superuser", body)


class MigrationPreservesServiceRole(unittest.TestCase):
    def test_service_role_is_never_revoked(self) -> None:
        body = normalised()
        for match in re.finditer(r"revoke[^;]*;", body):
            self.assertNotIn("service_role", match.group(0))

    def test_self_check_asserts_service_role_access(self) -> None:
        self.assertIn("service_role lost required access", normalised())


# ===========================================================================
# Live database tests
# ===========================================================================


class _DatabaseTestCase(unittest.TestCase):
    database: str
    hardened: bool = False
    apply_twice: bool = False
    fresh: bool = False

    @classmethod
    def setUpClass(cls) -> None:
        if _psql_binary() is None:
            raise unittest.SkipTest("psql is not on PATH")
        try:
            _run("select 1;")
        except (AssertionError, OSError, subprocess.SubprocessError) as exc:
            raise unittest.SkipTest(f"no PostgreSQL server reachable: {exc}") from exc

        cls.database = f"fyndra_acl_{uuid.uuid4().hex[:10]}"
        _run(f'create database "{cls.database}";')
        _run(BASELINE_SQL, database=cls.database)

        if cls.fresh:
            for name in BASE_MIGRATIONS:
                _apply_file(name, cls.database)
            _apply_file(LOCKDOWN_FILE, cls.database)
            _run(SEED_SQL, database=cls.database)
        else:
            for name in BASE_MIGRATIONS:
                _apply_file(name, cls.database)
            _run(SEED_SQL, database=cls.database)
            if cls.hardened or cls.apply_twice:
                _apply_file(LOCKDOWN_FILE, cls.database)
            if cls.apply_twice:
                _apply_file(LOCKDOWN_FILE, cls.database)

    @classmethod
    def tearDownClass(cls) -> None:
        database = getattr(cls, "database", None)
        if database:
            _run(f'drop database if exists "{database}" with (force);', check=False)

    # -- helpers ---------------------------------------------------------

    def privilege(self, role: str, relation: str, kind: str) -> bool:
        return _scalar(
            f"select has_table_privilege('{role}', '{relation}', '{kind}')::text;",
            database=self.database,
        ) == "true"

    def scalar(self, sql: str) -> str:
        return _scalar(sql, database=self.database)

    def as_role(self, role: str, sql: str) -> str:
        _, out, _ = _run(
            f"begin; set local role {role}; {sql} rollback;", database=self.database
        )
        lines = [line for line in out.splitlines() if line.strip()]
        return lines[-1].strip() if lines else ""

    def denied(self, role: str, statement: str) -> None:
        code, _, err = _run(
            f"begin; set local role {role}; {statement} rollback;",
            database=self.database,
            check=False,
        )
        self.assertNotEqual(code, 0, f"{statement!r} unexpectedly succeeded as {role}")
        self.assertIn("permission denied", err.lower(), f"unexpected error: {err}")


class VulnerableBaseline(_DatabaseTestCase):
    """Pins the bug so the regression suite cannot rot into a no-op."""

    hardened = False

    def test_anon_inherits_write_privileges_on_the_view(self) -> None:
        for kind in ("INSERT", "UPDATE", "DELETE"):
            self.assertTrue(
                self.privilege("anon", "public.catalogue_products", kind),
                f"baseline did not reproduce: anon lacks {kind} on the view",
            )

    def test_incident_statement_deletes_approved_products(self) -> None:
        before = int(self.scalar(
            "select count(*) from public.affiliate_products where approval_status='approved';"))
        self.assertGreater(before, 0)
        _run(
            "begin; set local role anon; "
            "delete from public.catalogue_products where true; commit;",
            database=self.database,
        )
        after = int(self.scalar(
            "select count(*) from public.affiliate_products where approval_status='approved';"))
        self.assertEqual(after, 0, "incident statement did not reproduce")


class HardenedView(_DatabaseTestCase):
    hardened = True

    def test_anon_has_exactly_select(self) -> None:
        self.assertTrue(self.privilege("anon", "public.catalogue_products", "SELECT"))
        for kind in ("INSERT", "UPDATE", "DELETE", "TRUNCATE", "REFERENCES", "TRIGGER"):
            self.assertFalse(self.privilege("anon", "public.catalogue_products", kind))

    def test_authenticated_has_exactly_select(self) -> None:
        self.assertTrue(self.privilege("authenticated", "public.catalogue_products", "SELECT"))
        for kind in ("INSERT", "UPDATE", "DELETE", "TRUNCATE", "REFERENCES", "TRIGGER"):
            self.assertFalse(self.privilege("authenticated", "public.catalogue_products", kind))

    def test_view_is_security_invoker(self) -> None:
        opts = self.scalar(
            "select coalesce(array_to_string(reloptions, ','), '') "
            "from pg_class where oid='public.catalogue_products'::regclass;")
        self.assertIn("security_invoker=true", opts)
        self.assertIn("security_barrier=true", opts)

    def test_anon_insert_update_delete_are_denied(self) -> None:
        self.denied("anon", "insert into public.catalogue_products "
                            "(id, slug, title, price, currency, approval_status, data_source) "
                            "values (gen_random_uuid(),'x','X',1,'USD','approved','api');")
        self.denied("anon", "update public.catalogue_products set title='HACKED';")
        self.denied("anon", "delete from public.catalogue_products where true;")

    def test_authenticated_insert_update_delete_are_denied(self) -> None:
        self.denied("authenticated", "update public.catalogue_products set title='HACKED';")
        self.denied("authenticated", "delete from public.catalogue_products where true;")

    def test_writable_cte_and_returning_paths_are_denied(self) -> None:
        self.denied("anon", "with d as (delete from public.catalogue_products "
                            "where true returning id) select count(*) from d;")
        self.denied("anon", "delete from public.catalogue_products returning id;")

    def test_public_select_still_works(self) -> None:
        for role in ("anon", "authenticated"):
            count = self.as_role(role, "select count(*) from public.catalogue_products;")
            self.assertEqual(int(count), 1, f"{role} sees the wrong row count")

    def test_view_hides_unapproved_rows(self) -> None:
        self.assertEqual(
            int(self.as_role("anon",
                             "select count(*) from public.catalogue_products "
                             "where approval_status <> 'approved';")),
            0,
        )

    def test_service_role_retains_full_access(self) -> None:
        for kind in ("SELECT", "INSERT", "UPDATE", "DELETE", "TRUNCATE"):
            self.assertTrue(
                self.privilege("service_role", "public.catalogue_products", kind),
                f"service_role lost {kind}; backend operations would break",
            )


class BaseTableRls(_DatabaseTestCase):
    """security_invoker relies on column grants; RLS must still bound rows."""

    hardened = True

    def test_anon_base_table_reads_are_rls_filtered(self) -> None:
        total = int(self.as_role("anon", "select count(*) from public.affiliate_products;"))
        approved = int(self.as_role(
            "anon",
            "select count(*) from public.affiliate_products where approval_status='approved';"))
        pending = int(self.as_role(
            "anon",
            "select count(*) from public.affiliate_products where approval_status<>'approved';"))
        self.assertEqual(total, 1, "column grants must not widen rows")
        self.assertEqual(approved, 1)
        self.assertEqual(pending, 0, "RLS must hide unapproved rows on the base table")

    def test_research_columns_remain_unreachable(self) -> None:
        for column in ("evidence_notes", "commission_info", "model_error"):
            self.denied("anon", f"select {column} from public.affiliate_products limit 1;")

    def test_authenticated_base_table_reads_are_rls_filtered(self) -> None:
        self.assertEqual(
            int(self.as_role("authenticated",
                             "select count(*) from public.affiliate_products "
                             "where approval_status<>'approved';")),
            0,
        )


class MaintenancePrivileges(_DatabaseTestCase):
    """TRUNCATE is outside RLS; MAINTAIN additionally allows LOCK/VACUUM."""

    hardened = True

    def _public_tables(self) -> list[str]:
        out = self.scalar(
            "select coalesce(string_agg(c.relname, ',' order by c.relname), '') "
            "from pg_class c join pg_namespace n on n.oid=c.relnamespace "
            "where n.nspname='public' and c.relkind='r';")
        return [t for t in out.split(",") if t]

    def test_no_truncate_prime_anywhere(self) -> None:
        for role in ("anon", "authenticated"):
            for table in self._public_tables():
                self.assertFalse(
                    self.privilege(role, f"public.{table}", "TRUNCATE"),
                    f"{role} still holds TRUNCATE on public.{table}")

    def test_no_maintain_or_truncate_on_postgres_17_plus(self) -> None:
        version = int(self.scalar("show server_version_num;"))
        if version < 170000:
            self.skipTest(f"MAINTAIN does not exist before PostgreSQL 17 (server {version})")
        for role in ("anon", "authenticated"):
            for table in self._public_tables():
                self.assertFalse(
                    self.privilege(role, f"public.{table}", "MAINTAIN"),
                    f"{role} still holds MAINTAIN on public.{table}")

    def test_truncate_and_lock_are_denied(self) -> None:
        self.denied("anon", "truncate public.affiliate_products;")
        self.denied("anon", "truncate public.product_model_jobs;")
        self.denied("anon", "lock table public.product_model_jobs in access exclusive mode;")
        self.denied("authenticated", "truncate public.affiliate_clicks;")


class InternalTablesArePrivate(_DatabaseTestCase):
    hardened = True

    def test_internal_tables_are_unreadable(self) -> None:
        for table in ("product_model_jobs", "admitad_import_runs",
                      "admitad_import_errors", "affiliate_clicks"):
            for role in ("anon", "authenticated"):
                self.denied(role, f"select count(*) from public.{table};")

    def test_internal_tables_are_unwritable(self) -> None:
        self.denied("anon", "insert into public.product_model_jobs "
                            "(product_id, source_image_hash, source_image_url) "
                            "values (gen_random_uuid(),'h','u');")
        self.denied("anon", "delete from public.product_model_jobs where true;")


class FutureObjects(_DatabaseTestCase):
    hardened = True

    def test_new_table_and_view_grant_public_roles_nothing(self) -> None:
        _run("create table public.acl_future_src (id int); "
             "create view public.acl_future_view as select id from public.acl_future_src;",
             database=self.database)
        for relation in ("public.acl_future_src", "public.acl_future_view"):
            for role in ("anon", "authenticated"):
                for kind in ("SELECT", "INSERT", "UPDATE", "DELETE", "TRUNCATE"):
                    self.assertFalse(
                        self.privilege(role, relation, kind),
                        f"{role} inherited {kind} on a future object {relation}")

    def test_new_sequence_is_not_usable(self) -> None:
        _run("create table public.acl_future_serial (id bigserial primary key);",
             database=self.database)
        seq = self.scalar(
            "select pg_get_serial_sequence('public.acl_future_serial','id')::text;")
        for role in ("anon", "authenticated"):
            for kind in ("USAGE", "SELECT", "UPDATE"):
                self.assertEqual(
                    self.scalar(f"select has_sequence_privilege('{role}','{seq}','{kind}')::text;"),
                    "false", f"{role} inherited {kind} on a future sequence")

    def test_service_role_keeps_full_rights_on_future_objects(self) -> None:
        _run("create table public.acl_future_svc (id int);", database=self.database)
        for kind in ("SELECT", "INSERT", "UPDATE", "DELETE", "TRUNCATE"):
            self.assertTrue(self.privilege("service_role", "public.acl_future_svc", kind))

    def test_default_acl_grants_public_roles_nothing(self) -> None:
        offenders = self.scalar(
            "select coalesce(string_agg(format('%s:%s:%s', "
            "  coalesce(d.defaclnamespace::regnamespace::text,'GLOBAL'), "
            "  a.grantee::regrole::text, a.privilege_type), ', '), '') "
            "from pg_default_acl d cross join lateral aclexplode(d.defaclacl) a "
            "where d.defaclobjtype in ('r','S') "
            "  and (d.defaclnamespace = 0 or d.defaclnamespace = 'public'::regnamespace) "
            "  and a.grantee in ('anon'::regrole,'authenticated'::regrole);")
        self.assertEqual(offenders, "", f"defaults still grant: {offenders}")


class CreatorRoleDifferences(_DatabaseTestCase):
    """A table created by another role must still be born closed."""

    hardened = True

    def test_table_created_by_another_superuser_is_born_closed(self) -> None:
        _run("do $$ begin if not exists (select 1 from pg_roles where rolname='acl_creator') "
             "then create role acl_creator superuser; end if; end $$; "
             "grant usage, create on schema public to acl_creator;",
             database=self.database)
        _run("set role acl_creator; create table public.acl_by_creator (id int); reset role;",
             database=self.database)
        for role in ("anon", "authenticated"):
            for kind in ("SELECT", "INSERT", "UPDATE", "DELETE"):
                self.assertFalse(
                    self.privilege(role, "public.acl_by_creator", kind),
                    f"{role} inherited {kind} from a foreign creator role")


class EventTriggerSecurity(_DatabaseTestCase):
    hardened = True

    def test_event_trigger_is_installed_and_enabled(self) -> None:
        self.assertEqual(
            self.scalar("select count(*) from pg_event_trigger "
                        "where evtname='enforce_public_schema_acl';"), "1")
        self.assertEqual(
            self.scalar("select evtenabled from pg_event_trigger "
                        "where evtname='enforce_public_schema_acl';"), "O")

    def test_event_function_is_hardened(self) -> None:
        self.assertEqual(
            self.scalar("select prosecdef::text from pg_proc "
                        "where proname='enforce_public_schema_acl';"), "true")
        self.assertEqual(
            self.scalar("select (coalesce(array_length(proconfig,1),0)=1 "
                        "and left(proconfig[1],14)='search_path=pg')::text "
                        "from pg_proc where proname='enforce_public_schema_acl';"), "true")

    def test_public_role_cannot_execute_the_event_function(self) -> None:
        self.denied("anon", "select public.enforce_public_schema_acl();")

    def test_non_superuser_migration_fails_closed(self) -> None:
        _run("do $$ begin if not exists (select 1 from pg_roles where rolname='acl_nonsuper') "
             "then create role acl_nonsuper nologin; end if; end $$;"
             "grant usage, create on schema public to acl_nonsuper;",
             database=self.database)
        code, _, err = _run(
            "set role acl_nonsuper;\n" + (MIGRATIONS / LOCKDOWN_FILE).read_text(encoding="utf-8"),
            database=self.database,
            check=False,
        )
        self.assertNotEqual(code, 0, "migration must refuse to run as a non-superuser")
        self.assertIn("superuser", err.lower())
        # Nothing may be left half-applied.
        self.assertEqual(
            self.scalar("select count(*) from pg_event_trigger "
                        "where evtname='enforce_public_schema_acl';"), "1",
            "the pre-existing trigger must still be the only one")


class HardeningIsIdempotent(_DatabaseTestCase):
    apply_twice = True

    def test_second_application_preserves_invariants(self) -> None:
        self.assertTrue(self.privilege("anon", "public.catalogue_products", "SELECT"))
        for kind in ("INSERT", "UPDATE", "DELETE", "TRUNCATE"):
            self.assertFalse(self.privilege("anon", "public.catalogue_products", kind))
        self.assertEqual(
            self.scalar("select count(*) from pg_event_trigger "
                        "where evtname='enforce_public_schema_acl';"), "1")


class FreshProvisioning(_DatabaseTestCase):
    """Applying the lockdown to a brand-new database yields the same state."""

    fresh = True

    def test_fresh_database_matches_hardened_state(self) -> None:
        self.assertTrue(self.privilege("anon", "public.catalogue_products", "SELECT"))
        for kind in ("INSERT", "UPDATE", "DELETE", "TRUNCATE"):
            self.assertFalse(self.privilege("anon", "public.catalogue_products", kind))
        opts = self.scalar(
            "select coalesce(array_to_string(reloptions, ','), '') "
            "from pg_class where oid='public.catalogue_products'::regclass;")
        self.assertIn("security_invoker=true", opts)

    def test_fresh_public_read_works(self) -> None:
        self.assertEqual(
            int(self.as_role("anon", "select count(*) from public.catalogue_products;")), 1)

    def test_fresh_internal_tables_are_private(self) -> None:
        self.denied("anon", "select count(*) from public.product_model_jobs;")


if __name__ == "__main__":
    unittest.main(verbosity=2)
