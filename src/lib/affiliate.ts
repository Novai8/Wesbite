import { getPrograms } from "@/lib/catalogue";
import type { Product } from "@/lib/types";

/**
 * Affiliate link management.
 *
 * Every outbound click goes through /api/go/[id]:
 *   1. Validate the product exists, is approved, and its destination is
 *      well-formed and belongs to a known affiliate programme domain.
 *   2. Record a non-identifying click event (product id, programme, timestamp).
 *   3. Redirect (302) to the approved destination, preserving the URL exactly
 *      as approved — no parameter injection, no user-controlled URLs.
 */

const ALLOWED_PROTOCOLS = new Set(["https:"]);

export function validateAffiliateUrl(raw: string, productProgram: string): { ok: true } | { ok: false; reason: string } {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return { ok: false, reason: "Affiliate URL is not a valid URL" };
  }
  if (!ALLOWED_PROTOCOLS.has(url.protocol)) {
    return { ok: false, reason: "Affiliate URL must use HTTPS" };
  }
  const program = getPrograms().find((p) => p.slug === productProgram && p.active);
  if (!program) {
    return { ok: false, reason: `Unknown or inactive affiliate programme: ${productProgram}` };
  }
  if (!url.hostname.endsWith(program.destinationDomain)) {
    return { ok: false, reason: `Affiliate URL host ${url.hostname} is outside approved programme domain ${program.destinationDomain}` };
  }
  return { ok: true };
}

/**
 * Outbound click recording. Console-log fallback when Supabase is not
 * configured; swaps to the affiliate_clicks table when it is.
 */
export async function recordClick(product: Product, campaign?: string): Promise<void> {
  const event = {
    productId: product.id,
    programSlug: product.programSlug,
    merchant: product.merchant,
    campaign: campaign ?? null,
    ts: new Date().toISOString(),
    // Deliberately non-identifying: no IP, no user agent, no session id.
  };
  // TODO(supabase): insert into affiliate_clicks when SUPABASE_URL is configured.
  console.info("[affiliate-click]", JSON.stringify(event));
}

export function outboundPath(product: Pick<Product, "id">, campaign?: string): string {
  const params = new URLSearchParams({ id: product.id });
  if (campaign) params.set("src", campaign);
  return `/api/go?${params.toString()}`;
}
