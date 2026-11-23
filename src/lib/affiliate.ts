import { getPrograms } from "@/lib/catalogue";
import { getSupabaseConfig, insertRows, SUPABASE_TABLES } from "@/lib/supabase-rest";
import type { AffiliateProgram, Product } from "@/lib/types";

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

export type UrlCheck = { ok: true } | { ok: false; reason: string };

/**
 * Provider tracking hosts, per programme slug.
 *
 * These are hosts a *network* serves tracked links from. They are deliberately
 * separate from `destinationDomain`, which is the merchant the shopper lands
 * on. A host may appear here only when the network actually issues links on
 * it — `rzekl.com` was observed from the live Admitad `/deeplink/` response for
 * AliExpress WW (advertiser 6115).
 *
 * A host in this list is still not sufficient on its own: `rzekl.com` serves
 * many advertisers, so a stored link is additionally required to have come
 * from an authenticated Admitad API response (see `validateGeneratedDeeplink`).
 */
const PROVIDER_TRACKING_DOMAINS: Record<string, string[]> = {
  admitad: ["ad.admitad.com", "rzekl.com"],
};

/** True when `host` is exactly `domain` or a subdomain of it. */
function hostMatches(host: string, domain: string): boolean {
  const clean = domain.toLowerCase().trim().replace(/^\./, "");
  if (!clean) return false;
  const h = host.toLowerCase();
  return h === clean || h.endsWith(`.${clean}`);
}

function parseHttpsUrl(raw: string): URL | null {
  try {
    const url = new URL(raw);
    return ALLOWED_PROTOCOLS.has(url.protocol) ? url : null;
  } catch {
    return null;
  }
}

/** Every tracking host a programme's generated links may use. */
export function trackingDomainsFor(program: AffiliateProgram): string[] {
  const configured = program.trackingDomains ?? [];
  const known = PROVIDER_TRACKING_DOMAINS[program.slug] ?? [];
  const merged = [...configured, ...known].map((d) => d.toLowerCase());
  // Falling back to the merchant domain keeps programmes whose network issues
  // links on its own domain (AliExpress Portals: s.click.aliexpress.com).
  return merged.length > 0
    ? [...new Set(merged)]
    : [program.destinationDomain.toLowerCase()];
}

/**
 * Validates a stored **tracking** URL — the link `/api/go` redirects to.
 *
 * This is the open-redirect guard: the destination is never taken from the
 * request, only from a catalogue row, and the row's URL must sit on one of the
 * programme's provider tracking hosts over HTTPS.
 */
export function validateAffiliateUrl(raw: string, productProgram: string): UrlCheck {
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
  const host = url.hostname.toLowerCase();
  const allowed = trackingDomainsFor(program);
  // Exact host or a true subdomain. A bare `endsWith` would accept look-alikes
  // such as "evil-ad.admitad.com" or "ad.admitad.com.evil.example".
  if (!allowed.some((domain) => hostMatches(host, domain))) {
    return {
      ok: false,
      reason: `Affiliate URL host ${url.hostname} is outside the programme's tracking domains (${allowed.join(", ")})`,
    };
  }
  return { ok: true };
}

/**
 * Validates an **original merchant destination** — the product page a tracked
 * link ultimately points at.
 *
 * The allowlist comes from the advertiser itself (Admitad returns
 * `allowed_deeplink_domains` on the ad-space programme view), never from feed
 * data. A provider tracking host is not a merchant destination, so
 * `rzekl.com` is rejected here even though it is accepted as a tracking host.
 */
export function validateMerchantDestination(raw: string, allowedDomains: string[]): UrlCheck {
  const url = parseHttpsUrl(raw);
  if (!url) {
    return { ok: false, reason: "Destination must be an absolute HTTPS URL" };
  }
  if (url.username || url.password) {
    return { ok: false, reason: "Destination must not embed credentials" };
  }
  if (allowedDomains.length === 0) {
    return { ok: false, reason: "Advertiser supplied no allowed destination domains" };
  }
  const host = url.hostname.toLowerCase();
  if (!allowedDomains.some((domain) => hostMatches(host, domain))) {
    return {
      ok: false,
      reason: `Destination host ${url.hostname} is not one of the advertiser's allowed domains (${allowedDomains.join(", ")})`,
    };
  }
  return { ok: true };
}

/**
 * True when `raw` sits on one of the programme's provider tracking hosts.
 * Used to recognise a provider URL without trusting it as a destination.
 */
export function isProviderTrackingHost(raw: string, productProgram: string): boolean {
  const program = getPrograms().find((p) => p.slug === productProgram);
  if (!program) return false;
  const url = parseHttpsUrl(raw);
  if (!url) return false;
  const host = url.hostname.toLowerCase();
  return trackingDomainsFor(program).some((domain) => hostMatches(host, domain));
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
  console.info("[affiliate-click]", JSON.stringify(event));

  // Persist when configured. A logging failure must never block the redirect,
  // so errors are swallowed after being reported.
  if (!getSupabaseConfig()) return;
  try {
    await insertRows(
      SUPABASE_TABLES.clicks,
      [
        {
          product_id: product.id,
          program_slug: product.programSlug,
          merchant: product.merchant,
          campaign: campaign ?? null,
          ts: event.ts,
        },
      ],
      getSupabaseConfig() as NonNullable<ReturnType<typeof getSupabaseConfig>>,
    );
  } catch (err) {
    console.error(
      `[affiliate-click] failed to persist click: ${err instanceof Error ? err.message : String(err)}`,
    );
  }
}

export function outboundPath(product: Pick<Product, "id">, campaign?: string): string {
  const params = new URLSearchParams({ id: product.id });
  if (campaign) params.set("src", campaign);
  return `/api/go?${params.toString()}`;
}
