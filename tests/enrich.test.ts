import assert from "node:assert/strict";
import { test } from "node:test";
import {
  computeQualityFlags,
  looksLikeFabrication,
} from "../src/lib/admitad/enrich.ts";
import type { Product } from "../src/lib/types.ts";

const product = {
  title: "Gas Spring Monitor Arm",
  description: "A clamp-on monitor arm with gas spring adjustment for 13-32 inch screens and most VESA mounts.",
  categorySlug: "desk-setup",
  price: 24.5,
  currency: "USD",
  merchant: "AliExpress WW",
  imageUrls: ["https://cdn.example.com/a.jpg"],
  specs: { "Screen size": "13-32 inch" },
  availability: "in_stock" as const,
  sourceUrl: "https://www.aliexpress.com/item/1.html",
} satisfies Pick<Product, "title" | "description" | "categorySlug" | "price" | "currency" | "merchant" | "imageUrls" | "specs" | "availability" | "sourceUrl">;

test("a complete record produces no quality flags", () => {
  assert.deepEqual(computeQualityFlags(product), []);
});

test("quality flags name the actual missing fields", () => {
  const flags = computeQualityFlags({
    ...product,
    imageUrls: [],
    price: 0,
    description: "short",
    specs: {},
    availability: "unknown",
    sourceUrl: "",
  });
  assert.deepEqual(flags.sort(), [
    "missing_image",
    "missing_price",
    "missing_source_url",
    "no_specs",
    "thin_description",
    "unknown_availability",
  ].sort());
});

test("long titles are flagged, not silently truncated", () => {
  const flags = computeQualityFlags({ ...product, title: "x".repeat(200) });
  assert.equal(flags.includes("title_too_long"), true);
});

test("looksLikeFabrication accepts numbers that came from the source", () => {
  // 24.5 is the price, 13-32 appears in the description, USD is the currency.
  const text = "Monitor arm for 13-32 inch screens at 24.5 USD.";
  assert.equal(looksLikeFabrication(text, { product }), false);
});

test("looksLikeFabrication rejects invented ratings, counts and discounts", () => {
  assert.equal(looksLikeFabrication("Rated 4.8 out of 5 by 12,000 buyers.", { product }), true);
  assert.equal(looksLikeFabrication("Now 40% off, saving you 15.00.", { product }), true);
  assert.equal(looksLikeFabrication("Number one best seller with 99 in stock.", { product }), true);
});

test("looksLikeFabrication tolerates text with no numbers at all", () => {
  assert.equal(looksLikeFabrication("A sturdy clamp-on arm for a tidier desk.", { product }), false);
});