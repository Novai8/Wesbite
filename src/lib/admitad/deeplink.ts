/**
 * Deeplink generation and link validation.
 *
 * Deeplinks:  GET /deeplink/{w_id}/advcampaign/{c_id}/?ulp=<url>&subid=…
 *   - `ulp` is required, max 200 chars, repeatable.
 *   - response is `[{ link, is_affiliate_product }]`.
 *
 * Validation: GET /validate_links/?link=<url>
 *   - 200 only means *the request was understood*. The body's message decides
 *     whether the link is actually payable. We surface that verbatim.
 */

import { getAdmitadConfig } from "./config";
import { admitadRequest } from "./client";
import { validateAffiliateUrl } from "@/lib/affiliate";
import type { AdmitadDeeplinkResult } from "./types";

export class AdmitadDeeplinkError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AdmitadDeeplinkError";
  }
}

export interface DeeplinkOptions {
  ulp: string;
  subid?: string;
  subid1?: string;
  subid2?: string;
  subid3?: string;
  subid4?: string;
}

const ULP_MAX = 200;
const SUBID_MAX = 50;
const SUBID4_MAX = 120;

function clamp(value: string, max: number): string {
  return value.length <= max ? value : value.slice(0, max);
}

/**
 * Generate a tracked link for one destination URL.
 * Throws rather than returning the original URL — an untracked URL must never
 * be presented as an affiliate link.
 */
export async function generateDeeplink(
  campaignId: number | string,
  options: DeeplinkOptions,
): Promise<AdmitadDeeplinkResult> {
  const config = getAdmitadConfig();
  if (!config.websiteId) {
    throw new AdmitadDeeplinkError("ADMITAD_WEBSITE_ID is required to generate deeplinks.");
  }

  const ulp = options.ulp?.trim();
  if (!ulp) throw new AdmitadDeeplinkError("A destination URL (ulp) is required.");
  if (ulp.length > ULP_MAX) {
    throw new AdmitadDeeplinkError(`Destination URL exceeds the ${ULP_MAX}-character limit.`);
  }

  const query: Record<string, string | undefined> = {
    ulp,
    subid: options.subid && clamp(options.subid, SUBID_MAX),
    subid1: options.subid1 && clamp(options.subid1, SUBID_MAX),
    subid2: options.subid2 && clamp(options.subid2, SUBID_MAX),
    subid3: options.subid3 && clamp(options.subid3, SUBID_MAX),
    subid4: options.subid4 && clamp(options.subid4, SUBID4_MAX),
  };

  const data = await admitadRequest<AdmitadDeeplinkResult[]>(
    `/deeplink/${encodeURIComponent(config.websiteId)}/advcampaign/${encodeURIComponent(String(campaignId))}/`,
    { query },
  );

  const first = Array.isArray(data) ? data[0] : undefined;
  if (!first?.link) {
    throw new AdmitadDeeplinkError(
      "Admitad returned no deeplink. Confirm the programme is connected, allows deeplinks, and that the URL is on an allowed domain.",
    );
  }
  return first;
}

export interface LinkValidationResult {
  ok: boolean;
  message: string;
  raw?: unknown;
}

/**
 * Validate that a URL will be paid on. Admitad answers 200 with a message;
 * only "Link successfully tested." (case-insensitive) counts as usable.
 */
export async function validateDeeplink(link: string): Promise<LinkValidationResult> {
  let url: URL;
  try {
    url = new URL(link);
  } catch {
    return { ok: false, message: "Not a valid absolute URL." };
  }
  if (url.protocol !== "https:") {
    return { ok: false, message: "Admitad only pays HTTPS destinations." };
  }

  try {
    const data = await admitadRequest<{ message?: string; error_description?: string }>(
      "/validate_links/",
      { query: { link } },
    );
    const message = String(data?.message ?? data?.error_description ?? "").trim();
    if (!message) return { ok: false, message: "Admitad returned no validation message.", raw: data };
    return { ok: /success/i.test(message), message, raw: data };
  } catch (err) {
    return {
      ok: false,
      message: err instanceof Error ? err.message : "Link validation failed.",
    };
  }
}

export interface GeneratedLinkCheck {
  ok: boolean;
  /** Which guard rejected the link, when it did. */
  stage?: "host" | "validate_links";
  reason: string;
}

/**
 * Full acceptance test for a link that came back from `/deeplink/`.
 *
 * A generated link is accepted only when BOTH hold:
 *  1. its host is one of the programme's provider tracking hosts (this is what
 *     keeps a hijacked or off-network response out of the catalogue), and
 *  2. Admitad's own `/validate_links/` confirms it will be paid.
 *
 * Callers must pass the raw API response here — never a URL a user supplied.
 * The host check alone is insufficient: `rzekl.com` is shared by many
 * advertisers, so "on rzekl.com" does not mean "on this programme".
 */
export async function validateGeneratedDeeplink(
  response: AdmitadDeeplinkResult | null | undefined,
  programmeSlug = "admitad",
  options: { skipNetworkValidation?: boolean } = {},
): Promise<GeneratedLinkCheck> {
  if (!response?.link) {
    return { ok: false, stage: "host", reason: "Admitad returned no deeplink." };
  }

  const hostCheck = validateAffiliateUrl(response.link, programmeSlug);
  if (!hostCheck.ok) {
    return { ok: false, stage: "host", reason: hostCheck.reason };
  }

  if (options.skipNetworkValidation) {
    return { ok: true, reason: "Tracking host accepted; network validation skipped by caller." };
  }

  const validation = await validateDeeplink(response.link);
  if (!validation.ok) {
    return {
      ok: false,
      stage: "validate_links",
      reason: `Admitad did not confirm the link will be paid: ${validation.message}`,
    };
  }

  return { ok: true, reason: validation.message };
}
