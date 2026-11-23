import assert from "node:assert/strict";
import { test } from "node:test";
import {
  ALIEXPRESS_ITEM_ORIGIN,
  aliExpressProductIdFromUrl,
  canonicalAliExpressProductUrl,
  isAliExpressProductId,
} from "../src/lib/admitad/aliexpress.ts";
import { resolveDestination } from "../src/lib/admitad/products.ts";

/**
 * AliExpress WW feed URLs are 485–486 character provider tracking links, well
 * past Admitad's 200-character `ulp` limit. The verified workaround is a
 * canonical product URL built from the feed's product id.
 *
 * These tests pin the construction and, importantly, that it is *strict*:
 * a bad id must not produce a guessed URL.
 */

const LONG_FEED_URL =
  "https://rzekl.com/g/1e8d114494c05aeface116525dc3e8/?ulp=" +
  "https%3A%2F%2Fs.click.aliexpress.com%2Fdeep_link.htm%3Faff_short_key%3D" +
  "1e8d114494c05aeface%26aff_platform%3Ddefault%26ascene%3D3%26item_id%3D1005012486166415";

test("canonical AliExpress product URL is built from the product id", () => {
  assert.equal(
    canonicalAliExpressProductUrl("1005012486166415"),
    "https://www.aliexpress.com/item/1005012486166415.html",
  );
  assert.equal(ALIEXPRESS_ITEM_ORIGIN, "https://www.aliexpress.com");
});

test("product ids are accepted only in their numeric form", () => {
  for (const id of ["1005012486166415", "4001313151561", 1005006358417196]) {
    assert.equal(isAliExpressProductId(String(id)), true, `${id} must be accepted`);
  }
  for (const id of [
    "",
    "   ",
    "123", // too short
    "12a45",
    "10050 12486",
    "-1005012486166415",
    "1005012486166415/../evil",
    "1005012486166415?x=1",
    "javascript:alert(1)",
    null,
    undefined,
  ]) {
    assert.equal(isAliExpressProductId(id as string), false, `${String(id)} must be rejected`);
    assert.equal(canonicalAliExpressProductUrl(id as string), null, `${String(id)} must not produce a URL`);
  }
});

test("a long tracking URL is replaced by the canonical product page", () => {
  assert.ok(LONG_FEED_URL.length > 200, "fixture must exceed the ulp limit");
  const resolved = resolveDestination({
    external_product_id: "1005012486166415",
    product_url: LONG_FEED_URL,
  });
  assert.equal(resolved.rebuiltFromId, true);
  assert.equal(resolved.url, "https://www.aliexpress.com/item/1005012486166415.html");
  assert.equal(resolved.error, undefined);
});

test("a provider tracking URL is never used as a destination, even when short", () => {
  const resolved = resolveDestination({
    external_product_id: "1005012486166415",
    product_url: "https://rzekl.com/g/abc/",
  });
  assert.equal(resolved.rebuiltFromId, true);
  assert.equal(resolved.url, "https://www.aliexpress.com/item/1005012486166415.html");
});

test("a short ordinary feed URL is tracked as supplied", () => {
  const resolved = resolveDestination({
    external_product_id: "1005012486166415",
    product_url: "https://www.aliexpress.com/item/1005012486166415.html",
  });
  assert.equal(resolved.rebuiltFromId, false);
  assert.equal(resolved.url, "https://www.aliexpress.com/item/1005012486166415.html");
});

test("when neither a usable URL nor a valid id exists the row fails explicitly", () => {
  const resolved = resolveDestination({
    external_product_id: "not-an-id",
    product_url: LONG_FEED_URL,
  });
  assert.equal(resolved.url, "");
  assert.match(resolved.error ?? "", /no usable tracked destination/);
  assert.match(resolved.error ?? "", /not a valid AliExpress id/);
});

test("the ulp limit is unchanged at 200 characters", async () => {
  // Guards against 'fixing' the long-URL problem by widening the API limit.
  const { readFileSync } = await import("node:fs");
  const source = readFileSync("src/lib/admitad/deeplink.ts", "utf8");
  assert.match(source, /const ULP_MAX = 200;/);
});

test("a canonical URL round-trips back to its product id", () => {
  const url = canonicalAliExpressProductUrl("1005012486166415");
  assert.ok(url);
  assert.equal(aliExpressProductIdFromUrl(url), "1005012486166415");
  assert.equal(aliExpressProductIdFromUrl("https://evil.example/item/1005012486166415.html"), null);
  assert.equal(aliExpressProductIdFromUrl("http://www.aliexpress.com/item/1005012486166415.html"), null);
});
