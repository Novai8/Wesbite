/**
 * Minimal Supabase (PostgREST + Storage) client for server-side reads/writes.
 *
 * Why not `@supabase/supabase-js`: this integration needs a handful of
 * operations against one table and one bucket. A small fetch wrapper keeps
 * the Worker bundle lean and avoids a dependency the project does not use.
 *
 * SERVER ONLY. Uses the service-role key, which must never reach the browser.
 * Nothing in this module logs or returns credentials.
 */

const TABLE_PRODUCTS = "affiliate_products";
const TABLE_JOBS = "product_model_jobs";
export const MODEL_BUCKET = "product-models";

export interface SupabaseConfig {
  url: string;
  serviceRoleKey: string;
}

function env(name: string): string | undefined {
  const value = process.env[name]?.trim();
  return value ? value : undefined;
}

export function getSupabaseConfig(): SupabaseConfig | null {
  const url = env("SUPABASE_URL");
  const serviceRoleKey = env("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !serviceRoleKey) return null;
  return { url: url.replace(/\/+$/, ""), serviceRoleKey };
}

export function isSupabaseConfigured(): boolean {
  return getSupabaseConfig() !== null;
}

export class SupabaseError extends Error {
  readonly status: number;
  readonly details?: string;
  constructor(message: string, status: number, details?: string) {
    super(message);
    this.name = "SupabaseError";
    this.status = status;
    this.details = details;
  }
}

type Query = Record<string, string | number | boolean | undefined>;

function restUrl(config: SupabaseConfig, table: string, query?: Query): string {
  const url = new URL(`${config.url}/rest/v1/${table}`);
  if (query) {
    for (const [key, value] of Object.entries(query)) {
      if (value === undefined) continue;
      url.searchParams.set(key, String(value));
    }
  }
  return url.toString();
}

function authHeaders(config: SupabaseConfig, extra?: Record<string, string>): HeadersInit {
  return {
    apikey: config.serviceRoleKey,
    Authorization: `Bearer ${config.serviceRoleKey}`,
    ...extra,
  };
}

async function readJson<T>(res: Response, context: string): Promise<T> {
  const text = await res.text();
  if (!res.ok) {
    throw new SupabaseError(`${context} failed (${res.status})`, res.status, text.slice(0, 400));
  }
  return (text ? JSON.parse(text) : null) as T;
}

export interface ReadOptions {
  /** Seconds the response may be cached; 0 forces a fresh read. */
  revalidate?: number;
}

export async function selectRows<T>(
  table: string,
  query: Query,
  config: SupabaseConfig,
  options: ReadOptions = {},
): Promise<T[]> {
  const res = await fetch(restUrl(config, table, query), {
    headers: authHeaders(config, { Accept: "application/json" }),
    ...(options.revalidate !== undefined
      ? { next: { revalidate: options.revalidate } }
      : { cache: "no-store" as RequestCache }),
  });
  const rows = await readJson<T[] | null>(res, `select ${table}`);
  return rows ?? [];
}

/** Partial update on a filtered set. Returns the updated rows. */
export async function updateRows<T extends object>(
  table: string,
  filter: Query,
  patch: Partial<T>,
  config: SupabaseConfig,
): Promise<T[]> {
  const res = await fetch(restUrl(config, table, filter), {
    method: "PATCH",
    headers: authHeaders(config, {
      "Content-Type": "application/json",
      Prefer: "return=representation",
    }),
    body: JSON.stringify(patch),
    cache: "no-store",
  });
  const rows = await readJson<T[] | null>(res, `update ${table}`);
  return rows ?? [];
}

/**
 * Upsert on a unique constraint. PostgREST needs `on_conflict` naming the
 * constrained columns and `Prefer: resolution=merge-duplicates`.
 */
export async function upsertRows<T extends object>(
  table: string,
  rows: T[],
  onConflict: string,
  config: SupabaseConfig,
): Promise<T[]> {
  if (rows.length === 0) return [];
  const res = await fetch(restUrl(config, table, { on_conflict: onConflict }), {
    method: "POST",
    headers: authHeaders(config, {
      "Content-Type": "application/json",
      Prefer: "resolution=merge-duplicates,return=representation",
    }),
    body: JSON.stringify(rows),
    cache: "no-store",
  });
  const out = await readJson<T[] | null>(res, `upsert ${table}`);
  return out ?? [];
}

/**
 * Storage uploads are intentionally NOT implemented here.
 *
 * `scripts/3d_worker.py` is the single production writer to the
 * `product-models` bucket, because the worker is the only process that holds
 * a generated GLB. Keeping one upload path means one place to audit for
 * credential handling.
 */
export interface ProductModelRow {
  id: string;
  slug: string;
  model_url: string | null;
  model_format: string | null;
  model_type: string | null;
  model_status: string | null;
  model_provider: string | null;
  model_generated_at: string | null;
  model_error: string | null;
  source_image_hash: string | null;
}

export interface ProductModelJobRow {
  id: string;
  product_id: string;
  source_image_hash: string;
  source_image_url: string;
  status: string;
  attempts: number;
  provider: string | null;
  model_path: string | null;
  error: string | null;
  created_at: string;
  updated_at: string;
}

export const SUPABASE_TABLES = {
  products: TABLE_PRODUCTS,
  jobs: TABLE_JOBS,
} as const;

export function mapProductModel(row: ProductModelRow) {
  return {
    modelUrl: row.model_url ?? undefined,
    modelFormat: (row.model_format as "glb" | null) ?? undefined,
    modelType: (row.model_type as "single_image_generative" | "manual" | null) ?? undefined,
    modelStatus: row.model_status ?? undefined,
    modelProvider: row.model_provider ?? undefined,
    modelGeneratedAt: row.model_generated_at ?? undefined,
    modelError: row.model_error ?? undefined,
    sourceImageHash: row.source_image_hash ?? undefined,
  };
}
