"""Access-control regression tests for the catalogue ACL hardening migration.

These tests run the REAL files in supabase/migrations/ against a disposable
PostgreSQL database, not a hand-copied schema. That matters: the bug they guard
against lived in the interaction between Supabase's default privileges and the
3D migration's "grant select on the view", and a reconstructed fixture would
reproduce whatever the fixture author believed instead of what ships.

What is under test
------------------
The confirmed incident statement:

    SET LOCAL ROLE anon; DELETE FROM public.catalogue_products WHERE true;

succeeded because the view is auto-updatable and owned by postgres (which has
rolbypassrls), while anon held the full arwdDxtm grant inherited from Supabase's
schema default privileges. Deleting through the view therefore rewrote into a
DELETE on public.affiliate_products executed as the owner, with RLS bypassed.

Connection
----------
Standard libpq environment variables are honoured:

    PGHOST PGPORT PGUSER PGPASSWORD PGDATABASE

The test needs a role that can CREATE DATABASE, CREATE ROLE and ALTER DEFAULT
PRIVILEGES (a superuser satisfies all three). It creates a uniquely named
database, never touches an existing one, and drops it afterwards.

Run: python -m unittest tests.test_catalogue_acl -v
Skipped automatically when no PostgreSQL server is reachable.
"""

from __future__ import annotations

import os
import pathlib
import subprocess
import unittest
import uuid

MIGRATIONS = pathlib.Path(__file__).resolve().parent.parent / "supabase" / "migrations"

# Applied in this order, exactly as the repo ships them.
MIGRATION_FILES = [
    "0001_admitad_integration.sql",
    "20261123150000_fyndra_3d_models.sql",
    "20261124090000_fyndra_function_search_path.sql",
]
HARDENING_FILE = "20261124120000_fyndra_catalogue_acl_hardening.sql"

# Local stand-in for the Supabase baseline. The key line is the default
# privilege: Supabase grants ALL on new tables to the public roles, and that
# applies to views too. Without it the vulnerability does not reproduce at all.
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
"""


def _psql_binary() -> str | None:
    return shutil_which("psql")


def shutil_which(name: str) -> str | None:
    for directory in os.environ.get("PATH", "").split(os.pathsep):
        candidate = pathlib.Path(directory) / (name + (".exe" if os.name == "nt" else ""))
        if candidate.is_file() and os.access(candidate, os.X_OK):
            return str(candidate)
    return None


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
    _, _, err = _run(path.read_text(encoding="utf-8"), database=database)
    del err


class _DatabaseTestCase(unittest.TestCase):
    """Creates a throwaway database per test class, drops it afterwards."""

    database: str
    hardened: bool = False

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
        _run(BASELINE_SQL.replace("$$", chr(36) * 2), database=cls.database)
        for name in MIGRATION_FILES:
            _apply_file(name, cls.database)
        if cls.hardened:
            _apply_file(HARDENING_FILE, cls.database)
        _run(SEED_SQL, database=cls.database)

    @classmethod
    def tearDownClass(cls) -> None:
        database = getattr(cls, "database", None)
        if database:
            _run(f'drop database if exists "{database}" with (force);')

    # -- helpers ---------------------------------------------------------

    def privilege(self, role: str, relation: str, kind: str) -> bool:
        return _scalar(
            f"select has_table_privilege('{role}', '{relation}', '{kind}')::text;",
            database=self.database,
        ) == "true"

    def dml_denied(self, role: str, statement: str) -> None:
        """The statement must fail, and fail with a permission error."""
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


class VulnerableBaseline(_DatabaseTestCase):
    """Pins the bug itself, so the regression test cannot rot into a no-op."""

    hardened = False

    def test_anon_inherits_write_privileges_on_the_view(self) -> None:
        # This is the defect. If it ever stops being true, the ACL assumption
        # behind the hardening migration has changed and the suite must be
        # re-read rather than silently passing.
        for kind in ("INSERT", "UPDATE", "DELETE"):
            self.assertTrue(
                self.privilege("anon", "public.catalogue_products", kind),
                f"baseline did not reproduce: anon lacks {kind} on the view",
            )

    def test_incident_statement_deletes_approved_products(self) -> None:
        before = self.approved_count()
        self.assertGreater(before, 0)
        _run(
            "begin; set local role anon; "
            "delete from public.catalogue_products where true; commit;",
            database=self.database,
        )
        self.assertEqual(self.approved_count(), 0, "incident statement did not reproduce")


class HardenedView(_DatabaseTestCase):
    """The view is SELECT-only and public SELECT still works."""

    hardened = True

    def test_anon_has_exactly_select(self) -> None:
        self.assertTrue(self.privilege("anon", "public.catalogue_products", "SELECT"))
        for kind in ("INSERT", "UPDATE", "DELETE", "TRUNCATE", "REFERENCES", "TRIGGER"):
            self.assertFalse(
                self.privilege("anon", "public.catalogue_products", kind),
                f"anon still holds {kind} on catalogue_products",
            )

    def test_authenticated_has_exactly_select(self) -> None:
        self.assertTrue(self.privilege("authenticated", "public.catalogue_products", "SELECT"))
        for kind in ("INSERT", "UPDATE", "DELETE", "TRUNCATE", "REFERENCES", "TRIGGER"):
            self.assertFalse(
                self.privilege("authenticated", "public.catalogue_products", kind),
                f"authenticated still holds {kind} on catalogue_products",
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
        for role in ("anon", "authenticated"):
            _, out, _ = _run(
                f"begin; set local role {role}; "
                "select count(*) from public.catalogue_products; rollback;",
                database=self.database,
            )
            counts = [line for line in out.splitlines() if line.strip()]
            self.assertTrue(counts, f"{role} read returned nothing")
            self.assertEqual(int(counts[-1]), 2, f"{role} sees the wrong row count")

    def test_service_role_retains_full_access(self) -> None:
        # Imports, the 3D worker and click logging all rely on this.
        for kind in ("SELECT", "INSERT", "UPDATE", "DELETE", "TRUNCATE"):
            self.assertTrue(
                self.privilege("service_role", "public.catalogue_products", kind),
                f"service_role lost {kind}; backend operations would break",
            )


class TruncateRevocation(_DatabaseTestCase):
    """TRUNCATE is not filtered by RLS, so no public role may hold it."""

    hardened = True

    def _public_tables(self) -> list[str]:
        out = _scalar(
            "select coalesce(string_agg(c.relname, ',' order by c.relname), '') "
            "from pg_class c join pg_namespace n on n.oid = c.relnamespace "
            "where n.nspname = 'public' and c.relkind = 'r';",
            database=self.database,
        )
        return [name for name in out.split(",") if name]

    def test_no_public_table_grants_truncate_to_public_roles(self) -> None:
        tables = self._public_tables()
        self.assertIn("product_model_jobs", tables)
        self.assertIn("affiliate_clicks", tables)
        for role in ("anon", "authenticated"):
            for table in tables:
                self.assertFalse(
                    self.privilege(role, f"public.{table}", "TRUNCATE"),
                    f"{role} still holds TRUNCATE on public.{table}",
                )

    def test_anon_truncate_is_denied_on_the_queue(self) -> None:
        # product_model_jobs has RLS enabled with no policies, which does NOT
        # stop TRUNCATE; only the revoked privilege does.
        self.dml_denied("anon", "truncate public.product_model_jobs;")

    def test_anon_truncate_is_denied_on_the_click_log(self) -> None:
        self.dml_denied("anon", "truncate public.affiliate_clicks;")


class FutureObjectDefaults(_DatabaseTestCase):
    """New objects must not re-acquire write rights for the public roles."""

    hardened = True

    def test_future_table_is_select_only(self) -> None:
        _run("create table public.acl_future_table (id int);", database=self.database)
        for role in ("anon", "authenticated"):
            self.assertTrue(self.privilege(role, "public.acl_future_table", "SELECT"))
            for kind in ("INSERT", "UPDATE", "DELETE", "TRUNCATE", "REFERENCES", "TRIGGER"):
                self.assertFalse(
                    self.privilege(role, f"public.acl_future_table", kind),
                    f"{role} inherited {kind} on a table created after the migration",
                )

    def test_future_view_is_not_updatable_by_public_roles(self) -> None:
        # The original defect, one object later: a new auto-updatable view must
        # not hand anon DELETE over whatever table it selects from.
        _run(
            "create table public.acl_future_src (id int); "
            "create view public.acl_future_view as select id from public.acl_future_src;",
            database=self.database,
        )
        self.assertTrue(self.privilege("anon", "public.acl_future_view", "SELECT"))
        self.dml_denied("anon", "delete from public.acl_future_view where true;")

    def test_service_role_still_gets_full_rights_on_future_objects(self) -> None:
        _run("create table public.acl_future_svc (id int);", database=self.database)
        for kind in ("SELECT", "INSERT", "UPDATE", "DELETE", "TRUNCATE"):
            self.assertTrue(
                self.privilege("service_role", "public.acl_future_svc", kind),
                f"service_role did not inherit {kind}; imports would break",
            )

    def test_default_acl_grants_only_select_to_public_roles(self) -> None:
        # Asserted against the catalog directly, at BOTH scopes, because the
        # global and schema-scoped entries are unioned.
        out = _scalar(
            "select coalesce(string_agg("
            "  coalesce(d.defaclnamespace::regnamespace::text, 'GLOBAL') || ':' || "
            "  a.grantee::regrole::text || ':' || a.privilege_type, ',' order by 1), '') "
            "from pg_default_acl d cross join lateral aclexplode(d.defaclacl) a "
            "where d.defaclobjtype = 'r' "
            "  and (d.defaclnamespace = 0 or d.defaclnamespace = 'public'::regnamespace) "
            "  and a.grantee in ('anon'::regrole, 'authenticated'::regrole);",
            database=self.database,
        )
        entries = [e for e in out.split(",") if e]
        self.assertTrue(entries, "no matching default-ACL entries found")
        for entry in entries:
            self.assertTrue(
                entry.endswith(":SELECT"),
                f"default privileges grant more than SELECT: {entry}",
            )


class HardeningIsIdempotent(_DatabaseTestCase):
    hardened = True

    def test_second_application_succeeds_and_preserves_invariants(self) -> None:
        _apply_file(HARDENING_FILE, self.database)
        self.assertTrue(self.privilege("anon", "public.catalogue_products", "SELECT"))
        for kind in ("INSERT", "UPDATE", "DELETE", "TRUNCATE"):
            self.assertFalse(self.privilege("anon", "public.catalogue_products", kind))

    def test_migration_is_separate_from_the_search_path_migration(self) -> None:
        # The two concerns are deliberately not merged; both must exist.
        self.assertTrue((MIGRATIONS / "20261124090000_fyndra_function_search_path.sql").is_file())
        self.assertTrue((MIGRATIONS / HARDENING_FILE).is_file())


if __name__ == "__main__":
    unittest.main(verbosity=2)
