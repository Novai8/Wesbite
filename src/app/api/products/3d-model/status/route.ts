/**
 * GET /api/products/3d-model/status?productId=… — job and queue state.
 *
 * Same shared-secret gate as the enqueue route. Returns the product's model
 * state plus queue depth so the operator can see what is pending without
 * triggering any generation.
 */

import { NextResponse } from "next/server";
import { timingSafeEqual } from "node:crypto";
import {
  getSupabaseConfig,
  selectRows,
  SUPABASE_TABLES,
  type ProductModelJobRow,
} from "@/lib/supabase-server";
import { isUuid } from "@/lib/validation";

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

const JOB_COLUMNS =
  "id,product_id,source_image_hash,source_image_url,status,attempts,provider,model_path,error,created_at,updated_at";

export async function GET(request: Request) {
  if (!process.env.FYNDRA_3D_WORKER_SECRET?.trim()) {
    return NextResponse.json({ error: "3D generation is not enabled." }, { status: 503 });
  }
  if (!isAuthorised(request)) {
    return NextResponse.json({ error: "Unauthorised" }, { status: 401 });
  }

  const config = getSupabaseConfig();
  if (!config) {
    return NextResponse.json({ error: "Supabase is not configured." }, { status: 503 });
  }

  const productId = new URL(request.url).searchParams.get("productId")?.trim();
  if (productId !== undefined && productId !== "" && !isUuid(productId)) {
    return NextResponse.json(
      { error: "productId must be a UUID." },
      { status: 400 },
    );
  }

  try {
    const jobs = await selectRows<ProductModelJobRow>(
      SUPABASE_TABLES.jobs,
      {
        select: JOB_COLUMNS,
        ...(productId ? { product_id: `eq.${productId}` } : {}),
        order: "created_at.desc",
        limit: 20,
      },
      config,
    );

    const pending = await selectRows<{ id: string }>(
      SUPABASE_TABLES.jobs,
      { select: "id", status: "eq.pending", limit: 1000 },
      config,
    );
    const processing = await selectRows<{ id: string }>(
      SUPABASE_TABLES.jobs,
      { select: "id", status: "eq.processing", limit: 1000 },
      config,
    );

    return NextResponse.json({
      queue: { pending: pending.length, processing: processing.length },
      jobs: jobs.map((job) => ({
        id: job.id,
        productId: job.product_id,
        status: job.status,
        attempts: job.attempts,
        provider: job.provider,
        modelPath: job.model_path,
        error: job.error,
        createdAt: job.created_at,
        updatedAt: job.updated_at,
      })),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Status lookup failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
