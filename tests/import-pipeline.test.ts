import assert from "node:assert/strict";
import { test } from "node:test";
import { importFromFeedText } from "../src/lib/admitad/products.ts";

/**
 * Integration test for the import pipeline. Admitad's deeplink endpoint is
 * mocked, so this exercises the real code path (parse -> deeplink -> map ->
 * dedupe -> validate) without credentials or network.
 */

const realFetch = globalThis.fetch;

function mockDeeplinkApi(options: {
  failFor?: string[];
  returnUntrackedFor?: string[];
} = {}) {
  const calls: string[] = [];
  globalThis.fetch = (async (input: string | URL | Request) => {
    const url = new URL(typeof input === "string" ? input : input instanceof URL ? input.href : input.url);
    if (url.pathname === "/token/") {
      return new Response(
        JSON.stringify({ access_token: "test-token", token_type: "bearer", expires_in: 3600 }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      );
    }
    if (url.pathname.startsWith("/deeplink/")) {
      const ulp = url.searchParams.get("ulp") ?? "";
      calls.push(ulp);
      if (options.failFor?.some((fragment) => ulp.includes(fragment))) {
        return new Response(
          JSON.stringify({ error_description: "Wrong link", error_code: 3 }),
          { status: 400, headers: { "Content-Type": "application/json" } },
        );
      }
      // Simulate a server returning an untracked URL for a bad row.
      if (options.returnUntrackedFor?.some((fragment) => ulp.includes(fragment))) {
        return new Response(JSON.stringify([{ link: ulp, is_affiliate_product: null }]), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      }
      const tracked = `https://ad.admitad.com/g/tracked${calls.length}/?ulp=${encodeURIComponent(ulp)}`;
      return new Response(JSON.stringify([{ link: tracked, is_affiliate_product: true }]), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }
    throw new Error(`Unexpected mocked call: ${url.pathname}`);
  }) as typeof fetch;
  return calls;
}

const FEED = [
  "offer_id,Product Name,Description,Image,URL,Price,OldPrice,Currency,Category,Availability",
  'A1,"Monitor Arm","A clamp-on gas spring arm for 13-32 inch screens with VESA mounting.","https://cdn.example.com/a.jpg","https://www.aliexpress.com/item/1.html",24.50,29.99,USD,"Computer / Monitor",in stock',
  'A2,"Gaming Controller","A wireless controller with two analogue sticks for PC and console play.","https://cdn.example.com/b.jpg","https://www.aliexpress.com/item/2.html",32.00,,USD,"Gaming",in stock',
  // Duplicate of A1 — must be counted, not imported twice.
  'A1,"Monitor Arm duplicate","A clamp-on gas spring arm for 13-32 inch screens with VESA mounting.","https://cdn.example.com/a.jpg","https://www.aliexpress.com/item/1.html",24.50,29.99,USD,"Computer / Monitor",in stock',
  // Missing image and price — must fail the publish gate.
  'A3,"No Image Thing","This listing has no image and no price supplied by the feed at all.","","https://www.aliexpress.com/item/3.html",,,USD,"Gadgets",',
  // No URL — parser skips it.
  'A4,"No URL","A record with no product URL at all in the feed row.","https://cdn.example.com/d.jpg","",10.00,,USD,"Gadgets",in stock',
].join("\n");

test("import pipeline produces a full, honest report", async () => {
  const calls = mockDeeplinkApi();
  try {
    process.env.ADMITAD_CLIENT_ID = "test-id";
    process.env.ADMITAD_CLIENT_SECRET = "test-secret";
    process.env.ADMITAD_WEBSITE_ID = "123456";

    const { report, products } = await importFromFeedText(FEED, {
      campaignId: 20523,
      programme: { id: 20523, name: "AliExpress WW", currency: "USD" },
    });

    // Parsing
    assert.equal(report.format, "csv");
    assert.equal(report.totalRows, 5);
    assert.equal(report.duplicates, 1, "the repeated offer id is deduped by source key");

    // The two good rows import; A3 fails the publish gate.
    assert.equal(report.imported, 2);
    assert.equal(products.length, 2);

    // A4 was skipped by the parser, A3 by the publisher gate, A1-dup by dedupe.
    assert.equal(report.skipped, 1);
    assert.equal(report.errors.length, 2);
    assert.ok(
      report.errors.some((e) => e.externalProductId === "A3" && e.reason.includes("missing image")),
      `expected A3 to fail on missing image, got: ${JSON.stringify(report.errors)}`,
    );

    // Every imported product carries a tracked link on the Admitad domain.
    for (const product of products) {
      assert.equal(new URL(product.affiliateUrl).hostname, "ad.admitad.com");
      assert.equal(product.source, "admitad");
      assert.equal(product.programSlug, "admitad");
      assert.equal(product.dataSource, "api");
    }

    assert.equal(products[0].categorySlug, "desk-setup");
    assert.equal(products[1].categorySlug, "gaming");
    assert.equal(products[0].price, 24.5);
    assert.equal(products[1].previousPrice, undefined, "no invented previous price");

    // One deeplink call per non-duplicate parsed row.
    assert.equal(calls.length, 3);
  } finally {
    globalThis.fetch = realFetch;
    delete process.env.ADMITAD_CLIENT_ID;
    delete process.env.ADMITAD_CLIENT_SECRET;
    delete process.env.ADMITAD_WEBSITE_ID;
  }
});

test("a row whose deeplink resolves off-domain is rejected, not published", async () => {
  mockDeeplinkApi({ returnUntrackedFor: ["item/1.html"] });
  try {
    process.env.ADMITAD_CLIENT_ID = "test-id";
    process.env.ADMITAD_CLIENT_SECRET = "test-secret";
    process.env.ADMITAD_WEBSITE_ID = "123456";

    const feed = [
      "id,title,url,price,image",
      'X1,"Monitor Arm","https://www.aliexpress.com/item/1.html",20,https://cdn.example.com/a.jpg',
    ].join("\n");

    const { report, products } = await importFromFeedText(feed, { campaignId: 1 });
    assert.equal(products.length, 0);
    assert.equal(report.imported, 0);
    assert.equal(report.blocked, true);
    assert.ok(report.errors.some((e) => e.reason.includes("outside approved programme domain")));
  } finally {
    globalThis.fetch = realFetch;
    delete process.env.ADMITAD_CLIENT_ID;
    delete process.env.ADMITAD_CLIENT_SECRET;
    delete process.env.ADMITAD_WEBSITE_ID;
  }
});

test("deeplink failures are recorded per row and the run is marked blocked", async () => {
  mockDeeplinkApi({ failFor: ["item/2.html"] });
  try {
    process.env.ADMITAD_CLIENT_ID = "test-id";
    process.env.ADMITAD_CLIENT_SECRET = "test-secret";
    process.env.ADMITAD_WEBSITE_ID = "123456";

    const feed = [
      "id,title,url,price,image",
      'Y1,"Controller","https://www.aliexpress.com/item/2.html",20,https://cdn.example.com/a.jpg',
    ].join("\n");

    const { report, products } = await importFromFeedText(feed, { campaignId: 1 });
    assert.equal(products.length, 0);
    assert.equal(report.blocked, true);
    assert.ok(report.blockedReason && report.blockedReason.length > 0);
    assert.ok(report.errors.some((e) => e.externalProductId === "Y1"));
  } finally {
    globalThis.fetch = realFetch;
    delete process.env.ADMITAD_CLIENT_ID;
    delete process.env.ADMITAD_CLIENT_SECRET;
    delete process.env.ADMITAD_WEBSITE_ID;
  }
});

test("an unparseable feed reports why instead of pretending it is empty", async () => {
  const { report, products } = await importFromFeedText("this is not a feed", { campaignId: 1 });
  assert.equal(products.length, 0);
  assert.equal(report.blocked, true);
  assert.ok(report.blockedReason?.includes("format"));
});