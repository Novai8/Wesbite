"""Permanent access-control regression tests for the canonical catalogue ACL
lockdown migration (20261124130000_fyndra_public_acl_lockdown.sql).

These tests run the REAL files in supabase/migrations/ against a disposable
PostgreSQL database, not a hand-copied schema. That matters: the bug they guard
against lived in the interaction between Supabase's default privileges and the
3D migration grant select on the view, and a reconstructed fixture would
reproduce whatever the fixture author believed instead of what ships.

What is under test
------------------
The confirmed incident statement:

    SET LOCAL ROLE anon; DELETE FROM public.catalogue_products WHERE true;

succeeded because the view was auto-updatable and owned by a role exempt from
the base table RLS, while anon held the full arwdDxtm grant inherited from
Supabase schema default privileges.

The canonical migration applies two independent defences:

  1. security_invoker = true, so the view is privilege-checked and RLS-filtered
     as the caller -- the rewrite-as-owner path is gone.
  2. fail-closed grants: SELECT on the view, minimal column-level SELECT on the
     base table, nothing else, and no default privileges for new objects.

Connection
----------
Standard libpq environment variables are honoured:

    PGHOST PGPORT PGUSER PGPASSWORD PGDATABASE

The test needs a role that can CREATE DATABASE, CREATE ROLE and ALTER DEFAULT
PRIVILEGES (a superuser satisfies all three). It creates a uniquely named
database, never touches an existing one, and drops it afterwards.

Run: python -m unittest tests.test_catalogue_acl_lockdown -v
Skipped automatically when no PostgreSQL server is reachable.
"""

from __future__ import annotations

import os
import pathlib
import subprocess
import unittest
import uuid

MIGRATIONS = pathlib.Path(__file__).resolve().parent.parent / "supabase" / "migrations"

MIGRATION_FILES = [
    "0001_admitad_integration.sql",
    "20261123150000_fyndra_3d_models.sql",
    "20261124090000_fyndra_function_search_path.sql",
]
LOCKDOWN_FILE = "20261124130000_fyndra_public_acl_lockdown.sql"

REJECTED_FILE = (
    pathlib.Path(__file__).resolve().parent.parent
    / "security-review-candidates"
    / "archived"
    / "20261124130000-concurrent-rejected"
    / "20261124130000_fyndra_public_acl_lockdown.sql"
)

REVIEWED_RELATIONS = {
    "affiliate_products",
    "affiliate_programs",
    "affiliate_categories",
    "admitad_import_runs",
    "admitad_import_errors",
    "affiliate_clicks",
    "product_model_jobs",
    "catalogue_products",
}

INTERNAL_RELATIONS = REVIEWED_RELATIONS - {"catalogue_products"}

WRITE_PRIVILEGES = (
    "INSERT",
    "UPDATE",
    "DELETE",
    "TRUNCATE",
    "REFERENCES",
    "TRIGGER",
)

ALL_PRIVILEGES = ("SELECT",) + WRITE_PRIVILEGES

SENSITIVE_COLUMNS = ("evidence_notes", "score", "research_confidence", "decision",
                     "commission_info", "model_error")

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
  bucket_id text not null,
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
  (gen_random_uuid(), 'acl-approved-a', 'ACL APPROVED A', 1, 'USD', 'approved', 'api'),
  (gen_random_uuid(), 'acl-approved-b', 'ACL APPROVED B', 2, 'USD', 'approved', 'api'),
  (gen_random_uuid(), 'acl-pending',    'ACL PENDING',    3, 'USD', 'pending',  'api');
insert into public.affiliate_clicks (program_slug) values ('admitad');
insert into public.admitad_import_runs (campaign_id) values (1);
insert into public.product_model_jobs (product_id, source_image_hash, source_image_url)
  select id, 'hash-acl', 'https://example.invalid/acl.png'
    from public.affiliate_products order by slug limit 1;
"""


def shutil_which(name: str) -> str | None:
    for directory in os.environ.get("PATH", "").split(os.pathsep):
        candidate = pathlib.Path(directory) / (name + (".exe" if os.name == "nt" else ""))
        if candidate.is_file() and os.access(candidate, os.X_OK):
            return str(candidate)
    return None


def _psql_binary() -> str | None:
    return shutil_which("psql")


def _env() -> dict[str, str]:
    env = {k: v for k, v in os.environ.items() if not k.startswith("PG")}
    for key in ("PGHOST", "PGPORT", "PGUSER", "PGPASSWORD", "PGDATABASE", "PGSSLMODE"):
        if key in os.environ:
            env[key] = os.environ[key]
    return env


def _run(sql: str, *, database: str | None = None, check: bool = True) -> tuple[int, str, str]:
    psql = _psql_binary()
    if psql is None:
        raise unittest.SkipTest("psql is not on PATH")
    args = [psql, "-X", "-q", "-A", "-t", "-v", "ON_ERROR_STOP=1"]
    if database:
        args += ["-d", database]
    result = subprocess.run(
        args, input=sql, capture_output=True, text=True, env=_env(), timeout=180
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


def _server_version(database: str) -> int:
    return int(_scalar("show server_version_num;", database=database))


class _DatabaseTestCase(unittest.TestCase):
    """Creates a throwaway database per test class, drops it afterwards."""

    database: str
    hardened: bool = False
    seeded: bool = True
    version: int = 0

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
        cls.version = _server_version(cls.database)
        _run(BASELINE_SQL.replace("$$", chr(36) * 2), database=cls.database)
        for name in MIGRATION_FILES:
            _apply_file(name, cls.database)
        if cls.hardened:
            _apply_file(LOCKDOWN_FILE, cls.database)
        if cls.seeded:
            _run(SEED_SQL, database=cls.database)

    @classmethod
    def tearDownClass(cls) -> None:
        database = getattr(cls, "database", None)
        if database:
            _run(f'drop database if exists "{database}" with (force);')

    def privilege(self, role: str, relation: str, kind: str) -> bool:
        return _scalar(
            f"select has_table_privilege('{role}', '{relation}', '{kind}')::text;",
            database=self.database,
        ) == "true"

    def column_privilege(self, role: str, relation: str, column: str, kind: str) -> bool:
        return _scalar(
            "select has_column_privilege("
            f"'{role}', '{relation}', '{column}', '{kind}')::text;",
            database=self.database,
        ) == "true"

    def sequence_privilege(self, role: str, relation: str, kind: str) -> bool:
        return _scalar(
            f"select has_sequence_privilege('{role}', '{relation}', '{kind}')::text;",
            database=self.database,
        ) == "true"

    def view_option(self, name: str) -> str:
        return _scalar(
            "select coalesce((select option_value from pg_options_to_table(reloptions) "
            f"where option_name = '{name}'), 'unset') "
            "from pg_class where oid = 'public.catalogue_products'::regclass;",
            database=self.database,
        )

    def dml_denied(self, role: str, statement: str) -> None:
        code, _, err = _run(
            f"begin; set local role {role}; {statement} rollback;",
            database=self.database,
            check=False,
        )
        self.assertNotEqual(code, 0, f"{statement!r} unexpectedly succeeded as {role}")
        self.assertIn("permission denied", err.lower(), f"unexpected error: {err}")
        _run("rollback;", database=self.database, check=False)

    def approved_count(self) -> int:
        return int(
            _scalar(
                "select count(*) from public.affiliate_products "
                "where approval_status = 'approved';",
                database=self.database,
            )
        )

    def public_tables(self) -> list[str]:
        out = _scalar(
            "select coalesce(string_agg(c.relname, ',' order by c.relname), '') "
            "from pg_class c join pg_namespace n on n.oid = c.relnamespace "
            "where n.nspname = 'public' and c.relkind = 'r';",
            database=self.database,
        )
        return [name for name in out.split(",") if name]

    def acl_grantees(self, relation: str, grantee_oid: int) -> list[str]:
        out = _scalar(
            "select coalesce(string_agg(a.privilege_type, ',' order by a.privilege_type), '') "
            "from pg_class c cross join lateral aclexplode(c.relacl) a "
            f"where c.oid = '{relation}'::regclass and a.grantee = {grantee_oid};",
            database=self.database,
        )
        return [p for p in out.split(",") if p]

    def public_write_privileges(self) -> list[str]:
        out = _scalar(
            "select coalesce(string_agg(format('%s:%s:%s', r.role, c.relname, p.priv), "
            "  ',' order by 2, 1), '') "
            "from (values ('anon'), ('authenticated')) as r(role) "
            "cross join lateral ("
            "  select c.oid, c.relname from pg_class c "
            "  join pg_namespace n on n.oid = c.relnamespace "
            "  where n.nspname = 'public' and c.relkind in ('r','p','v','m')"
            ") as c "
            "cross join (values ('INSERT'),('UPDATE'),('DELETE'),('TRUNCATE'),"
            "  ('REFERENCES'),('TRIGGER')) as p(priv) "
            "where has_table_privilege(r.role, c.oid, p.priv);",
            database=self.database,
        )
        return [row for row in out.split(",") if row]


class VulnerableBaseline(_DatabaseTestCase):
    """Pins the bug itself, so the regression test cannot rot into a no-op."""

    hardened = False

    def test_baseline_view_is_writable_by_anon(self) -> None:
        for kind in ("INSERT", "UPDATE", "DELETE"):
            self.assertTrue(
                self.privilege("anon", "public.catalogue_products", kind),
                f"baseline did not reproduce: anon lacks {kind} on the view",
            )

    def test_baseline_view_is_not_security_invoker(self) -> None:
        self.assertEqual(
            self.view_option("security_invoker"),
            "unset",
            "baseline already had security_invoker",
        )

    def test_baseline_incident_statement_deletes_approved_products(self) -> None:
        before = self.approved_count()
        self.assertGreater(before, 0)
        _run(
            "begin; set local role anon; "
            "delete from public.catalogue_products where true; commit;",
            database=self.database,
        )
        self.assertEqual(self.approved_count(), 0, "incident statement did not reproduce")


class HardenedView(_DatabaseTestCase):
    """The view is security_invoker, SELECT-only, and public SELECT works."""

    hardened = True

    def test_view_is_security_invoker(self) -> None:
        self.assertEqual(
            self.view_option("security_invoker"),
            "true",
            "the view is not security_invoker = true",
        )

    def test_view_keeps_security_barrier(self) -> None:
        self.assertEqual(
            self.view_option("security_barrier"),
            "true",
            "security_barrier was lost",
        )

    def test_anon_has_exactly_select(self) -> None:
        self.assertTrue(self.privilege("anon", "public.catalogue_products", "SELECT"))
        for kind in WRITE_PRIVILEGES:
            self.assertFalse(
                self.privilege("anon", "public.catalogue_products", kind),
                f"anon still holds {kind} on catalogue_products",
            )

    def test_authenticated_has_exactly_select(self) -> None:
        self.assertTrue(self.privilege("authenticated", "public.catalogue_products", "SELECT"))
        for kind in WRITE_PRIVILEGES:
            self.assertFalse(
                self.privilege("authenticated", "public.catalogue_products", kind),
                f"authenticated still holds {kind} on catalogue_products",
            )

    def test_public_pseudo_role_holds_nothing_on_the_view(self) -> None:
        self.assertEqual(
            self.acl_grantees("public.catalogue_products", 0),
            [],
            "catalogue_products grants privileges to PUBLIC",
        )

    def test_anon_insert_is_denied(self) -> None:
        self.dml_denied(
            "anon",
            "insert into public.catalogue_products "
            "(id, slug, title, price, currency, approval_status, data_source) values "
            "(gen_random_uuid(), 'x', 'X', 1, 'USD', 'approved', 'api');",
        )

    def test_anon_update_is_denied(self) -> None:
        self.dml_denied("anon", "update public.catalogue_products set title = 'HACKED';")

    def test_anon_delete_is_denied(self) -> None:
        before = self.approved_count()
        self.dml_denied("anon", "delete from public.catalogue_products where true;")
        self.assertGreater(before, 0)
        self.assertEqual(self.approved_count(), before, "rows changed despite the denial")

    def test_authenticated_insert_is_denied(self) -> None:
        self.dml_denied(
            "authenticated",
            "insert into public.catalogue_products "
            "(id, slug, title, price, currency, approval_status, data_source) values "
            "(gen_random_uuid(), 'y', 'Y', 1, 'USD', 'approved', 'api');",
        )

    def test_authenticated_update_is_denied(self) -> None:
        self.dml_denied(
            "authenticated", "update public.catalogue_products set title = 'HACKED';"
        )

    def test_authenticated_delete_is_denied(self) -> None:
        self.dml_denied(
            "authenticated", "delete from public.catalogue_products where true;"
        )

    def test_public_select_still_works(self) -> None:
        # security_invoker means the caller needs SELECT on the projected base
        # columns; this proves the column-level grant is complete, not partial.
        for role in ("anon", "authenticated"):
            _, out, _ = _run(
                f"begin; set local role {role}; "
                "select count(*) from public.catalogue_products; rollback;",
                database=self.database,
            )
            counts = [line for line in out.splitlines() if line.strip()]
            self.assertTrue(counts, f"{role} read returned nothing")
            self.assertEqual(int(counts[-1]), 2, f"{role} sees the wrong row count")

    def test_rls_still_filters_pending_rows(self) -> None:
        out = _run(
            "begin; set local role anon; "
            "select count(*) from public.catalogue_products "
            "where slug = 'acl-pending'; rollback;",
            database=self.database,
        )[1]
        counts = [line for line in out.splitlines() if line.strip()]
        self.assertEqual(int(counts[-1]), 0, "a pending row leaked through the view")

    def test_hardened_view_is_not_writable_even_if_granted(self) -> None:
        # The structural fix: security_invoker removes the rewrite-as-owner
        # path, so a re-grant would still not resurrect the DELETE.
        _run(
            "grant insert, update, delete on public.catalogue_products "
            "to anon;",
            database=self.database,
        )
        try:
            self.dml_denied(
                "anon", "delete from public.catalogue_products where true;")
        finally:
            _run(
                "revoke all on public.catalogue_products from anon; "
                "grant select on public.catalogue_products to anon;",
                database=self.database,
            )

    def test_service_role_retains_full_access(self) -> None:
        for kind in ("SELECT", "INSERT", "UPDATE", "DELETE", "TRUNCATE"):
            self.assertTrue(
                self.privilege("service_role", "public.catalogue_products", kind),
                f"service_role lost {kind} on the view",
            )
            self.assertTrue(
                self.privilege("service_role", "public.affiliate_products", kind),
                f"service_role lost {kind} on the base table",
            )


class BaseTableColumnGrants(_DatabaseTestCase):
    """Only the projected columns are grantable, and only for SELECT."""

    hardened = True

    def test_no_table_level_select_on_the_base_table(self) -> None:
        for role in ("anon", "authenticated"):
            self.assertFalse(
                self.privilege(role, "public.affiliate_products", "SELECT"),
                f"{role} has table-level SELECT on affiliate_products",
            )

    def test_projected_columns_are_readable(self) -> None:
        for role in ("anon", "authenticated"):
            for column in ("id", "slug", "title", "price", "currency", "model_url"):
                self.assertTrue(
                    self.column_privilege(role, "public.affiliate_products", column, "SELECT"),
                    f"{role} cannot read projected column {column}",
                )

    def test_sensitive_columns_are_not_readable(self) -> None:
        for role in ("anon", "authenticated"):
            for column in SENSITIVE_COLUMNS:
                self.assertFalse(
                    self.column_privilege(role, "public.affiliate_products", column, "SELECT"),
                    f"{role} can read sensitive column {column}",
                )

    def test_no_write_privilege_on_any_base_column(self) -> None:
        for role in ("anon", "authenticated"):
            for column in ("id", "title", "price"):
                for kind in ("INSERT", "UPDATE"):
                    self.assertFalse(
                        self.column_privilege(
                            role, "public.affiliate_products", column, kind),
                        f"{role} can {kind} column {column} on the base table",
                    )

    def test_sensitive_column_read_is_denied(self) -> None:
        self.dml_denied("anon", "select commission_info from public.affiliate_products;")
        self.dml_denied("anon", "select model_error from public.affiliate_products;")


class InternalRelationsClosed(_DatabaseTestCase):
    """Internal tables are not reachable by the public roles at all."""

    hardened = True

    def test_internal_relations_are_present(self) -> None:
        tables = set(self.public_tables())
        for name in INTERNAL_RELATIONS:
            self.assertIn(name, tables, f"{name} missing from the fixture")

    def test_no_privilege_for_anon_or_authenticated(self) -> None:
        tables = set(self.public_tables())
        for relation in sorted(INTERNAL_RELATIONS):
            if relation not in tables:
                continue
            for role in ("anon", "authenticated"):
                for kind in ALL_PRIVILEGES:
                    self.assertFalse(
                        self.privilege(role, f"public.{relation}", kind),
                        f"{role} still holds {kind} on public.{relation}",
                    )

    def test_public_pseudo_role_holds_nothing(self) -> None:
        tables = set(self.public_tables())
        for relation in sorted(INTERNAL_RELATIONS):
            if relation not in tables:
                continue
            self.assertEqual(
                self.acl_grantees(f"public.{relation}", 0),
                [],
                f"public.{relation} grants privileges to PUBLIC",
            )

    def test_selection_on_internal_tables_is_denied(self) -> None:
        for relation in ("product_model_jobs", "admitad_import_runs",
                         "affiliate_clicks", "affiliate_programs",
                         "affiliate_categories"):
            if relation not in self.public_tables():
                continue
            for role in ("anon", "authenticated"):
                self.dml_denied(role, f"select * from public.{relation};")

    def test_programs_and_categories_are_not_public(self) -> None:
        # Both are served from seed content (src/lib/catalogue.ts), so granting
        # them publicly would be access with no consumer.
        for relation in ("affiliate_programs", "affiliate_categories"):
            if relation not in self.public_tables():
                continue
            for role in ("anon", "authenticated"):
                self.assertFalse(
                    self.privilege(role, f"public.{relation}", "SELECT"),
                    f"{role} can read {relation}, which no public code path uses",
                )


class TruncateAndMaintainRevocation(_DatabaseTestCase):
    """TRUNCATE and MAINTAIN are unfiltered by RLS; neither may be granted."""

    hardened = True

    def test_no_public_table_grants_truncate(self) -> None:
        tables = self.public_tables()
        self.assertIn("product_model_jobs", tables)
        self.assertIn("affiliate_clicks", tables)
        for role in ("anon", "authenticated"):
            for table in tables:
                self.assertFalse(
                    self.privilege(role, f"public.{table}", "TRUNCATE"),
                    f"{role} still holds TRUNCATE on public.{table}",
                )

    def test_no_public_table_grants_references_or_trigger(self) -> None:
        for role in ("anon", "authenticated"):
            for table in self.public_tables():
                for kind in ("REFERENCES", "TRIGGER"):
                    self.assertFalse(
                        self.privilege(role, f"public.{table}", kind),
                        f"{role} still holds {kind} on public.{table}",
                    )

    def test_anon_truncate_is_denied(self) -> None:
        self.dml_denied("anon", "truncate public.product_model_jobs;")
        self.dml_denied("anon", "truncate public.affiliate_clicks;")

    def test_maintain_is_absent_everywhere(self) -> None:
        if self.version < 170000:
            self.skipTest("MAINTAIN does not exist before PostgreSQL 17")
        for role in ("anon", "authenticated"):
            for table in self.public_tables():
                self.assertFalse(
                    self.privilege(role, f"public.{table}", "MAINTAIN"),
                    f"{role} still holds MAINTAIN on public.{table}",
                )

    def test_anon_cannot_lock_an_internal_table(self) -> None:
        if self.version < 170000:
            self.skipTest("LOCK via MAINTAIN only exists on PostgreSQL 17+")
        self.dml_denied(
            "anon", "lock table public.affiliate_products in access exclusive mode;"
        )
        self.dml_denied(
            "anon", "lock table public.product_model_jobs in access exclusive mode;"
        )

    def test_service_role_retains_maintain(self) -> None:
        if self.version < 170000:
            self.skipTest("MAINTAIN does not exist before PostgreSQL 17")
        self.assertTrue(
            self.privilege("service_role", "public.affiliate_products", "MAINTAIN"),
            "service_role should retain MAINTAIN",
        )

    def test_no_write_privilege_anywhere_in_public(self) -> None:
        # The strongest assertion in the suite: across every relation in schema
        # public, no public role holds any write privilege.
        self.assertEqual(
            self.public_write_privileges(), [], "public roles hold write privileges")


class FutureObjectDefaults(_DatabaseTestCase):
    """New objects must not be born visible to the public roles."""

    hardened = True

    def test_future_table_grants_nothing_to_public_roles(self) -> None:
        _run("create table public.acl_future_table (id int);", database=self.database)
        for role in ("anon", "authenticated"):
            for kind in ALL_PRIVILEGES:
                self.assertFalse(
                    self.privilege(role, "public.acl_future_table", kind),
                    f"{role} inherited {kind} on a table created after the migration",
                )
        self.assertEqual(
            self.acl_grantees("public.acl_future_table", 0),
            [],
            "a new table grants privileges to PUBLIC",
        )

    def test_future_view_is_not_readable_or_updatable(self) -> None:
        _run(
            "create table public.acl_future_src (id int); "
            "create view public.acl_future_view as select id from public.acl_future_src;",
            database=self.database,
        )
        self.dml_denied("anon", "select * from public.acl_future_view;")
        self.dml_denied("anon", "delete from public.acl_future_view where true;")

    def test_future_sequence_grants_nothing(self) -> None:
        _run(
            "create table public.acl_future_serial (id bigserial primary key);",
            database=self.database,
        )
        for role in ("anon", "authenticated"):
            for kind in ("USAGE", "SELECT", "UPDATE"):
                self.assertFalse(
                    self.sequence_privilege(role, "public.acl_future_serial_id_seq", kind),
                    f"{role} inherited {kind} on a new sequence",
                )

    def test_service_role_defaults_are_untouched(self) -> None:
        # service_role default privileges are deliberately NOT revoked:
        # imports, the 3D worker and click logging all run as service_role.
        out = _scalar(
            "select coalesce(string_agg(a.privilege_type, ',' order by a.privilege_type), '') "
            "from pg_default_acl d cross join lateral aclexplode(d.defaclacl) a "
            "where d.defaclobjtype = 'r' "
            "  and d.defaclnamespace = 'public'::regnamespace "
            "  and a.grantee = 'service_role'::regrole;",
            database=self.database,
        )
        granted = {p for p in out.split(",") if p}
        for kind in ("SELECT", "INSERT", "UPDATE", "DELETE"):
            self.assertIn(kind, granted, f"service_role lost its default {kind}")

    def test_default_acl_has_no_public_role_entry_anywhere(self) -> None:
        # Asserted against the catalog directly, at BOTH scopes, because the
        # global and schema-scoped entries are unioned.
        out = _scalar(
            "select coalesce(string_agg("
            "  coalesce(d.defaclnamespace::regnamespace::text, 'GLOBAL') || ':' || "
            "  d.defaclrole::regrole::text || ':' || a.grantee::regrole::text || ':' || "
            "  a.privilege_type, ',' order by 1), '') "
            "from pg_default_acl d cross join lateral aclexplode(d.defaclacl) a "
            "where d.defaclobjtype in ('r', 'S') "
            "  and (d.defaclnamespace = 0 or d.defaclnamespace = 'public'::regnamespace) "
            "  and a.grantee <> 0 "
            "  and a.grantee in ('anon'::regrole, 'authenticated'::regrole);",
            database=self.database,
        )
        entries = [e for e in out.split(",") if e]
        self.assertEqual(
            entries, [], f"default privileges still grant to public roles: {entries}")


class UpgradePath(_DatabaseTestCase):
    """The migration must compose on top of the vulnerable state."""

    hardened = False

    def test_upgrade_from_vulnerable_state_closes_everything(self) -> None:
        self.assertTrue(self.privilege("anon", "public.catalogue_products", "DELETE"))

        _apply_file(LOCKDOWN_FILE, self.database)

        for kind in WRITE_PRIVILEGES:
            self.assertFalse(
                self.privilege("anon", "public.catalogue_products", kind),
                f"upgrade left {kind} on the view",
            )
        self.assertTrue(self.privilege("anon", "public.catalogue_products", "SELECT"))
        self.dml_denied("anon", "delete from public.catalogue_products where true;")
        self.assertEqual(self.approved_count(), 2)

    def test_upgrade_twice_is_stable(self) -> None:
        _apply_file(LOCKDOWN_FILE, self.database)
        _apply_file(LOCKDOWN_FILE, self.database)
        self.assertTrue(self.privilege("anon", "public.catalogue_products", "SELECT"))
        for relation in INTERNAL_RELATIONS:
            if relation not in self.public_tables():
                continue
            self.assertFalse(
                self.privilege("anon", f"public.{relation}", "SELECT"),
                f"re-running the upgrade re-opened public.{relation}",
            )


class LockdownIsIdempotent(_DatabaseTestCase):
    hardened = True

    def test_second_application_succeeds_and_preserves_invariants(self) -> None:
        _apply_file(LOCKDOWN_FILE, self.database)
        self.assertTrue(self.privilege("anon", "public.catalogue_products", "SELECT"))
        for kind in WRITE_PRIVILEGES:
            self.assertFalse(self.privilege("anon", "public.catalogue_products", kind))
        self.assertEqual(self.public_write_privileges(), [])

    def test_search_path_migration_stays_separate(self) -> None:
        # Assert on DDL, not on prose: the header legitimately mentions
        # search_path to say it is handled elsewhere. What must not appear is an
        # actual function redefinition or a pinned path.
        search_path_migration = MIGRATIONS / "20261124090000_fyndra_function_search_path.sql"
        self.assertTrue(search_path_migration.is_file())
        self.assertTrue((MIGRATIONS / LOCKDOWN_FILE).is_file())

        sql = (MIGRATIONS / LOCKDOWN_FILE).read_text(encoding="utf-8").lower()
        self.assertNotIn(
            "create or replace function", sql,
            "the lockdown migration must not redefine functions",
        )
        self.assertNotIn(
            "set search_path", sql,
            "the lockdown migration must not pin search_path",
        )
        self.assertNotIn(
            "alter function", sql,
            "the lockdown migration must not alter functions",
        )
        # And the other direction: the search_path migration must not start
        # doing ACL work.
        sp_sql = search_path_migration.read_text(encoding="utf-8").lower()
        self.assertNotIn(
            "revoke all on public.catalogue_products", sp_sql,
            "the search_path migration must not absorb the ACL lockdown",
        )

    def test_reviewed_relations_are_named_not_pattern_matched(self) -> None:
        _run(
            "create table public.acl_unreviewed_later (id int); "
            "grant select on public.acl_unreviewed_later to anon;",
            database=self.database,
        )
        _apply_file(LOCKDOWN_FILE, self.database)

        self.assertTrue(
            self.privilege("anon", "public.acl_unreviewed_later", "SELECT"),
            "the migration touched a relation it never reviewed",
        )
        self.assertFalse(
            self.privilege("anon", "public.affiliate_programs", "SELECT"),
            "a reviewed internal relation was left open",
        )

    def test_no_event_trigger_and_no_superuser_requirement(self) -> None:
        sql = (MIGRATIONS / LOCKDOWN_FILE).read_text(encoding="utf-8").lower()
        self.assertNotIn("create event trigger", sql, "an event trigger was introduced")
        self.assertNotIn(
            "rolsuper",
            sql,
            "the migration must not require a superuser",
        )

    def test_postgres_default_failure_is_raised_not_swallowed(self) -> None:
        sql = (MIGRATIONS / LOCKDOWN_FILE).read_text(encoding="utf-8").lower()
        self.assertIn(
            "cannot change default privileges for the migration role",
            sql,
            "the migration-role failure path is missing",
        )
        self.assertIn(
            "platform fix required",
            sql,
            "the supabase_admin limitation is not documented in the code",
        )

    def test_no_automatic_select_grant_on_future_objects(self) -> None:
        sql = (MIGRATIONS / LOCKDOWN_FILE).read_text(encoding="utf-8").lower()
        for pattern in (
            "default privileges grant select",
            "grant select on tables to anon",
            "grant select on tables to authenticated",
        ):
            self.assertNotIn(
                pattern, sql,
                f"the migration re-introduces an automatic SELECT default: {pattern}",
            )


@unittest.skipUnless(REJECTED_FILE.is_file(), "rejected candidate is not archived")
class RejectedCompetingMigration(_DatabaseTestCase):
    """The rejected 13000 implementation must FAIL the security assertions.

    This is the negation control for the suite: it proves the assertions are not
    vacuous, and documents concretely why that implementation was rejected.
    """

    hardened = False

    def test_rejected_migration_fails_open_as_non_superuser(self) -> None:
        code, _, err = _run(
            REJECTED_FILE.read_text(encoding="utf-8"),
            database=self.database,
            check=False,
        )

        if code != 0:
            # It aborts on its own superuser guard. That is a fail-open: nothing
            # was hardened, so the incident statement must still work.
            self.assertIn(
                "SUPERUSER", err.upper(),
                f"rejected candidate failed for an unexpected reason: {err}",
            )
            _run(
                "begin; set local role anon; "
                "delete from public.catalogue_products where true; commit;",
                database=self.database,
            )
            self.assertEqual(
                self.approved_count(), 0,
                "expected the rejected candidate to leave the delete path open",
            )
        else:
            self.assertFalse(
                self.privilege("anon", "public.catalogue_products", "DELETE"),
                "rejected candidate succeeded but left DELETE granted",
            )


if __name__ == "__main__":
    unittest.main(verbosity=2)
