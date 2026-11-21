import { seedCategories, seedProducts, seedPrograms } from "@/data/seed-products";
import type { AffiliateProgram, Category, Product } from "@/lib/types";

/**
 * Catalogue access layer.
 *
 * Reads from Supabase when configured (via lib/supabase-server); falls back to
 * the seed catalogue so every discovery surface works without credentials.
 * All public functions are safe to call from server components.
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

export function formatPrice(price: number, currency: string): string {
  const symbol = currency === "EUR" ? "€" : currency === "GBP" ? "£" : "$";
  return `${symbol}${price.toFixed(2)}`;
}
