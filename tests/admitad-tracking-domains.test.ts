import assert from "node:assert/strict";
import { test } from "node:test";
import {
  isProviderTrackingHost,
  trackingDomainsFor,
  validateAffiliateUrl,
  validateMerchantDestination,
} from "../src/lib/affiliate.ts";
import { getPrograms } from "../src/lib/catalogue.ts";
import { validateGeneratedDeeplink } from "../src/lib/admitad/deeplink.ts";

/**
 * Admitad issues AliExpress WW tracking links on `rzekl.com`, not on
 * `ad.admitad.com`. `rzekl.com` is shared across advertisers, so it is handled
 * as a *provider tracking host* only — never as a merchant destination, and
 * never accepted from user input.
 */

const RZEKL_LINK =
  "https://rzekl.com/g/1e8d114494c05aeface116525dc3e8/?ulp=https%3A%2F%2Fwww.aliexpress.com%2Fitem%2F1005012486166415.html&subid=fyndra";

/** Swaps global fetch for the duration of one call. */
async function withFetch<T>(impl: typeof fetch, fn: () => Promise<T>): Promise<T> {
  const real = globalThis.fetch;
  globalThis.fetch = impl;
  try {
    return await fn();
  } finally {
    globalThis.fetch = real;
  }
}

test("the Admitad programme lists both provider tracking hosts", () => {
  const program = getPrograms().find((p) => p.slug === "admitad");
  assert.ok(program);
  const domains = trackingDomainsFor(program);
  assert.ok(domains.includes("ad.admitad.com"));
  assert.ok(domains.includes("rzekl.com"));
  // The merchant domain stays separate from the tracking hosts.
  assert.equal(program.destinationDomain, "admitad.com");
});

test("a generated rzekl.com tracking URL is accepted for Admitad", () => {
  assert.deepEqual(validateAffiliateUrl(RZEKL_LINK, "admitad"), { ok: true });
  assert.equal(isProviderTrackingHost(RZEKL_LINK, "admitad"), true);
});

test("rzekl.com is recognised as a provider host, not a merchant destination", () => {
  assert.equal(isProviderTrackingHost(RZEKL_LINK, "admitad"), true);
  const asDestination = validateMerchantDestination(RZEKL_LINK, [
    "aliexpress.com",
    "admitad.com",
    "aliexpress.ru",
  ]);
  assert.equal(asDestination.ok, false, "a tracking host must not pass as a destination");
});

test("an arbitrary user-supplied rzekl.com URL does not validate on its own", () => {
  // Someone cannot hardcode a rzekl.com link and have it treated as approved:
  // it also has to come from an authenticated API response and pass
  // /validate_links/. Here the API rejects it.
  assert.equal(isProviderTrackingHost("https://rzekl.com/g/anything/", "admitad"), true);

  const rejectingApi = (async (input: string | URL | Request) => {
    const url = new URL(typeof input === "string" ? input : input instanceof URL ? input.href : input.url);
    if (url.pathname === "/validate_links/") {
      return new Response(JSON.stringify({ errors: { links: ["Attention! This product is nonaffiliate"] } }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }
    throw new Error(`unexpected call ${url.pathname}`);
  }) as typeof fetch;

  return withFetch(rejectingApi, async () => {
    const check = await validateGeneratedDeeplink({
      link: "https://rzekl.com/g/hand-made/",
      is_affiliate_product: null,
    });
    assert.equal(check.ok, false);
    assert.equal(check.stage, "validate_links");
  });
});

test("invalid tracking domains and HTTP links are rejected", () => {
  for (const url of [
    "https://evil-rzekl.com/g/1/",
    "https://rzekl.com.evil.example/g/1/",
    "https://not-rzekl.example/g/1/",
    "http://rzekl.com/g/1/",
    "http://ad.admitad.com/g/1/",
    "https://www.aliexpress.com/item/1005012486166415.html",
    "javascript:alert(1)",
    "not a url",
  ]) {
    const check = validateAffiliateUrl(url, "admitad");
    assert.equal(check.ok, false, `${url} must be rejected`);
  }
});

test("a generated link must also pass Admitad's validate_links", async () => {
  const calls: string[] = [];
  const okApi = (async (input: string | URL | Request) => {
    const url = new URL(typeof input === "string" ? input : input instanceof URL ? input.href : input.url);
    calls.push(url.pathname);
    if (url.pathname === "/token/") {
      return new Response(
        JSON.stringify({ access_token: "test-token", token_type: "bearer", expires_in: 3600 }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      );
    }
    return new Response(JSON.stringify({ message: "Link successfully tested." }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  }) as typeof fetch;

  await withFetch(okApi, async () => {
    const realId = process.env.ADMITAD_CLIENT_ID;
    const realSecret = process.env.ADMITAD_CLIENT_SECRET;
    process.env.ADMITAD_CLIENT_ID = "test-id";
    process.env.ADMITAD_CLIENT_SECRET = "test-secret";
    try {
      const check = await validateGeneratedDeeplink({ link: RZEKL_LINK, is_affiliate_product: true });
      assert.equal(check.ok, true, check.reason);
      assert.ok(calls.includes("/validate_links/"), "validate_links must actually be called");
    } finally {
      if (realId === undefined) delete process.env.ADMITAD_CLIENT_ID;
      else process.env.ADMITAD_CLIENT_ID = realId;
      if (realSecret === undefined) delete process.env.ADMITAD_CLIENT_SECRET;
      else process.env.ADMITAD_CLIENT_SECRET = realSecret;
    }
  });
});

test("a link on the wrong host is rejected before any network validation", async () => {
  let called = false;
  const tracking = (async () => {
    called = true;
    return new Response("{}", { status: 200 });
  }) as typeof fetch;

  await withFetch(tracking, async () => {
    const check = await validateGeneratedDeeplink({
      link: "https://attacker.example/g/1/",
      is_affiliate_product: true,
    });
    assert.equal(check.ok, false);
    assert.equal(check.stage, "host");
    assert.equal(called, false, "network validation must not run for a bad host");
  });
});

test("a missing link in the API response is rejected", async () => {
  const check = await validateGeneratedDeeplink({ link: "", is_affiliate_product: null });
  assert.equal(check.ok, false);
  assert.match(check.reason, /no deeplink/i);
});

test("merchant destinations must be HTTPS on an advertiser-allowed domain", () => {
  const allowed = ["aliexpress.com", "admitad.com", "aliexpress.ru"];
  assert.equal(validateMerchantDestination("https://www.aliexpress.com/item/1.html", allowed).ok, true);
  assert.equal(validateMerchantDestination("https://aliexpress.ru/item/1.html", allowed).ok, true);
  assert.equal(validateMerchantDestination("http://www.aliexpress.com/item/1.html", allowed).ok, false);
  assert.equal(validateMerchantDestination("https://aliexpress.com.evil.example/item/1.html", allowed).ok, false);
  assert.equal(validateMerchantDestination("https://evil.example/item/1.html", allowed).ok, false);
  assert.equal(validateMerchantDestination("https://user:pass@www.aliexpress.com/item/1.html", allowed).ok, false);
  // No advertiser data means no destination can be trusted.
  assert.equal(validateMerchantDestination("https://www.aliexpress.com/item/1.html", []).ok, false);
});

test("existing AliExpress Portals links keep validating", () => {
  assert.deepEqual(validateAffiliateUrl("https://s.click.aliexpress.com/e/_c3yyKUxb", "aliexpress"), { ok: true });
  // And an Admitad-only host is not accepted for the AliExpress programme.
  assert.equal(validateAffiliateUrl(RZEKL_LINK, "aliexpress").ok, false);
});
