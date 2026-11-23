"""
Worker-side regression tests: storage upload failures, credential hygiene,
and the queue's quota behaviour.

No network and no GPU: `urllib.request.urlopen` is replaced with a stub.
"""

from __future__ import annotations

import importlib.util
import io
import os
import sys
import unittest
import urllib.error
from pathlib import Path
from unittest import mock

WORKER_PATH = Path(__file__).resolve().parents[1] / "scripts/3d_worker.py"
SERVICE_KEY = "sb-secret-service-role-key-do-not-leak"


def load_worker():
    spec = importlib.util.spec_from_file_location("fyndra_3d_worker", WORKER_PATH)
    module = importlib.util.module_from_spec(spec)
    assert spec.loader is not None
    # dataclasses resolves annotations through sys.modules during exec.
    sys.modules[spec.name] = module
    spec.loader.exec_module(module)
    return module


worker = load_worker()


class FakeResponse:
    def __init__(self, body: bytes = b"[]", headers: dict[str, str] | None = None) -> None:
        self._body = body
        self.headers = headers or {}

    def read(self) -> bytes:
        return self._body

    def __enter__(self):
        return self

    def __exit__(self, *exc):
        return False


def http_error(code: int, body: bytes) -> urllib.error.HTTPError:
    return urllib.error.HTTPError(
        url="https://project.supabase.co/storage/v1/object/product-models/x.glb",
        code=code,
        msg="error",
        hdrs=None,
        fp=io.BytesIO(body),
    )


class StorageUpload(unittest.TestCase):
    def setUp(self) -> None:
        self.client = worker.Supabase("https://project.supabase.co", SERVICE_KEY)

    def test_upload_uses_service_role_and_upsert(self) -> None:
        captured: dict[str, object] = {}

        def fake_urlopen(request, timeout=None):
            captured["request"] = request
            return FakeResponse(b"{}")

        with mock.patch.object(worker.urllib.request, "urlopen", fake_urlopen):
            self.client.upload("product-models", "prod/hash.glb", b"glb-bytes", "model/gltf-binary")

        request = captured["request"]
        assert request is not None
        headers = {key.lower(): value for key, value in request.headers.items()}
        self.assertEqual(headers["apikey"], SERVICE_KEY)
        self.assertEqual(headers["authorization"], f"Bearer {SERVICE_KEY}")
        self.assertEqual(request.get_method(), "POST")
        self.assertEqual(headers["x-upsert"], "true")
        self.assertEqual(headers["content-type"], "model/gltf-binary")
        self.assertIn("/storage/v1/object/product-models/prod/hash.glb", request.full_url)

    def test_upload_failure_raises_without_leaking_the_key(self) -> None:
        failure = http_error(403, b'{"message":"new row violates row-level security policy"}')

        with mock.patch.object(worker.urllib.request, "urlopen", side_effect=failure):
            with self.assertRaises(RuntimeError) as caught:
                self.client.upload("product-models", "prod/hash.glb", b"glb", "model/gltf-binary")

        message = str(caught.exception)
        self.assertIn("403", message)
        self.assertIn("row-level security", message)
        self.assertNotIn(SERVICE_KEY, message)
        self.assertNotIn("Bearer", message)

    def test_upload_failure_is_classified_as_failed_not_quota(self) -> None:
        failure = http_error(403, b'{"message":"new row violates row-level security policy"}')
        with mock.patch.object(worker.urllib.request, "urlopen", side_effect=failure):
            with self.assertRaises(RuntimeError) as caught:
                self.client.upload("product-models", "prod/hash.glb", b"glb", "model/gltf-binary")

        self.assertEqual(worker.classify_failure(caught.exception), "failed")

    def test_public_url_is_public_path(self) -> None:
        url = self.client.public_url("product-models", "prod 1/hash.glb")
        self.assertEqual(
            url,
            "https://project.supabase.co/storage/v1/object/public/product-models/prod%201/hash.glb",
        )

    def test_quota_errors_are_classified_as_quota_exhausted(self) -> None:
        for message in (
            "ZeroGPU quota exceeded",
            "429 Too Many Requests",
            "You have exceeded your free GPU quota",
        ):
            self.assertEqual(worker.classify_failure(RuntimeError(message)), "quota_exhausted")
        self.assertEqual(worker.classify_failure(RuntimeError("connection reset")), "failed")


class QueueBehaviour(unittest.TestCase):
    def setUp(self) -> None:
        self.client = worker.Supabase("https://project.supabase.co", SERVICE_KEY)

    def test_quota_failure_stops_the_queue_and_leaves_jobs_pending(self) -> None:
        pending_job = {
            "id": "job-1",
            "product_id": "0d5a1f2e-7b64-4c31-9f3a-2c8d1e5b7a90",
            "source_image_hash": "a" * 64,
            "source_image_url": "https://cdn.example.com/a.png",
            "status": "pending",
            "attempts": 0,
        }
        updates: list[tuple[str, dict, dict]] = []

        def fake_select(table, query):
            if table == "product_model_jobs":
                return [pending_job]
            return [{"id": pending_job["product_id"], "slug": "desk-lamp", "title": "Desk Lamp", "description": ""}]

        def fake_update(table, query, patch):
            updates.append((table, query, patch))
            if table == "product_model_jobs" and patch.get("status") == "processing":
                return [{**pending_job, **patch}]
            return [patch]

        def boom(*args, **kwargs):
            raise RuntimeError("ZeroGPU quota exceeded for today")

        with mock.patch.object(worker, "supabase_from_env", return_value=self.client), \
             mock.patch.object(self.client, "select", fake_select), \
             mock.patch.object(self.client, "update", fake_update), \
             mock.patch.object(worker, "download_image", boom):
            self.assertEqual(worker.process_queue(limit=5), 0)

        job_writes = [patch for table, _, patch in updates if table == "product_model_jobs"]
        self.assertEqual(job_writes[-1]["status"], "quota_exhausted")
        # Only the claim happened once: the worker stops instead of retrying.
        self.assertEqual(sum(1 for patch in job_writes if patch.get("status") == "processing"), 1)
        product_writes = [patch for table, _, patch in updates if table == "affiliate_products"]
        self.assertEqual(product_writes[-1]["model_status"], "quota_exhausted")

    def test_worker_updates_never_include_updated_at(self) -> None:
        # The BEFORE UPDATE trigger owns the column; sending it would defeat the
        # check that timestamps advance automatically.
        source = WORKER_PATH.read_text(encoding="utf-8")
        self.assertNotIn('"updated_at"', source)
        self.assertNotIn("'updated_at'", source)

    def test_log_never_receives_credentials(self) -> None:
        lines: list[str] = []

        with mock.patch("builtins.print", side_effect=lambda message, **_: lines.append(str(message))):
            worker.log("claimed job job-1")
            self.client.upload = mock.Mock(side_effect=RuntimeError("upload failed (500)"))
            try:
                self.client.upload("product-models", "x.glb", b"x", "model/gltf-binary")
            except RuntimeError as exc:
                worker.log(str(exc))

        joined = "\n".join(lines)
        self.assertNotIn(SERVICE_KEY, joined)
        self.assertNotIn("Bearer", joined)


class EnvConfiguration(unittest.TestCase):
    def tearDown(self) -> None:
        for key in ("SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY"):
            os.environ.pop(key, None)

    def test_missing_credentials_yield_no_client(self) -> None:
        self.assertIsNone(worker.supabase_from_env())

    def test_partial_credentials_yield_no_client(self) -> None:
        os.environ["SUPABASE_URL"] = "https://project.supabase.co"
        self.assertIsNone(worker.supabase_from_env())

    def test_both_credentials_yield_a_client(self) -> None:
        os.environ["SUPABASE_URL"] = "https://project.supabase.co/"
        os.environ["SUPABASE_SERVICE_ROLE_KEY"] = SERVICE_KEY
        client = worker.supabase_from_env()
        assert client is not None
        self.assertEqual(client.url, "https://project.supabase.co")


if __name__ == "__main__":
    unittest.main(verbosity=2)
