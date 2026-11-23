/**
 * Product-feed permission.
 *
 * Admitad returns feed URLs to a connected publisher whether or not the
 * advertiser has granted permission to *import* products. AliExpress WW
 * currently reports `show_products_links: false` while still returning
 * `products_csv_link` / `products_xml_link` that answer HTTP 200.
 *
 * Technical accessibility is not permission. The URLs are signed and will serve
 * a file; using them would be taking data the programme has not enabled. The
 * importer therefore fails closed on this flag and says why.
 */

import type { AdmitadCampaignForWebsite } from "./types";

export interface FeedPermission {
  /** True only when the advertiser flag explicitly allows product links. */
  allowed: boolean;
  reason: string;
}

/**
 * Reads the programme's product-feed permission from the ad-space view.
 *
 * `show_products_links` is the advertiser-controlled switch. A feed URL's
 * presence is NOT evidence of permission, so it is deliberately not consulted.
 */
export function checkFeedPermission(
  programme: Pick<AdmitadCampaignForWebsite, "show_products_links" | "connection_status" | "name" | "id"> | null | undefined,
): FeedPermission {
  if (!programme) {
    return {
      allowed: false,
      reason: "Programme is not connected to this ad space, so product-feed permission cannot be confirmed.",
    };
  }

  const status = programme.connection_status ?? "unknown";
  if (status !== "active") {
    return {
      allowed: false,
      reason: `Programme ${programme.id} cooperation status is "${status}". Feed import requires an active connection.`,
    };
  }

  if (programme.show_products_links !== true) {
    return {
      allowed: false,
      reason:
        `Programme ${programme.id} reports show_products_links = ${String(programme.show_products_links ?? "absent")}. ` +
        "The advertiser has not enabled product links, so importing is not permitted even if a feed file downloads. " +
        "Ask the advertiser to enable the product tool, then re-check. Nothing was imported.",
    };
  }

  return { allowed: true, reason: "Advertiser has enabled product links for this programme." };
}
