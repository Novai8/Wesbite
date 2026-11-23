/**
 * Maps Admitad data onto Fyndra's `Product` shape.
 *
 * Rules enforced here, because this is the only place source data becomes a
 * catalogue record:
 *  - Nothing is invented. Missing price / image / description stays missing,
 *    which the UI already handles honestly.
 *  - The destination URL is always the *source* product URL; the tracked
 *    affiliate URL is generated separately and validated before it is stored.
 *  - Category and budget tier are derived by documented, inspectable rules from
 *    the feed's own text and price — never guessed by a model.
 */

import { createHash } from "node:crypto";
import type { Product } from "@/lib/types";
import type { AdmitadCampaignForWebsite, FeedRow } from "./types";

export const ADMITAD_PROGRAM_SLUG = "admitad";
export const ADMITAD_PROGRAM_NAME = "Admitad";
/** The only host we will let Admitad tracking links point at. */
export const ADMITAD_DEEPLINK_DOMAIN = "ad.admitad.com";

/**
 * Fyndra's fixed shelves. Feed categories are matched to these by keyword;
 * when nothing matches we fall back to a "catch-all" shelf rather than
 * fabricating a category that the UI does not have.
 */
const CATEGORY_RULES: { slug: string; patterns: RegExp[] }[] = [
  {
    slug: "desk-setup",
    patterns: [/monitor/i, /keyboard/i, /mouse/i, /desk/i, /laptop/i, /stand/i, /usb\s*hub/i, /docking/i, /webcam/i, /office/i, /computer/i, /pc\b/i, /tablet/i, /printer/i],
  },
  {
    slug: "gaming",
    patterns: [/gaming/i, /gamepad/i, /controller/i, /console/i, /playstation/i, /xbox/i, /nintendo/i, /\bgame\b/i],
  },
  {
    slug: "storage-organisation",
    patterns: [/storage/i, /organis/i, /organiz/i, /shelf/i, /shelves/i, /drawer/i, /box/i, /basket/i, /rack/i, /hanger/i, /home\s*(?:&|and)?\s*decor/i],
  },
  {
    slug: "study-stationery",
    patterns: [/stationery/i, /notebook/i, /pens?\b/i, /pencils?\b/i, /school/i, /study/i, /books?\b/i, /education/i],
  },
  {
    slug: "travel-accessories",
    patterns: [/travel/i, /luggage/i, /suitcase/i, /backpack/i, /packing/i, /bag\b/i, /bags\b/i, /wallet/i, /passport/i, /tourist/i],
  },
  {
    slug: "kitchen-utility",
    patterns: [/kitchen/i, /cook/i, /utensil/i, /pot\b/i, /pan\b/i, /cup\b/i, /mug\b/i, /bottle/i, /home\s*appliance/i, /coffee/i, /tea\b/i],
  },
];

export const FALLBACK_CATEGORY = "desk-setup";

/**
 * Shelf for products whose source category could not be resolved.
 *
 * A row with a category *id* the feed's dictionary does not contain must not be
 * pushed onto an unrelated shelf (that silently invents an association the
 * source never made). Such rows land here instead, and the importer reports how
 * many did. The slug is not in the seed catalogue, so the UI renders it as
 * "uncategorised" rather than claiming a shelf.
 */
export const UNCATEGORISED_SLUG = "uncategorised";

/**
 * Category chosen from the feed's own category path / product type text.
 *
 * Highest-confidence match wins, not first match. Source paths are often broad
 * ("Office & School Supplies / Pens"), so a shelf that matches on several
 * specific words must beat one that matches a single generic word
 * ("office"). Ties fall back to catalogue order.
 */
export function inferCategory(...hints: (string | undefined)[]): string {
  const haystack = hints.filter(Boolean).join(" ");
  if (!haystack) return FALLBACK_CATEGORY;

  let best: { slug: string; score: number } | null = null;
  for (const rule of CATEGORY_RULES) {
    const score = rule.patterns.reduce((total, pattern) => total + (pattern.test(haystack) ? 1 : 0), 0);
    if (score > 0 && (!best || score > best.score)) {
      best = { slug: rule.slug, score };
    }
  }
  return best?.slug ?? FALLBACK_CATEGORY;
}

export type CategoryBasis = "source-category" | "title" | "unresolved-id" | "none";

/**
 * Category for a feed row, honouring the feed's own category dictionary.
 *
 * Precedence, in order of evidence strength:
 *  1. the row's category text resolved against Fyndra's shelves;
 *  2. the title, when the source category text matched nothing;
 *  3. `uncategorised`, when an id was present but could not be resolved;
 *  4. the catch-all shelf only when the source supplied no category signal.
 *
 * The distinction between 3 and 4 matters: an unresolved id means "we were told
 * a category and could not read it", which must not be dressed up as a shelf.
 */
export function resolveProductCategory(row: {
  category?: string;
  categoryId?: string;
  title?: string;
}): { slug: string; basis: CategoryBasis } {
  const rulesMatch = (text: string | undefined) =>
    text?.trim()
      ? CATEGORY_RULES.some((rule) => rule.patterns.some((pattern) => pattern.test(text)))
      : false;

  if (row.category?.trim()) {
    const slug = inferCategory(row.category);
    if (rulesMatch(row.category)) return { slug, basis: "source-category" };
    // The source category is real but outside our shelves: try the title
    // before giving up, since feeds often use generic top-level categories.
    if (rulesMatch(row.title)) return { slug: inferCategory(row.title), basis: "title" };
    return { slug: UNCATEGORISED_SLUG, basis: "unresolved-id" };
  }
  if (rulesMatch(row.title)) return { slug: inferCategory(row.title), basis: "title" };
  if (row.categoryId?.trim()) return { slug: UNCATEGORISED_SLUG, basis: "unresolved-id" };
  return { slug: FALLBACK_CATEGORY, basis: "none" };
}

/** Budget tier from the source price. Thresholds match the seed catalogue. */
export function inferBudgetTier(price: number | undefined): Product["budgetTier"] {
  if (price == null || !Number.isFinite(price)) return "budget";
  if (price <= 30) return "budget";
  if (price <= 150) return "mid";
  return "premium";
}

const MAX_SLUG = 60;

export function slugify(input: string): string {
  return input
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, MAX_SLUG)
    .replace(/-+$/g, "");
}

/** Short, stable, non-cryptographic hash — keeps slugs unique and readable. */
export function shortHash(input: string): string {
  let hash = 0x811c9dc5;
  for (let i = 0; i < input.length; i += 1) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash.toString(36).slice(0, 6);
}

export function buildProductSlug(title: string, externalId: string, advertiserId?: string): string {
  const base = slugify(title) || "admitad-product";
  const hashInput = advertiserId ? `${advertiserId}:${externalId}` : externalId;
  return `${base}-${shortHash(hashInput)}`;
}

/**
 * Dedupe key. Stable across syncs and independent of slug/title edits.
 *
 * Advertiser ids are included when available: feed product ids are only
 * guaranteed unique inside one advertiser's feed, so two programmes can
 * legitimately publish the same external id.
 */
export function productSourceKey(
  source: string,
  externalProductId: string,
  advertiserId?: string,
): string {
  return advertiserId
    ? `${source}:${advertiserId}:${externalProductId}`
    : `${source}:${externalProductId}`;
}

/**
 * Deterministic, UUID-shaped id for an imported record.
 *
 * The database contract exists in two forms in the wild: the original schema
 * documentation used `id uuid`, while earlier migrations created `id text`.
 * A name-based UUID inserts cleanly into either column type without an
 * `ALTER TABLE`, and stays stable across re-syncs so an upsert updates the
 * existing identity instead of creating a new one.
 */
export function stableProductId(
  source: string,
  advertiserId: string,
  externalProductId: string,
): string {
  const digest = createHash("sha1")
    .update(`fyndra:${source}:${advertiserId}:${externalProductId}`, "utf8")
    .digest();
  const bytes = Buffer.from(digest.subarray(0, 16));
  // RFC 4122 version 5 (name-based) and variant bits.
  bytes[6] = (bytes[6] & 0x0f) | 0x50;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = bytes.toString("hex");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

/**
 * Columns PostgREST names in `on_conflict`. Must match the non-partial unique
 * index created by `0001_admitad_integration.sql` exactly, or every upsert is
 * rejected by PostgreSQL.
 */
export const PRODUCT_SOURCE_UNIQUE_COLUMNS = "source,advertiser_id,external_product_id";

const MAX_KEYWORDS = 10;

/** Keywords taken only from the words the source itself supplied. */
export function deriveKeywords(row: FeedRow): string[] {
  const words = `${row.title} ${row.category ?? ""} ${row.brand ?? ""}`
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, " ")
    .split(/\s+/)
    .filter((word) => word.length > 2)
    .filter((word) => !STOP_WORDS.has(word));

  return [...new Set(words)].slice(0, MAX_KEYWORDS);
}

const STOP_WORDS = new Set([
  "the", "and", "for", "with", "from", "your", "you", "our", "this", "that",
  "new", "hot", "sale", "free", "shipping", "pcs", "set", "pack", "high",
  "quality", "best", "good", "item", "items", "product", "products",
]);

/** Short factual description built from source fields only. */
export function buildDescription(row: FeedRow): string {
  const provided = row.description?.replace(/\s+/g, " ").trim();
  if (provided && provided.length >= 40) return provided.slice(0, 600);

  const parts: string[] = [];
  if (row.title) parts.push(row.title.trim());
  if (row.brand) parts.push(`Brand: ${row.brand}.`);
  if (row.category) parts.push(`Category: ${row.category}.`);
  parts.push("Imported from the Admitad product feed. Check the merchant page for full details and the live price.");
  return parts.join(" ").slice(0, 600);
}

const ISO_CURRENCIES = new Set([
  "USD", "EUR", "GBP", "AED", "AUD", "BRL", "CAD", "CHF", "CNY", "CZK", "DKK",
  "EGP", "HKD", "HUF", "IDR", "ILS", "INR", "JPY", "KRW", "KZT", "MXN", "MYR",
  "NGN", "NOK", "NZD", "PHP", "PKR", "PLN", "RON", "RUB", "SAR", "SEK", "SGD",
  "THB", "TRY", "TWD", "UAH", "VND", "ZAR",
]);

/** Coerces feed currency to a 3-letter ISO code, or undefined if unusable. */
export function normaliseCurrency(value: string | undefined, fallback = "USD"): string | undefined {
  const code = value?.trim().toUpperCase();
  if (code && ISO_CURRENCIES.has(code)) return code;
  const fallbackCode = fallback.trim().toUpperCase();
  return ISO_CURRENCIES.has(fallbackCode) ? fallbackCode : "USD";
}

export interface MapFeedRowInput {
  row: FeedRow;
  programme: Pick<AdmitadCampaignForWebsite, "id" | "name" | "currency">;
  /** Validated tracked URL. When absent, the product is not publishable. */
  affiliateUrl: string;
  /**
   * The merchant destination actually tracked. Defaults to the feed row's URL.
   * AliExpress WW passes a canonical product URL here because its feed URL is a
   * long provider tracking link.
   */
  destinationUrl?: string;
  /** Merchant display name. Defaults to the programme name. */
  merchant?: string;
  region?: string[];
  now?: Date;
}

/**
 * Builds a catalogue record from one feed row.
 * `affiliateUrl` must already be a validated Admitad deeplink — callers
 * generate and validate it first.
 */
export function mapFeedRowToProduct(input: MapFeedRowInput): Product {
  const { row, programme, affiliateUrl } = input;
  const now = input.now ?? new Date();
  const timestamp = now.toISOString();
  const category = resolveProductCategory(row);
  const tracker = row.brand?.trim() || input.merchant || programme.name;
  const advertiserId = String(programme.id);
  const destination = input.destinationUrl?.trim() || row.product_url;

  return {
    id: stableProductId(ADMITAD_PROGRAM_SLUG, advertiserId, row.external_product_id),
    slug: buildProductSlug(row.title, row.external_product_id, advertiserId),
    title: row.title.trim().slice(0, 240),
    description: buildDescription(row),
    categorySlug: category.slug,
    subcategory: row.category?.slice(0, 80),
    imageUrls: row.image_url ? [row.image_url] : [],
    merchant: tracker,
    programSlug: ADMITAD_PROGRAM_SLUG,
    affiliateUrl,
    // Provenance: the merchant product page the tracked link resolves to. The
    // feed's own URL is only used when it *is* that page.
    sourceUrl: destination,
    // Provenance: the URL exactly as the feed supplied it, when it was not the
    // destination (AliExpress WW's 485-character tracking link).
    feedProductUrl: row.product_url !== destination ? row.product_url : undefined,
    price: row.price ?? 0,
    currency: normaliseCurrency(row.currency, programme.currency ?? "USD") ?? "USD",
    previousPrice: row.original_price && row.price && row.original_price > row.price ? row.original_price : undefined,
    originalPrice: row.original_price,
    specs: {},
    pros: [],
    cons: [],
    availability:
      row.availability === "in_stock"
        ? "in_stock"
        : row.availability === "out_of_stock"
          ? "out_of_stock"
          : "unknown",
    region: input.region ?? ["worldwide"],
    keywords: deriveKeywords(row),
    useCases: [],
    budgetTier: inferBudgetTier(row.price),
    priceVerifiedAt: timestamp.slice(0, 10),
    approvalStatus: "approved",
    dataSource: "api",
    source: "admitad",
    externalProductId: row.external_product_id,
    advertiserId,
    sourceCategoryId: row.categoryId,
    sourceCategory: row.category,
    categoryBasis: category.basis,
    lastSyncedAt: timestamp,
    createdAt: timestamp,
    updatedAt: timestamp,
  };
}

/** Reasons a record is not publishable, so imports fail loudly instead of quietly. */
export function productPublishBlockers(product: Product): string[] {
  const blockers: string[] = [];
  if (!product.affiliateUrl) blockers.push("missing affiliate URL");
  if (!product.sourceUrl) blockers.push("missing source URL");
  if (!product.price || product.price <= 0) blockers.push("missing price");
  if (product.imageUrls.length === 0) blockers.push("missing image");
  if (product.approvalStatus !== "approved") blockers.push("not approved");
  return blockers;
}
