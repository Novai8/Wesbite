/**
 * Import service: runs the pipeline and persists what it produced.
 *
 * Persistence is best-effort but *reported*: if Supabase is not configured the
 * run still returns its full report and analyses, and says `persisted: false`
 * with the reason. Nothing is claimed to be stored when it was not.
 */

import { enrichProduct } from "./enrich";
import { PRODUCT_SOURCE_UNIQUE_COLUMNS } from "./mapper";
import {
  importFromFeedText,
  importFromFeedUrl,
  type DownloadFeedOptions,
  type ImportOptions,
  type ImportReport,
} from "./products";
import { toProductRow } from "./supabase-store";
import { scrubFeedCredentials } from "./public-view";
import {
  getSupabaseConfig,
  insertRows,
  isSupabaseConfigured,
  selectRows,
  upsertRows,
  SUPABASE_TABLES,
} from "@/lib/supabase-rest";
import type { Product } from "@/lib/types";

export interface RunImportInput {
  feedText?: string;
  feedUrl?: string;
  campaignId: number;
  programme?: ImportOptions["programme"];
  /**
   * The ad-space programme record. When present, its `show_products_links`
   * flag is enforced and the import fails closed without reading the feed.
   * Omitted by callers that only supply metadata (tests, inline feed text).
   */
  permission?: ImportOptions["permission"];
  /** Advertiser's allowed destination domains, from the ad-space programme. */
  allowedDeeplinkDomains?: string[];
  /** Skip Admitad /validate_links/ per row. Tests only. */
  skipLinkValidation?: boolean;
  subid?: string;
  maxRows?: number;
  throttleMs?: number;
  /** Run AI enrichment on each imported product. Requires GROQ_API_KEY. */
  enrich?: boolean;
  /** Write to Supabase. Defaults to true when configured. */
  persist?: boolean;
  /** Streaming download tuning for URL imports. */
  download?: DownloadFeedOptions;
}

export interface RunImportResult {
  report: ImportReport;
  products: Product[];
  persisted: boolean;
  persistReason?: string;
  enriched: number;
  enrichmentSkipped?: string;
}

export async function runImport(input: RunImportInput): Promise<RunImportResult> {
  const sharedOptions: ImportOptions = {
    campaignId: input.campaignId,
    programme: input.programme,
    permission: input.permission,
    allowedDeeplinkDomains: input.allowedDeeplinkDomains,
    skipLinkValidation: input.skipLinkValidation,
    subid: input.subid,
    maxRows: input.maxRows,
    throttleMs: input.throttleMs,
  };

  // URL imports stream; inline text is parsed directly. Both share the same
  // permission gate and row pipeline.
  const { report, products } = input.feedText
    ? await importFromFeedText(input.feedText, sharedOptions)
    : await importFromFeedUrl(requireFeedUrl(input), { ...sharedOptions, download: input.download });

  let enriched = 0;
  let enrichmentSkipped: string | undefined;

  if (input.enrich) {
    if (!process.env.GROQ_API_KEY) {
      enrichmentSkipped = "GROQ_API_KEY is not set; skipped AI enrichment.";
    } else {
      for (const product of products) {
        const result = await enrichProduct({
          product,
          keywords: product.keywords,
        });
        if (result.headline || result.description) {
          product.aiHeadline = result.headline;
          product.aiDescription = result.description;
          enriched += 1;
        }
        if (result.qualityFlags?.length) product.aiQualityFlags = result.qualityFlags;
        if (result.error) enrichmentSkipped = result.error;
      }
    }
  } else {
    enrichmentSkipped = "AI enrichment not requested.";
  }

  const wantsPersist = input.persist ?? true;
  if (!wantsPersist) {
    return { report, products, persisted: false, persistReason: "Persistence disabled for this run.", enriched, enrichmentSkipped };
  }
  if (!isSupabaseConfigured()) {
    return {
      report,
      products,
      persisted: false,
      persistReason:
        "Supabase is not configured (SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY). Products were parsed and validated but not stored.",
      enriched,
      enrichmentSkipped,
    };
  }

  try {
    await recordRun(report);
    if (products.length > 0) {
      const existing = await existingProductIdentities(products, getSupabaseConfig() as NonNullable<ReturnType<typeof getSupabaseConfig>>);
      await upsertRows(
        SUPABASE_TABLES.products,
        products.map((p) => {
          const row = toProductRow(p, {
            advertiserId: p.advertiserId ?? String(input.campaignId),
            programme: input.programme?.name,
            network: "admitad",
            // Provenance only: the URL the feed supplied. For AliExpress WW this
            // is a long provider tracking link, so it is never tracked; the
            // canonical product page lives in `source_url`.
            feedUrl: p.feedProductUrl,
          });
          // Keep the identity of a row an earlier import already created. The
          // upsert conflict target is the source tuple, so sending a new id
          // would rewrite the primary key (and any referencing rows) instead
          // of updating the record in place.
          const prior = p.externalProductId
            ? existing.get(`${row.advertiser_id}:${p.externalProductId}`)
            : undefined;
          return prior ? { ...row, id: prior.id, slug: prior.slug } : row;
        }),
        PRODUCT_SOURCE_UNIQUE_COLUMNS,
        getSupabaseConfig() as NonNullable<ReturnType<typeof getSupabaseConfig>>,
      );
      // Persist AI copy to its own columns, so a later re-sync of source data
      // cannot clobber it and it can never overwrite a source field.
      await recordEnrichment(products);
    }
    return { report, products, persisted: true, enriched, enrichmentSkipped };
  } catch (err) {
    return {
      report,
      products,
      persisted: false,
      persistReason: err instanceof Error ? err.message : "Unknown Supabase error.",
      enriched,
      enrichmentSkipped,
    };
  }
}

function requireFeedUrl(input: RunImportInput): string {
  if (!input.feedUrl) throw new Error("Provide feedText or feedUrl.");
  return input.feedUrl;
}

interface ExistingIdentity {
  id: string;
  slug: string;
  advertiserId: string;
  externalProductId: string;
}

/** Escapes a value for PostgREST's quoted `in.(...)` list. */
function postgrestListValue(value: string): string {
  return `"${value.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`;
}

/**
 * Reads the ids and slugs of rows this import will merge into.
 *
 * Failure here must not block an import: the deterministic id is still a
 * valid fallback. It is only an optimisation for databases that already hold
 * rows from an earlier version of the integration.
 */
async function existingProductIdentities(
  products: Product[],
  config: NonNullable<ReturnType<typeof getSupabaseConfig>>,
): Promise<Map<string, ExistingIdentity>> {
  const externalIds = [
    ...new Set(
      products
        .map((product) => product.externalProductId)
        .filter((id): id is string => Boolean(id)),
    ),
  ];
  if (externalIds.length === 0) return new Map();

  try {
    const rows = await selectRows<Record<string, unknown>>(
      SUPABASE_TABLES.products,
      {
        select: "id,slug,advertiser_id,external_product_id",
        source: "eq.admitad",
        external_product_id: `in.(${externalIds.map(postgrestListValue).join(",")})`,
      },
      config,
      { revalidate: 0 },
    );

    const found = new Map<string, ExistingIdentity>();
    for (const row of rows) {
      const advertiserId = String(row.advertiser_id ?? "");
      const externalProductId = String(row.external_product_id ?? "");
      if (!row.id || !row.slug || !externalProductId) continue;
      found.set(`${advertiserId}:${externalProductId}`, {
        id: String(row.id),
        slug: String(row.slug),
        advertiserId,
        externalProductId,
      });
    }
    return found;
  } catch (err) {
    console.warn(
      `[admitad-import] could not read existing identities; using deterministic ids: ${
        scrubFeedCredentials(err instanceof Error ? err.message : String(err))
      }`,
    );
    return new Map();
  }
}

async function recordRun(report: ImportReport): Promise<void> {
  const config = getSupabaseConfig();
  if (!config) return;
  const inserted = await insertRowsReturning(
    SUPABASE_TABLES.importRuns,
    [
      {
        campaign_id: report.campaignId,
        programme_name: report.programmeName,
        feed_format: report.format,
        total_rows: report.totalRows,
        imported: report.imported,
        duplicates: report.duplicates,
        skipped: report.skipped,
        error_count: report.errors.length,
        blocked: report.blocked,
        blocked_reason: report.blockedReason ?? null,
        unmapped_columns: report.unmappedColumns,
        started_at: report.startedAt,
        finished_at: report.finishedAt,
      },
    ],
    config,
  );

  const runId = inserted?.[0]?.id;
  if (runId && report.errors.length > 0) {
    await insertRows(
      SUPABASE_TABLES.importErrors,
      report.errors.slice(0, 200).map((error) => ({
        run_id: runId,
        row_index: error.row,
        external_product_id: error.externalProductId ?? null,
        reason: error.reason.slice(0, 500),
      })),
      config,
    );
  }
}

/**
 * AI fields are written with a targeted PATCH against the row id, so the
 * statement touches only `ai_*` columns.
 */
async function recordEnrichment(products: Product[]): Promise<void> {
  const config = getSupabaseConfig();
  if (!config) return;
  const enriched = products.filter((p) => p.aiHeadline || p.aiDescription || p.aiQualityFlags?.length);
  if (enriched.length === 0) return;

  for (const product of enriched) {
    await patchAiFields(product, config);
  }
}

async function patchAiFields(
  product: Product,
  config: NonNullable<ReturnType<typeof getSupabaseConfig>>,
): Promise<void> {
  const url = new URL(`${config.url}/rest/v1/${SUPABASE_TABLES.products}`);
  // Filter on the provenance tuple, not the primary key: a re-sync may reuse
  // the id of a row created by an earlier import, and the tuple is the
  // invariant both writes agree on.
  if (product.source && product.advertiserId && product.externalProductId) {
    url.searchParams.set("source", `eq.${product.source}`);
    url.searchParams.set("advertiser_id", `eq.${product.advertiserId}`);
    url.searchParams.set("external_product_id", `eq.${product.externalProductId}`);
  } else {
    url.searchParams.set("id", `eq.${product.id}`);
  }
  url.searchParams.set("data_source", "neq.manual");
  const res = await fetch(url.toString(), {
    method: "PATCH",
    headers: {
      apikey: config.serviceRoleKey,
      Authorization: `Bearer ${config.serviceRoleKey}`,
      "Content-Type": "application/json",
      Prefer: "return=minimal",
    },
    body: JSON.stringify({
      ai_headline: product.aiHeadline ?? null,
      ai_description: product.aiDescription ?? null,
      ai_quality_flags: product.aiQualityFlags ?? [],
    }),
    cache: "no-store",
  });
  if (!res.ok) {
    throw new Error(`AI field update failed (${res.status}).`);
  }
}

/** Minimal insert that returns the created rows (for the run id). */
async function insertRowsReturning<T extends object>(
  table: string,
  rows: T[],
  config: NonNullable<ReturnType<typeof getSupabaseConfig>>,
): Promise<Array<{ id?: string }>> {
  const url = new URL(`${config.url}/rest/v1/${table}`);
  const res = await fetch(url.toString(), {
    method: "POST",
    headers: {
      apikey: config.serviceRoleKey,
      Authorization: `Bearer ${config.serviceRoleKey}`,
      "Content-Type": "application/json",
      Prefer: "return=representation",
    },
    body: JSON.stringify(rows),
    cache: "no-store",
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`insert ${table} failed (${res.status}): ${text.slice(0, 300)}`);
  }
  return (await res.json()) as Array<{ id?: string }>;
}
