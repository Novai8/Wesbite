"""
Static checks on the function search_path migration.

Runs everywhere (no database, no Docker): it parses the migration text and
asserts the properties the security review asked for, so a future edit that
silently widens the path fails here.
"""

from __future__ import annotations

import re
import unittest
from pathlib import Path

MIGRATIONS = Path(__file__).resolve().parents[1] / "supabase/migrations"
MIGRATION = MIGRATIONS / "20261124090000_fyndra_function_search_path.sql"


def sql() -> str:
    return MIGRATION.read_text(encoding="utf-8")


def without_comments() -> str:
    """The migration with comment-only lines removed.

    Comments describe the fix and legitimately mention now() and
    "search_path = ''"; only executable SQL should be asserted on.
    """
    return "\n".join(
        line for line in sql().splitlines() if not line.lstrip().startswith("--")
    )


def normalised() -> str:
    return re.sub(r"\s+", " ", without_comments().lower())


class SearchPathMigration(unittest.TestCase):
    def test_migration_exists(self) -> None:
        self.assertTrue(MIGRATION.is_file(), f"missing {MIGRATION}")

    def test_pins_both_project_functions_to_an_empty_path(self) -> None:
        body = normalised()
        for function in ("protect_manual_product", "set_product_model_jobs_updated_at"):
            self.assertIn(
                f"create or replace function public.{function}()",
                body,
                f"{function} must be redefined so its settings are replaced",
            )
        # Two definitions, two pins.
        self.assertEqual(body.count("set search_path = ''"), 2)

    def test_bodies_are_schema_qualified(self) -> None:
        body = normalised()
        # With an empty path an unqualified now() would not resolve, so every
        # call site must be qualified and the two counts must agree.
        self.assertEqual(
            body.count("now()"),
            body.count("pg_catalog.now()"),
            "every now() call must be pg_catalog.now() once the path is empty",
        )
        self.assertEqual(body.count("pg_catalog.now()"), 2)

    def test_does_not_touch_platform_rls_helper(self) -> None:
        body = normalised()
        self.assertNotIn("create or replace function public.rls_auto_enable", body)
        self.assertNotIn("alter function public.rls_auto_enable", body)
        self.assertNotIn("drop function", body)
        # The rationale lives in a comment, so check the raw file text.
        self.assertIn("deliberately untouched", sql().lower())

    def test_is_additive(self) -> None:
        body = normalised()
        for statement in (
            "drop table",
            "drop column",
            "truncate",
            "delete from",
            "alter column",
            "drop constraint",
            "drop policy",
            "revoke ",
        ):
            self.assertNotIn(statement, body, f"migration must stay additive: found {statement!r}")

    def test_only_touches_the_two_named_functions(self) -> None:
        defined = re.findall(r"create or replace function public\.([a-z_]+)\(", normalised())
        self.assertEqual(
            sorted(defined),
            ["protect_manual_product", "set_product_model_jobs_updated_at"],
        )

    def test_self_check_fails_loudly(self) -> None:
        body = normalised()
        self.assertIn("raise exception", body)
        self.assertIn("search_path is still mutable", body)

    def test_is_guarded_against_a_missing_function(self) -> None:
        # The body is only replaced when the function already exists; the
        # migration must not invent a trigger function that no trigger uses.
        self.assertEqual(normalised().count("if exists ("), 2)

    def test_runs_after_the_migrations_that_create_the_functions(self) -> None:
        # Only ordering against the migrations that define the functions
        # matters. Later migrations (for example ACL hardening) are free to
        # sort after this one because they do not redefine these functions.
        names = sorted(path.name for path in MIGRATIONS.glob("*.sql"))
        creators = [
            "0001_admitad_integration.sql",
            "20261123150000_fyndra_3d_models.sql",
        ]
        for creator in creators:
            self.assertIn(creator, names)
            self.assertLess(
                names.index(creator),
                names.index(MIGRATION.name),
                f"search_path migration must run after {creator}",
            )


if __name__ == "__main__":
    unittest.main(verbosity=2)
