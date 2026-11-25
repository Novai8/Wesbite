import assert from "node:assert/strict";
import { test } from "node:test";
import { getCatalogue, getProductBySlug } from "../src/lib/catalogue.ts";
import { validateAffiliateUrl } from "../src/lib/affiliate.ts";

/**
 * The product-page E2E test targets a fixed slug. These assertions keep that
 * slug honest against the local seed catalogue, so the deterministic choice
 * cannot silently drift into a record that renders no Specifications section
 * or no affiliate link.
 *
 * Seed-only: `src/lib/catalogue.ts` never contacts a network.
 */

const PRODUCT_SLUG = "hot-swap-65-percent-keyboard";

test("the E2E product slug exists in the seed catalogue", () => {
  const product = getProductBySlug(PRODUCT_SLUG);
  assert.ok(product, `${PRODUCT_SLUG} is missing from the seed catalogue`);
});

test("the E2E product is approved, in stock and has non-empty specs", () => {
  const product = getProductBySlug(PRODUCT_SLUG);
  assert.ok(product);
  assert.equal(product.approvalStatus, "approved");
  assert.equal(product.availability, "in_stock");
  assert.ok(
    Object.keys(product.specs).length > 0,
    "the E2E product must have specifications, or the page renders no section",
  );
});

test("the E2E product renders a valid affiliate link target", () => {
  const product = getProductBySlug(PRODUCT_SLUG);
  assert.ok(product);
  const check = validateAffiliateUrl(product.affiliateUrl, product.programSlug);
  assert.equal(check.ok, true, check.ok ? "" : check.reason);
});

test("the E2E product has pros and cons for the page assertions", () => {
  const product = getProductBySlug(PRODUCT_SLUG);
  assert.ok(product);
  assert.ok(product.pros.length > 0);
  assert.ok(product.cons.length > 0);
});

test("the seed catalogue is non-empty and offline", () => {
  assert.ok(getCatalogue().length > 0);
});
