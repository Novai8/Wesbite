import assert from "node:assert/strict";
import { test } from "node:test";
import {
  ADMITAD_PROGRAM_SLUG,
  PRODUCT_SOURCE_UNIQUE_COLUMNS,
  buildProductSlug,
  inferBudgetTier,
  inferCategory,
  mapFeedRowToProduct,
  normaliseCurrency,
  productPublishBlockers,
  productSourceKey,
  shortHash,
  slugify,
  stableProductId,
} from "../src/lib/admitad/mapper.ts";
import type { FeedRow } from "../src/lib/admitad/types.ts";

const baseRow: FeedRow = {
  external_product_id: "AE-12345",
  title: "Gas Spring Monitor Arm 13-32 inch",
  description: "A clamp-on monitor arm with gas spring adjustment for 13-32 inch screens.",
  image_url: "https://cdn.example.com/arm.jpg",
  product_url: "https://www.aliexpress.com/item/1005001.html",
  price: 24.5,
  original_price: 29.99,
  currency: "USD",
  category: "Computer & Office / Monitor Accessories",
  availability: "in_stock",
};

const programme = { id: 20523, name: "AliExpress WW", currency: "USD" };
const tracked = "https://ad.admitad.com/g/abc123/?ulp=https%3A%2F%2Fwww.aliexpress.com%2Fitem%2F1005001.html";

test("inferCategory maps source categories onto Fyndra's fixed shelves", () => {
  assert.equal(inferCategory("Computer & Office / Monitor Accessories"), "desk-setup");
  assert.equal(inferCategory("Consumer Electronics / Game Controllers"), "gaming");
  assert.equal(inferCategory("Home & Garden / Storage & Organisation"), "storage-organisation");
  assert.equal(inferCategory("Office & School Supplies / Pens"), "study-stationery");
  assert.equal(inferCategory("Luggage & Travel Bags"), "travel-accessories");
  assert.equal(inferCategory("Home Appliances / Kitchen"), "kitchen-utility");
});

test("inferCategory falls back to a real shelf rather than inventing one", () => {
  assert.equal(inferCategory(undefined, undefined), "desk-setup");
  assert.equal(inferCategory("Something entirely unmapped"), "desk-setup");
});

test("inferBudgetTier uses explicit price thresholds", () => {
  assert.equal(inferBudgetTier(5), "budget");
  assert.equal(inferBudgetTier(30), "budget");
  assert.equal(inferBudgetTier(30.01), "mid");
  assert.equal(inferBudgetTier(150), "mid");
  assert.equal(inferBudgetTier(150.01), "premium");
  assert.equal(inferBudgetTier(undefined), "budget");
});

test("slugify and buildProductSlug produce stable, URL-safe identifiers", () => {
  assert.equal(slugify("Gas Spring Monitor Arm (13–32\")"), "gas-spring-monitor-arm-13-32");
  const a = buildProductSlug("Gas Spring Monitor Arm", "AE-12345");
  const b = buildProductSlug("Gas Spring Monitor Arm", "AE-12345");
  assert.equal(a, b, "same input must produce the same slug across syncs");
  assert.match(a, /^gas-spring-monitor-arm-[a-z0-9]{1,6}$/);
  assert.notEqual(buildProductSlug("Gas Spring Monitor Arm", "AE-99999"), a);
  assert.equal(shortHash("AE-12345").length > 0, true);
});

test("dedupe key is stable and network-scoped", () => {
  assert.equal(productSourceKey("admitad", "AE-12345"), "admitad:AE-12345");
  assert.notEqual(productSourceKey("admitad", "X"), productSourceKey("aliexpress", "X"));
});

test("dedupe key is advertiser-scoped when an advertiser id is known", () => {
  assert.equal(productSourceKey("admitad", "AE-1", "20523"), "admitad:20523:AE-1");
  assert.notEqual(
    productSourceKey("admitad", "AE-1", "20523"),
    productSourceKey("admitad", "AE-1", "31415"),
    "two advertisers may publish the same external product id",
  );
});

test("stable product ids are UUID-shaped, deterministic and advertiser-scoped", () => {
  const UUID_V5 = /^[0-9a-f]{8}-[0-9a-f]{4}-5[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
  const id = stableProductId("admitad", "20523", "AE-1");

  assert.match(id, UUID_V5, "a uuid column must accept the id without a cast");
  assert.equal(id, stableProductId("admitad", "20523", "AE-1"), "re-syncs must keep the same id");
  assert.notEqual(id, stableProductId("admitad", "31415", "AE-1"));
  assert.notEqual(id, stableProductId("aliexpress", "20523", "AE-1"));
});

test("slug hashing includes the advertiser so identical ids cannot collide", () => {
  const a = buildProductSlug("Desk Lamp", "AE-1", "20523");
  const b = buildProductSlug("Desk Lamp", "AE-1", "31415");
  assert.notEqual(a, b);
  assert.equal(buildProductSlug("Desk Lamp", "AE-1", "20523"), a);
});

test("the upsert conflict target matches the migration's unique index", () => {
  assert.equal(PRODUCT_SOURCE_UNIQUE_COLUMNS, "source,advertiser_id,external_product_id");
});

test("normaliseCurrency accepts ISO codes and rejects junk", () => {
  assert.equal(normaliseCurrency("usd"), "USD");
  assert.equal(normaliseCurrency("RUB"), "RUB");
  assert.equal(normaliseCurrency("", "GBP"), "GBP");
  assert.equal(normaliseCurrency("dollars", "EUR"), "EUR");
});

test("mapFeedRowToProduct maps source data without inventing anything", () => {
  const product = mapFeedRowToProduct({
    row: baseRow,
    programme,
    affiliateUrl: tracked,
    now: new Date("2026-11-22T10:00:00.000Z"),
  });

  assert.equal(product.programSlug, ADMITAD_PROGRAM_SLUG);
  assert.equal(product.source, "admitad");
  assert.equal(product.externalProductId, "AE-12345");
  assert.equal(product.advertiserId, "20523");
  assert.match(
    product.id,
    /^[0-9a-f]{8}-[0-9a-f]{4}-5[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
    "imported ids must fit both uuid and text primary keys",
  );
  assert.equal(product.price, 24.5);
  assert.equal(product.previousPrice, 29.99);
  assert.equal(product.currency, "USD");
  assert.equal(product.affiliateUrl, tracked);
  assert.equal(product.sourceUrl, "https://www.aliexpress.com/item/1005001.html");
  assert.equal(product.budgetTier, "budget");
  assert.equal(product.categorySlug, "desk-setup");
  assert.equal(product.availability, "in_stock");
  assert.equal(product.dataSource, "api");
  assert.equal(product.priceVerifiedAt, "2026-11-22");

  // Never fabricated:
  assert.deepEqual(product.pros, []);
  assert.deepEqual(product.cons, []);
  assert.deepEqual(product.specs, {});
  assert.equal(product.aiHeadline, undefined);
});

test("mapFeedRowToProduct does not invent a previous price when none is cheaper", () => {
  const product = mapFeedRowToProduct({
    row: { ...baseRow, price: 40, original_price: 30 },
    programme,
    affiliateUrl: tracked,
  });
  assert.equal(product.previousPrice, undefined);
});

test("mapFeedRowToProduct keeps an unknown availability as unknown", () => {
  const product = mapFeedRowToProduct({
    row: { ...baseRow, availability: undefined },
    programme,
    affiliateUrl: tracked,
  });
  assert.equal(product.availability, "unknown");
});

test("mapFeedRowToProduct yields an empty image list rather than a fake image", () => {
  const product = mapFeedRowToProduct({
    row: { ...baseRow, image_url: undefined },
    programme,
    affiliateUrl: tracked,
  });
  assert.deepEqual(product.imageUrls, []);
});

test("productPublishBlockers explains why a record cannot go live", () => {
  const product = mapFeedRowToProduct({ row: baseRow, programme, affiliateUrl: tracked });
  assert.deepEqual(productPublishBlockers(product), []);

  const broken = mapFeedRowToProduct({
    row: { ...baseRow, image_url: undefined, price: 0 },
    programme,
    affiliateUrl: "",
  });
  const blockers = productPublishBlockers(broken);
  assert.equal(blockers.includes("missing affiliate URL"), true);
  assert.equal(blockers.includes("missing price"), true);
  assert.equal(blockers.includes("missing image"), true);
});

test("keywords are derived only from words the source supplied", () => {
  const product = mapFeedRowToProduct({ row: baseRow, programme, affiliateUrl: tracked });
  assert.equal(product.keywords.includes("monitor"), true);
  assert.equal(product.keywords.includes("arm"), true);
  assert.equal(product.keywords.length <= 10, true);
});
