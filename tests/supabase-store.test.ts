import assert from "node:assert/strict";
import { test } from "node:test";
import { fromProductRow, toProductRow } from "../src/lib/admitad/supabase-store.ts";
import type { Product } from "../src/lib/types.ts";

const product: Product = {
  id: "admitad-20523-AE-1",
  slug: "desk-lamp-abc123",
  title: "Desk Lamp",
  description: "A small desk lamp.",
  categorySlug: "desk-setup",
  imageUrls: ["https://cdn.example.com/lamp.jpg"],
  merchant: "AliExpress WW",
  programSlug: "admitad",
  affiliateUrl: "https://ad.admitad.com/g/xyz/",
  sourceUrl: "https://www.aliexpress.com/item/1.html",
  price: 12.5,
  currency: "USD",
  specs: {},
  pros: [],
  cons: [],
  availability: "in_stock",
  region: ["US"],
  keywords: ["lamp"],
  useCases: [],
  budgetTier: "budget",
  priceVerifiedAt: "2026-11-20",
  approvalStatus: "approved",
  dataSource: "api",
  source: "admitad",
  externalProductId: "AE-1",
  advertiserId: "20523",
  lastSyncedAt: "2026-11-20T10:00:00.000Z",
  createdAt: "2026-11-20T10:00:00.000Z",
  updatedAt: "2026-11-20T10:00:00.000Z",
};

test("round-tripping a product through the row shape preserves fields", () => {
  const row = toProductRow(product, { network: "admitad" });
  const back = fromProductRow(row as unknown as Record<string, unknown>);

  assert.equal(back.id, product.id);
  assert.equal(back.slug, product.slug);
  assert.equal(back.affiliateUrl, product.affiliateUrl);
  assert.equal(back.price, product.price);
  assert.equal(back.currency, "USD");
  assert.equal(back.source, "admitad");
  assert.equal(back.externalProductId, "AE-1");
  assert.equal(back.advertiserId, "20523");
  assert.equal(back.dataSource, "api");
  assert.equal(back.approvalStatus, "approved");
});

test("toProductRow writes snake_case columns and keeps AI fields out", () => {
  const row = toProductRow({ ...product, aiHeadline: "Nice lamp" });
  assert.equal(row.category_slug, "desk-setup");
  assert.equal(row.external_product_id, "AE-1");
  assert.equal("ai_headline" in row, false, "AI copy is written by its own PATCH, never in an import upsert");
});

test("toProductRow omits created_at so a re-sync cannot rewrite it", () => {
  const row = toProductRow(product);
  assert.equal(
    "created_at" in row,
    false,
    "an upsert that resends created_at overwrites the original creation time on every sync",
  );
  assert.equal(row.updated_at, product.updatedAt);
});

test("fromProductRow tolerates nulls and bad enum values", () => {
  const back = fromProductRow({
    id: "x",
    slug: "s",
    title: "T",
    description: "D",
    category_slug: "desk-setup",
    merchant: "M",
    program_slug: "admitad",
    affiliate_url: "https://ad.admitad.com/g/1/",
    price: "9.99",
    currency: null,
    availability: "bogus",
    budget_tier: "bogus",
    approval_status: "bogus",
    data_source: "bogus",
    image_urls: null,
    region: null,
  });
  assert.equal(back.price, 9.99);
  assert.equal(back.currency, "USD");
  assert.equal(back.availability, "unknown");
  assert.equal(back.budgetTier, "budget");
  assert.equal(back.approvalStatus, "pending");
  assert.equal(back.dataSource, "manual");
  assert.deepEqual(back.imageUrls, []);
  assert.deepEqual(back.region, []);
});

test("fromProductRow reads JSON strings returned by older PostgREST clients", () => {
  const back = fromProductRow({
    id: "x",
    slug: "s",
    title: "T",
    description: "D",
    category_slug: "desk-setup",
    merchant: "M",
    program_slug: "admitad",
    affiliate_url: "https://ad.admitad.com/g/1/",
    price: 1,
    currency: "EUR",
    image_urls: '["https://cdn.example.com/1.jpg"]',
    specs: '{"Weight":"1kg"}',
    keywords: "a,b,c",
  });
  assert.deepEqual(back.imageUrls, ["https://cdn.example.com/1.jpg"]);
  assert.deepEqual(back.specs, { Weight: "1kg" });
  assert.deepEqual(back.keywords, ["a", "b", "c"]);
});

test("fromProductRow surfaces AI fields separately from source fields", () => {
  const back = fromProductRow({
    id: "x", slug: "s", title: "Source title", description: "D",
    category_slug: "desk-setup", merchant: "M", program_slug: "admitad",
    affiliate_url: "https://ad.admitad.com/g/1/", price: 1, currency: "USD",
    ai_headline: "Punchy headline", ai_description: "Short blurb",
    ai_quality_flags: '["no_specs"]',
  });
  assert.equal(back.title, "Source title");
  assert.equal(back.aiHeadline, "Punchy headline");
  assert.equal(back.aiDescription, "Short blurb");
  assert.deepEqual(back.aiQualityFlags, ["no_specs"]);
});
