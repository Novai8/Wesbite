/**
 * Admitad programme discovery.
 *
 * Two documented views matter:
 *  - `GET /advcampaigns/` — the catalogue of advertiser programmes.
 *  - `GET /advcampaigns/website/{w_id}/` — the same programmes *as connected to
 *    your ad space*, including `connection_status`, `allow_deeplink`,
 *    `show_products_links` and the product-feed download links.
 *
 * Eligibility for product import is decided from the ad-space view only:
 * a programme must be `connection_status = "active"`, expose product links,
 * and (for deeplink use) have `allow_deeplink = true`.
 */

import { getAdmitadConfig, requireWebsiteId } from "./config";
import { admitadRequest } from "./client";
import type {
  AdmitadCampaign,
  AdmitadCampaignForWebsite,
  AdmitadPagedResponse,
} from "./types";

const DEFAULT_LIMIT = 100;
const CACHE_TTL_MS = 15 * 60 * 1000;

interface CacheEntry<T> {
  value: T;
  expiresAt: number;
}

const campaignCache = new Map<string, CacheEntry<AdmitadCampaign[]>>();

export interface ListProgrammesOptions {
  limit?: number;
  offset?: number;
  language?: string;
  /** Filter to programmes that expose a given tool, e.g. "products". */
  hasTool?: string;
  /** Filter by connected ad space id. */
  website?: string;
}

/** Catalogue view. Works without an ad space. */
export async function listProgrammes(
  options: ListProgrammesOptions = {},
): Promise<AdmitadCampaign[]> {
  const data = await admitadRequest<AdmitadPagedResponse<AdmitadCampaign>>("/advcampaigns/", {
    query: {
      limit: options.limit ?? DEFAULT_LIMIT,
      offset: options.offset ?? 0,
      language: options.language,
      has_tool: options.hasTool,
      website: options.website,
    },
  });
  return data?.results ?? [];
}

/** Fetch every programme, following `_meta.count` page by page. */
export async function listAllProgrammes(
  options: Omit<ListProgrammesOptions, "offset" | "limit"> & { maxPages?: number } = {},
): Promise<AdmitadCampaign[]> {
  const limit = DEFAULT_LIMIT;
  const maxPages = options.maxPages ?? 20;
  const all: AdmitadCampaign[] = [];
  for (let page = 0; page < maxPages; page += 1) {
    const data = await admitadRequest<AdmitadPagedResponse<AdmitadCampaign>>("/advcampaigns/", {
      query: {
        limit,
        offset: page * limit,
        language: options.language,
        has_tool: options.hasTool,
        website: options.website,
      },
    });
    const results = data?.results ?? [];
    all.push(...results);
    const count = data?._meta?.count ?? all.length;
    if (results.length < limit || all.length >= count) break;
  }
  return all;
}

export async function getProgramme(id: number | string, language?: string): Promise<AdmitadCampaign | null> {
  const data = await admitadRequest<AdmitadCampaign | AdmitadPagedResponse<AdmitadCampaign>>(
    `/advcampaigns/${encodeURIComponent(String(id))}/`,
    { query: { language } },
  );
  if (!data) return null;
  if ("results" in data) return data.results[0] ?? null;
  return data;
}

export interface ListWebsiteProgrammesOptions {
  connectionStatus?: "active" | "pending" | "declined";
  hasTool?: string;
  websiteId?: string;
  /** Skip the in-memory cache (used by admin "refresh" actions). */
  bypassCache?: boolean;
}

/**
 * Programmes attached to the configured ad space, paged to completion.
 * This is the authoritative source for "which programmes can I actually use".
 */
export async function listWebsiteProgrammes(
  options: ListWebsiteProgrammesOptions = {},
): Promise<AdmitadCampaignForWebsite[]> {
  const websiteId = options.websiteId ?? requireWebsiteId(getAdmitadConfig());
  const cacheKey = [
    websiteId,
    options.connectionStatus ?? "any",
    options.hasTool ?? "any",
  ].join("|");

  const cached = campaignCache.get(cacheKey);
  if (!options.bypassCache && cached && cached.expiresAt > Date.now()) {
    return cached.value as AdmitadCampaignForWebsite[];
  }

  const limit = DEFAULT_LIMIT;
  const all: AdmitadCampaignForWebsite[] = [];
  const maxPages = 20;

  for (let page = 0; page < maxPages; page += 1) {
    const data = await admitadRequest<AdmitadPagedResponse<AdmitadCampaignForWebsite>>(
      `/advcampaigns/website/${encodeURIComponent(websiteId)}/`,
      {
        query: {
          limit,
          offset: page * limit,
          connection_status: options.connectionStatus,
          has_tool: options.hasTool,
        },
      },
    );
    const results = data?.results ?? [];
    all.push(...results);
    const count = data?._meta?.count ?? all.length;
    if (results.length < limit || all.length >= count) break;
  }

  campaignCache.set(cacheKey, { value: all, expiresAt: Date.now() + CACHE_TTL_MS });
  return all;
}

export async function getWebsiteProgramme(
  campaignId: number | string,
  websiteId?: string,
): Promise<AdmitadCampaignForWebsite | null> {
  const wId = websiteId ?? requireWebsiteId(getAdmitadConfig());
  const data = await admitadRequest<
    AdmitadCampaignForWebsite | AdmitadPagedResponse<AdmitadCampaignForWebsite>
  >(`/advcampaigns/${encodeURIComponent(String(campaignId))}/website/${encodeURIComponent(wId)}/`);
  if (!data) return null;
  if ("results" in data) return data.results[0] ?? null;
  return data;
}

/** Names that identify the AliExpress Worldwide programme in the catalogue. */
const ALIEXPRESS_NAME_PATTERNS = [/aliexpress/i, /ali\s*express/i];

export function looksLikeAliExpress(programme: { name?: string; site_url?: string }): boolean {
  const haystack = `${programme.name ?? ""} ${programme.site_url ?? ""}`;
  return ALIEXPRESS_NAME_PATTERNS.some((re) => re.test(haystack)) || /aliexpress\./i.test(haystack);
}

export interface AliExpressAvailability {
  available: boolean;
  /** Present when the programme exists in the catalogue view. */
  programme?: AdmitadCampaignForWebsite;
  /** Present when the programme is not connected to the ad space. */
  connectionStatus?: string;
  reason: string;
  /** True when we can also import products (feed links + product tool). */
  canImportProducts: boolean;
  /** True when deeplinks may be generated for this programme. */
  canUseDeeplinks: boolean;
}

/**
 * Answers "is AliExpress WW usable for this publisher account?" from real API
 * data. Never guesses: if the programme is absent it says so.
 */
export async function checkAliExpressAvailability(
  options: { websiteId?: string; bypassCache?: boolean } = {},
): Promise<AliExpressAvailability> {
  const programmes = await listWebsiteProgrammes({
    websiteId: options.websiteId,
    bypassCache: options.bypassCache,
  });

  const programme = programmes.find((p) => looksLikeAliExpress(p));

  if (!programme) {
    return {
      available: false,
      reason:
        "No AliExpress programme is connected to this ad space. Join AliExpress WW in the Admitad catalogue, wait for approval, then re-run the check.",
      canImportProducts: false,
      canUseDeeplinks: false,
    };
  }

  const status = programme.connection_status ?? "unknown";
  const active = status === "active";
  const hasFeed = Boolean(
    programme.show_products_links ||
      programme.products_csv_link ||
      programme.products_xml_link ||
      (programme.feeds_info && programme.feeds_info.length > 0),
  );
  const canUseDeeplinks = active && programme.allow_deeplink !== false;

  return {
    available: active,
    programme,
    connectionStatus: status,
    canImportProducts: active && hasFeed,
    canUseDeeplinks,
    reason: active
      ? hasFeed
        ? "AliExpress WW is connected and exposes product feeds."
        : "AliExpress WW is connected but this ad space has no product-feed links. Enable the product tool / request feed access with the advertiser."
      : `AliExpress WW cooperation status is "${status}". Approval is required before imports or deeplinks can be used.`,
  };
}

export function clearProgrammeCache(): void {
  campaignCache.clear();
}