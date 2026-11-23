/**
 * Bidirectional mapping between Fyndra `Product` and the
 * `affiliate_products` row shape (snake_case).
 *
 * Two hard rules live here:
 *  1. A manual row is never overwritten by an import. `toProductRow` marks the
 *     upsert as import-owned; the SQL side refuses to touch `data_source =
 *     'manual'` rows on conflict.
 *  2. AI-written fields (`ai_*`) are written in their own columns, so a
 *     re-sync of source data can never clobber generated copy, and generated
 *     copy can never masquerade as source data.
 */

import type { Product } from "@/lib/types";

export interface ProductRow {
  id: string;
  slug: string;
  title: string;
  description: string;
  category_slug: string;
  subcategory: string | null;
  image_urls: string[];
  merchant: string;
  program_slug: string;
  affiliate_url: string;
  source_url: string | null;
  price: number;
  currency: string;
  previous_price: number | null;
  original_price: number | null;
  specs: Record<string, string>;
  pros: string[];
  cons: string[];
  availability: string;
  region: string[];
  keywords: string[];
  use_cases: string[];
  budget_tier: string;
  price_verified_at: string | null;
  approval_status: string;
  data_source: string;
  source: string | null;
  external_product_id: string | null;
  advertiser_id: string | null;
  commission_info: Record<string, unknown> | null;
  last_synced_at: string | null;
  updated_at: string;
}

const validAvailability = new Set(["in_stock", "out_of_stock", "unknown"]);
const validTier = new Set(["budget", "mid", "premium"]);
const validApproval = new Set(["approved", "pending", "rejected"]);
const validDataSource = new Set(["manual", "api", "csv_import", "n8n_workflow"]);

function asStringArray(value: unknown): string[] {
  if (Array.isArray(value)) return value.filter((item): item is string => typeof item === "string");
  if (typeof value === "string" && value.trim()) {
    try {
      const parsed = JSON.parse(value);
      if (Array.isArray(parsed)) return parsed.filter((item): item is string => typeof item === "string");
    } catch {
      return value.split(",").map((s) => s.trim()).filter(Boolean);
    }
  }
  return [];
}

function asRecord(value: unknown): Record<string, string> {
  if (typeof value === "string" && value.trim()) {
    try {
      return asRecord(JSON.parse(value));
    } catch {
      return {};
    }
  }
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .filter(([, v]) => v != null)
        .map(([k, v]) => [k, String(v)]),
    );
  }
  return {};
}

function asNumber(value: unknown): number | undefined {
  if (value == null) return undefined;
  const n = Number(value);
  return Number.isFinite(n) ? n : undefined;
}

/**
 * The feed URL the advertiser originally supplied, if the row carries it.
 *
 * `commission_info` is internal provenance. It lives on the base table only:
 * the public `catalogue_products` view deliberately omits it because it holds
 * signed, advertiser-controlled feed URLs. Reads that can see it are privileged
 * (service role) reads, never browser reads.
 */
function feedUrlFromCommissionInfo(value: unknown): string | undefined {
  if (!value || typeof value !== "object") return undefined;
  const info = value as Record<string, unknown>;
  const feedUrl = info.feedUrl ?? info.feed_url;
  return typeof feedUrl === "string" && feedUrl ? feedUrl : undefined;
}

/**
 * Category provenance the feed supplied, if the row carries it.
 *
 * Like `feedUrlFromCommissionInfo`, this lives only in `commission_info`, which
 * the public view does not project. Callers must therefore gate it behind a
 * privileged read; the public mapper must never reach into `commission_info`,
 * even when a future view change were to leak the column.
 */
function categoryProvenanceFromCommissionInfo(value: unknown): {
  sourceCategoryId?: string;
  sourceCategory?: string;
  categoryBasis?: Product["categoryBasis"];
} {
  if (!value || typeof value !== "object") return {};
  const info = value as Record<string, unknown>;
  return {
    sourceCategoryId: stringOrUndefined(info.sourceCategoryId),
    sourceCategory: stringOrUndefined(info.sourceCategory),
    categoryBasis: asCategoryBasis(info.categoryBasis),
  };
}

interface RowToProductOptions {
  /**
   * Read `commission_info` for `feedProductUrl`. Only a privileged base-table
   * read may set this: the public catalogue view does not project the column.
   */
  readProvenance: boolean;
}

/** Shared row -> Product mapping. Tolerant of nulls and partial rows. */
function rowToProduct(row: Record<string, unknown>, options: RowToProductOptions): Product {
  const availability = String(row.availability ?? "unknown");
  const tier = String(row.budget_tier ?? "budget");
  const approval = String(row.approval_status ?? "pending");
  const dataSource = String(row.data_source ?? "manual");
  // Provenance columns are readable only on a privileged base-table read.
  // Returning an empty object here keeps the public mapping provenance-free.
  const provenance = options.readProvenance
    ? categoryProvenanceFromCommissionInfo(row.commission_info)
    : {};

  return {
    id: String(row.id),
    slug: String(row.slug),
    title: String(row.title ?? ""),
    description: String(row.description ?? ""),
    categorySlug: String(row.category_slug ?? ""),
    subcategory: row.subcategory ? String(row.subcategory) : undefined,
    imageUrls: asStringArray(row.image_urls),
    merchant: String(row.merchant ?? ""),
    programSlug: String(row.program_slug ?? ""),
    affiliateUrl: String(row.affiliate_url ?? ""),
    sourceUrl: row.source_url ? String(row.source_url) : undefined,
    feedProductUrl: options.readProvenance
      ? feedUrlFromCommissionInfo(row.commission_info)
      : undefined,
    price: asNumber(row.price) ?? 0,
    currency: String(row.currency ?? "USD"),
    previousPrice: asNumber(row.previous_price),
    originalPrice: asNumber(row.original_price),
    specs: asRecord(row.specs),
    pros: asStringArray(row.pros),
    cons: asStringArray(row.cons),
    availability: (validAvailability.has(availability) ? availability : "unknown") as Product["availability"],
    region: asStringArray(row.region),
    keywords: asStringArray(row.keywords),
    useCases: asStringArray(row.use_cases),
    budgetTier: (validTier.has(tier) ? tier : "budget") as Product["budgetTier"],
    priceVerifiedAt: row.price_verified_at ? String(row.price_verified_at).slice(0, 10) : "",
    approvalStatus: (validApproval.has(approval) ? approval : "pending") as Product["approvalStatus"],
    dataSource: (validDataSource.has(dataSource) ? dataSource : "manual") as Product["dataSource"],
    source: row.source ? (String(row.source) as Product["source"]) : undefined,
    externalProductId: row.external_product_id ? String(row.external_product_id) : undefined,
    advertiserId: row.advertiser_id ? String(row.advertiser_id) : undefined,
    sourceCategoryId: provenance.sourceCategoryId,
    sourceCategory: provenance.sourceCategory,
    categoryBasis: provenance.categoryBasis,
    lastSyncedAt: row.last_synced_at ? String(row.last_synced_at) : undefined,
    createdAt: String(row.created_at ?? ""),
    updatedAt: String(row.updated_at ?? ""),
    aiHeadline: row.ai_headline ? String(row.ai_headline) : undefined,
    aiDescription: row.ai_description ? String(row.ai_description) : undefined,
    aiQualityFlags: asStringArray(row.ai_quality_flags),
    // 3D model state. Display-only; never part of an import payload.
    // `model_error` is intentionally not read here: the public catalogue view
    // does not expose it, and the page never needs the failure reason.
    modelUrl: row.model_url ? String(row.model_url) : undefined,
    modelFormat: row.model_format === "glb" ? ("glb" as const) : undefined,
    modelType:
      row.model_type === "single_image_generative" || row.model_type === "manual"
        ? (row.model_type as Product["modelType"])
        : undefined,
    modelStatus: row.model_status ? (String(row.model_status) as Product["modelStatus"]) : undefined,
    modelProvider: row.model_provider ? String(row.model_provider) : undefined,
    modelGeneratedAt: row.model_generated_at ? String(row.model_generated_at) : undefined,
    sourceImageHash: row.source_image_hash ? String(row.source_image_hash) : undefined,
  };
}

function stringOrUndefined(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value : undefined;
}

function asCategoryBasis(value: unknown): Product["categoryBasis"] {
  return value === "source-category" || value === "title" || value === "unresolved-id" || value === "none"
    ? value
    : undefined;
}

/**
 * Row -> Product for a privileged read of `public.affiliate_products`.
 *
 * Privileged callers (the service-role import/enrichment paths and their tests)
 * see the base table, including `commission_info`, so feed provenance is
 * preserved. Tolerant of nulls so an incomplete import cannot crash a page.
 */
export function fromProductRow(row: Record<string, unknown>): Product {
  return rowToProduct(row, { readProvenance: true });
}

/**
 * Row -> Product for the public `catalogue_products` view.
 *
 * The view omits research columns, `model_error` and `commission_info`. Feed
 * provenance is therefore *never available* here, by design, and the mapping
 * must not depend on it: `feedProductUrl` is always undefined, and no
 * browser-facing render reads it.
 */
export function fromPublicProductRow(row: Record<string, unknown>): Product {
  return rowToProduct(row, { readProvenance: false });
}

/**
 * Product -> row for an import upsert.
 * `commissionInfo` is optional structured provenance (advertiser, currency,
 * programme name) — it is data we received, never an estimate.
 *
 * `created_at` is deliberately absent: an upsert merges into an existing row,
 * and re-sending the import timestamp would rewrite the original creation
 * time on every re-sync. The column keeps its `default now()` on insert.
 */
export function toProductRow(
  product: Product,
  commissionInfo?: Record<string, unknown>,
): ProductRow {
  // The upsert conflict target includes advertiser_id, and NULLs never match in
  // a unique index. Fall back to the import-supplied advertiser id so every
  // imported row has a usable key.
  const advertiserFromInfo =
    typeof commissionInfo?.advertiserId === "string" ? commissionInfo.advertiserId : undefined;

  // Category provenance is carried inside `commission_info` because it belongs
  // to the same internal column the public view omits. Caller-supplied keys win,
  // so an explicit provenance object is never silently rewritten.
  const provenance: Record<string, unknown> = {};
  if (product.sourceCategoryId) provenance.sourceCategoryId = product.sourceCategoryId;
  if (product.sourceCategory) provenance.sourceCategory = product.sourceCategory;
  if (product.categoryBasis) provenance.categoryBasis = product.categoryBasis;
  const mergedInfo =
    Object.keys(provenance).length === 0 && !commissionInfo
      ? null
      : { ...provenance, ...(commissionInfo ?? {}) };

  return {
    id: product.id,
    slug: product.slug,
    title: product.title,
    description: product.description,
    category_slug: product.categorySlug,
    subcategory: product.subcategory ?? null,
    image_urls: product.imageUrls,
    merchant: product.merchant,
    program_slug: product.programSlug,
    affiliate_url: product.affiliateUrl,
    source_url: product.sourceUrl ?? null,
    price: product.price,
    currency: product.currency,
    previous_price: product.previousPrice ?? null,
    original_price: product.originalPrice ?? null,
    specs: product.specs,
    pros: product.pros,
    cons: product.cons,
    availability: product.availability,
    region: product.region,
    keywords: product.keywords,
    use_cases: product.useCases,
    budget_tier: product.budgetTier,
    price_verified_at: product.priceVerifiedAt || null,
    approval_status: product.approvalStatus,
    data_source: product.dataSource,
    source: product.source ?? null,
    external_product_id: product.externalProductId ?? null,
    advertiser_id: product.advertiserId ?? advertiserFromInfo ?? null,
    commission_info: mergedInfo,
    last_synced_at: product.lastSyncedAt ?? new Date().toISOString(),
    updated_at: product.updatedAt,
  };
}

/** Columns changed by a re-sync. Used to keep manual edits out of the update. */
export function importUpdateColumns(row: ProductRow): Partial<ProductRow> {
  return {
    title: row.title,
    description: row.description,
    category_slug: row.category_slug,
    subcategory: row.subcategory,
    image_urls: row.image_urls,
    merchant: row.merchant,
    affiliate_url: row.affiliate_url,
    source_url: row.source_url,
    price: row.price,
    currency: row.currency,
    previous_price: row.previous_price,
    original_price: row.original_price,
    availability: row.availability,
    region: row.region,
    keywords: row.keywords,
    budget_tier: row.budget_tier,
    price_verified_at: row.price_verified_at,
    last_synced_at: row.last_synced_at,
    commission_info: row.commission_info,
    updated_at: row.updated_at,
  };
}
