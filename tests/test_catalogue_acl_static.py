"""Static contract tests for the canonical catalogue ACL lockdown.

These tests never open a database connection. They parse the shipped SQL and
assert on the structure of individual statements, so they run in CI jobs that
have no PostgreSQL available.

They are deliberately NOT a substitute for the integration suite in
``test_catalogue_acl_lockdown.py``. Privilege results depend on server state --
ownership, RLS, inherited grants, the server version -- and only a real server
can prove them. This module proves something different and complementary: that
the statements which establish those privileges are still present, are still
targeted at the right objects, and have not been weakened by an edit.

A run where the integration suite is skipped is NOT evidence of database
security. ``IntegrationSuiteIsNotSilentlySkipped`` below fails if the
integration suite collapses to nothing.

Parsing notes
-------------
Assertions are made against parsed statements rather than substring searches.
A naive ``"grant" in sql`` check passes for ``revoke all ... from anon`` and for
prose in comments, which is exactly the failure mode that let the original
defect ship. Comments are stripped first, statements are split on semicolons
outside quotes and dollar-quoted bodies, and each statement is classified and
asserted on its own.
"""

from __future__ import annotations

import pathlib
import re
import unittest

REPO_ROOT = pathlib.Path(__file__).resolve().parent.parent
MIGRATIONS = REPO_ROOT / "supabase" / "migrations"
DOCS = REPO_ROOT / "docs" / "DATABASE-SCHEMA.md"
LOCKDOWN_FILE = "20261124130000_fyndra_public_acl_lockdown.sql"
SEARCH_PATH_FILE = "20261124090000_fyndra_function_search_path.sql"
THREE_D_FILE = "20261123150000_fyndra_3d_models.sql"
ADMITAD_FILE = "0001_admitad_integration.sql"

INTERNAL_RELATIONS = (
    "affiliate_programs",
    "affiliate_categories",
    "admitad_import_runs",
    "admitad_import_errors",
    "affiliate_clicks",
    "product_model_jobs",
)

PUBLIC_ROLES = ("anon", "authenticated")
WRITE_PRIVILEGES = ("insert", "update", "delete", "truncate", "references", "trigger")

DOLLAR_TAG = re.compile(r"\$[A-Za-z_0-9]*\$")


def _dollar_tag(sql, index):
    """Return the dollar-quote tag starting at ``index``, if any."""
    return DOLLAR_TAG.match(sql, index)


def strip_comments(sql):
    """Remove ``--`` and ``/* */`` comments, preserving everything else.

    Dollar-quoted bodies and single-quoted literals are copied through
    untouched, so a ``--`` inside a string or a function body is not treated
    as a comment.
    """
    out = []
    i = 0
    length = len(sql)
    while i < length:
        char = sql[i]
        if char == "-" and sql.startswith("--", i):
            newline = sql.find("\n", i)
            i = length if newline == -1 else newline
            continue
        if char == "/" and sql.startswith("/*", i):
            end = sql.find("*/", i + 2)
            i = length if end == -1 else end + 2
            continue
        if char == "'":
            j = i + 1
            while j < length:
                if sql[j] == "'" and sql[j + 1 : j + 2] == "'":
                    j += 2
                    continue
                if sql[j] == "'":
                    j += 1
                    break
                j += 1
            out.append(sql[i:j])
            i = j
            continue
        tag = _dollar_tag(sql, i)
        if tag is not None:
            marker = tag.group(0)
            end = sql.find(marker, i + len(marker))
            end = length if end == -1 else end + len(marker)
            out.append(sql[i:end])
            i = end
            continue
        out.append(char)
        i += 1
    return "".join(out)


def split_statements(sql):
    """Split on semicolons that are outside literals and dollar-quoted bodies."""
    statements = []
    buffer = []
    i = 0
    length = len(sql)
    while i < length:
        char = sql[i]
        if char == "'":
            j = i + 1
            while j < length:
                if sql[j] == "'" and sql[j + 1 : j + 2] == "'":
                    j += 2
                    continue
                if sql[j] == "'":
                    j += 1
                    break
                j += 1
            buffer.append(sql[i:j])
            i = j
            continue
        tag = _dollar_tag(sql, i)
        if tag is not None:
            marker = tag.group(0)
            end = sql.find(marker, i + len(marker))
            end = length if end == -1 else end + len(marker)
            buffer.append(sql[i:end])
            i = end
            continue
        if char == ";":
            statement = "".join(buffer).strip()
            if statement:
                statements.append(statement)
            buffer = []
            i += 1
            continue
        buffer.append(char)
        i += 1
    tail = "".join(buffer).strip()
    if tail:
        statements.append(tail)
    return statements

def normalise(statement):
    """Collapse whitespace so multi-line statements compare as one line."""
    return " ".join(statement.split()).lower()


def is_dollar_block(statement):
    return normalise(statement).startswith("do $")


def block_body(statement):
    """Return the plpgsql body of a DO block, lowercased and normalised."""
    first = statement.find("$")
    if first == -1:
        return ""
    tag = _dollar_tag(statement, first)
    if tag is None:
        return ""
    marker = tag.group(0)
    start = first + len(marker)
    end = statement.find(marker, start)
    if end == -1:
        return ""
    return " ".join(statement[start:end].split()).lower()


def lockdown_sql():
    return (MIGRATIONS / LOCKDOWN_FILE).read_text(encoding="utf-8")


def statements():
    return split_statements(strip_comments(lockdown_sql()))


def _starts(statement, keyword):
    return normalise(statement).startswith(keyword)


def grants():
    return [normalise(s) for s in statements() if _starts(s, "grant ")]


def revokes():
    return [normalise(s) for s in statements() if _starts(s, "revoke ")]


def alters():
    return [normalise(s) for s in statements() if _starts(s, "alter ")]


def creates():
    return [normalise(s) for s in statements() if _starts(s, "create ")]


def dollar_blocks():
    return [s for s in statements() if is_dollar_block(s)]


def has_create_event_trigger(sql):
    """True if the script creates an event trigger, ignoring prose in comments."""
    for statement in split_statements(strip_comments(sql)):
        if re.match(r"^\s*create\s+event\s+trigger\b", statement, re.IGNORECASE):
            return True
    return False


def execute_literal(text):
    """Return the lowercased SQL passed to EXECUTE, if the call is a plain literal."""
    match = re.search(r"execute\s+format\s*\(\s*'([^']*)'", text, re.IGNORECASE)
    if match:
        return match.group(1).lower()
    match = re.search(r"execute\s+'([^']*)'", text, re.IGNORECASE)
    return match.group(1).lower() if match else ""


def executed_sql(body):
    """Every literal handed to EXECUTE/FORMAT in a plpgsql body, joined."""
    parts = re.findall(r"'(?:[^']|'')*'", body)
    return " ".join(part.strip("'") for part in parts).lower()


class _StaticTest(unittest.TestCase):
    """Base class that fails loudly if the migration is missing."""

    @classmethod
    def setUpClass(cls):
        if not (MIGRATIONS / LOCKDOWN_FILE).is_file():
            raise AssertionError("canonical migration is missing: " + LOCKDOWN_FILE)

class CanonicalMigrationSet(_StaticTest):
    """Exactly one active ACL migration, and it is the expected file."""

    def test_exactly_one_active_acl_migration(self):
        names = sorted(
            p.name for p in MIGRATIONS.glob("*.sql")
            if "acl" in p.name.lower() or "lockdown" in p.name.lower()
        )
        self.assertEqual(names, [LOCKDOWN_FILE], "unexpected ACL migrations: %s" % names)

    def test_no_duplicate_migration_versions(self):
        versions = [p.name.split("_")[0] for p in MIGRATIONS.glob("*.sql")]
        duplicates = sorted({v for v in versions if versions.count(v) > 1})
        self.assertEqual(duplicates, [], "duplicate migration versions: %s" % duplicates)

    def test_rejected_candidate_is_not_active(self):
        rejected = MIGRATIONS / "20261124120000_fyndra_catalogue_acl_hardening.sql"
        self.assertFalse(rejected.exists(), "rejected candidate is still in the migration path")

    def test_dependency_migrations_exist(self):
        for name in (ADMITAD_FILE, THREE_D_FILE, SEARCH_PATH_FILE):
            self.assertTrue((MIGRATIONS / name).is_file(), "missing dependency: " + name)

    def test_historical_migrations_are_untouched_by_this_file(self):
        for name in (ADMITAD_FILE, THREE_D_FILE):
            text = (MIGRATIONS / name).read_text(encoding="utf-8").lower()
            self.assertNotIn(
                "security_invoker = true",
                text.replace("security_invoker = false", ""),
                "%s already sets security_invoker; the lockdown would be redundant" % name,
            )


class ViewRunsAsCaller(_StaticTest):
    """security_invoker=true on the catalogue view, and reads stay granted."""

    def test_security_invoker_is_enabled_exactly_once(self):
        matching = [
            a for a in alters()
            if a.startswith("alter view public.catalogue_products set")
            and "security_invoker = true" in a
        ]
        self.assertEqual(len(matching), 1, "expected one security_invoker ALTER, got %s" % matching)

    def test_security_invoker_is_never_disabled(self):
        for statement in statements():
            self.assertNotIn(
                "security_invoker = false",
                normalise(statement),
                "the canonical migration disables security_invoker",
            )

    def test_security_barrier_is_kept(self):
        matching = [a for a in alters() if "security_barrier = true" in a]
        self.assertEqual(len(matching), 1, "expected one security_barrier ALTER, got %s" % matching)

    def test_view_is_revoked_before_being_granted(self):
        ordered = [normalise(s) for s in statements()]
        revoke_at = [i for i, s in enumerate(ordered) if s.startswith("revoke all on public.catalogue_products")]
        grant_at = [i for i, s in enumerate(ordered) if s.startswith("grant select on public.catalogue_products")]
        self.assertTrue(revoke_at, "the view is never revoked; inherited grants would survive")
        self.assertTrue(grant_at, "the view is never granted SELECT; public reads would break")
        self.assertLess(
            max(revoke_at), min(grant_at),
            "GRANT runs before REVOKE, so the inherited write grant is never removed",
        )

    def test_view_grant_is_select_only(self):
        view_grants = [g for g in grants() if "on public.catalogue_products" in g]
        self.assertTrue(view_grants, "no grant on catalogue_products found")
        for grant in view_grants:
            self.assertTrue(grant.startswith("grant select "), "non-SELECT view grant: " + grant)
            for privilege in WRITE_PRIVILEGES:
                self.assertNotIn(privilege, grant, "%s granted on the view: %s" % (privilege, grant))

    def test_view_grant_names_both_public_roles(self):
        view_grants = [g for g in grants() if "on public.catalogue_products" in g]
        self.assertEqual(len(view_grants), 1, "expected exactly one view grant")
        for role in PUBLIC_ROLES:
            self.assertIn(role, view_grants[0], "%s does not receive public read access" % role)

class NoEventTriggerOrSuperuser(_StaticTest):
    """The canonical migration must not require a superuser."""

    def test_no_create_event_trigger_statement(self):
        self.assertFalse(
            has_create_event_trigger(lockdown_sql()),
            "the canonical migration creates an event trigger, which requires SUPERUSER",
        )

    def test_no_rolsuper_check(self):
        for statement in statements():
            self.assertNotIn(
                "rolsuper",
                normalise(statement),
                "the migration checks rolsuper, so it can only run as a superuser",
            )

    def test_no_event_trigger_function_is_defined(self):
        for statement in creates():
            self.assertNotIn("event_trigger", statement, "event trigger helper defined")

    def test_invariant_blocks_abort_rather_than_warn(self):
        # Without an event trigger there is no in-transaction guarantee, so any
        # block that verifies a security invariant must abort rather than warn.
        # Purely advisory blocks -- reporting extension-owned relations, or
        # relations outside the reviewed allowlist -- are expected to warn only.
        advisory = ("pg_extension", "pg_depend", "unreviewed")
        for statement in statements():
            if not is_dollar_block(statement):
                continue
            body = block_body(statement)
            if any(marker in body for marker in advisory):
                continue
            if "raise warning" in body and "raise exception" not in body:
                self.fail(
                    "an invariant-checking DO block only warns, so a failed "
                    "check would still commit: " + body[:100]
                )


class ColumnGrants(_StaticTest):
    """Base-table access is per-column and derived from the view, never table-wide."""

    def test_table_level_privileges_are_revoked_before_column_grant(self):
        ordered = [normalise(s) for s in statements()]
        revoke_at = [i for i, s in enumerate(ordered) if s.startswith("revoke all on public.affiliate_products")]
        self.assertTrue(
            revoke_at,
            "the base table is never revoked, so an inherited table-level grant could survive",
        )

    def test_no_table_level_select_grant_on_the_base_table(self):
        for grant in grants():
            if "on public.affiliate_products" not in grant:
                continue
            self.assertRegex(
                grant,
                r"^grant select \([^)]+\) on public\.affiliate_products",
                "base-table grant is not column-scoped: " + grant,
            )

    def test_column_list_is_derived_from_the_view(self):
        derived = [
            block for block in dollar_blocks()
            if "string_agg(quote_ident(a.attname)" in block_body(block)
            and "'public.catalogue_products'::regclass" in block_body(block)
        ]
        self.assertEqual(
            len(derived), 1,
            "the base-table column grant must be derived from the view definition",
        )
        sql = execute_literal(block_body(derived[0]))
        self.assertIn("grant select", sql, "unexpected dynamic SQL: " + sql)
        self.assertIn("public.affiliate_products", sql, sql)
        self.assertIn("anon, authenticated", sql, sql)

    def test_derived_column_grant_is_not_table_wide(self):
        derived = [
            block for block in dollar_blocks()
            if "string_agg(quote_ident(a.attname)" in block_body(block)
        ]
        self.assertEqual(len(derived), 1)
        sql = execute_literal(block_body(derived[0]))
        self.assertIn("grant select (", sql, "the derived grant is not column-scoped: " + sql)

    def test_sensitive_columns_are_absent_from_the_view_projection(self):
        code = strip_comments((MIGRATIONS / THREE_D_FILE).read_text(encoding="utf-8"))
        match = re.search(
            r"create\s+or\s+replace\s+view\s+public\.catalogue_products(.*?)"
            r"\bfrom\s+public\.affiliate_products",
            code,
            re.IGNORECASE | re.DOTALL,
        )
        self.assertIsNotNone(match, "could not locate the catalogue_products view definition")
        projection = match.group(1).lower()
        for column in (
            "evidence_notes",
            "research_confidence",
            "commission_info",
            "model_error",
            "positioning_angle",
            "risk_flags",
            "content_hooks",
        ):
            self.assertNotRegex(
                projection,
                r"\b%s\b" % column,
                "%s appears in the view projection, so it would be grantable" % column,
            )

class InternalRelationControls(_StaticTest):
    """Internal tables are closed, and named explicitly rather than pattern-matched."""

    def _revoke_block(self):
        matching = [
            block for block in dollar_blocks()
            if "revoke all on public.%i from public, anon, authenticated" in block_body(block)
        ]
        self.assertEqual(len(matching), 1, "expected one internal-revoke block, got %d" % len(matching))
        return block_body(matching[0])

    def test_internal_relations_are_revoked_by_name(self):
        body = self._revoke_block()
        for relation in INTERNAL_RELATIONS:
            self.assertIn("'%s'" % relation, body, "%s is not in the revoke list" % relation)

    def test_revoke_is_guarded_by_to_regclass(self):
        self.assertIn("to_regclass", self._revoke_block(), "the revoke is not guarded")

    def test_revoke_covers_every_public_role(self):
        body = self._revoke_block()
        for role in ("public", "anon", "authenticated"):
            self.assertIn(role, body, "%s is not covered by the internal revoke" % role)

    def test_revoke_is_not_pattern_matched(self):
        body = self._revoke_block()
        self.assertNotIn("like ", body, "relations are selected by pattern rather than by name")


class TruncateAndMaintain(_StaticTest):
    """TRUNCATE, REFERENCES, TRIGGER and MAINTAIN are all revoked schema-wide."""

    def test_truncate_references_trigger_revoked_together(self):
        matching = [
            r for r in revokes()
            if "truncate" in r and "references" in r and "trigger" in r
            and "on all tables in schema public" in r
        ]
        self.assertEqual(
            len(matching), 1,
            "expected one schema-wide TRUNCATE/REFERENCES/TRIGGER revoke, got %s" % matching,
        )
        for role in ("public", "anon", "authenticated"):
            self.assertIn(role, matching[0], "%s is not covered" % role)

    def test_maintain_revoke_is_version_gated(self):
        matching = [block for block in dollar_blocks() if "revoke maintain" in block_body(block)]
        self.assertEqual(len(matching), 1, "expected one MAINTAIN revoke, got %d" % len(matching))
        body = block_body(matching[0])
        self.assertIn(
            "server_version_num')::int >= 170000",
            body,
            "MAINTAIN is not gated on PostgreSQL 17, where the keyword exists",
        )
        sql = execute_literal(body)
        self.assertIn("revoke maintain on all tables in schema public", sql, sql)
        self.assertIn("anon, authenticated", sql, sql)

    def test_maintain_is_never_granted(self):
        for grant in grants():
            self.assertNotIn("maintain", grant, "MAINTAIN is granted: " + grant)

    def test_no_write_privilege_is_granted_anywhere(self):
        for grant in grants():
            head = grant.split(" on ")[0]
            for privilege in WRITE_PRIVILEGES:
                self.assertNotIn(privilege, head, "write privilege granted: " + grant)

class DefaultPrivileges(_StaticTest):
    """Both default-ACL scopes are revoked, for tables and sequences."""

    def _block(self):
        matching = [block for block in dollar_blocks() if "alter default privileges" in block_body(block)]
        self.assertEqual(len(matching), 1, "expected one default-privilege block, got %d" % len(matching))
        return block_body(matching[0])

    def test_global_scope_is_revoked(self):
        body = self._block()
        self.assertIn(
            "alter default privileges for role %i revoke all on tables from public, anon, authenticated",
            body,
            "the global default-ACL entry for tables is not revoked",
        )
        self.assertIn(
            "alter default privileges for role %i revoke all on sequences from public, anon, authenticated",
            body,
            "the global default-ACL entry for sequences is not revoked",
        )

    def test_schema_scoped_scope_is_revoked(self):
        body = self._block()
        self.assertIn(
            "alter default privileges for role %i in schema public revoke all on tables "
            "from public, anon, authenticated",
            body,
            "the schema-scoped default-ACL entry for tables is not revoked",
        )
        self.assertIn(
            "alter default privileges for role %i in schema public revoke all on sequences "
            "from public, anon, authenticated",
            body,
            "the schema-scoped default-ACL entry for sequences is not revoked",
        )

    def test_both_scopes_are_present_together(self):
        body = self._block()
        globals_ = body.count("alter default privileges for role %i revoke")
        scoped = body.count("alter default privileges for role %i in schema public revoke")
        self.assertEqual(globals_, 2, "expected global revokes for tables and sequences")
        self.assertEqual(scoped, 2, "expected schema-scoped revokes for tables and sequences")

    def test_no_default_privilege_grant_exists(self):
        for statement in statements():
            body = normalise(statement)
            self.assertNotRegex(
                body,
                r"alter\s+default\s+privileges[^;]*\bgrant\b",
                "a default privilege is granted: " + body[:120],
            )

    def test_migration_role_failure_is_raised_not_swallowed(self):
        body = self._block()
        self.assertIn("when insufficient_privilege then", body, "42501 is not handled explicitly")
        self.assertIn("raise exception", body, "a failure on the migration role must abort")

    def test_unmanageable_roles_warn_rather_than_claim_success(self):
        body = self._block()
        self.assertIn("raise warning", body, "the reserved-role limitation is not reported")
        self.assertIn("42501", body, "the 42501 case is not described")

    def test_only_managed_roles_are_asserted(self):
        body = self._block()
        self.assertIn(
            "=any(managed)",
            body.replace(" ", ""),
            "the self-check asserts over roles it never managed",
        )

    def test_sequences_are_revoked_schema_wide(self):
        matching = [r for r in revokes() if "sequence" in r and "in schema public" in r]
        self.assertEqual(len(matching), 1, "expected one sequence revoke, got %s" % matching)
        for role in ("public", "anon", "authenticated"):
            self.assertIn(role, matching[0], "%s is not covered by the sequence revoke" % role)


class SearchPathSeparation(_StaticTest):
    """search_path pinning stays in its own migration; nothing is redefined here."""

    def test_lockdown_defines_no_functions(self):
        for statement in creates():
            self.assertNotRegex(
                statement,
                r"create\s+(or\s+replace\s+)?function",
                "function defined in the lockdown migration: " + statement[:100],
            )

    def test_lockdown_does_not_pin_a_search_path(self):
        for statement in statements():
            body = normalise(statement)
            self.assertNotRegex(
                body,
                r"set\s+search_path\s*(?:=|to)\s*'",
                "search_path is pinned in the lockdown migration: " + body[:120],
            )

    def test_search_path_migration_pins_both_trigger_functions(self):
        code = strip_comments((MIGRATIONS / SEARCH_PATH_FILE).read_text(encoding="utf-8"))
        for function in ("protect_manual_product", "set_product_model_jobs_updated_at"):
            self.assertIn(function, code, "%s is not re-created by the search_path migration" % function)
        pins = re.findall(r"set\s+search_path\s*=\s*''", code, re.IGNORECASE)
        self.assertGreaterEqual(len(pins), 2, "expected two empty-path pins, found %d" % len(pins))

    def test_search_path_migration_changes_no_privileges(self):
        code = strip_comments((MIGRATIONS / SEARCH_PATH_FILE).read_text(encoding="utf-8"))
        for statement in split_statements(code):
            body = normalise(statement)
            self.assertFalse(
                body.startswith("grant ") or body.startswith("revoke "),
                "search_path migration changes privileges: " + body[:100],
            )

class ForwardOnlyAndNonDestructive(_StaticTest):
    """The migration only adds or revokes privileges for the public roles."""

    def test_no_drop_statements(self):
        for statement in statements():
            self.assertNotRegex(normalise(statement), r"^drop\s", "destructive statement: " + statement[:100])

    def test_no_dml_statements(self):
        for statement in statements():
            self.assertNotRegex(
                normalise(statement),
                r"^(insert|update|delete|truncate|copy)\s",
                "DML in a privilege migration: " + statement[:100],
            )

    def test_no_alter_table_statement(self):
        for statement in statements():
            self.assertNotRegex(
                normalise(statement),
                r"^alter\s+table\s",
                "schema change in a privilege migration: " + statement[:100],
            )

    def test_no_create_table_or_policy(self):
        for statement in creates():
            self.assertNotRegex(
                statement,
                r"create\s+(table|policy|index|unique)",
                "object creation in a privilege migration: " + statement[:100],
            )

    def test_service_role_is_never_revoked(self):
        for revoke in revokes():
            self.assertNotIn(
                "service_role",
                revoke,
                "service_role privileges are revoked, breaking imports and the 3D worker: " + revoke,
            )

    def test_every_revoke_names_a_public_role(self):
        for revoke in revokes():
            self.assertTrue(
                any(role in revoke for role in ("public", "anon", "authenticated")),
                "revoke targets no public role: " + revoke,
            )

    def test_every_revoke_includes_public_pseudo_role(self):
        for revoke in revokes():
            self.assertIn(
                "public",
                revoke,
                "revoke omits PUBLIC, so inherited grants survive: " + revoke,
            )


class Preflight(_StaticTest):
    """Inputs are asserted before anything is revoked."""

    def test_preflight_is_the_first_statement(self):
        first = statements()[0]
        self.assertTrue(is_dollar_block(first), "the first statement is not a preflight block")
        body = block_body(first)
        self.assertIn("public.catalogue_products", body, "preflight does not check the view")
        self.assertIn("public.affiliate_products", body, "preflight does not check the base table")
        self.assertIn("raise exception", body, "preflight does not abort")

    def test_preflight_requires_postgresql_15(self):
        body = block_body(statements()[0])
        self.assertIn(
            "server_version_num')::int < 150000",
            body,
            "security_invoker requires PostgreSQL 15+; the guard is missing",
        )

    def test_preflight_checks_public_roles_exist(self):
        body = block_body(statements()[0])
        for role in PUBLIC_ROLES:
            self.assertIn(role, body, "preflight does not check for role %s" % role)

    def test_first_privilege_statement_comes_after_preflight(self):
        first = normalise(statements()[0])
        self.assertTrue(is_dollar_block(statements()[0]), first[:80])
        self.assertFalse(first.startswith("revoke"), "a revoke runs before any preflight check")


class RlsIsAssertedNotRedefined(_StaticTest):
    """The policy belongs to 0001; this migration only asserts it exists."""

    def _rls_block(self):
        matching = [block for block in dollar_blocks() if "products_read_approved" in block_body(block)]
        self.assertEqual(len(matching), 1, "the RLS policy is not asserted exactly once")
        return block_body(matching[0])

    def test_policy_is_asserted_through_pg_policies(self):
        body = self._rls_block()
        self.assertIn("pg_policies", body, "the assertion does not read pg_policies")
        self.assertIn("raise exception", body, "a missing policy does not abort")

    def test_policy_is_never_created_or_dropped_here(self):
        for statement in statements():
            body = normalise(statement)
            self.assertNotRegex(body, r"create\s+policy", "the policy is redefined: " + body[:100])
            self.assertNotRegex(body, r"drop\s+policy", "the policy is dropped: " + body[:100])

    def test_row_level_security_is_asserted_enabled(self):
        matching = [block for block in dollar_blocks() if "relrowsecurity" in block_body(block)]
        self.assertEqual(len(matching), 1, "RLS state is not asserted")

    def test_policy_object_is_not_dropped_indirectly(self):
        for statement in statements():
            self.assertNotIn("drop policy", normalise(statement))


class AdminLimitationIsDocumented(_StaticTest):
    """The supabase_admin gap is written down rather than assumed away."""

    def test_docs_name_the_supabase_admin_limitation(self):
        text = DOCS.read_text(encoding="utf-8")
        self.assertIn("supabase_admin", text, "the reserved-role limitation is undocumented")
        self.assertGreaterEqual(
            text.count("supabase_admin"), 3,
            "the limitation is mentioned but not explained",
        )

    def test_docs_say_it_requires_a_platform_fix(self):
        text = DOCS.read_text(encoding="utf-8").lower()
        self.assertIn("platform", text, "the docs do not say the gap needs a platform-level fix")

    def test_migration_records_the_limitation(self):
        self.assertIn(
            "supabase_admin",
            lockdown_sql().lower(),
            "the migration does not record the limitation",
        )

    def test_docs_do_not_justify_security_invoker_false(self):
        text = DOCS.read_text(encoding="utf-8")
        self.assertNotIn(
            "which is what we want here",
            text,
            "the obsolete justification for security_invoker=false is still present",
        )

    def test_docs_describe_security_invoker_true(self):
        code = strip_comments(DOCS.read_text(encoding="utf-8"))
        self.assertIn(
            "security_invoker = true",
            code,
            "the docs do not describe the corrected architecture",
        )

class IntegrationSuiteIsNotSilentlySkipped(unittest.TestCase):
    """A green static run must never be mistaken for a green database run.

    The integration suite skips every live test when PostgreSQL is unreachable.
    ``unittest`` still reports ``OK (skipped=N)``, and a CI check that only looks
    at the exit code would record that as a database security pass. This guard
    keeps the distinction visible: it fails if the integration module is missing
    or has collapsed to a trivial number of tests.

    It does not, and cannot, turn a skipped run into a passing one. It only
    prevents the static suite from being cited as database evidence.
    """

    INTEGRATION = REPO_ROOT / "tests" / "test_catalogue_acl_lockdown.py"

    def test_integration_module_exists(self):
        self.assertTrue(
            self.INTEGRATION.is_file(),
            "the integration suite is missing; static tests are not a substitute",
        )

    def test_integration_suite_has_not_shrunk(self):
        import importlib.util

        spec = importlib.util.spec_from_file_location("acl_integration_probe", self.INTEGRATION)
        self.assertIsNotNone(spec, "could not create an import spec for the integration suite")
        module = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(module)

        loader = unittest.TestLoader()
        total = 0
        for name in dir(module):
            candidate = getattr(module, name)
            if isinstance(candidate, type) and issubclass(candidate, unittest.TestCase):
                total += loader.loadTestsFromTestCase(candidate).countTestCases()

        self.assertGreaterEqual(
            total, 40,
            "the integration suite collects only %d tests; expected at least 40" % total,
        )

    def test_database_requirement_can_be_enforced_in_ci(self):
        """Opt-in gate: fail when CI demands database coverage but gets none.

        Without this, ``python -m unittest discover`` reports
        ``OK (skipped=N)`` when PostgreSQL is unreachable, and a pipeline that
        only checks the exit code would record a database security pass that
        never happened. Set ``FYNDRA_REQUIRE_DATABASE_TESTS=1`` in the job that
        is supposed to run the integration suite; it is unset by default so a
        laptop or a docs-only job still runs green.
        """
        import os
        import subprocess

        if os.environ.get("FYNDRA_REQUIRE_DATABASE_TESTS") != "1":
            self.skipTest("FYNDRA_REQUIRE_DATABASE_TESTS is not set")

        psql = None
        for directory in os.environ.get("PATH", "").split(os.pathsep):
            candidate = pathlib.Path(directory) / "psql"
            if candidate.is_file():
                psql = str(candidate)
                break
        self.assertIsNotNone(psql, "FYNDRA_REQUIRE_DATABASE_TESTS=1 but psql is not on PATH")

        env = {k: v for k, v in os.environ.items() if not k.startswith("PG")}
        for key in ("PGHOST", "PGPORT", "PGUSER", "PGPASSWORD", "PGDATABASE", "PGSSLMODE"):
            if key in os.environ:
                env[key] = os.environ[key]

        probe = subprocess.run(
            [psql, "-X", "-q", "-A", "-t", "-v", "ON_ERROR_STOP=1", "-c", "select 1;"],
            capture_output=True,
            text=True,
            env=env,
            timeout=30,
        )
        self.assertEqual(
            probe.returncode,
            0,
            "FYNDRA_REQUIRE_DATABASE_TESTS=1 but PostgreSQL is unreachable "
            "(%s); the integration suite would have been skipped, so this run "
            "proves nothing about database security" % probe.stderr.strip(),
        )

    def test_docs_do_not_claim_static_tests_are_database_proof(self):
        text = DOCS.read_text(encoding="utf-8").lower()
        self.assertNotIn(
            "static contract tests over the shipped sql",
            text,
            "the docs still describe static tests as if they exercised the database",
        )


class StatementParserSelfTests(unittest.TestCase):
    """The parser itself must be trustworthy, or every assertion above is noise."""

    def test_comments_are_stripped(self):
        self.assertEqual(strip_comments("-- grant all\nselect 1;").strip(), "select 1;")

    def test_block_comments_are_stripped(self):
        self.assertEqual(strip_comments("/* grant all */ select 1;").strip(), "select 1;")

    def test_dashes_inside_literals_survive(self):
        sql = "select '--not a comment';"
        self.assertIn("--not a comment", strip_comments(sql))

    def test_dollar_body_is_not_split(self):
        parts = split_statements("do $$ begin perform 1; end; $$; select 2;")
        self.assertEqual(len(parts), 2, parts)
        self.assertIn("perform 1;", parts[0])

    def test_commented_out_grant_is_not_seen(self):
        code = strip_comments("-- grant select on public.affiliate_products to anon;\nrevoke all on x from anon;")
        self.assertEqual(len(split_statements(code)), 1)
        self.assertNotIn("grant", code.lower())

    def test_revoke_all_is_not_mistaken_for_a_grant(self):
        parsed = [normalise(s) for s in split_statements("revoke all on public.affiliate_products from anon;")]
        self.assertEqual([p for p in parsed if p.startswith("grant ")], [])

    def test_semicolon_inside_literal_is_not_a_separator(self):
        parts = split_statements("select 'a;b'; select 2;")
        self.assertEqual(len(parts), 2, parts)

    def test_event_trigger_detection_ignores_comments(self):
        self.assertFalse(has_create_event_trigger("-- create event trigger x\nselect 1;"))
        self.assertTrue(has_create_event_trigger("create event trigger x on ddl_command_end execute function f();"))


if __name__ == "__main__":
    unittest.main(verbosity=2)