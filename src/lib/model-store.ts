/**
 * Server-side model-state access and the generation queue.
 *
 * Two responsibilities, both server-only:
 *  1. Read the generated-model fields for a product page (cached, so page
 *     views never trigger generation).
 *  2. Enqueue / claim / finish generation jobs with explicit deduplication.
 *
 * When Supabase is not configured this degrades to "no model" (the product
 * page shows the original image) and `enqueueModelJob` refuses to invent a
 * queue — it returns `not_configured` rather than pretending to work.
 */

import { createHash } from "node:crypto";
import type { Product } from "@/lib/types";
import type { ModelStatus } from "@/lib/types";
import {
  getSupabaseConfig,
  isSupabaseConfigured,
  selectRows,
  updateRows,
  upsertRows,
  type ProductModelJobRow,
  type ProductModelRow,
  mapProductModel,
  SUPABASE_TABLES,
} from "@/lib/supabase-server";

export const MODEL_PROVIDER = "huggingface:stabilityai/stable-fast-3d";

/** Cache window for model lookups on the product page (seconds). */
const MODEL_READ_REVALIDATE = 60;

/** Raster formats Stable Fast 3D can actually consume. */
const SUPPORTED_IMAGE_EXTENSIONS = [".png", ".jpg", ".jpeg", ".webp"];

export function hashImageBytes(bytes: Uint8Array): string {
  return createHash("sha256").update(bytes).digest("hex");
}

/**
 * True when an image URL is a real photo we can generate from. SVG
 * placeholders and data-URI-free seed art are rejected so we never waste GPU
 * quota modelling a placeholder.
 */
export function isGeneratableImageUrl(url: string | undefined | null): boolean {
  if (!url) return false;
  const path = url.split("?")[0]?.split("#")[0] ?? "";
  const lower = path.toLowerCase();
  if (lower.endsWith(".svg")) return false;
  return SUPPORTED_IMAGE_EXTENSIONS.some((ext) => lower.endsWith(ext));
}

export interface StoredModelState {
  modelUrl?: string;
  modelFormat?: "glb";
  modelType?: "single_image_generative" | "manual";
  modelStatus?: ModelStatus;
  modelProvider?: string;
  modelGeneratedAt?: string;
  /**
   * Not read for page renders. `model_error` is operator-facing and is absent
   * from the public catalogue view, so page reads never request it.
   */
  modelError?: string;
  sourceImageHash?: string;
}

/**
 * Columns the product page may read. Mirrors the public catalogue view:
 * `model_error` is deliberately excluded because it can contain quota and
 * operator detail that must not reach the browser.
 */
const PUBLIC_MODEL_COLUMNS =
  "id,slug,model_url,model_format,model_type,model_status,model_provider,model_generated_at,source_image_hash";

/**
 * Model state for a product, keyed by slug. Never throws: any failure or
 * missing configuration yields an empty state so the viewer falls back to the
 * product photo.
 */
export async function getModelStateForSlug(slug: string): Promise<StoredModelState> {
  const config = getSupabaseConfig();
  if (!config) return {};
  try {
    const rows = await selectRows<ProductModelRow>(
      SUPABASE_TABLES.products,
      {
        select: PUBLIC_MODEL_COLUMNS,
        slug: `eq.${slug}`,
        limit: 1,
      },
      config,
      { revalidate: MODEL_READ_REVALIDATE },
    );
    const row = rows[0];
    if (!row) return {};
    return mapProductModel(row) as StoredModelState;
  } catch {
    return {};
  }
}

/** Best-effort merge of stored model state onto a product record. */
export async function withModelState(product: Product): Promise<Product> {
  const state = await getModelStateForSlug(product.slug);
  return { ...product, ...state };
}

export type EnqueueReason =
  | "queued"
  | "already_completed"
  | "already_pending"
  | "quota_exhausted"
  | "not_configured"
  | "invalid_image"
  | "unknown_product";

export interface EnqueueResult {
  reason: EnqueueReason;
  jobId?: string;
  status?: ModelStatus;
  modelUrl?: string;
}

interface InsertJobInput {
  productId: string;
  sourceImageUrl: string;
  sourceImageHash: string;
}

/**
 * Enqueue a single generation job with deduplication on
 * (product_id, source_image_hash).
 *
 * Deliberately one product per call: bulk catalogues are not permitted until
 * the single-image flow has been proven.
 */
export async function enqueueModelJob(input: InsertJobInput): Promise<EnqueueResult> {
  const config = getSupabaseConfig();
  if (!config) return { reason: "not_configured" };
  if (!isGeneratableImageUrl(input.sourceImageUrl)) return { reason: "invalid_image" };

  const productRows = await selectRows<ProductModelRow>(
    SUPABASE_TABLES.products,
    {
      select: "id,slug,model_url,model_format,model_type,model_status,model_provider,model_generated_at,model_error,source_image_hash",
      id: `eq.${input.productId}`,
      limit: 1,
    },
    config,
  );
  if (productRows.length === 0) return { reason: "unknown_product" };

  const product = productRows[0];
  if (
    product.model_status === "completed" &&
    product.model_url &&
    product.source_image_hash === input.sourceImageHash
  ) {
    return { reason: "already_completed", status: "completed", modelUrl: product.model_url };
  }

  const existingJobs = await selectRows<ProductModelJobRow>(
    SUPABASE_TABLES.jobs,
    {
      select: "id,product_id,source_image_hash,source_image_url,status,attempts,provider,model_path,error,created_at,updated_at",
      product_id: `eq.${input.productId}`,
      source_image_hash: `eq.${input.sourceImageHash}`,
      limit: 1,
    },
    config,
  );
  const existing = existingJobs[0];
  if (existing) {
    if (existing.status === "completed") {
      return { reason: "already_completed", jobId: existing.id, status: "completed" };
    }
    if (existing.status === "quota_exhausted") {
      return { reason: "quota_exhausted", jobId: existing.id, status: "quota_exhausted" };
    }
    if (existing.status === "pending" || existing.status === "processing") {
      return { reason: "already_pending", jobId: existing.id, status: existing.status as ModelStatus };
    }
  }

  const inserted = await upsertRows<ProductModelJobRow>(
    SUPABASE_TABLES.jobs,
    [
      {
        product_id: input.productId,
        source_image_hash: input.sourceImageHash,
        source_image_url: input.sourceImageUrl,
        status: "pending",
        provider: MODEL_PROVIDER,
      } as ProductModelJobRow,
    ],
    "product_id,source_image_hash",
    config,
  );
  const job = inserted[0];
  if (job?.id) {
    await updateRows(
      SUPABASE_TABLES.products,
      { id: `eq.${input.productId}` },
      { model_status: "pending", source_image_hash: input.sourceImageHash, model_provider: MODEL_PROVIDER, model_error: null },
      config,
    );
  }
  return { reason: "queued", jobId: job?.id, status: "pending" };
}

export interface ClaimedJob {
  id: string;
  productId: string;
  productSlug: string;
  sourceImageUrl: string;
  sourceImageHash: string;
  attempts: number;
}

/**
 * Atomically move the oldest pending job to `processing` and return it.
 * Returns null when the queue is empty or Supabase is not configured.
 */
export async function claimNextJob(): Promise<ClaimedJob | null> {
  const config = getSupabaseConfig();
  if (!config) return null;

  const pending = await selectRows<ProductModelJobRow>(
    SUPABASE_TABLES.jobs,
    {
      select: "id,product_id,source_image_hash,source_image_url,status,attempts,provider,model_path,error,created_at,updated_at",
      status: "eq.pending",
      order: "created_at.asc",
      limit: 1,
    },
    config,
  );
  const job = pending[0];
  if (!job) return null;

  // Conditional update: only one worker can win the pending -> processing flip.
  const claimed = await updateRows<ProductModelJobRow>(
    SUPABASE_TABLES.jobs,
    { id: `eq.${job.id}`, status: "eq.pending" },
    // `updated_at` is stamped by the BEFORE UPDATE trigger.
    { status: "processing", attempts: job.attempts + 1 },
    config,
  );
  if (claimed.length === 0) return null;

  const products = await selectRows<ProductModelRow>(
    SUPABASE_TABLES.products,
    { select: "id,slug", id: `eq.${job.product_id}`, limit: 1 },
    config,
  );

  await updateRows(
    SUPABASE_TABLES.products,
    { id: `eq.${job.product_id}` },
    { model_status: "processing", model_provider: MODEL_PROVIDER, model_error: null },
    config,
  );

  return {
    id: job.id,
    productId: job.product_id,
    productSlug: products[0]?.slug ?? job.product_id,
    sourceImageUrl: job.source_image_url,
    sourceImageHash: job.source_image_hash,
    attempts: job.attempts + 1,
  };
}

export interface CompleteJobInput {
  jobId: string;
  productId: string;
  modelUrl: string;
  modelPath: string;
  bytes?: number;
}

export async function completeJob(input: CompleteJobInput): Promise<void> {
  const config = getSupabaseConfig();
  if (!config) throw new Error("Supabase is not configured");
  const generatedAt = new Date().toISOString();
  await updateRows(
    SUPABASE_TABLES.jobs,
    { id: `eq.${input.jobId}` },
    { status: "completed", model_path: input.modelPath, error: null },
    config,
  );
  await updateRows(
    SUPABASE_TABLES.products,
    { id: `eq.${input.productId}` },
    {
      model_url: input.modelUrl,
      model_format: "glb",
      model_type: "single_image_generative",
      model_status: "completed",
      model_provider: MODEL_PROVIDER,
      model_generated_at: generatedAt,
      model_error: null,
    },
    config,
  );
}

export type JobFailureStatus = Extract<ModelStatus, "failed" | "quota_exhausted" | "image_fallback">;

export async function failJob(input: {
  jobId: string;
  productId: string;
  status: JobFailureStatus;
  error: string;
}): Promise<void> {
  const config = getSupabaseConfig();
  if (!config) throw new Error("Supabase is not configured");
  const message = input.error.slice(0, 500);
  await updateRows(
    SUPABASE_TABLES.jobs,
    { id: `eq.${input.jobId}` },
    { status: input.status, error: message },
    config,
  );
  await updateRows(
    SUPABASE_TABLES.products,
    { id: `eq.${input.productId}` },
    { model_status: input.status, model_error: message, model_url: null },
    config,
  );
}

export { isSupabaseConfigured };
