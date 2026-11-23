import assert from "node:assert/strict";
import { test } from "node:test";
import { importFromFeedUrl } from "../src/lib/admitad/products.ts";
import { resetTokenCache } from "../src/lib/admitad/auth.ts";

/**
 * URL import path.
 *
 * Proves three safety properties:
 *  1. permission is checked before the first byte is requested;
 *  2. a truncated download is refused rather than partially imported;
 *  3. a download failure is reported with its cause, not as an empty success.
 *
 * The deeplink API is stubbed so nothing leaves the process.
 */

const REAL_FETCH = globalThis.fetch;

function programme(overrides: Record<string, unknown> = {}) {
  return {
    id: 6115,
    name: "AliExpress WW",
    connection_status: "active",
    show_products_links: true,
    allow_deeplink: true,
    allowed_deeplink_domains: ["aliexpress.com"],
    ...overrides,
  };
}

function xmlOffers(count: number): string {
  const offers = Array.from({ length: count }, (_, i) =>
    [
      `<offer id="${1005000000000 + i}">`,
      `<name>Monitor arm ${i}</name><price>19.99</price><currencyId>USD</currencyId>`,
      `<categoryId>5</categoryId>`,
      `<picture>https://cdn.example.com/${i}.jpg</picture>`,
      `<url>https://rzekl.com/g/tracked-${i}</url>`,
      "</offer>",
    ].join(""),
  ).join("");
  return [
    '<?xml version="1.0"?>',
    "<yml_catalog><shop>",
    '<categories><category id="5">Computer Components</category></categories>',
    `<offers>${offers}</offers></shop></yml_catalog>`,
  ].join("");
}

function withMockedAdmitad(feedBody: string, status = 200) {
  const calls: string[] = [];
  globalThis.fetch = (async (input: string | URL | Request) => {
    const url = new URL(typeof input === "string" ? input : input instanceof URL ? input.href : input.url);
    calls.push(url.pathname);
    if (url.pathname === "/feed.xml") {
      return new Response(feedBody, { status, headers: { "Content-Type": "application/xml" } });
    }
    if (url.pathname === "/token/") {
      return new Response(
        JSON.stringify({ access_token: "test-token", token_type: "bearer", expires_in: 3600 }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      );
    }
    if (url.pathname.startsWith("/deeplink/")) {
      const ulp = url.searchParams.get("ulp") ?? "";
      return new Response(
        JSON.stringify([{ link: `https://ad.admitad.com/g/t/?ulp=${encodeURIComponent(ulp)}`, is_affiliate_product: true }]),
        { status: 200, headers: { "Content-Type": "application/json" } },
      );
    }
    if (url.pathname === "/validate_links/") {
      return new Response(JSON.stringify({ message: "Link successfully tested." }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }
    throw new Error(`unexpected call: ${url.pathname}`);
  }) as typeof fetch;
  return calls;
}

function withEnv(fn: () => Promise<void>) {
  process.env.ADMITAD_CLIENT_ID = "test-id";
  process.env.ADMITAD_CLIENT_SECRET = "test-secret";
  process.env.ADMITAD_WEBSITE_ID = "3025495";
  return fn().finally(() => {
    globalThis.fetch = REAL_FETCH;
    resetTokenCache();
    delete process.env.ADMITAD_CLIENT_ID;
    delete process.env.ADMITAD_CLIENT_SECRET;
    delete process.env.ADMITAD_WEBSITE_ID;
  });
}

test("a permission refusal never touches the network", async () => {
  const calls: string[] = [];
  globalThis.fetch = (async (input: string | URL | Request) => {
    const url = new URL(typeof input === "string" ? input : input instanceof URL ? input.href : input.url);
    calls.push(url.pathname);
    throw new Error("network must not be used");
  }) as typeof fetch;

  try {
    const { report, products } = await importFromFeedUrl("https://export.example.test/feed.xml", {
      campaignId: 6115,
      permission: programme({ show_products_links: false }) as never,
    });
    assert.equal(products.length, 0);
    assert.equal(report.blocked, true);
    assert.equal(report.feedPermission?.state, "denied");
    assert.equal(report.totalRows, 0);
    assert.equal(calls.length, 0);
  } finally {
    globalThis.fetch = REAL_FETCH;
  }
});

test("an ambiguous programme is blocked before download too", async () => {
  let fetched = false;
  globalThis.fetch = (async () => {
    fetched = true;
    return new Response("", { status: 200 });
  }) as typeof fetch;

  try {
    const { report } = await importFromFeedUrl("https://export.example.test/feed.xml", {
      campaignId: 6115,
      permission: programme({
        show_products_links: false,
        feeds_info: [{ xml_link: "https://export.example.test/feed.xml?feed_id=14107" }],
      }) as never,
    });
    assert.equal(report.feedPermission?.state, "ambiguous");
    assert.equal(report.blocked, true);
    assert.equal(fetched, false, "no request may be made for an ambiguous programme");
  } finally {
    globalThis.fetch = REAL_FETCH;
  }
});

test("a truncated feed is refused rather than partially imported", async () => {
  // 400 offers, but the cap stops the read after 20.
  withMockedAdmitad(xmlOffers(400));
  await withEnv(async () => {
    const { report, products } = await importFromFeedUrl("https://export.example.test/feed.xml", {
      campaignId: 6115,
      permission: programme() as never,
      download: { maxRecords: 20 },
    });

    assert.equal(products.length, 0, "no product may be returned from a truncated feed");
    assert.equal(report.imported, 0);
    assert.equal(report.blocked, true);
    assert.equal(report.download?.truncated, true);
    assert.match(report.download?.truncationReason ?? "", /record cap 20/);
    assert.match(report.blockedReason ?? "", /truncated feed is refused/i);
  });
});

test("a complete feed imports normally through the streaming path", async () => {
  const calls = withMockedAdmitad(xmlOffers(3));
  await withEnv(async () => {
    const { report, products } = await importFromFeedUrl("https://export.example.test/feed.xml", {
      campaignId: 6115,
      permission: programme() as never,
      feedOptions: { maxRows: 10 },
    });

    assert.equal(report.blocked, false, report.blockedReason);
    assert.equal(report.imported, 3);
    assert.equal(products.length, 3);
    assert.equal(report.download?.truncated, false);
    assert.equal(report.format, "xml");
    // The category dictionary resolved, so the shelf came from source data.
    assert.equal(report.categories?.resolved, 3);
    assert.equal(products[0].categoryBasis, "source-category");
    assert.equal(products[0].sourceCategoryId, "5");
    assert.equal(products[0].categorySlug, "desk-setup");
    assert.equal(calls.filter((c) => c === "/feed.xml").length, 1);
  });
});

test("an expired link is reported as expired, not as a successful empty feed", async () => {
  withMockedAdmitad("signature expired", 403);
  await withEnv(async () => {
    const { report } = await importFromFeedUrl("https://export.example.test/feed.xml", {
      campaignId: 6115,
      permission: programme() as never,
    });
    assert.equal(report.blocked, true);
    assert.equal(report.imported, 0);
    assert.match(report.blockedReason ?? "", /expired/);
  });
});

test("a network failure is surfaced with its cause", async () => {
  globalThis.fetch = (async () => {
    throw new Error("connect ECONNREFUSED");
  }) as typeof fetch;
  try {
    const { report } = await importFromFeedUrl("https://export.example.test/feed.xml", {
      campaignId: 6115,
      permission: programme() as never,
    });
    assert.equal(report.blocked, true);
    assert.match(report.blockedReason ?? "", /network|could not be reached/i);
  } finally {
    globalThis.fetch = REAL_FETCH;
  }


test("a transient overload during download is retried without importing twice", async () => {
  let feedRequests = 0;
  const feedBody = xmlOffers(2);
  globalThis.fetch = (async (input: string | URL | Request) => {
    const url = new URL(typeof input === "string" ? input : input instanceof URL ? input.href : input.url);
    if (url.pathname === "/feed.xml") {
      feedRequests += 1;
      if (feedRequests === 1) {
        return new Response("advertiser server overloaded", { status: 503 });
      }
      return new Response(feedBody, { status: 200, headers: { "Content-Type": "application/xml" } });
    }
    if (url.pathname === "/token/") {
      return new Response(
        JSON.stringify({ access_token: "test-token", token_type: "bearer", expires_in: 3600 }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      );
    }
    if (url.pathname.startsWith("/deeplink/")) {
      const ulp = url.searchParams.get("ulp") ?? "";
      return new Response(
        JSON.stringify([{ link: `https://ad.admitad.com/g/t/?ulp=${encodeURIComponent(ulp)}`, is_affiliate_product: true }]),
        { status: 200, headers: { "Content-Type": "application/json" } },
      );
    }
    if (url.pathname === "/validate_links/") {
      return new Response(JSON.stringify({ message: "Link successfully tested." }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }
    throw new Error(`unexpected call: ${url.pathname}`);
  }) as typeof fetch;

  await withEnv(async () => {
    const { report, products } = await importFromFeedUrl("https://export.example.test/feed.xml", {
      campaignId: 6115,
      permission: programme() as never,
      download: { attempts: 2 },
      feedOptions: { maxRows: 10 },
    });

    assert.equal(feedRequests, 2, "the overload should be retried exactly once");
    assert.equal(report.blocked, false, report.blockedReason);
    assert.equal(report.imported, 2);
    assert.equal(products.length, 2, "a retry must not duplicate rows");
  });
});
});
