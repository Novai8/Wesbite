/**
 * Product-feed permission.
 *
 * Admitad returns feed URLs to a connected publisher whether or not the
 * advertiser has granted permission to *import* products. AliExpress WW
 * currently reports `show_products_links: false` while still returning
 * `products_csv_link` / `products_xml_link` and a ten-entry `feeds_info` that
 * answer HTTP 200.
 *
 * Technical accessibility is not permission. The URLs are signed for the
 * publisher, so they will serve a file; using them would be taking data the
 * programme has not enabled in moderation. The importer therefore fails
 * closed, but reports *why* honestly instead of flattening every refusal into
 * one message:
 *
 *   allowed    advertiser explicitly enabled product links
 *   ambiguous  the flag says no, yet a feed entry exists for this programme
 *   denied     no active connection, no feed entry, or unusable flag data
 *
 * `ambiguous` is still blocked. It exists so the contradiction is visible and
 * auditable rather than silently treated as either permission or absence.
 * There is deliberately no override: written confirmation from Admitad or the
 * AliExpress programme manager is required before that can exist.
 *
 * Nothing here consults HTTP status, `has_tool=products`, or the mere
 * existence of a download link as evidence of permission.
 */

import type { AdmitadCampaignForWebsite, AdmitadFeedInfo } from "./types";

export type FeedPermissionState = "allowed" | "ambiguous" | "denied";

/** A feed entry as the permission check sees it: identity only, never the URL. */
export interface FeedEntry {
  /** `feed_id` from the signed link, when the link is parseable. */
  feedId: string | null;
  name?: string;
  /** Which link the entry came from. */
  format: "csv" | "xml" | "unknown";
  /** Timestamp Admitad last refreshed the file, when supplied. */
  lastUpdate?: string;
}

/**
 * The subset of the ad-space programme record this module reads.
 * Kept structural so tests can pass plain objects.
 */
export type PermissionProgramme = Pick<
  AdmitadCampaignForWebsite,
  "id" | "name" | "connection_status" | "show_products_links"
> &
  Partial<
    Pick<
      AdmitadCampaignForWebsite,
      "products_csv_link" | "products_xml_link" | "feeds_info" | "allow_deeplink"
    >
  >;

export interface FeedPermissionEvidence {
  connectionStatus: string | null;
  /** `true` / `false` when a real boolean was supplied; otherwise null. */
  showProductsLinks: boolean | null;
  /** True when the API returned a value that is neither boolean nor absent. */
  malformedFlag: boolean;
  feedEntryCount: number;
  matchingFeedIds: string[];
  /** Set when the caller asked about one specific feed. */
  requestedFeedId?: string;
  /** Programme allows deeplinks. Informational; never affects feed import. */
  allowDeeplink: boolean | null;
}

export interface FeedPermission {
  state: FeedPermissionState;
  /**
   * Convenience boolean for existing callers. True only for `allowed`.
   * `ambiguous` is intentionally NOT importable.
   */
  allowed: boolean;
  reason: string;
  /** Machine-readable detail for the status endpoint and import reports. */
  evidence: FeedPermissionEvidence;
}

const FEED_ID_PARAMS = ["feed_id", "feedid", "id"];

/** Extracts `feed_id` from a signed export link without retaining the link. */
export function feedIdFromLink(link: string | null | undefined): string | null {
  if (!link) return null;
  try {
    const url = new URL(link);
    for (const key of FEED_ID_PARAMS) {
      const value = url.searchParams.get(key);
      if (value && /^\d+$/.test(value)) return value;
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Every feed entry the programme advertises, identified by feed id.
 * Top-level `products_*_link` fields count too: some programmes publish only
 * those and leave `feeds_info` empty.
 */
export function describeFeedEntries(programme: PermissionProgramme | null | undefined): FeedEntry[] {
  if (!programme) return [];
  const entries: FeedEntry[] = [];
  const seen = new Set<string>();

  const push = (entry: FeedEntry) => {
    // Identity is the feed id when known. The same id legitimately appears both
    // as a top-level `products_*_link` and as a named `feeds_info` entry; it is
    // one feed, and the named entry (pushed first) carries more context.
    const key = entry.feedId ? `id:${entry.feedId}` : `name:${entry.name ?? ""}`;
    if (seen.has(key)) return;
    seen.add(key);
    entries.push(entry);
  };

  const info = Array.isArray(programme.feeds_info) ? programme.feeds_info : [];
  for (const feed of info) {
    if (!feed || typeof feed !== "object") continue;
    const typed = feed as AdmitadFeedInfo;
    const csv = typeof typed.csv_link === "string" ? typed.csv_link : undefined;
    const xml = typeof typed.xml_link === "string" ? typed.xml_link : undefined;
    const feedId = feedIdFromLink(xml) ?? feedIdFromLink(csv);
    const format: FeedEntry["format"] = xml ? "xml" : csv ? "csv" : "unknown";
    if (!feedId && !typed.name) continue;
    push({
      feedId,
      name: typeof typed.name === "string" ? typed.name : undefined,
      format,
      lastUpdate:
        typeof typed.admitad_last_update === "string" ? typed.admitad_last_update : undefined,
    });
  }

  // Top-level links are a fallback for programmes that publish no `feeds_info`.
  if (programme.products_xml_link) {
    push({ feedId: feedIdFromLink(programme.products_xml_link), format: "xml", name: "programme feed" });
  }
  if (programme.products_csv_link) {
    push({ feedId: feedIdFromLink(programme.products_csv_link), format: "csv", name: "programme feed" });
  }

  return entries;
}

export interface CheckFeedPermissionOptions {
  /**
   * Ask about one specific feed id. When supplied, `ambiguous` requires that
   * exact feed to exist; a different feed on the same programme does not count.
   */
  feedId?: string;
}

function denied(reason: string, evidence: FeedPermissionEvidence): FeedPermission {
  return { state: "denied", allowed: false, reason, evidence };
}

/**
 * Decides whether a programme's product feed may be imported.
 *
 * The ad-space programme record is the only source consulted. Missing data is
 * never treated as consent.
 */
export function checkFeedPermission(
  programme: PermissionProgramme | null | undefined,
  options: CheckFeedPermissionOptions = {},
): FeedPermission {
  const requestedFeedId = options.feedId?.trim() || undefined;
  const entries = describeFeedEntries(programme);
  const matching = requestedFeedId
    ? entries.filter((entry) => entry.feedId === requestedFeedId)
    : entries;

  const rawFlag = programme?.show_products_links as unknown;
  const malformedFlag = rawFlag !== undefined && rawFlag !== null && typeof rawFlag !== "boolean";
  const flag: boolean | null = typeof rawFlag === "boolean" ? rawFlag : null;

  const evidence: FeedPermissionEvidence = {
    connectionStatus:
      typeof programme?.connection_status === "string" ? programme.connection_status : null,
    showProductsLinks: flag,
    malformedFlag,
    feedEntryCount: matching.length,
    matchingFeedIds: matching
      .map((entry) => entry.feedId)
      .filter((id): id is string => Boolean(id))
      .sort(),
    requestedFeedId,
    allowDeeplink: typeof programme?.allow_deeplink === "boolean" ? programme.allow_deeplink : null,
  };

  if (!programme) {
    return denied(
      "Programme is not connected to this ad space, so product-feed permission cannot be confirmed. Nothing was imported.",
      evidence,
    );
  }

  const status = evidence.connectionStatus ?? "unknown";
  if (status !== "active") {
    return denied(
      `Programme ${programme.id} cooperation status is "${status}". Feed import requires an active connection; the advertiser's product-feed permission cannot be relied on without it. Nothing was imported.`,
      evidence,
    );
  }

  if (malformedFlag) {
    return denied(
      `Programme ${programme.id} returned show_products_links as ${JSON.stringify(rawFlag)}, which is not a boolean. Permission data is malformed, so the importer fails closed. Nothing was imported.`,
      evidence,
    );
  }

  if (flag === true) {
    return {
      state: "allowed",
      allowed: true,
      reason: "Advertiser has enabled product links for this programme.",
      evidence,
    };
  }

  if (flag === false) {
    if (matching.length > 0) {
      const ids = evidence.matchingFeedIds;
      const which = requestedFeedId
        ? `feed ${requestedFeedId} exists`
        : `${matching.length} feed entr${matching.length === 1 ? "y exists" : "ies exist"}${
            ids.length ? ` (${ids.slice(0, 6).join(", ")}${ids.length > 6 ? ", ..." : ""})` : ""
          }`;
      return {
        state: "ambiguous",
        allowed: false,
        reason:
          `Programme ${programme.id} reports show_products_links = false, but ${which} for this ad space. ` +
          "The signed export may download, yet advertiser moderation does not indicate permission to import. " +
          "This is an ambiguous, unverified permission state and the importer stays blocked. " +
          "Obtain written confirmation from Admitad or the AliExpress programme manager, then have the advertiser enable the product tool. Nothing was imported.",
        evidence,
      };
    }

    return denied(
      requestedFeedId
        ? `Programme ${programme.id} reports show_products_links = false and feed ${requestedFeedId} is not present in its feed list. Product import is not permitted. Nothing was imported.`
        : `Programme ${programme.id} reports show_products_links = false and exposes no product-feed entry. Product import is not permitted. Nothing was imported.`,
      evidence,
    );
  }

  // Absent flag: unknown is not consent.
  return denied(
    `Programme ${programme.id} did not return show_products_links (absent), so product-feed permission is unknown. ` +
      "Absence is not consent; the importer fails closed. Re-check the ad-space programme endpoint. Nothing was imported.",
    evidence,
  );
}

/** Short, log-safe description of a permission outcome. */
export function summariseFeedPermission(permission: FeedPermission): string {
  return `${permission.state} (${permission.evidence.connectionStatus ?? "unknown"} connection, show_products_links=${String(
    permission.evidence.showProductsLinks,
  )}, feeds=${permission.evidence.feedEntryCount})`;
}
