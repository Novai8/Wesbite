import { seedCategories, seedProducts, seedPrograms } from "@/data/seed-products";
import type { AffiliateProgram, Category, Product } from "@/lib/types";

/**
 * Synchronous, seed-backed catalogue helpers.
 *
 * Everything here reads `src/data/seed-products.ts` only, so it is safe in the
 * client bundle and during a credential-free build. Live catalogue reads (seed
 * rows merged with approved Supabase rows) live in `lib/catalogue-server.ts`;
 * callers that need imported products use `getCatalogueSnapshot()` there.
 */

export function getCatalogue(): Product[] {
  return seedProducts.filter((p) => p.approvalStatus === "approved");
}

export function getAllProductsForAdmin(): Product[] {
  return seedProducts;
}

export function getCategories(): Category[] {
  return seedCategories;
}

export function getPrograms(): AffiliateProgram[] {
  return seedPrograms;
}

export function getProductBySlug(slug: string): Product | undefined {
  return getCatalogue().find((p) => p.slug === slug);
}

export function getRelatedProducts(product: Product, limit = 3): Product[] {
  return getCatalogue()
    .filter((p) => p.id !== product.id)
    .map((p) => {
      let rel = 0;
      if (p.categorySlug === product.categorySlug) rel += 2;
      if (p.subcategory === product.subcategory) rel += 1;
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

export function getNewestProducts(limit = 4): Product[] {
  return [...getCatalogue()]
    .sort((a, b) => (a.updatedAt < b.updatedAt ? 1 : -1))
    .slice(0, limit);
}

const POPULARITY_HINTS = [
  "p-monitor-arm-gas",
  "p-wireless-mouse-light",
  "p-underbed-bags",
  "p-laptop-stand",
  "p-mech-keyboard-65",
  "p-packing-cubes",
];

export function getPopularProducts(limit = 4): Product[] {
  const catalogue = getCatalogue();
  const picks = POPULARITY_HINTS.map((id) => catalogue.find((p) => p.id === id)).filter(
    (p): p is Product => Boolean(p),
  );
  return picks.slice(0, limit);
}

/**
 * Formats a source price using the *actual* currency code.
 *
 * `Intl.NumberFormat` picks the right symbol and grouping for every ISO code
 * (`$1,234.00`, `€1,234.00`, `AED 1,234.00`, `PKR 1,234`, `¥1,234`). A code the
 * runtime does not recognise is rendered as an explicit code suffix —
 * `1,234.00 ZZZ` — never as dollars, so a currency is never silently
 * misrepresented.
 *
 * `currencyDisplay: "symbol"` is deliberate. The narrower "Rs" for PKR is also
 * India's symbol, so an ambiguous glyph would be worse than showing the code.
 */
export function formatPrice(price: number, currency: string): string {
  const amount = Number.isFinite(price) ? price : 0;
  const code = typeof currency === "string" ? currency.trim().toUpperCase() : "";

  if (code) {
    try {
      return new Intl.NumberFormat("en-US", {
        style: "currency",
        currency: code,
        currencyDisplay: "symbol",
      }).format(amount);
    } catch {
      // RangeError: the runtime has no data for this code. Fall through to the
      // honest "amount CODE" form instead of guessing a symbol.
    }
  }

  const fallbackCode = code || "USD";
  return `${amount.toFixed(2)} ${fallbackCode}`;
}
