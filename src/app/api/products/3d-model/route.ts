/**
 * POST /api/products/3d-model — enqueue one product for 3D generation.
 *
 * Server-only and fail-closed: requires `FYNDRA_3D_WORKER_SECRET` in the
 * environment AND a matching `Authorization: Bearer` header. Without a
 * configured secret this route refuses all traffic rather than leaving an
 * open generation trigger that could burn ZeroGPU quota.
 *
 * One product per request, and only from a raster image URL the worker can
 * re-fetch. Bulk enqueue is intentionally unsupported until the single-image
 * flow is proven.
 */

import { NextResponse } from "next/server";
import { timingSafeEqual } from "node:crypto";
import { enqueueModelJob, hashImageBytes, isGeneratableImageUrl } from "@/lib/model-store";
import { getSupabaseConfig, selectRows, SUPABASE_TABLES } from "@/lib/supabase-server";
import { MAX_IMAGE_BYTES, parseEnqueueRequest } from "@/lib/validation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function isAuthorised(request: Request): boolean {
  const secret = process.env.FYNDRA_3D_WORKER_SECRET?.trim();
  if (!secret) return false;
  const header = request.headers.get("authorization") ?? "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : "";
  if (!token) return false;
  const a = Buffer.from(token);
  const b = Buffer.from(secret);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

async function hashRemoteImage(url: string): Promise<string | undefined> {
  try {
    const res = await fetch(url, { cache: "no-store", signal: AbortSignal.timeout(15_000) });
    if (!res.ok) return undefined;
    const bytes = new Uint8Array(await res.arrayBuffer());
    if (bytes.byteLength === 0 || bytes.byteLength > MAX_IMAGE_BYTES) return undefined;
    return hashImageBytes(bytes);
  } catch {
    return undefined;
  }
}

export async function POST(request: Request) {
  if (!process.env.FYNDRA_3D_WORKER_SECRET?.trim()) {
    return NextResponse.json(
      { error: "3D generation is not enabled on this deployment." },
      { status: 503 },
    );
  }
  if (!isAuthorised(request)) {
    return NextResponse.json({ error: "Unauthorised" }, { status: 401 });
  }

  const config = getSupabaseConfig();
  if (!config) {
    return NextResponse.json({ error: "Supabase is not configured." }, { status: 503 });
  }

  let body: unknown;
  try {
    body = JSON.parse(await request.text());
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = parseEnqueueRequest(body);
  if (!parsed.ok) {
    return NextResponse.json({ error: parsed.error }, { status: 400 });
  }
  const { productId, imageUrl } = parsed.value;

  if (!isGeneratableImageUrl(imageUrl)) {
    return NextResponse.json(
      { error: "Image must be a raster photo (png/jpg/jpeg/webp); SVG placeholders are rejected." },
      { status: 422 },
    );
  }

  try {
    const rows = await selectRows<{ id: string }>(
      SUPABASE_TABLES.products,
      { select: "id", id: `eq.${productId}`, limit: 1 },
      config,
    );
    if (rows.length === 0) {
      return NextResponse.json({ error: "Unknown product" }, { status: 404 });
    }

    const sourceImageHash = await hashRemoteImage(imageUrl);
    if (!sourceImageHash) {
      return NextResponse.json({ error: "Could not fetch the source image" }, { status: 422 });
    }

    const result = await enqueueModelJob({ productId, sourceImageUrl: imageUrl, sourceImageHash });
    return NextResponse.json(result, { status: 202 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Enqueue failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
