import assert from "node:assert/strict";
import { test } from "node:test";
import { checkFeedPermission } from "../src/lib/admitad/permissions.ts";
import { importFromFeedText } from "../src/lib/admitad/products.ts";
import { POST as importRoute } from "../src/app/api/n8n/admitad/import/route.ts";

/**
 * AliExpress WW reports `show_products_links: false` while its signed feed URLs
 * still answer HTTP 200. Technical accessibility is not permission: the
 * importer must fail closed and never read the feed.
 */

const FEED = [
  "id,title,url,price,image",
  '1005012486166415,"Bread Basket","https://rzekl.com/g/abc/",12.23,https://cdn.example.com/a.jpg',
].join("\n");

const REAL_FETCH = globalThis.fetch;

function failOnNetwork(): string[] {
  const calls: string[] = [];
  globalThis.fetch = (async (input: string | URL | Request) => {
    const url = new URL(typeof input === "string" ? input : input instanceof URL ? input.href : input.url);
    calls.push(`${url.hostname}${url.pathname}`);
    throw new Error(`network access is not permitted: ${url.hostname}`);
  }) as typeof fetch;
  return calls;
}

/**
 * Models the live programme record: connected, deeplinks allowed, but
 * `show_products_links: false`. Only `/token/` and the programme lookup are
 * answered; anything else is an unexpected call and throws.
 */
function mockAdmitadProgramme(showProductsLinks: boolean, calls: string[]) {
  globalThis.fetch = (async (input: string | URL | Request) => {
    const url = new URL(typeof input === "string" ? input : input instanceof URL ? input.href : input.url);
    calls.push(`${url.hostname}${url.pathname}`);
    if (url.pathname === "/token/") {
      return new Response(
        JSON.stringify({ access_token: "test-token", token_type: "bearer", expires_in: 3600 }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      );
    }
    if (/^\/advcampaigns\/6115\/website\/3025495\/$/.test(url.pathname)) {
      return new Response(
        JSON.stringify({
          id: 6115,
          name: "AliExpress WW",
          connection_status: "active",
          allow_deeplink: true,
          show_products_links: showProductsLinks,
          allowed_deeplink_domains: ["aliexpress.com", "admitad.com", "aliexpress.ru"],
          products_csv_link: "https://export.admitad.com/signed/feed.csv",
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      );
    }
    throw new Error(`unexpected network call: ${url.hostname}${url.pathname}`);
  }) as typeof fetch;
}

test("show_products_links=false without any feed entry is denied", () => {
  const permission = checkFeedPermission({
    id: 6115,
    name: "AliExpress WW",
    connection_status: "active",
    show_products_links: false,
  });
  assert.equal(permission.state, "denied");
  assert.equal(permission.allowed, false);
  assert.match(permission.reason, /show_products_links = false/);
  assert.match(permission.reason, /no product-feed entry/i);
});

test("permission is denied when the flag is absent, not assumed true", () => {
  const permission = checkFeedPermission({
    id: 6115,
    name: "AliExpress WW",
    connection_status: "active",
  });
  assert.equal(permission.allowed, false);
  assert.match(permission.reason, /absent/);
});

test("permission requires an active connection as well", () => {
  for (const status of ["pending", "declined", undefined]) {
    const permission = checkFeedPermission({
      id: 6115,
      name: "AliExpress WW",
      connection_status: status,
      show_products_links: true,
    });
    assert.equal(permission.allowed, false);
  }
});

test("permission is granted only when both conditions genuinely hold", () => {
  const permission = checkFeedPermission({
    id: 6115,
    name: "AliExpress WW",
    connection_status: "active",
    show_products_links: true,
  });
  assert.equal(permission.allowed, true);
});

test("the importer refuses before reading the feed when permission is false", async () => {
  const calls = failOnNetwork();
  try {
    const { report, products } = await importFromFeedText(FEED, {
      campaignId: 6115,
      programme: { id: 6115, name: "AliExpress WW", currency: "USD" },
      permission: {
        id: 6115,
        name: "AliExpress WW",
        connection_status: "active",
        show_products_links: false,
      },
    });

    assert.equal(products.length, 0);
    assert.equal(report.imported, 0);
    assert.equal(report.blocked, true);
    assert.equal(report.totalRows, 0, "the feed must not be parsed");
    assert.match(report.blockedReason ?? "", /show_products_links = false/);
    assert.equal(calls.length, 0, "no network call may be made");
  } finally {
    globalThis.fetch = REAL_FETCH;
  }
});

test("the import route returns 409 ambiguous with an explanation and imports nothing", async () => {
  const calls: string[] = [];
  mockAdmitadProgramme(false, calls);
  process.env.N8N_WEBHOOK_SECRET = "test-secret";
  process.env.ADMITAD_CLIENT_ID = "test-id";
  process.env.ADMITAD_CLIENT_SECRET = "test-secret";
  process.env.ADMITAD_WEBSITE_ID = "3025495";
  try {
    const res = await importRoute(
      new Request("https://fyndra.test/api/n8n/admitad/import", {
        method: "POST",
        headers: {
          Authorization: "Bearer test-secret",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ campaignId: 6115, feedText: FEED }),
      }),
    );
    // The mocked programme advertises `products_csv_link`, so a refusal here is
    // the ambiguous case: a feed exists but the advertiser flag says no.
    assert.equal(res.status, 409, `unexpected status ${res.status}`);
    const body = await res.json();
    assert.equal(body.ok, false);
    assert.equal(body.blocked, true);
    assert.match(body.error, /show_products_links = false/);
    assert.equal(body.feedPermission.state, "ambiguous");
    assert.equal(body.feedPermission.allowed, false);
    // The programme lookup is expected; fetching the feed is not.
    assert.equal(
      calls.some((c) => c.includes("export.admitad.com")),
      false,
      "the feed must never be downloaded",
    );
  } finally {
    globalThis.fetch = REAL_FETCH;
    delete process.env.N8N_WEBHOOK_SECRET;
    delete process.env.ADMITAD_CLIENT_ID;
    delete process.env.ADMITAD_CLIENT_SECRET;
    delete process.env.ADMITAD_WEBSITE_ID;
  }
});

test("the import route still refuses when the programme record is unreachable", async () => {
  const calls = failOnNetwork();
  process.env.N8N_WEBHOOK_SECRET = "test-secret";
  process.env.ADMITAD_CLIENT_ID = "test-id";
  process.env.ADMITAD_CLIENT_SECRET = "test-secret";
  process.env.ADMITAD_WEBSITE_ID = "3025495";
  try {
    const res = await importRoute(
      new Request("https://fyndra.test/api/n8n/admitad/import", {
        method: "POST",
        headers: { Authorization: "Bearer test-secret", "Content-Type": "application/json" },
        body: JSON.stringify({ campaignId: 6115, feedText: FEED }),
      }),
    );
    // Unknown permission is treated as denied, never as allowed.
    assert.ok([403, 404, 502].includes(res.status), `unexpected status ${res.status}`);
    const body = await res.json();
    assert.equal(body.ok, false);
    assert.equal(body.blocked, true);
    assert.equal(
      calls.some((c) => c.includes("export.admitad.com")),
      false,
      "the feed must never be downloaded",
    );
  } finally {
    globalThis.fetch = REAL_FETCH;
    delete process.env.N8N_WEBHOOK_SECRET;
    delete process.env.ADMITAD_CLIENT_ID;
    delete process.env.ADMITAD_CLIENT_SECRET;
    delete process.env.ADMITAD_WEBSITE_ID;
  }
});

test("feed parsing stays testable without any API access", async () => {
  const calls = failOnNetwork();
  try {
    const { parseFeed } = await import("../src/lib/admitad/feed-parser.ts");
    const parsed = parseFeed(
      [
        "id;name;url;price;picture",
        "1005012486166415;Bread Basket;https://rzekl.com/g/abc/;12.23;https://cdn.example.com/a.jpg",
      ].join("\n"),
    );
    assert.equal(parsed.format, "csv");
    assert.equal(parsed.rows.length, 1);
    assert.equal(parsed.rows[0].external_product_id, "1005012486166415");
    assert.equal(calls.length, 0);
  } finally {
    globalThis.fetch = REAL_FETCH;
  }
});
