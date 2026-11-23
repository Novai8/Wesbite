import { ISO_4217_CODES, normaliseCurrencyCode } from "@/lib/currency";

/**
 * Currencies offered in the UI picker. This is a *display* subset, not the set
 * of codes the parser accepts: an imported AED/PKR/JPY product is valid even
 * though it is not in this list.
 */
export const CURRENCIES = ["USD", "EUR", "GBP"] as const;
export type CurrencyCode = (typeof CURRENCIES)[number];

/** Every ISO 4217 code the catalogue accepts (wide `string`, not a union). */
export const SUPPORTED_CURRENCIES: readonly string[] = ISO_4217_CODES;

const MAX_GOAL = 500;
const MAX_PROBLEM = 800;
const MAX_COUNTRY = 60;
const MAX_PREFERENCES = 8;

export interface ParsedShoppingInput {
  goal: string;
  problem?: string;
  budget?: number;
  /** Any ISO 4217 code; unknown codes are rejected rather than coerced to USD. */
  currency: string;
  country?: string;
  preferences: string[];
}

export function parseShoppingInput(body: unknown): { ok: true; value: ParsedShoppingInput } | { ok: false; error: string } {
  if (typeof body !== "object" || body === null) {
    return { ok: false, error: "Request body must be a JSON object." };
  }
  const raw = body as Record<string, unknown>;

  const goal = typeof raw.goal === "string" ? raw.goal.trim() : "";
  if (goal.length < 5) {
    return { ok: false, error: "Describe what you're looking for in at least a few words." };
  }
  if (goal.length > MAX_GOAL) {
    return { ok: false, error: `Keep the goal under ${MAX_GOAL} characters.` };
  }

  let problem: string | undefined;
  if (raw.problem != null) {
    if (typeof raw.problem !== "string") return { ok: false, error: "Problem must be text." };
    problem = raw.problem.trim().slice(0, MAX_PROBLEM) || undefined;
  }

  let budget: number | undefined;
  if (raw.budget != null && raw.budget !== "") {
    const n = Number(raw.budget);
    if (!Number.isFinite(n) || n < 0 || n > 100_000) {
      return { ok: false, error: "Budget must be a number between 0 and 100000." };
    }
    budget = n > 0 ? n : undefined;
  }

  // Absent means "not specified" and defaults to USD. A supplied value must be
  // a real ISO code: silently replacing AED with USD would misstate a price.
  let currency = "USD";
  if (raw.currency != null && raw.currency !== "") {
    const normalised = normaliseCurrencyCode(raw.currency);
    if (!normalised) {
      return { ok: false, error: "Currency must be a valid ISO 4217 code (e.g. USD, EUR, AED, PKR, JPY)." };
    }
    currency = normalised;
  }

  let country: string | undefined;
  if (typeof raw.country === "string" && raw.country.trim()) {
    country = raw.country.trim().slice(0, MAX_COUNTRY);
  }

  const preferences = Array.isArray(raw.preferences)
    ? raw.preferences
        .filter((p): p is string => typeof p === "string")
        .map((p) => p.trim().slice(0, 80))
        .filter(Boolean)
        .slice(0, MAX_PREFERENCES)
    : [];

  return { ok: true, value: { goal, problem, budget, currency, country, preferences } };
}

/* ------------------------------------------------------------------------- *
 * 3D model generation enqueue input
 * ------------------------------------------------------------------------- */

/** Upper bound for a product photo we will download and hash. */
export const MAX_IMAGE_BYTES = 12 * 1024 * 1024;

const MAX_IMAGE_URL = 2048;

/**
 * Canonical hyphenated UUID, the only form Postgres accepts for a `uuid`
 * column without coercion. Catalogue seed ids (`p-monitor-arm-gas`, ...) are
 * text, not UUIDs, and must be rejected before they reach the foreign key.
 */
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isUuid(value: unknown): value is string {
  return typeof value === "string" && UUID_PATTERN.test(value);
}

export interface ParsedEnqueueInput {
  productId: string;
  imageUrl: string;
}

export function parseEnqueueRequest(
  body: unknown,
): { ok: true; value: ParsedEnqueueInput } | { ok: false; error: string } {
  if (typeof body !== "object" || body === null) {
    return { ok: false, error: "Request body must be a JSON object." };
  }
  const raw = body as Record<string, unknown>;

  const productId = typeof raw.productId === "string" ? raw.productId.trim() : "";
  if (!productId) {
    return { ok: false, error: "productId is required." };
  }
  if (!isUuid(productId)) {
    return {
      ok: false,
      error:
        'productId must be a UUID. Catalogue slugs such as "p-monitor-arm-gas" are not product ids.',
    };
  }

  const imageUrlRaw = typeof raw.imageUrl === "string" ? raw.imageUrl.trim() : "";
  if (!imageUrlRaw || imageUrlRaw.length > MAX_IMAGE_URL) {
    return { ok: false, error: "A valid imageUrl is required." };
  }

  let parsed: URL;
  try {
    parsed = new URL(imageUrlRaw);
  } catch {
    return { ok: false, error: "imageUrl must be an absolute URL." };
  }
  if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
    return { ok: false, error: "imageUrl must use http or https." };
  }

  return { ok: true, value: { productId, imageUrl: parsed.toString() } };
}
