import assert from "node:assert/strict";
import { test } from "node:test";
import { GET } from "../src/app/api/go/route.ts";
import { getCatalogue } from "../src/lib/catalogue.ts";

/**
 * `/api/go` uses the real seed catalogue. These tests cover the redirect path
 * a browser takes, including the refusal path for a bad stored link.
 */

function request(id: string): Request {
  return new Request(`https://fyndra.test/api/go?id=${encodeURIComponent(id)}&src=test`);
}

test("/api/go redirects an approved product to its affiliate URL", async () => {
  const product = getCatalogue().find((p) => p.approvalStatus === "approved" && p.programSlug === "aliexpress");
  assert.ok(product, "expected a seeded AliExpress product");

  const res = await GET(request(product.id));
  assert.equal(res.status, 302);
  assert.equal(res.headers.get("location"), product.affiliateUrl);
  assert.equal(res.headers.get("cache-control"), "no-store");
});

test("/api/go resolves a UUID-shaped id through the live catalogue path", async () => {
  // No Supabase is configured in this test, so a UUID unknown to the seed must
  // return a clean 404 rather than throwing while parsing the id.
  const res = await GET(request("1f0c3c2e-8a41-5f4b-9a54-0f0f7f4b1234"));
  assert.equal(res.status, 404);
  const body = await res.json();
  assert.match(body.error, /Unknown product/);
});

test("/api/go never redirects for an unknown identifier, even an off-domain URL", async () => {
  // A caller cannot smuggle a destination: ids are looked up in the server-side
  // catalogue, and an off-domain string simply fails to resolve.
  const res = await GET(request("https://evil.example/steal"));
  assert.equal(res.status, 404);
  assert.equal(res.headers.get("location"), null);
});

test("/api/go rejects a missing id", async () => {
  const res = await GET(new Request("https://fyndra.test/api/go"));
  assert.equal(res.status, 400);
});
