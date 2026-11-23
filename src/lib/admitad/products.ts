/**
 * Admitad import pipeline.
 *
 * One pass, in this order, per feed row:
 *   1. parse + normalise the feed file (feed-parser.ts)
 *   2. generate a tracked deeplink for the source product URL (deeplink.ts)
 *   3. map to a Fyndra Product (mapper.ts)
 *   4. dedupe by `source:advertiser_id:external_product_id`, keeping the first occurrence
 *   5. validate the resulting affiliate URL against the programme domain
 *
 * Failures are recorded per row with a reason. Nothing is silently dropped:
 * the caller receives counters and an error list it can persist or log.
 */

import { generateDeeplink } from "./deeplink";
import { parseFeed, type NormaliseFeedOptions } from "./feed-parser";
import {
  ADMITAD_PROGRAM_SLUG,
  mapFeedRowToProduct,
  productPublishBlockers,
  productSourceKey,
} from "./mapper";
import type { AdmitadCampaignForWebsite } from "./types";
import type { Product } from "@/lib/types";
import { validateAffiliateUrl } from "@/lib/affiliate";

export interface ImportOptions {
  /** ID of the advertiser programme the feed belongs to. */
  campaignId: number;
  /** Programme metadata used for merchant naming and currency fallback. */
  programme?: Pick<AdmitadCampaignForWebsite, "id" | "name" | "currency" | "regions">;
  /** Value written to `subid` on every deeplink. */
  subid?: string;
  /** Called for each row after mapping — lets a caller persist as it goes. */
  onProduct?: (product: Product, index: number) => Promise<void> | void;
  /** Hard cap on rows processed in one run. */
  maxRows?: number;
  /** Per-row deeplink delay (ms). Menial but keeps us far under 600 req/min. */
  throttleMs?: number;
  feedOptions?: NormaliseFeedOptions;
}

export interface ImportError {
  row: number;
  externalProductId?: string;
  reason: string;
}

export interface ImportReport {
  campaignId: number;
  programmeName: string;
  totalRows: number;
  imported: number;
  duplicates: number;
  skipped: number;
  errors: ImportError[];
  unmappedColumns: string[];
  format: string;
  startedAt: string;
  finishedAt: string;
  /** True when nothing could be imported for a structural reason. */
  blocked: boolean;
  blockedReason?: string;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Imports products from feed text.
 * Does not persist anything by itself — pass `onProduct` to store rows.
 */
export async function importFromFeedText(
  feedText: string,
  options: ImportOptions,
): Promise<{ report: ImportReport; products: Product[] }> {
  const startedAt = new Date().toISOString();
  const maxRows = options.maxRows ?? 200;
  const throttleMs = options.throttleMs ?? 0;

  const parsed = parseFeed(feedText, { ...options.feedOptions, maxRows });
  const report: ImportReport = {
    campaignId: options.campaignId,
    programmeName: options.programme?.name ?? `Programme ${options.campaignId}`,
    totalRows: parsed.totalRows,
    imported: 0,
    duplicates: 0,
    skipped: parsed.skipped.length,
    errors: parsed.skipped.map((s) => ({ row: s.index, reason: s.reason })),
    unmappedColumns: parsed.unmappedColumns,
    format: parsed.format,
    startedAt,
    finishedAt: startedAt,
    blocked: false,
  };

  if (parsed.totalRows === 0) {
    report.blocked = true;
    report.blockedReason =
      parsed.format === "unknown"
        ? "The feed format could not be detected (expected CSV, XML or JSON)."
        : "The feed parsed to zero rows. Check the export format in the Admitad dashboard.";
    report.finishedAt = new Date().toISOString();
    return { report, products: [] };
  }

  const programme =
    options.programme ??
    ({ id: options.campaignId, name: `Programme ${options.campaignId}`, currency: "USD" } as Pick<
      AdmitadCampaignForWebsite,
      "id" | "name" | "currency" | "regions"
    >);

  const products: Product[] = [];
  const seen = new Set<string>();

  for (let index = 0; index < parsed.rows.length; index += 1) {
    const row = parsed.rows[index];
    const dedupeKey = productSourceKey(
      ADMITAD_PROGRAM_SLUG,
      row.external_product_id,
      String(options.campaignId),
    );

    if (seen.has(dedupeKey)) {
      report.duplicates += 1;
      continue;
    }
    seen.add(dedupeKey);

    try {
      const link = await generateDeeplink(options.campaignId, {
        ulp: row.product_url,
        subid: options.subid,
      });

      const product = mapFeedRowToProduct({
        row,
        programme,
        affiliateUrl: link.link,
        region: programme.regions?.map((r) => r.region).filter(Boolean),
      });

      // Domain check against the Admitad programme entry. This is what keeps a
      // malformed or hijacked tracking URL from ever reaching the catalogue.
      const check = validateAffiliateUrl(product.affiliateUrl, ADMITAD_PROGRAM_SLUG);
      if (!check.ok) {
        report.errors.push({ row: index, externalProductId: row.external_product_id, reason: check.reason });
        continue;
      }

      const blockers = productPublishBlockers(product);
      if (blockers.length > 0) {
        report.errors.push({
          row: index,
          externalProductId: row.external_product_id,
          reason: `not publishable: ${blockers.join(", ")}`,
        });
        continue;
      }

      products.push(product);
      report.imported += 1;
      if (options.onProduct) await options.onProduct(product, index);
    } catch (err) {
      report.errors.push({
        row: index,
        externalProductId: row.external_product_id,
        reason: err instanceof Error ? err.message : "unknown error",
      });
    }

    if (throttleMs > 0) await sleep(throttleMs);
  }

  report.finishedAt = new Date().toISOString();
  report.blocked = report.imported === 0;
  if (report.blocked && !report.blockedReason) {
    report.blockedReason =
      "No rows produced a usable tracked link. Most common causes: programme not connected, deeplinks disabled for the programme, or URLs outside the allowed domains.";
  }

  return { report, products };
}

/** Downloads a feed URL. Admitad feed links are bearer-free signed URLs. */
export async function downloadFeed(url: string, timeoutMs = 25_000): Promise<string> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      headers: { Accept: "text/csv, application/xml, text/xml, application/json, */*" },
      signal: controller.signal,
      cache: "no-store",
    });
    if (!res.ok) {
      throw new Error(
        `Feed download failed (${res.status}). The feed link may have expired — refresh it from the Admitad dashboard or the ad-space programme endpoint.`,
      );
    }
    return await res.text();
  } finally {
    clearTimeout(timer);
  }
}
