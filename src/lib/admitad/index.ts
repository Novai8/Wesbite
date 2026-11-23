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
export { listWebsites, getWebsite } from "./websites";
export { getStatistics, getAliExpressCommissionRates, formatAdmitadDate } from "./statistics";
export { parseFeed, parseCsv, parseXmlRecords, parseJsonRecords, canonicalField, detectFormat } from "./feed-parser";
export {
  mapFeedRowToProduct,
  inferCategory,
  inferBudgetTier,
  buildProductSlug,
  slugify,
  productSourceKey,
  normaliseCurrency,
  productPublishBlockers,
  ADMITAD_PROGRAM_SLUG,
  ADMITAD_PROGRAM_NAME,
  ADMITAD_DEEPLINK_DOMAIN,
} from "./mapper";
export { importFromFeedText, downloadFeed, type ImportReport, type ImportOptions } from "./products";
export { runImport, type RunImportInput, type RunImportResult } from "./import-service";
export { enrichProduct, computeQualityFlags, looksLikeFabrication } from "./enrich";
export { fromProductRow, toProductRow, importUpdateColumns } from "./supabase-store";
export * from "./types";