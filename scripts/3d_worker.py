#!/usr/bin/env python3
"""Fyndra 3D worker — remote image-to-3D generation on Hugging Face ZeroGPU.

Runs the official Gradio API of the public Space
``stabilityai/stable-fast-3d``. No model weights are downloaded and no local
GPU or CPU inference happens: the image is uploaded to the Space, the Space's
ZeroGPU hardware does the work, and we download the resulting GLB.

Two modes:

  Single-image test (no database needed, proves the remote path):
      python scripts/3d_worker.py --image photo.png --out .tmp/3d-agent/out

  Queue processing (claims pending rows from Supabase, one at a time):
      python scripts/3d_worker.py --limit 1

Environment (server-side only, never printed):
  HF_TOKEN                     optional; falls back to the hf CLI login
  SUPABASE_URL                 queue mode
  SUPABASE_SERVICE_ROLE_KEY    queue mode
  FREELLMAPI_API_KEY           optional enrichment
  FREELLMAPI_BASE_URL          optional, default http://127.0.0.1:31415/v1

Quota safety: a quota/ZeroGPU/429 error marks the job ``quota_exhausted`` and
the worker refuses to retry it. It never retries a quota failure in a loop.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import mimetypes
import os
import struct
import sys
import tempfile
import time
import urllib.error
import urllib.parse
import urllib.request
from dataclasses import dataclass
from pathlib import Path
from typing import Any

SPACE_ID = "stabilityai/stable-fast-3d"
PROVIDER = "huggingface:stabilityai/stable-fast-3d"
BUCKET = "product-models"
FOREGROUND_RATIO = 0.85
REMESH_OPTION = "None"
VERTEX_COUNT = -1
TEXTURE_SIZE = 1024

GLB_MAGIC = 0x46546C67
GLB_JSON_CHUNK = 0x4E4F534A

QUOTA_MARKERS = (
    "zero gpu",
    "zerogpu",
    "gpu quota",
    "quota",
    "too many requests",
    "429",
    "exceeded your free",
    "rate limit",
)


def log(message: str) -> None:
    """Print a progress line. Never pass secrets to this function."""
    print(f"[3d-worker] {message}", flush=True)


class QuotaExhausted(RuntimeError):
    """Raised when the Space reports free-GPU quota or rate-limit exhaustion."""


class ValidationFailure(RuntimeError):
    """Raised when the downloaded artefact is not a usable GLB."""


def classify_failure(exc: BaseException) -> str:
    text = f"{type(exc).__name__}: {exc}".lower()
    if any(marker in text for marker in QUOTA_MARKERS):
        return "quota_exhausted"
    return "failed"


# --------------------------------------------------------------------------- #
# GLB validation (mirrors src/lib/glb.ts)
# --------------------------------------------------------------------------- #


@dataclass
class GlbSummary:
    version: int
    length: int
    meshes: int
    materials: int
    textures: int
    images: int
    generator: str | None


def validate_glb(data: bytes) -> GlbSummary:
    if len(data) < 20:
        raise ValidationFailure(f"file too small ({len(data)} bytes)")

    magic, version, declared = struct.unpack_from("<4sII", data, 0)
    if magic != b"glTF":
        raise ValidationFailure(f"bad magic {magic!r}")
    if version != 2:
        raise ValidationFailure(f"unsupported version {version}")
    if declared != len(data):
        raise ValidationFailure(f"declared length {declared} != actual {len(data)}")

    offset = 12
    gltf: dict[str, Any] | None = None
    index = 0
    while offset + 8 <= len(data):
        chunk_length, chunk_type = struct.unpack_from("<II", data, offset)
        start = offset + 8
        end = start + chunk_length
        if end > len(data):
            raise ValidationFailure(f"chunk {index} overruns the file")
        if index == 0:
            if chunk_type != GLB_JSON_CHUNK:
                raise ValidationFailure("first chunk is not JSON")
            try:
                gltf = json.loads(data[start:end])
            except json.JSONDecodeError as exc:
                raise ValidationFailure(f"JSON chunk invalid: {exc}") from exc
        offset = end
        index += 1

    if gltf is None:
        raise ValidationFailure("missing JSON chunk")

    asset_version = (gltf.get("asset") or {}).get("version")
    if asset_version != "2.0":
        raise ValidationFailure(f"asset.version is {asset_version!r}")

    meshes = len(gltf.get("meshes") or [])
    if meshes == 0:
        raise ValidationFailure("no meshes")

    return GlbSummary(
        version=version,
        length=len(data),
        meshes=meshes,
        materials=len(gltf.get("materials") or []),
        textures=len(gltf.get("textures") or []),
        images=len(gltf.get("images") or []),
        generator=(gltf.get("asset") or {}).get("generator"),
    )


# --------------------------------------------------------------------------- #
# Hugging Face generation
# --------------------------------------------------------------------------- #


def _load_token() -> str | None:
    """Return the HF token from the environment or the cached CLI login."""
    token = os.environ.get("HF_TOKEN", "").strip()
    if token:
        return token
    try:
        from huggingface_hub import get_token

        return get_token()
    except Exception:
        return None


def generate_glb(image_path: Path, work_dir: Path) -> Path:
    """Generate a GLB remotely and return the downloaded local path.

    Uses the documented named endpoints. The background-removal prompt must be
    called first on the same client so the Space's shared state is primed
    before the run button fires; skipping it raises AppError.
    """
    from gradio_client import Client, handle_file

    token = _load_token()
    client = Client(
        SPACE_ID,
        token=token,
        httpx_kwargs={"timeout": 900},
        _skip_components=False,
    )

    log("priming background-removal state")
    client.predict(
        handle_file(str(image_path)),
        FOREGROUND_RATIO,
        api_name="/requires_bg_remove",
    )

    log("submitting generation job (remote ZeroGPU)")
    started = time.time()
    result = client.predict(
        # The Space declares five visible parameters, but its `/run_button`
        # dependency is wired to seven inputs: a hidden submit button and a
        # hidden background-removal state sit either side of the image. The
        # button must be the literal "Run", otherwise the app raises AppError.
        "Run",
        handle_file(str(image_path)),
        None,
        FOREGROUND_RATIO,
        REMESH_OPTION,
        VERTEX_COUNT,
        TEXTURE_SIZE,
        api_name="/run_button",
    )
    log(f"generation returned in {time.time() - started:.1f}s")

    remote_path = _extract_filepath(result)
    if remote_path is None:
        raise RuntimeError(f"unexpected result shape: {type(result).__name__}")

    # Download immediately: Space outputs are temporary and may be cleaned up.
    src = Path(remote_path)
    if not src.is_file():
        raise RuntimeError("generation result path does not exist locally")

    work_dir.mkdir(parents=True, exist_ok=True)
    dest = work_dir / f"{image_path.stem}-{int(time.time())}.glb"
    dest.write_bytes(src.read_bytes())
    log(f"downloaded GLB {dest.name} ({dest.stat().st_size} bytes)")
    return dest


def _extract_filepath(result: Any) -> str | None:
    """Pull the generated .glb path out of the shapes Gradio can return.

    The file component serialises to ``{"value": {"path": ...}, ...}`` and the
    call returns a list of those. Prefer a ``.glb`` path, then any file path.
    """
    candidates: list[str] = []

    def collect(node: Any) -> None:
        if isinstance(node, str):
            candidates.append(node)
        elif isinstance(node, dict):
            for key in ("value", "path", "name"):
                if key in node:
                    collect(node[key])
        elif isinstance(node, (list, tuple)):
            for item in node:
                collect(item)

    collect(result)
    glb = [c for c in candidates if c.lower().endswith(".glb")]
    if glb:
        return glb[-1]
    return candidates[-1] if candidates else None


# --------------------------------------------------------------------------- #
# Supabase (PostgREST + Storage) via urllib — no extra dependency
# --------------------------------------------------------------------------- #


class Supabase:
    def __init__(self, url: str, service_role_key: str) -> None:
        self.url = url.rstrip("/")
        self.key = service_role_key

    @property
    def configured(self) -> bool:
        return bool(self.url and self.key)

    def _request(
        self,
        method: str,
        path: str,
        *,
        body: bytes | None = None,
        headers: dict[str, str] | None = None,
        query: dict[str, str] | None = None,
    ) -> bytes:
        url = f"{self.url}{path}"
        if query:
            url += "?" + urllib.parse.urlencode(query)
        merged = {
            "apikey": self.key,
            "Authorization": f"Bearer {self.key}",
            **(headers or {}),
        }
        request = urllib.request.Request(url, data=body, headers=merged, method=method)
        try:
            with urllib.request.urlopen(request, timeout=120) as response:
                return response.read()
        except urllib.error.HTTPError as exc:
            detail = exc.read().decode("utf-8", "replace")[:400]
            raise RuntimeError(f"Supabase {method} {path} failed ({exc.code}): {detail}") from exc

    def select(self, table: str, query: dict[str, str]) -> list[dict[str, Any]]:
        raw = self._request(
            "GET",
            f"/rest/v1/{table}",
            headers={"Accept": "application/json"},
            query=query,
        )
        return json.loads(raw or b"[]")

    def update(self, table: str, query: dict[str, str], patch: dict[str, Any]) -> list[dict[str, Any]]:
        raw = self._request(
            "PATCH",
            f"/rest/v1/{table}",
            body=json.dumps(patch).encode(),
            headers={"Content-Type": "application/json", "Prefer": "return=representation"},
            query=query,
        )
        return json.loads(raw or b"[]")

    def upload(self, bucket: str, path: str, data: bytes, content_type: str) -> None:
        encoded = "/".join(urllib.parse.quote(part) for part in path.split("/"))
        self._request(
            "POST",
            f"/storage/v1/object/{bucket}/{encoded}",
            body=data,
            headers={
                "Content-Type": content_type,
                "Cache-Control": "31536000",
                "x-upsert": "true",
            },
        )

    def public_url(self, bucket: str, path: str) -> str:
        encoded = "/".join(urllib.parse.quote(part) for part in path.split("/"))
        return f"{self.url}/storage/v1/object/public/{bucket}/{encoded}"


def supabase_from_env() -> Supabase | None:
    url = os.environ.get("SUPABASE_URL", "").strip()
    key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY", "").strip()
    if not url or not key:
        return None
    return Supabase(url, key)


# --------------------------------------------------------------------------- #
# FreeLLMAPI enrichment (optional, never blocking)
# --------------------------------------------------------------------------- #


def analyse_product(title: str, description: str, categories: list[str]) -> dict[str, Any] | None:
    api_key = os.environ.get("FREELLMAPI_API_KEY", "").strip()
    if not api_key:
        return None
    base = os.environ.get("FREELLMAPI_BASE_URL", "http://127.0.0.1:31415/v1").rstrip("/")
    prompt = (
        "You are a catalogue assistant. Allowed categories: "
        + ", ".join(categories or ["uncategorised"])
        + ". Pick one allowed category, and give a 3-6 word object label. "
        'Reply JSON only: {"category":"...","label":"..."}\n\n'
        f"Title: {title[:300]}\nDescription: {description[:600]}"
    )
    body = json.dumps(
        {
            "model": "auto",
            "input": [{"role": "user", "content": [{"type": "input_text", "text": prompt}]}],
        }
    ).encode()
    request = urllib.request.Request(
        f"{base}/responses",
        data=body,
        headers={"Content-Type": "application/json", "Authorization": f"Bearer {api_key}"},
        method="POST",
    )
    try:
        with urllib.request.urlopen(request, timeout=25) as response:
            payload = json.loads(response.read())
    except Exception as exc:  # enrichment must never break generation
        log(f"FreeLLMAPI unavailable ({type(exc).__name__}); continuing without it")
        return None

    text = payload.get("output_text")
    if not text:
        for item in payload.get("output") or []:
            for part in item.get("content") or []:
                if part.get("text"):
                    text = part["text"]
                    break
    if not isinstance(text, str):
        return None
    start, end = text.find("{"), text.rfind("}")
    if start < 0 or end <= start:
        return None
    try:
        parsed = json.loads(text[start : end + 1])
    except json.JSONDecodeError:
        return None
    category = parsed.get("category")
    label = parsed.get("label")
    return {
        "category": category if category in categories else None,
        "label": label if isinstance(label, str) else None,
    }


# --------------------------------------------------------------------------- #
# Modes
# --------------------------------------------------------------------------- #


def run_single_image(image_path: Path, out_dir: Path, keep_remote_work: Path | None = None) -> int:
    if not image_path.is_file():
        log(f"image not found: {image_path}")
        return 2
    work = keep_remote_work or Path(tempfile.mkdtemp(prefix="fyndra-3d-"))
    log(f"source {image_path.name} ({image_path.stat().st_size} bytes, sha256 {sha256_file(image_path)[:12]}…)")

    try:
        glb = generate_glb(image_path, work)
        summary = validate_glb(glb.read_bytes())
    except Exception as exc:
        status = classify_failure(exc)
        log(f"{status.upper()}: {exc}")
        return 1

    log(
        "GLB valid "
        f"(v{summary.version}, {summary.length} bytes, meshes={summary.meshes}, "
        f"materials={summary.materials}, textures={summary.textures}, images={summary.images}, "
        f"generator={summary.generator})"
    )
    out_dir.mkdir(parents=True, exist_ok=True)
    final = out_dir / f"{image_path.stem}.glb"
    final.write_bytes(glb.read_bytes())
    log(f"saved {final}")
    return 0


def sha256_file(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for block in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(block)
    return digest.hexdigest()


def claim_next(supabase: Supabase) -> dict[str, Any] | None:
    pending = supabase.select(
        "product_model_jobs",
        {
            "select": "*",
            "status": "eq.pending",
            "order": "created_at.asc",
            "limit": "1",
        },
    )
    if not pending:
        return None
    job = pending[0]
    claimed = supabase.update(
        "product_model_jobs",
        {"id": f"eq.{job['id']}", "status": "eq.pending"},
        {"status": "processing", "attempts": int(job.get("attempts") or 0) + 1},
    )
    if not claimed:
        return None
    supabase.update(
        "affiliate_products",
        {"id": f"eq.{job['product_id']}"},
        {"model_status": "processing", "model_provider": PROVIDER, "model_error": None},
    )
    return claimed[0]


def fail_job(supabase: Supabase, job: dict[str, Any], status: str, message: str) -> None:
    message = message[:500]
    supabase.update(
        "product_model_jobs",
        {"id": f"eq.{job['id']}"},
        {"status": status, "error": message},
    )
    supabase.update(
        "affiliate_products",
        {"id": f"eq.{job['product_id']}"},
        {"model_status": status, "model_error": message, "model_url": None},
    )


def process_queue(limit: int) -> int:
    supabase = supabase_from_env()
    if supabase is None:
        log("queue mode needs SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY")
        return 2

    processed = 0
    while processed < limit:
        job = claim_next(supabase)
        if job is None:
            log("queue empty")
            break

        product = supabase.select(
            "affiliate_products",
            {"select": "id,slug,title,description,category_slug", "id": f"eq.{job['product_id']}", "limit": "1"},
        )
        title = product[0]["title"] if product else job["product_id"]
        log(f"job {job['id']} -> product {title}")

        work = Path(tempfile.mkdtemp(prefix="fyndra-3d-"))
        try:
            image_path = download_image(job["source_image_url"], work / "source")
            actual_hash = sha256_file(image_path)
            if actual_hash != job["source_image_hash"]:
                raise ValidationFailure(
                    "source image hash changed since enqueue; refusing to model a different image"
                )

            enrichment = analyse_product(
                title=title,
                description=(product[0].get("description") if product else "") or "",
                categories=["desk-setup", "gaming", "storage-organisation", "study-stationery", "travel-accessories", "kitchen-utility"],
            )
            if enrichment:
                log(f"FreeLLMAPI: category={enrichment.get('category')} label={enrichment.get('label')}")

            glb = generate_glb(image_path, work)
            summary = validate_glb(glb.read_bytes())
            log(f"GLB valid: meshes={summary.meshes} textures={summary.textures} bytes={summary.length}")

            path = f"{job['product_id']}/{job['source_image_hash'][:16]}.glb"
            supabase.upload(bucket=BUCKET, path=path, data=glb.read_bytes(), content_type="model/gltf-binary")
            url = supabase.public_url(BUCKET, path)

            generated_at = time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())
            supabase.update(
                "product_model_jobs",
                {"id": f"eq.{job['id']}"},
                {"status": "completed", "model_path": path, "error": None},
            )
            supabase.update(
                "affiliate_products",
                {"id": f"eq.{job['product_id']}"},
                {
                    "model_url": url,
                    "model_format": "glb",
                    "model_type": "single_image_generative",
                    "model_status": "completed",
                    "model_provider": PROVIDER,
                    "model_generated_at": generated_at,
                    "model_error": None,
                },
            )
            log(f"completed: uploaded {path}")
            processed += 1
        except Exception as exc:
            status = classify_failure(exc)
            fail_job(supabase, job, status, str(exc))
            log(f"job {job['id']} {status}: {exc}")
            processed += 1
            if status == "quota_exhausted":
                log("stopping: free GPU quota exhausted. Remaining jobs stay pending for tomorrow.")
                break

    return 0


def download_image(url: str, dest: Path) -> Path:
    """Download an image and return the path actually written.

    The extension comes from the response Content-Type (falling back to the
    URL), because Stable Fast 3D's file input is extension-sensitive.
    """
    request = urllib.request.Request(url, headers={"User-Agent": "fyndra-3d-worker/1.0"})
    with urllib.request.urlopen(request, timeout=60) as response:
        data = response.read()
        content_type = (response.headers.get("Content-Type") or "").split(";")[0].strip()
    if not data:
        raise RuntimeError("empty image response")

    allowed = {".png", ".jpg", ".jpeg", ".webp"}
    suffix = mimetypes.guess_extension(content_type) if content_type.startswith("image/") else None
    if suffix not in allowed:
        suffix = Path(urllib.parse.urlparse(url).path).suffix.lower()
    if suffix not in allowed:
        suffix = ".png"

    target = dest.with_suffix(suffix)
    target.write_bytes(data)
    return target


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="Fyndra remote 3D generation worker")
    parser.add_argument("--image", type=Path, help="generate from this local image (single-image test)")
    parser.add_argument("--out", type=Path, default=Path(".tmp/3d-agent/out"), help="output directory")
    parser.add_argument("--limit", type=int, default=1, help="max jobs to process in queue mode")
    args = parser.parse_args(argv)

    if args.image:
        return run_single_image(args.image, args.out)
    if args.limit < 1:
        log("--limit must be at least 1")
        return 2
    return process_queue(args.limit)


if __name__ == "__main__":
    sys.exit(main())
