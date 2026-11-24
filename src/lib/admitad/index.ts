/**
 * Admitad integration — public surface.
 *
 * SERVER ONLY. Every export here reaches for `process.env` or the Admitad API.
 * Never import this barrel from a `"use client"` module.
 */

export { describeConfig, getAdmitadConfig, isAdmitadConfigured, isAdmitadFullyConfigured, AdmitadNotConfiguredError } from "./config";
export { getAccessToken, invalidateAccessToken } from "./auth";
export { AdmitadApiError, admitadRequest } from "./client";
export {
  listProgrammes,
  listAllProgrammes,
  listWebsiteProgrammes,
  getProgramme,
  getWebsiteProgramme,
  checkAliExpressAvailability,
  looksLikeAliExpress,
  clearProgrammeCache,
  type AliExpressAvailability,
} from "./programmes";
export { generateDeeplink, validateDeeplink, AdmitadDeeplinkError } from "./deeplink";
export { validateGeneratedDeeplink, type GeneratedLinkCheck } from "./deeplink";
export { canonicalAliExpressProductUrl, isAliExpressProductId, aliExpressProductIdFromUrl, ALIEXPRESS_ITEM_ORIGIN } from "./aliexpress";
export {
  checkFeedPermission,
  describeFeedEntries,
  feedIdFromLink,
  summariseFeedPermission,
  type FeedEntry,
  type FeedPermission,
  type FeedPermissionEvidence,
  type FeedPermissionState,
  type PermissionProgramme,
} from "./permissions";
export {
  streamFeed,
  streamFeedWithRetry,
  sniffFeedFormat,
  classifyHttpStatus,
  FEED_LIMITS,
  type FeedFailure,
  type FeedFailureKind,
  type FeedStreamLimits,
  type FeedStreamProgress,
  type FeedStreamResult,
  type FeedStreamSuccess,
} from "./feed-stream";
export { listWebsites, getWebsite } from "./websites";

export {
  scrubFeedCredentials,
  toPublicAvailability,
  toPublicFeedPermission,
  toPublicProgramme,
  type PublicAvailability,
  type PublicFeedEntry,
  type PublicFeedPermission,
  type PublicProgramme,
} from "./public-view";
export { getStatistics, getAliExpressCommissionRates, formatAdmitadDate } from "./statistics";
export {
  parseFeed,
  parseCsv,
  parseXmlRecords,
  parseJsonRecords,
  parseStreamedXmlRecords,
  parseCategoryDictionary,
  canonicalField,
  detectFormat,
  XmlRecordStream,
  type XmlRecordBlock,
} from "./feed-parser";
export {
  mapFeedRowToProduct,
  inferCategory,
  inferBudgetTier,
  resolveProductCategory,
  buildProductSlug,
  slugify,
  productSourceKey,
  normaliseCurrency,
  productPublishBlockers,
  ADMITAD_PROGRAM_SLUG,
  ADMITAD_PROGRAM_NAME,
  ADMITAD_DEEPLINK_DOMAIN,
  FALLBACK_CATEGORY,
  UNCATEGORISED_SLUG,
} from "./mapper";
export {
  importFromFeedText,
  importFromFeedUrl,
  downloadFeed,
  type ImportReport,
  type ImportOptions,
  type ImportFromFeedUrlOptions,
  type DownloadFeedOptions,
  type FeedDownloadReport,
} from "./products";
export { runImport, type RunImportInput, type RunImportResult } from "./import-service";
export { enrichProduct, computeQualityFlags, looksLikeFabrication } from "./enrich";
export { fromProductRow, toProductRow, importUpdateColumns } from "./supabase-store";
export * from "./types";
