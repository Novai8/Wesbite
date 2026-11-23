"""Verify the trigger semantics the migration promises, against real Postgres.

The migration itself is never applied: the test reconstructs a minimal
schema (uuid PK table + queue table + the migration's trigger definition) in a
throwaway container, then asserts the behaviour the TypeScript and Python
workers rely on.

Skipped automatically when no Docker daemon is reachable.

Run: python -m unittest tests.test_persistence -v
"""

from __future__ import annotations

import shutil
import subprocess
import time
import unittest
import uuid

POSTGRES_IMAGE = "postgres:16-alpine"

# Exactly the objects the migration defines, reduced to what is under test.
# The trigger function body and the trigger wiring are verbatim copies.
SCHEMA_SQL = """
create table public.affiliate_products (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  model_status text
);

create table public.product_model_jobs (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.affiliate_products (id) on delete cascade,
  source_image_hash text not null,
  status text not null default 'pending',
  attempts int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint product_model_jobs_product_id_source_image_hash_key
    unique (product_id, source_image_hash)
);

-- migration section 3, verbatim
create or replace function public.set_product_model_jobs_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists product_model_jobs_set_updated_at on public.product_model_jobs;

create trigger product_model_jobs_set_updated_at
  before update on public.product_model_jobs
  for each row
  execute function public.set_product_model_jobs_updated_at();
"""


def docker_available() -> bool:
    if shutil.which("docker") is None:
        return False
    try:
        result = subprocess.run(
            ["docker", "info", "--format", "{{.ServerVersion}}"],
            capture_output=True,
            text=True,
            timeout=20,
        )
    except (OSError, subprocess.SubprocessError):
        return False
    return result.returncode == 0


@unittest.skipUnless(docker_available(), "Docker daemon is not reachable")
class TriggerAgainstRealPostgres(unittest.TestCase):
    container: str

    @classmethod
    def setUpClass(cls) -> None:
        cls.container = f"fyndra-3d-test-{uuid.uuid4().hex[:8]}"
        subprocess.run(
            [
                "docker", "run", "-d", "--rm",
                "--name", cls.container,
                "-e", "POSTGRES_PASSWORD=test",
                "-e", "POSTGRES_DB=fyndra",
                POSTGRES_IMAGE,
            ],
            check=True,
            capture_output=True,
        )
        for _ in range(60):
            probe = subprocess.run(
                ["docker", "exec", cls.container, "pg_isready", "-U", "postgres", "-d", "fyndra"],
                capture_output=True,
            )
            if probe.returncode == 0:
                break
            time.sleep(0.5)
        cls._psql(SCHEMA_SQL)

    @classmethod
    def tearDownClass(cls) -> None:
        subprocess.run(["docker", "rm", "-f", cls.container], capture_output=True)

    @classmethod
    def _psql(cls, sql: str) -> str:
        result = subprocess.run(
            [
                "docker", "exec", "-i", cls.container,
                "psql", "-U", "postgres", "-d", "fyndra",
                "-v", "ON_ERROR_STOP=1", "-At", "-F", "|",
            ],
            input=sql,
            capture_output=True,
            text=True,
            check=False,
        )
        if result.returncode != 0:
            raise AssertionError(f"psql failed: {result.stderr}")
        return result.stdout.strip()

    def test_trigger_and_function_are_defined(self) -> None:
        row = self._psql(
            """
            select tgname, tgtype, proname
            from pg_trigger t
            join pg_proc p on p.oid = t.tgfoid
            where t.tgrelid = 'public.product_model_jobs'::regclass
              and not t.tgisinternal;
            """
        )
        self.assertIn("product_model_jobs_set_updated_at", row)
        self.assertIn("set_product_model_jobs_updated_at", row)

    def test_update_without_updated_at_still_advances_timestamp(self) -> None:
        product_id = self._psql(
            "insert into public.affiliate_products (slug) values ('desk-lamp') returning id;"
        ).splitlines()[0]
        self._psql(
            f"insert into public.product_model_jobs (product_id, source_image_hash) "
            f"values ('{product_id}', 'hash-a');"
        )
        # Worker style: status-only PATCH, no updated_at column sent.
        self._psql(
            f"update public.product_model_jobs set status = 'processing' "
            f"where product_id = '{product_id}' and source_image_hash = 'hash-a';"
        )
        advanced = self._psql(
            f"select (updated_at > created_at)::text from public.product_model_jobs "
            f"where product_id = '{product_id}' and source_image_hash = 'hash-a';"
        )
        self.assertEqual(advanced, "true")

    def test_trigger_survives_a_second_migration_run(self) -> None:
        self._psql(SCHEMA_SQL)
        self.assertEqual(
            self._psql(
                "select count(*) from pg_trigger "
                "where tgname = 'product_model_jobs_set_updated_at';"
            ),
            "1",
        )

    def test_duplicate_enqueue_is_rejected_by_unique_constraint(self) -> None:
        product_id = self._psql(
            "insert into public.affiliate_products (slug) values ('wall-shelf') returning id;"
        ).splitlines()[0]
        insert = (
            f"insert into public.product_model_jobs (product_id, source_image_hash) "
            f"values ('{product_id}', 'hash-b');"
        )
        self._psql(insert)
        result = subprocess.run(
            [
                "docker", "exec", "-i", self.container,
                "psql", "-U", "postgres", "-d", "fyndra", "-v", "ON_ERROR_STOP=1",
            ],
            input=insert,
            capture_output=True,
            text=True,
        )
        self.assertNotEqual(result.returncode, 0)
        self.assertIn("product_model_jobs_product_id_source_image_hash_key", result.stderr)
        self.assertEqual(
            self._psql(
                f"select count(*) from public.product_model_jobs where product_id = '{product_id}';"
            ),
            "1",
        )


if __name__ == "__main__":
    unittest.main(verbosity=2)
