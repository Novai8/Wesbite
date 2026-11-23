/**
 * Import service: runs the pipeline and persists what it produced.
 *
 * Persistence is best-effort but *reported*: if Supabase is not configured the
 * run still returns its full report and analyses, and says `persisted: false`
 * with the reason. Nothing is claimed to be stored when it was not.
 */

import { enrichProduct } from "./enrich";
import { downloadFeed, importFromFeedText, type ImportOptions, type ImportReport } from "./products";
import { toProductRow } from "./supabase-store";
import {
  getSupabaseConfig,
  insertRows,
  isSupabaseConfigured,
  upsertRows,
  SUPABASE_TABLES,
} from "@/lib/supabase-rest";
import type { Product } from "@/lib/types";

export interface RunImportInput {
  feedText?: string;
  feedUrl?: string;
  campaignId: number;
  programme?: ImportOptions["programme"];
  subid?: string;
  maxRows?: number;
  throttleMs?: number;
  /** Run AI enrichment on each imported product. Requires GROQ_API_KEY. */
  enrich?: boolean;
  /** Write to Supabase. Defaults to true when configured. */
  persist?: boolean;
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
  let feedText = input.feedText;
  if (!feedText) {
    if (!input.feedUrl) throw new Error("Provide feedText or feedUrl.");
    feedText = await downloadFeed(input.feedUrl);
  }

  const { report, products } = await importFromFeedText(feedText, {
    campaignId: input.campaignId,
    programme: input.programme,
    subid: input.subid,
    maxRows: input.maxRows,
    throttleMs: input.throttleMs,
  });

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
      await upsertRows(
        SUPABASE_TABLES.products,
        products.map((p) =>
          toProductRow(p, {
            advertiserId: p.advertiserId ?? String(input.campaignId),
            programme: input.programme?.name,
            network: "admitad",
          }),
        ),
        "source,external_product_id",
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
  url.searchParams.set("id", `eq.${product.id}`);
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
