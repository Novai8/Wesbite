"""
Static checks on the 3D persistence migration.

Runs everywhere (no database, no Docker): it parses the migration text and
asserts the safety properties the review asked for, so a future edit that
silently drops a guard fails here.
"""

from __future__ import annotations

import re
import unittest
from pathlib import Path

MIGRATION = Path(__file__).resolve().parents[1] / "supabase/migrations/20261123150000_fyndra_3d_models.sql"


def sql() -> str:
    return MIGRATION.read_text(encoding="utf-8")


def normalised() -> str:
    """Whitespace- and case-insensitive view for structural assertions."""
    return re.sub(r"\s+", " ", sql().lower())


class MigrationDefinesUpdatedAtTrigger(unittest.TestCase):
    def test_migration_exists(self) -> None:
        self.assertTrue(MIGRATION.is_file(), f"missing {MIGRATION}")

    def test_defines_trigger_function(self) -> None:
        body = normalised()
        self.assertIn("create or replace function public.set_product_model_jobs_updated_at()", body)
        self.assertIn("returns trigger", body)

    def test_function_assigns_now_to_new_updated_at(self) -> None:
        match = re.search(
            r"begin\s+new\.updated_at = now\(\);\s+return new;\s+end;",
            normalised(),
        )
        self.assertIsNotNone(match, "trigger body must set NEW.updated_at = now() and RETURN NEW")

    def test_trigger_is_before_update_for_each_row(self) -> None:
        body = normalised()
        self.assertIn("before update on public.product_model_jobs", body)
        self.assertIn("for each row", body)
        self.assertIn("execute function public.set_product_model_jobs_updated_at()", body)

    def test_trigger_and_function_are_idempotent(self) -> None:
        body = normalised()
        self.assertIn("create or replace function public.set_product_model_jobs_updated_at()", body)
        self.assertIn(
            "drop trigger if exists product_model_jobs_set_updated_at on public.product_model_jobs",
            body,
        )


class MigrationIsSafe(unittest.TestCase):
    def test_status_constraint_check_is_scoped_to_products_table(self) -> None:
        body = normalised()
        self.assertIn("conrelid = 'public.affiliate_products'::regclass", body)

    def test_preflight_asserts_uuid_primary_key(self) -> None:
        body = normalised()
        self.assertIn("a.atttypid = 'uuid'::regtype", body)
        self.assertIn("c.contype = 'p'", body)
        self.assertIn("raise exception", body)

    def test_queue_fk_targets_products_id(self) -> None:
        body = normalised()
        self.assertIn("references public.affiliate_products (id) on delete cascade", body)
        self.assertIn("product_model_jobs.product_id must reference public.affiliate_products(id)", body)

    def test_every_model_column_is_added_idempotently(self) -> None:
        body = normalised()
        for column in (
            "model_url",
            "model_format",
            "model_type",
            "model_status",
            "model_provider",
            "model_generated_at",
            "model_error",
            "source_image_hash",
        ):
            self.assertIn(f"add column if not exists {column} ", body)

    def test_no_destructive_statements(self) -> None:
        body = normalised()
        for statement in (
            "drop table",
            "drop column",
            "truncate",
            "delete from",
            "alter column",
            "drop constraint",
        ):
            self.assertNotIn(statement, body, f"migration must stay additive: found {statement!r}")

    def test_status_lifecycle_matches_the_app(self) -> None:
        body = normalised()
        for status in (
            "pending",
            "processing",
            "completed",
            "failed",
            "quota_exhausted",
            "image_fallback",
        ):
            self.assertIn(f"'{status}'", body)


class StorageSecurity(unittest.TestCase):
    def test_bucket_is_public(self) -> None:
        body = normalised()
        self.assertIn("'product-models', 'product-models', true,", body)

    def test_redundant_public_read_policy_is_removed(self) -> None:
        body = normalised()
        self.assertIn("drop policy if exists product_models_public_read on storage.objects", body)

    def test_no_public_write_policies(self) -> None:
        body = normalised()
        self.assertNotRegex(body, r"create policy [^;]*for (insert|update|delete)")
        self.assertNotRegex(body, r"create policy [^;]*to (anon|authenticated)")

    def test_upload_stays_service_role_only(self) -> None:
        body = normalised()
        self.assertIn("service-role", body)


if __name__ == "__main__":
    unittest.main(verbosity=2)