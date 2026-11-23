/**
 * Minimal Supabase (PostgREST) client for server-side writes and reads.
 *
 * Why not `@supabase/supabase-js`: this integration needs five operations
 * against two tables. A ~120-line fetch wrapper keeps the Worker bundle small
 * and avoids a dependency the project does not otherwise use. If the app grows
 * more Supabase surface later, swapping this module for the official client is
 * a contained change.
 *
 * SERVER ONLY. Uses the service-role key, which must never reach the browser.
 */

const TABLE_PRODUCTS = "affiliate_products";
const TABLE_PROGRAMS = "affiliate_programs";
/**
 * Customer-facing projection of `affiliate_products`.
 *
 * The base table carries research columns and `model_error`; the view excludes
 * them. Public/catalogue reads use this so the integration cannot accidentally
 * start relying on a column the public roles can no longer see.
 */
const VIEW_CATALOGUE_PRODUCTS = "catalogue_products";

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

function buildUrl(config: SupabaseConfig, table: string, query?: Query): string {
  const url = new URL(`${config.url}/rest/v1/${table}`);
  if (query) {
    for (const [key, value] of Object.entries(query)) {
      if (value === undefined) continue;
      url.searchParams.set(key, String(value));
    }
  }
  return url.toString();
}

async function handle<T>(res: Response, context: string): Promise<T> {
  const text = await res.text();
  if (!res.ok) {
    throw new SupabaseError(`${context} failed (${res.status})`, res.status, text.slice(0, 400));
  }
  return (text ? JSON.parse(text) : null) as T;
}

export interface ReadOptions {
  /**
   * Seconds the result may be reused. Catalogue reads are cached so pages stay
   * statically renderable / ISR-cached instead of hitting the database on every
   * request. Set 0 for admin reads that must be fresh.
   */
  revalidate?: number;
}

export async function selectRows<T>(
  table: string,
  query: Query,
  config: SupabaseConfig = getSupabaseConfig() as SupabaseConfig,
  options: ReadOptions = {},
): Promise<T[]> {
  const res = await fetch(buildUrl(config, table, query), {
    headers: {
      apikey: config.serviceRoleKey,
      Authorization: `Bearer ${config.serviceRoleKey}`,
      Accept: "application/json",
    },
    ...(options.revalidate !== undefined
      ? { next: { revalidate: options.revalidate } }
      : { cache: "no-store" as RequestCache }),
  });
  const rows = await handle<T[] | null>(res, `select ${table}`);
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
  config: SupabaseConfig = getSupabaseConfig() as SupabaseConfig,
): Promise<T[]> {
  if (rows.length === 0) return [];
  const res = await fetch(buildUrl(config, table, { on_conflict: onConflict }), {
    method: "POST",
    headers: {
      apikey: config.serviceRoleKey,
      Authorization: `Bearer ${config.serviceRoleKey}`,
      "Content-Type": "application/json",
      Prefer: "resolution=merge-duplicates,return=representation",
    },
    body: JSON.stringify(rows),
    cache: "no-store",
  });
  const out = await handle<T[] | null>(res, `upsert ${table}`);
  return out ?? [];
}

export async function insertRows<T extends object>(
  table: string,
  rows: T[],
  config: SupabaseConfig = getSupabaseConfig() as SupabaseConfig,
): Promise<void> {
  if (rows.length === 0) return;
  const res = await fetch(buildUrl(config, table), {
    method: "POST",
    headers: {
      apikey: config.serviceRoleKey,
      Authorization: `Bearer ${config.serviceRoleKey}`,
      "Content-Type": "application/json",
      Prefer: "return=minimal",
    },
    body: JSON.stringify(rows),
    cache: "no-store",
  });
  if (!res.ok) {
    const text = await res.text();
    throw new SupabaseError(`insert ${table} failed (${res.status})`, res.status, text.slice(0, 400));
  }
}

export const SUPABASE_TABLES = {
  products: TABLE_PRODUCTS,
  catalogueProducts: VIEW_CATALOGUE_PRODUCTS,
  programs: TABLE_PROGRAMS,
  importRuns: "admitad_import_runs",
  importErrors: "admitad_import_errors",
  clicks: "affiliate_clicks",
} as const;
