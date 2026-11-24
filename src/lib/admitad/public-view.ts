/**
 * Public-safe projections for Admitad programme records.
 *
 * The ad-space programme object carries signed, per-publisher export URLs in
 * `products_csv_link`, `products_xml_link` and `feeds_info[].{csv,xml}_link`.
 * Each of those URLs embeds the publisher id (`user=PID...`) and an access
 * `code=` that serves the file. They are credentials in everything but name.
 *
 * Nothing outside the importer needs them. Workflow callers need *identity*
 * and *permission state*: which feeds exist, whether the advertiser allows
 * import, and why. This module is the single place that decides what crosses
 * that boundary, so a new API route cannot accidentally re-expose a raw record
 * by hand-rolling its own response.
 *
 * Two layers, on purpose:
 *   1. `toPublicProgramme` / `toPublicAvailability` rebuild the object field by
 *      field from an allowlist. A new upstream field is therefore invisible by
 *      default instead of leaking by default.
 *   2. `scrubFeedCredentials` is a last-resort scrubber for free-form text
 *      (error messages), which cannot be rebuilt from an allowlist.
 */

import { describeFeedEntries } from "./permissions";
import type { FeedPermission } from "./permissions";
import type { AdmitadCampaignForWebsite } from "./types";

/** One feed entry, identified by id. Never carries the download link. */
export interface PublicFeedEntry {
  feedId: string | null;
  name?: string;
  format: "csv" | "xml" | "unknown";
  lastUpdate?: string;
}

/**
 * A programme as a workflow caller may see it.
 *
 * Deliberately absent: `products_csv_link`, `products_xml_link`,
 * `feeds_info[].{csv,xml}_link`, `gotolink`, `description`,
 * `raw_description`, `actions_detail`, `regions`, `traffic` and any other
 * advertiser-supplied blob. None of them is needed to decide whether an import
 * may run, and several are large enough to make the status response unusable.
 */
export interface PublicProgramme {
  id: number;
  name: string;
  siteUrl: string | null;
  status: string | null;
  connectionStatus: string | null;
  currency: string | null;
  showProductsLinks: boolean | null;
  deeplinkAllowed: boolean | null;
  /** A product-feed link exists. Says *that* it exists, never what it is. */
  hasCsvFeed: boolean;
  hasXmlFeed: boolean;
  feedEntryCount: number;
  feedIds: string[];
  feeds: PublicFeedEntry[];
  allowedDeeplinkDomains: string[] | null;
}

/** Permission state, rebuilt so a new evidence field cannot leak by default. */
export interface PublicFeedPermission {
  state: FeedPermission["state"];
  allowed: boolean;
  reason: string;
  evidence: {
    connectionStatus: string | null;
    showProductsLinks: boolean | null;
    malformedFlag: boolean;
    feedEntryCount: number;
    matchingFeedIds: string[];
    allowDeeplink: boolean | null;
  };
}

export interface PublicAvailability {
  available: boolean;
  connectionStatus: string | null;
  canImportProducts: boolean;
  canUseDeeplinks: boolean;
  reason: string;
  feedPermission: PublicFeedPermission | null;
  programme: PublicProgramme | null;
}

function hasLink(programme: ProgrammeInput, format: "csv" | "xml"): boolean {
  const key = format === "csv" ? "csv_link" : "xml_link";
  const topLevel = format === "csv" ? programme.products_csv_link : programme.products_xml_link;
  if (topLevel) return true;
  const info = Array.isArray(programme.feeds_info) ? programme.feeds_info : [];
  return info.some((entry) => entry && typeof entry === "object" && Boolean(entry[key]));
}

/**
 * The fields this projection reads. Only identity is required: the routes hand
 * over a full `AdmitadCampaignForWebsite`, but the permission layer and tests
 * hand over the narrower `PermissionProgramme`, and both are enough.
 */
type ProgrammeInput = Partial<AdmitadCampaignForWebsite> &
  Pick<AdmitadCampaignForWebsite, "id" | "name">;

/**
 * Rebuilds one programme from an allowlist. Returns `null` for absent input so
 * callers can pass `availability.programme` straight through.
 */
export function toPublicProgramme(
  programme: ProgrammeInput | null | undefined,
): PublicProgramme | null {
  if (!programme) return null;
  const feeds: PublicFeedEntry[] = describeFeedEntries(programme).map((entry) => ({
    feedId: entry.feedId,
    ...(entry.name ? { name: entry.name } : {}),
    format: entry.format,
    ...(entry.lastUpdate ? { lastUpdate: entry.lastUpdate } : {}),
  }));

  return {
    id: programme.id,
    name: programme.name,
    siteUrl: typeof programme.site_url === "string" ? programme.site_url : null,
    status: typeof programme.status === "string" ? programme.status : null,
    connectionStatus:
      typeof programme.connection_status === "string" ? programme.connection_status : null,
    currency: typeof programme.currency === "string" ? programme.currency : null,
    showProductsLinks:
      typeof programme.show_products_links === "boolean" ? programme.show_products_links : null,
    deeplinkAllowed:
      typeof programme.allow_deeplink === "boolean" ? programme.allow_deeplink : null,
    hasCsvFeed: hasLink(programme, "csv"),
    hasXmlFeed: hasLink(programme, "xml"),
    feedEntryCount: feeds.length,
    feedIds: feeds.map((feed) => feed.feedId).filter((id): id is string => Boolean(id)),
    feeds,
    allowedDeeplinkDomains: Array.isArray(programme.allowed_deeplink_domains)
      ? programme.allowed_deeplink_domains.filter((domain): domain is string => typeof domain === "string")
      : null,
  };
}

export function toPublicFeedPermission(permission: FeedPermission): PublicFeedPermission {
  return {
    state: permission.state,
    allowed: permission.allowed,
    reason: permission.reason,
    evidence: {
      connectionStatus: permission.evidence.connectionStatus,
      showProductsLinks: permission.evidence.showProductsLinks,
      malformedFlag: permission.evidence.malformedFlag,
      feedEntryCount: permission.evidence.feedEntryCount,
      matchingFeedIds: [...permission.evidence.matchingFeedIds],
      allowDeeplink: permission.evidence.allowDeeplink,
    },
  };
}

/** Availability as reported to a workflow caller, with the programme sanitised. */
export function toPublicAvailability(availability: {
  available: boolean;
  connectionStatus?: string;
  reason: string;
  canImportProducts: boolean;
  canUseDeeplinks: boolean;
  feedPermission?: FeedPermission;
  programme?: ProgrammeInput;
}): PublicAvailability {
  return {
    available: availability.available,
    connectionStatus: availability.connectionStatus ?? null,
    canImportProducts: availability.canImportProducts,
    canUseDeeplinks: availability.canUseDeeplinks,
    reason: scrubFeedCredentials(availability.reason),
    feedPermission: availability.feedPermission
      ? toPublicFeedPermission(availability.feedPermission)
      : null,
    programme: toPublicProgramme(availability.programme),
  };
}

/**
 * Any full signed export URL, whatever its query string.
 *
 * The whole URL goes, host included: the replacement is a fixed token that
 * cannot itself match this pattern, so scrubbing twice gives the same result.
 */
const EXPORT_URL_PATTERN = /https?:\/\/export\.admitad\.com\/[^\s"'<>)\]]*/gi;

const REDACTED_EXPORT_URL = "<redacted-signed-feed-url>";

/** Query parameters that carry a credential or a per-publisher signature. */
const CREDENTIAL_PARAM_PATTERN =
  /([?&](?:code|user|token|signature|sign|key|api_key|secret|client_secret|access_token|refresh_token)=)[^&\s"'<>)\]]*/gi;

/**
 * Last-resort scrubber for free-form text such as an upstream error message.
 *
 * Error strings are not rebuildable from an allowlist, and a throw from the
 * HTTP client can echo the request URL. This removes the signed export host
 * entirely and blanks the credential-bearing query parameters in anything that
 * remains, so a message like
 *   "GET .../export_adv_products/?user=PID1&code=abc&feed_id=9 failed (403)"
 * becomes
 *   "GET <redacted-signed-feed-url> failed (403)".
 */
export function scrubFeedCredentials(text: string): string {
  if (!text) return text;
  return text
    .replace(EXPORT_URL_PATTERN, REDACTED_EXPORT_URL)
    .replace(CREDENTIAL_PARAM_PATTERN, "$1<redacted>");
}