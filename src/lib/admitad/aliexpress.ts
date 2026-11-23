/**
 * AliExpress canonical product URLs.
 *
 * AliExpress WW feed rows carry a `url` column, but for this advertiser it is a
 * 485–486 character tracking URL on `rzekl.com` — far past Admitad's
 * 200-character `ulp` limit, and not a payable destination on its own
 * (`/validate_links/` reports "nonaffiliate" for it).
 *
 * The feed's `id` column is the AliExpress product id, so a canonical product
 * URL can be built deterministically:
 *
 *     https://www.aliexpress.com/item/{external_product_id}.html
 *
 * That URL is short, validates, and produces a working tracked link. The
 * original feed URL is still preserved separately as provenance.
 *
 * This module does not relax the `ulp` limit. It only gives callers a URL that
 * genuinely fits inside it.
 */

/** AliExpress item ids are numeric and bounded in practice (4–20 digits). */
const ITEM_ID = /^\d{4,20}$/;

export const ALIEXPRESS_ITEM_ORIGIN = "https://www.aliexpress.com";

/** True when `id` is a plausible AliExpress item id and nothing else. */
export function isAliExpressProductId(id: string | number | null | undefined): boolean {
  if (id === null || id === undefined) return false;
  const value = String(id).trim();
  return ITEM_ID.test(value);
}

/**
 * Canonical AliExpress product URL, or `null` when the id is not usable.
 *
 * Returning `null` rather than a guessed URL is deliberate: a product that
 * cannot be addressed canonically must fail loudly, not silently import with a
 * broken destination.
 */
export function canonicalAliExpressProductUrl(
  externalProductId: string | number | null | undefined,
): string | null {
  if (!isAliExpressProductId(externalProductId)) return null;
  return `${ALIEXPRESS_ITEM_ORIGIN}/item/${String(externalProductId).trim()}.html`;
}

/**
 * Product id recovered from a canonical AliExpress item URL, when present.
 * Used to cross-check that a rebuilt URL still addresses the same product.
 */
export function aliExpressProductIdFromUrl(raw: string | null | undefined): string | null {
  if (!raw) return null;
  try {
    const url = new URL(raw);
    if (url.protocol !== "https:") return null;
    const host = url.hostname.toLowerCase();
    if (host !== "aliexpress.com" && !host.endsWith(".aliexpress.com")) return null;
    const match = url.pathname.match(/^\/item\/(\d{4,20})\.html$/);
    return match ? match[1] : null;
  } catch {
    return null;
  }
}
