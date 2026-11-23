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
import { validateGeneratedDeeplink } from "./deeplink";
import { parseFeed, parseStreamedXmlRecords, type NormaliseFeedOptions } from "./feed-parser";
import type { FeedParseResult } from "./types";
import {
  streamFeed,
  streamFeedWithRetry,
  type FeedStreamLimits,
  type FeedStreamResult,
} from "./feed-stream";
import { canonicalAliExpressProductUrl } from "./aliexpress";
import { checkFeedPermission, type FeedPermission, type PermissionProgramme } from "./permissions";
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
  programme?: Pick<
    AdmitadCampaignForWebsite,
    "id" | "name" | "currency" | "regions" | "show_products_links" | "allowed_deeplink_domains"
  >;
  /** Value written to `subid` on every deeplink. */
  subid?: string;
  /** Called for each row after mapping — lets a caller persist as it goes. */
  onProduct?: (product: Product, index: number) => Promise<void> | void;
  /** Hard cap on rows processed in one run. */
  maxRows?: number;
  /** Per-row deeplink delay (ms). Menial but keeps us far under 600 req/min. */
  throttleMs?: number;
  feedOptions?: NormaliseFeedOptions;
  /**
   * The ad-space programme record. When supplied, its `show_products_links`
   * permission flag is enforced before a single row is processed.
   */
  permission?: PermissionProgramme;
  /**
   * Advertiser's allowed destination domains (Admitad
   * `allowed_deeplink_domains`). Used to validate the URL actually sent for
   * tracking. Optional so feed parsing stays testable without API data.
   */
  allowedDeeplinkDomains?: string[];
  /** Skip Admitad `/validate_links/` per row (tests only). */
  skipLinkValidation?: boolean;
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
  /** Present when the caller supplied the programme's ad-space record. */
  feedPermission?: FeedPermission;
  /** Set when the feed was read from a URL and stopped early or failed. */
  download?: FeedDownloadReport;
  /** Category-id resolution against the feed's own dictionary. */
  categories?: {
    dictionarySize: number;
    resolved: number;
    unresolved: number;
    unresolvedIds: string[];
  };
}

export interface FeedDownloadReport {
  /** HTTP status of the final attempt, when a response was received. */
  status?: number;
  contentType?: string | null;
  bytes: number;
  records: number;
  elapsedMs: number;
  /** True when a cap stopped the read before the document ended. */
  truncated: boolean;
  truncationReason?: string;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Admitad's documented `ulp` limit. Kept as-is on purpose. */
const ULP_MAX = 200;

/**
 * Chooses the URL that gets tracked.
 *
 * Preference order:
 *  1. A feed URL that is already a short, non-provider HTTP(S) URL — used
 *     as-is (the historical behaviour, still correct for ordinary feeds).
 *  2. A canonical AliExpress product URL built from the product id — the case
 *     for AliExpress WW, whose feed URL is a 485+ character tracking link.
 *
 * Anything else is an error for that row. The `ulp` limit is never bypassed.
 */
export function resolveDestination(row: {
  external_product_id?: string;
  product_url?: string;
}): { url: string; rebuiltFromId: boolean; error?: string } {
  const feedUrl = (row.product_url ?? "").trim();
  const id = row.external_product_id;

  let usable = false;
  if (/^https:\/\//i.test(feedUrl) && feedUrl.length <= ULP_MAX) {
    try {
      const host = new URL(feedUrl).hostname.toLowerCase();
      // A provider tracking host is not a destination, even when short.
      usable = !(host === "rzekl.com" || host.endsWith(".rzekl.com"));
    } catch {
      usable = false;
    }
  }

  if (usable) return { url: feedUrl, rebuiltFromId: false };

  const canonical = canonicalAliExpressProductUrl(id);
  if (canonical) return { url: canonical, rebuiltFromId: true };

  return {
    url: "",
    rebuiltFromId: false,
    error: feedUrl
      ? `no usable tracked destination: the feed URL is ${feedUrl.length} characters (limit ${ULP_MAX}) and the product id "${String(id ?? "")}" is not a valid AliExpress id`
      : `no usable tracked destination: the feed supplied no URL and the product id "${String(id ?? "")}" is not a valid AliExpress id`,
  };
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

  // Permission gate runs before parsing: a programme that has not enabled
  // product links must not have its feed read at all. `ambiguous` is blocked
  // too, but says what the contradiction is instead of a flat denial.
  const permission = options.permission ? checkFeedPermission(options.permission) : undefined;
  if (permission && !permission.allowed) {
    const now = new Date().toISOString();
    return {
      report: {
        campaignId: options.campaignId,
        programmeName: options.programme?.name ?? options.permission?.name ?? `Programme ${options.campaignId}`,
        totalRows: 0,
        imported: 0,
        duplicates: 0,
        skipped: 0,
        errors: [],
        unmappedColumns: [],
        format: "unknown",
        startedAt: now,
        finishedAt: now,
        blocked: true,
        blockedReason: permission.reason,
        feedPermission: permission,
      },
      products: [],
    };
  }

  // Inline text is already in memory, so the CSV/XML/JSON parser handles it
  // directly; URL imports use the streaming path instead.
  const parsed = parseFeed(feedText, { ...options.feedOptions, maxRows });

  return runRows(parsed, options, startedAt, permission);
}

async function runRows(
  parsed: FeedParseResult,
  options: ImportOptions,
  startedAt: string,
  permission: FeedPermission | undefined,
  download?: FeedDownloadReport,
): Promise<{ report: ImportReport; products: Product[] }> {
  const throttleMs = options.throttleMs ?? 0;

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
    feedPermission: permission,
    categories: parsed.categories,
    ...(download ? { download } : {}),
  };

  const products: Product[] = [];
  const seen = new Set<string>();

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
      // Decide which URL to track. A feed URL that is itself a provider
      // tracking link (or is too long for `ulp`) is replaced by the canonical
      // product page, which is the real destination.
      const destination = resolveDestination(row);
      if (destination.error) {
        report.errors.push({
          row: index,
          externalProductId: row.external_product_id,
          reason: destination.error,
        });
        continue;
      }

      const link = await generateDeeplink(options.campaignId, {
        ulp: destination.url,
        subid: options.subid,
      });

      // A generated link is accepted only from the API response and only when
      // its host is a programme tracking host AND Admitad confirms payment.
      const accepted = await validateGeneratedDeeplink(link, ADMITAD_PROGRAM_SLUG, {
        skipNetworkValidation: options.skipLinkValidation,
      });
      if (!accepted.ok) {
        report.errors.push({
          row: index,
          externalProductId: row.external_product_id,
          reason: accepted.reason,
        });
        continue;
      }

      const product = mapFeedRowToProduct({
        row,
        programme,
        affiliateUrl: link.link,
        region: programme.regions?.map((r) => r.region).filter(Boolean),
        destinationUrl: destination.url,
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

/**
 * Downloads a feed URL.
 *
 * Kept for callers that still want raw text (and for small inline feeds). It
 * now streams with idle + absolute timeouts instead of one 25s deadline, so a
 * large but healthy export is not mistaken for an expired link.
 */
export interface DownloadFeedOptions extends FeedStreamLimits {
  fetchImpl?: typeof fetch;
  signal?: AbortSignal;
  onProgress?: (progress: { bytes: number; records: number; elapsedMs: number }) => void;
}

export async function downloadFeed(
  url: string,
  options: DownloadFeedOptions | number = {},
): Promise<string> {
  // Backwards compatibility: the old signature took a timeout in ms.
  const opts: DownloadFeedOptions =
    typeof options === "number" ? { totalTimeoutMs: options } : options;

  const result = await streamFeed(url, opts);
  if (!result.ok) {
    throw new Error(result.message);
  }
  if (result.format === "xml") {
    // Reassemble the document from the records we kept, so callers that only
    // want text still work without us retaining the original payload.
    return [
      '<?xml version="1.0" encoding="UTF-8"?>',
      "<records>",
      ...result.records.map((record) => record.xml),
      "</records>",
    ].join("\n");
  }
  return result.text;
}

export interface ImportFromFeedUrlOptions extends ImportOptions {
  /** Stream/retry tuning. */
  download?: DownloadFeedOptions & { attempts?: number };
  /** Retries for transient failures only. Defaults to 3 attempts. */
  attempts?: number;
}

/**
 * Imports directly from a feed URL without buffering the whole file.
 *
 * Permission is checked before the first byte is requested. Truncated reads are
 * refused outright rather than imported partially.
 */
export async function importFromFeedUrl(
  url: string,
  options: ImportFromFeedUrlOptions,
): Promise<{ report: ImportReport; products: Product[] }> {
  const startedAt = new Date().toISOString();
  const permission = options.permission ? checkFeedPermission(options.permission) : undefined;
  if (permission && !permission.allowed) {
    return {
      report: {
        campaignId: options.campaignId,
        programmeName: options.programme?.name ?? options.permission?.name ?? `Programme ${options.campaignId}`,
        totalRows: 0,
        imported: 0,
        duplicates: 0,
        skipped: 0,
        errors: [],
        unmappedColumns: [],
        format: "unknown",
        startedAt,
        finishedAt: startedAt,
        blocked: true,
        blockedReason: permission.reason,
        feedPermission: permission,
      },
      products: [],
    };
  }

  // Transient failures (overload, timeout, network) are retried; an expired
  // signature is not, because another attempt cannot help it. Default to one
  // extra attempt, since the export host has been observed to blip.
  const attempts = options.attempts ?? options.download?.attempts ?? 2;
  const download =
    attempts > 1
      ? await streamFeedWithRetry(url, { ...(options.download ?? {}), attempts })
      : await streamFeed(url, options.download ?? {});
  if (!download.ok) {
    return {
      report: {
        campaignId: options.campaignId,
        programmeName: options.programme?.name ?? `Programme ${options.campaignId}`,
        totalRows: 0,
        imported: 0,
        duplicates: 0,
        skipped: 0,
        errors: [],
        unmappedColumns: [],
        format: "unknown",
        startedAt,
        finishedAt: new Date().toISOString(),
        blocked: true,
        blockedReason: `Feed download failed (${download.kind}): ${download.message}`,
        feedPermission: permission,
        download: {
          status: download.status,
          bytes: 0,
          records: 0,
          elapsedMs: 0,
          truncated: false,
        },
      },
      products: [],
    };
  }

  const downloadReport: FeedDownloadReport = {
    status: download.status,
    contentType: download.contentType,
    bytes: download.bytes,
    records: download.records.length,
    elapsedMs: download.progress.elapsedMs,
    truncated: download.truncated,
    truncationReason: download.truncationReason,
  };

  // A truncated read is never imported: a partial catalogue looks complete to
  // everything downstream once it is written.
  if (download.truncated) {
    return {
      report: {
        campaignId: options.campaignId,
        programmeName: options.programme?.name ?? `Programme ${options.campaignId}`,
        totalRows: download.records.length,
        imported: 0,
        duplicates: 0,
        skipped: 0,
        errors: [],
        unmappedColumns: [],
        format: download.format,
        startedAt,
        finishedAt: new Date().toISOString(),
        blocked: true,
        blockedReason:
          `The feed read stopped early (${download.truncationReason ?? "unknown reason"}). ` +
          "A truncated feed is refused instead of imported partially. Raise the caps or split the feed, then retry.",
        feedPermission: permission,
        download: downloadReport,
      },
      products: [],
    };
  }

  return importParsedFeed(download, options, startedAt, permission, downloadReport);
}

/** Runs the row pipeline over an already-downloaded feed. */
async function importParsedFeed(
  download: FeedStreamResult & { ok: true },
  options: ImportOptions,
  startedAt: string,
  permission: FeedPermission | undefined,
  downloadReport: FeedDownloadReport,
): Promise<{ report: ImportReport; products: Product[] }> {
  const maxRows = options.maxRows ?? 200;
  const parsed =
    download.format === "xml"
      ? parseStreamedXmlRecords(download.records, {
          ...options.feedOptions,
          maxRows,
          categoryDictionary: download.categoryDictionary,
          truncated: download.truncated,
          truncationReason: download.truncationReason,
        })
      : parseFeed(download.text, { ...options.feedOptions, maxRows });

  return runRows(parsed, options, startedAt, permission, downloadReport);
}
