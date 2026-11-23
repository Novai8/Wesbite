import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { afterEach, test } from "node:test";
import { getCatalogueSnapshot, getLiveProductBySlug } from "@/lib/catalogue-server";

/**
 * Product-page resolution after the cross-branch merge.
 *
 * Fyndra's page used to resolve slugs from seed data only, so an imported
 * Supabase product 404'd. These tests pin the merged behaviour: one catalogue
 * source, with and without a generated 3D model, degrading to seed when
 * Supabase is unavailable.
 */

const REAL_ENV = { ...process.env };
const realFetch = globalThis.fetch;

afterEach(() => {
  process.env = { ...REAL_ENV };
  globalThis.fetch = realFetch;
});

function withSupabase() {
  process.env.SUPABASE_URL = "https://example.supabase.co";
  process.env.SUPABASE_SERVICE_ROLE_KEY = "test-service-role-key";
}

/** One approved catalogue row as the public view returns it. */
function viewRow(overrides: Record<string, unknown> = {}) {
  return {
    id: "9f1d2c3e-4f5a-4b6c-9d7e-8f90a1b2c3d4",
    slug: "imported-monitor-arm",
    title: "Imported Monitor Arm",
    description: "A clamp-on gas spring arm.",
    category_slug: "desk-setup",
    image_urls: ["https://cdn.example.com/arm.jpg"],
    merchant: "AliExpress WW",
    program_slug: "admitad",
    affiliate_url: "https://ad.admitad.com/g/xyz/",
    source_url: "https://www.aliexpress.com/item/100.html",
    price: 24.5,
    currency: "PKR",
    specs: {},
    pros: [],
    cons: [],
    availability: "in_stock",
    region: ["PK"],
    keywords: [],
    use_cases: [],
    budget_tier: "budget",
    approval_status: "approved",
    data_source: "api",
    source: "admitad",
    last_synced_at: "2026-11-20T10:00:00.000Z",
    created_at: "2026-11-20T10:00:00.000Z",
    updated_at: "2026-11-20T10:00:00.000Z",
    ai_quality_flags: [],
    model_status: null,
    model_url: null,
    model_format: null,
    model_type: null,
    model_provider: null,
    model_generated_at: null,
    ...overrides,
  };
}

/** Serve the catalogue view; any other request is a bug in the query. */
function stubCatalogue(rows: Record<string, unknown>[]) {
  const calls: string[] = [];
  globalThis.fetch = (async (input: RequestInfo | URL) => {
    const url = String(
      typeof input === "string" ? input : input instanceof URL ? input.href : input.url,
    );
    calls.push(url);
    if (url.includes("/rest/v1/catalogue_products")) return Response.json(rows);
    throw new Error(`unexpected request: ${url}`);
  }) as typeof fetch;
  return calls;
}

test("without Supabase the catalogue is seed-only and still resolves", async () => {
  delete process.env.SUPABASE_URL;
  delete process.env.SUPABASE_SERVICE_ROLE_KEY;

  const snapshot = await getCatalogueSnapshot();
  assert.equal(snapshot.source, "seed");
  assert.equal(snapshot.importedCount, 0);
  assert.ok(snapshot.products.length > 0, "seed catalogue should not be empty");

  const found = await getLiveProductBySlug(snapshot.products[0].slug);
  assert.ok(found, "a seed product must resolve by slug");
});

test("an imported product resolves by slug through the public view", async () => {
  withSupabase();
  const calls = stubCatalogue([viewRow()]);

  const snapshot = await getCatalogueSnapshot();
  assert.equal(snapshot.source, "seed+supabase");
  assert.equal(snapshot.importedCount, 1);

  const product = snapshot.products.find((p) => p.slug === "imported-monitor-arm");
  assert.ok(product, "the imported product must be in the catalogue");
  assert.equal(product.currency, "PKR");
  assert.equal(product.modelStatus, undefined, "a product without a model has no 3D state");

  assert.ok(
    calls.every((url) => url.includes("catalogue_products")),
    "catalogue reads must go through the public view, never the base table",
  );
});

test("a completed GLB reaches the product record", async () => {
  withSupabase();
  stubCatalogue([
    viewRow({
      model_status: "completed",
      model_format: "glb",
      model_type: "single_image_generative",
      model_provider: "huggingface:stabilityai/stable-fast-3d",
      model_url: "https://example.supabase.co/storage/v1/object/public/product-models/x/y.glb",
    }),
  ]);

  const product = await getLiveProductBySlug("imported-monitor-arm");
  assert.equal(product?.modelStatus, "completed");
  assert.equal(product?.modelFormat, "glb");
  assert.match(String(product?.modelUrl), /\.glb$/);
});

test("a Supabase outage degrades to the seed catalogue instead of failing", async () => {
  withSupabase();
  globalThis.fetch = (async () => {
    throw new Error("network down");
  }) as typeof fetch;

  const snapshot = await getCatalogueSnapshot();
  assert.equal(snapshot.source, "seed");
  assert.ok(snapshot.warning, "the degradation must be reported, not hidden");
  assert.ok(snapshot.products.length > 0);
});

test("the product page composes the live catalogue with model state", () => {
  const page = readFileSync("src/app/products/[slug]/page.tsx", "utf8");
  assert.match(page, /getCatalogueSnapshot\(\)/, "the page must read the live catalogue");
  assert.match(page, /withModelState\(/, "the page must merge 3D model state");
  assert.match(page, /Product3dStage/, "a completed model must render the 3D stage");
  assert.match(page, /modelStatus === "completed"/, "the stage is gated on completion");
  assert.match(page, /<Image/, "the original product image is the fallback");
});
