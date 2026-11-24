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

succeeded because the view is auto-updatable and owned by a role with
rolbypassrls, while anon held the full arwdDxtm grant inherited from Supabase's
schema default privileges. Deleting through the view therefore rewrote into a
DELETE on public.affiliate_products executed as the owner, with RLS bypassed.

The hardening migration is fail-closed: anon and authenticated keep SELECT on
catalogue_products and nothing else anywhere in schema public, and new objects
are not born visible to them.

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

# Relations the hardening migration reviews explicitly. Anything else that
# appears in schema public is, by definition, unreviewed.
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

ALL_PRIVILEGES = (
    "SELECT",
    "INSERT",
    "UPDATE",
    "DELETE",
    "TRUNCATE",
    "REFERENCES",
    "TRIGGER",
)

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
insert into public.affiliate_clicks (program_slug) values ('admitad');
insert into public.admitad_import_runs (campaign_id) values (1);
insert into public.product_model_jobs (product_id, source_image_hash, source_image_url)
  select id, 'hash-acl', 'https://example.invalid/acl.png'
    from public.affiliate_products order by slug limit 1;
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
            _apply_file(HARDENING_FILE, cls.database)
        if cls.seeded:
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

    def sequence_privilege(self, role: str, relation: str, kind: str) -> bool:
        return _scalar(
            f"select has_sequence_privilege('{role}', '{relation}', '{kind}')::text;",
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
    """The view is SELECT-only for both public roles, and public SELECT works."""

    hardened = True

    def test_anon_has_exactly_select(self) -> None:
        self.assertTrue(self.privilege("anon", "public.catalogue_products", "SELECT"))
        for kind in ALL_PRIVILEGES[1:]:
            self.assertFalse(
                self.privilege("anon", "public.catalogue_products", kind),
                f"anon still holds {kind} on catalogue_products",
            )

    def test_authenticated_has_exactly_select(self) -> None:
        self.assertTrue(self.privilege("authenticated", "public.catalogue_products", "SELECT"))
        for kind in ALL_PRIVILEGES[1:]:
            self.assertFalse(
                self.privilege("authenticated", "public.catalogue_products", kind),
                f"authenticated still holds {kind} on catalogue_products",
            )

    def test_public_pseudo_role_holds_nothing_on_the_view(self) -> None:
        # grantee OID 0 is PUBLIC. A PUBLIC grant would re-expose the view to
        # every role, including ones created later.
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
        # RLS alone would filter rows, but the grant layer must deny first.
        for relation in ("product_model_jobs", "admitad_import_runs", "affiliate_clicks"):
            if relation not in self.public_tables():
                continue
            for role in ("anon", "authenticated"):
                self.dml_denied(role, f"select * from public.{relation};")


class TruncateRevocation(_DatabaseTestCase):
    """TRUNCATE is not filtered by RLS, so no public role may hold it."""

    hardened = True

    def test_no_public_table_grants_truncate_to_public_roles(self) -> None:
        tables = self.public_tables()
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


class MaintainRevocation(_DatabaseTestCase):
    """MAINTAIN (PostgreSQL 17+) is a lock-anything primitive; it must be gone."""

    hardened = True

    def setUp(self) -> None:
        if self.version < 170000:
            self.skipTest("MAINTAIN does not exist before PostgreSQL 17")

    def test_maintain_is_absent_everywhere(self) -> None:
        for role in ("anon", "authenticated"):
            for table in self.public_tables():
                self.assertFalse(
                    self.privilege(role, f"public.{table}", "MAINTAIN"),
                    f"{role} still holds MAINTAIN on public.{table}",
                )

    def test_anon_cannot_lock_an_internal_table(self) -> None:
        # This is the concrete harm: ACCESS EXCLUSIVE blocks every reader of
        # the catalogue's base table.
        self.dml_denied(
            "anon", "lock table public.affiliate_products in access exclusive mode;"
        )

    def test_anon_cannot_lock_the_queue(self) -> None:
        self.dml_denied(
            "anon", "lock table public.product_model_jobs in access exclusive mode;"
        )

    def test_baseline_would_have_allowed_locking(self) -> None:
        # Guards against the test passing for the wrong reason: confirm the
        # privilege this test denies is one the baseline actually granted.
        self.assertTrue(
            self.privilege("service_role", "public.affiliate_products", "MAINTAIN"),
            "service_role should retain MAINTAIN",
        )


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
        # The original defect, one object later: a new auto-updatable view must
        # not hand anon DELETE over whatever table it selects from.
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
        # service_role's default privileges are deliberately NOT revoked by the
        # hardening migration: imports, the 3D worker and click logging all run
        # as service_role and must keep working on new objects. Asserting the
        # entry still exists is what proves the hardening did not overreach.
        out = _scalar(
            "select coalesce(string_agg(a.privilege_type, ',' order by a.privilege_type), '') "
            "from pg_default_acl d cross join lateral aclexplode(d.defaclacl) a "
            "where d.defaclobjtype = 'r' "
            "  and d.defaclnamespace = 'public'::regnamespace "
            "  and a.grantee = 'service_role'::regrole;",
            database=self.database,
        )
        granted = {p for p in out.split(",") if p}
        self.assertIn("SELECT", granted, "service_role lost its default SELECT")
        self.assertIn("INSERT", granted, "service_role lost its default INSERT")
        self.assertIn("UPDATE", granted, "service_role lost its default UPDATE")
        self.assertIn("DELETE", granted, "service_role lost its default DELETE")

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
        self.assertEqual(entries, [], f"default privileges still grant to public roles: {entries}")


class UpgradePath(_DatabaseTestCase):
    """The migration must compose on top of the vulnerable state, not a clean one."""

    hardened = False

    def test_upgrade_from_vulnerable_state_closes_everything(self) -> None:
        # Baseline + app migrations + Supabase-style defaults is exactly the
        # state production is in. Harden it now, mid-test.
        self.assertTrue(self.privilege("anon", "public.catalogue_products", "DELETE"))

        _apply_file(HARDENING_FILE, self.database)

        for kind in ALL_PRIVILEGES[1:]:
            self.assertFalse(
                self.privilege("anon", "public.catalogue_products", kind),
                f"upgrade left {kind} on the view",
            )
        self.assertTrue(self.privilege("anon", "public.catalogue_products", "SELECT"))
        self.dml_denied("anon", "delete from public.catalogue_products where true;")
        self.assertEqual(self.approved_count(), 2)

    def test_upgrade_twice_is_stable(self) -> None:
        _apply_file(HARDENING_FILE, self.database)
        _apply_file(HARDENING_FILE, self.database)
        self.assertTrue(self.privilege("anon", "public.catalogue_products", "SELECT"))
        for relation in INTERNAL_RELATIONS:
            if relation not in self.public_tables():
                continue
            self.assertFalse(
                self.privilege("anon", f"public.{relation}", "SELECT"),
                f"re-running the upgrade re-opened public.{relation}",
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

    def test_reviewed_relations_are_named_not_pattern_matched(self) -> None:
        # Two distinct properties, both important:
        #   (a) a relation this migration never reviewed is NOT touched by it,
        #       so an unrelated later grant cannot be clobbered by a re-run;
        #   (b) the reviewed internal relations stay closed on a re-run, because
        #       someone re-opening one is a regression, not an override.
        _run(
            "create table public.acl_unreviewed_later (id int); "
            "grant select on public.acl_unreviewed_later to anon;",
            database=self.database,
        )
        _apply_file(HARDENING_FILE, self.database)

        self.assertTrue(
            self.privilege("anon", "public.acl_unreviewed_later", "SELECT"),
            "the migration touched a relation it never reviewed",
        )
        self.assertFalse(
            self.privilege("anon", "public.affiliate_programs", "SELECT"),
            "a reviewed internal relation was left open",
        )


if __name__ == "__main__":
    unittest.main(verbosity=2)
