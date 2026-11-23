/**
 * Live catalogue reads (server only).
 *
 * The site is static-first: `lib/catalogue.ts` stays synchronous and seed-backed
 * so client components and the build never need credentials or a network call.
 * This module adds the *server* view: seed records plus anything imported into
 * Supabase, merged and de-duplicated.
 *
 * Reads go through `catalogue_products`, the public view that omits research
 * columns and `model_error`. Using the view (rather than the base table) means
 * the same query works for the service role *and* is the only shape public
 * roles are granted access to.
 *
 * Failure policy: a Supabase outage or a missing key returns the seed catalogue
 * and reports `degraded` in `CatalogueSnapshot`. It never throws into a page
 * render and never pretends imported data exists.
 */

import { seedCategories, seedProducts, seedPrograms } from "@/data/seed-products";
import { fromPublicProductRow } from "@/lib/admitad/supabase-store";
import { getSupabaseConfig, selectRows, SUPABASE_TABLES } from "@/lib/supabase-rest";
import type { Category, Product } from "@/lib/types";

const PRODUCT_COLUMNS = [
  "id", "slug", "title", "description", "category_slug", "subcategory",
  "image_urls", "merchant", "program_slug", "affiliate_url", "source_url",
  "price", "currency", "previous_price", "original_price", "specs", "pros",
  "cons", "availability", "region", "keywords", "use_cases", "budget_tier",
  "price_verified_at", "approval_status", "data_source", "source",
  "external_product_id", "advertiser_id", "last_synced_at", "created_at",
  "updated_at", "ai_headline", "ai_description", "ai_quality_flags",
  // 3D model state, so the product page can render a GLB without a second
  // catalogue read. These are display-only fields, never ranking inputs.
  "model_status", "model_url", "model_format", "model_type", "model_provider",
  "model_generated_at",
].join(",");

/**
 * How long a page may reuse a catalogue read before it is rebuilt.
 * The Supabase fetch below uses the same window, so pages stay ISR-cached and
 * imports surface within five minutes without a redeploy.
 */
export const CATALOGUE_REVALIDATE_SECONDS = 300;

/**
 * Catalogue ordering.
 *
 * Deliberately NOT `updated_at`: the Admitad guard trigger stamps
 * `updated_at = now()` on every non-manual UPDATE, so a background 3D-model
 * completion would jump an old product to the top of the storefront. Ordering
 * by `last_synced_at` (when the source data last changed) keeps ranking tied
 * to catalogue freshness, and `created_at` breaks ties deterministically.
 */
const CATALOGUE_ORDER = "last_synced_at.desc.nullslast,created_at.desc";

export interface CatalogueSnapshot {
  products: Product[];
  categories: Category[];
  /** "seed" | "seed+supabase" */
  source: "seed" | "seed+supabase";
  /** Set when a Supabase read was attempted and failed. */
  warning?: string;
  importedCount: number;
}

/** Rows imported from any network, approved only. */
async function fetchImportedProducts(): Promise<{ products: Product[]; warning?: string }> {
  const config = getSupabaseConfig();
  if (!config) return { products: [] };

  try {
    const rows = await selectRows<Record<string, unknown>>(SUPABASE_TABLES.catalogueProducts, {
      select: PRODUCT_COLUMNS,
      approval_status: "eq.approved",
      data_source: "neq.manual",
      order: CATALOGUE_ORDER,
      limit: 500,
    }, undefined, { revalidate: CATALOGUE_REVALIDATE_SECONDS });
    return { products: rows.map(fromPublicProductRow) };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Supabase read failed";
    console.error(`[catalogue] Supabase read failed, falling back to seed: ${message}`);
    return { products: [], warning: message };
  }
}

function mergeById(seed: Product[], imported: Product[]): Product[] {
  const seen = new Set<string>();
  const merged: Product[] = [];

  for (const product of imported) {
    if (seen.has(product.id)) continue;
    seen.add(product.id);
    merged.push(product);
  }
  for (const product of seed) {
    if (seen.has(product.id)) continue;
    seen.add(product.id);
    merged.push(product);
  }
  return merged;
}

export async function getCatalogueSnapshot(): Promise<CatalogueSnapshot> {
  const imported = await fetchImportedProducts();
  const seedApproved = seedProducts.filter((p) => p.approvalStatus === "approved");
  const products = mergeById(seedApproved, imported.products);

  return {
    products,
    categories: seedCategories,
    source: imported.products.length > 0 ? "seed+supabase" : "seed",
    warning: imported.warning,
    importedCount: imported.products.length,
  };
}

/** Convenience wrapper used by pages that only need the list. */
export async function getLiveCatalogue(): Promise<Product[]> {
  return (await getCatalogueSnapshot()).products;
}

export async function getLiveProductBySlug(slug: string): Promise<Product | undefined> {
  const products = await getLiveCatalogue();
  return products.find((p) => p.slug === slug);
}

/**
 * Same relevance rules as `getRelatedProducts`, but against a supplied list so
 * imported products can be related to seed products and vice versa.
 */
export function relatedFrom(
  catalogue: Product[],
  product: Product,
  limit = 3,
): Product[] {
  return catalogue
    .filter((p) => p.id !== product.id)
    .map((p) => {
      let rel = 0;
      if (p.categorySlug === product.categorySlug) rel += 2;
      if (p.subcategory && p.subcategory === product.subcategory) rel += 1;
      const sharedUse = p.useCases.filter((u) => product.useCases.includes(u)).length;
      rel += sharedUse;
      const priceGap = Math.abs(p.price - product.price) / Math.max(product.price, 1);
      if (priceGap < 0.5) rel += 1;
      return { p, rel };
    })
    .filter(({ rel }) => rel >= 2)
    .sort((a, b) => b.rel - a.rel)
    .slice(0, limit)
    .map(({ p }) => p);
}

/** Programmes, including any added to the database. */
export async function getLivePrograms() {
  const config = getSupabaseConfig();
  if (!config) return seedPrograms;
  try {
    const rows = await selectRows<Record<string, unknown>>(SUPABASE_TABLES.programs, {
      select: "slug,name,network,destination_domain,active,commission_note",
      active: "eq.true",
    });
    if (rows.length === 0) return seedPrograms;
    return rows.map((row) => ({
      slug: String(row.slug),
      name: String(row.name),
      network: String(row.network),
      destinationDomain: String(row.destination_domain),
      active: Boolean(row.active),
      commissionNote: row.commission_note ? String(row.commission_note) : undefined,
    }));
  } catch {
    return seedPrograms;
  }
}
