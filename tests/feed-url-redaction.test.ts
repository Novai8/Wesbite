import assert from "node:assert/strict";
import { test } from "node:test";
import {
  scrubFeedCredentials,
  toPublicAvailability,
  toPublicFeedPermission,
  toPublicProgramme,
} from "../src/lib/admitad/public-view.ts";
import { checkFeedPermission, type PermissionProgramme } from "../src/lib/admitad/permissions.ts";
import { GET as statusRoute } from "../src/app/api/n8n/admitad/status/route.ts";
import { GET as aliExpressRoute } from "../src/app/api/n8n/admitad/aliexpress/route.ts";
import { resetTokenCache } from "../src/lib/admitad/auth.ts";
import { clearProgrammeCache } from "../src/lib/admitad/programmes.ts";

/**
 * Signed-feed-URL redaction.
 *
 * Admitad's ad-space programme object carries per-publisher export links that
 * embed `user=PID...` and an access `code=`. They are credentials. Every
 * workflow-facing response must expose feed *identity* and *permission state*
 * without either value, and must survive a future upstream field being added.
 */

const CODE = "8avn6orxjt";
const PUBLISHER = "PID2611768";

function exportLink(feedId: string, format: "xml" | "csv" = "xml", code = CODE): string {
  return (
    "https://export.admitad.com/webmaster/websites/3025495/products/export_adv_products/" +
    `?user=${PUBLISHER}&code=${code}&feed_id=${feedId}&format=${format}`
  );
}

/** The live shape: flag false, ten feeds present, deeplinks allowed. */
function liveProgramme(overrides: Partial<PermissionProgramme> = {}): PermissionProgramme {
  return {
    id: 6115,
    name: "AliExpress WW",
    connection_status: "active",
    show_products_links: false,
    allow_deeplink: true,
    products_xml_link: exportLink("14267"),
    products_csv_link: exportLink("14267", "csv"),
    feeds_info: [
      { name: "10-25$", xml_link: exportLink("14267"), csv_link: exportLink("14267", "csv"), admitad_last_update: "2026-11-23 10:40:05+00:00" },
      { name: "hot products", xml_link: exportLink("15830"), csv_link: exportLink("15830", "csv") },
    ],
    ...overrides,
  } as PermissionProgramme;
}

function assertNoSignedUrl(value: unknown, label: string): void {
  const text = JSON.stringify(value);
  assert.ok(!text.includes(CODE), `${label} leaked the access code`);
  assert.ok(!text.includes(PUBLISHER), `${label} leaked the publisher id`);
  assert.ok(!/export\.admitad\.com/.test(text), `${label} leaked the export host`);
  assert.ok(!text.includes("code="), `${label} leaked a code parameter`);
  assert.ok(!/csv_link|xml_link|products_csv_link|products_xml_link/.test(text), `${label} kept a link field`);
}

test("toPublicProgramme strips every signed URL but keeps feed identity", () => {
  const publicProgramme = toPublicProgramme(liveProgramme());
  assert.ok(publicProgramme);
  assertNoSignedUrl(publicProgramme, "public programme");

  assert.equal(publicProgramme.id, 6115);
  assert.equal(publicProgramme.name, "AliExpress WW");
  assert.equal(publicProgramme.showProductsLinks, false);
  assert.equal(publicProgramme.deeplinkAllowed, true);
  // Existence is reported, contents are not.
  assert.equal(publicProgramme.hasXmlFeed, true);
  assert.equal(publicProgramme.hasCsvFeed, true);
  assert.deepEqual(publicProgramme.feedIds.sort(), ["14267", "15830"]);
  assert.equal(publicProgramme.feedEntryCount, 2);
  assert.deepEqual(
    publicProgramme.feeds.map((feed) => feed.feedId).sort(),
    ["14267", "15830"],
  );
});

test("toPublicProgramme never copies an unexpected upstream field", () => {
  const hostile = {
    ...liveProgramme(),
    // Fields a future Admitad response might add. None may reach the caller.
    products_json_link: exportLink("999"),
    api_secret: "should-not-appear",
    feeds_info: [
      { name: "x", xml_link: exportLink("14267"), csv_link: exportLink("14267", "csv"), token: "nope" },
    ],
  } as unknown as PermissionProgramme;

  const publicProgramme = toPublicProgramme(hostile);
  assert.ok(publicProgramme);
  assertNoSignedUrl(publicProgramme, "allowlisted programme");
  assert.ok(!JSON.stringify(publicProgramme).includes("should-not-appear"));
  assert.ok(!JSON.stringify(publicProgramme).includes("nope"));
});

test("toPublicProgramme handles an absent programme", () => {
  assert.equal(toPublicProgramme(null), null);
  assert.equal(toPublicProgramme(undefined), null);
});

test("toPublicFeedPermission keeps state and evidence, drops nothing useful", () => {
  const permission = checkFeedPermission(liveProgramme());
  const publicPermission = toPublicFeedPermission(permission);

  assert.equal(publicPermission.state, "ambiguous");
  assert.equal(publicPermission.allowed, false);
  assert.equal(publicPermission.evidence.showProductsLinks, false);
  assert.deepEqual([...publicPermission.evidence.matchingFeedIds].sort(), ["14267", "15830"]);
  assertNoSignedUrl(publicPermission, "public permission");
});

test("scrubFeedCredentials removes a signed export URL from free-form text", () => {
  const raw =
    `Admitad GET /export_adv_products/ failed (403) for ${exportLink("14267")} — retry later.`;
  const scrubbed = scrubFeedCredentials(raw);

  assertNoSignedUrl(scrubbed, "scrubbed message");
  assert.match(scrubbed, /failed \(403\)/);
  assert.match(scrubbed, /redacted-signed-feed-url/);
  assert.match(scrubbed, /retry later/);
});

test("scrubFeedCredentials blanks credential params in any URL", () => {
  const scrubbed = scrubFeedCredentials(
    "request to https://feeds.example.test/feed?user=PID2611768&code=8avn6orxjt&feed_id=9",
  );
  assert.ok(!scrubbed.includes(CODE));
  assert.ok(!scrubbed.includes(PUBLISHER));
  assert.match(scrubbed, /feed_id=9/, "non-credential parameters survive for debugging");
});

test("scrubFeedCredentials is idempotent and leaves clean text alone", () => {
  assert.equal(scrubFeedCredentials("plain message"), "plain message");
  assert.equal(scrubFeedCredentials(""), "");
  const once = scrubFeedCredentials(`link: ${exportLink("14267")}`);
  assert.equal(scrubFeedCredentials(once), once);
});

test("toPublicAvailability carries the permission state without the URLs", () => {
  const programme = liveProgramme();
  const publicAvailability = toPublicAvailability({
    available: true,
    connectionStatus: "active",
    reason: checkFeedPermission(programme).reason,
    canImportProducts: false,
    canUseDeeplinks: true,
    feedPermission: checkFeedPermission(programme),
    programme,
  });

  assertNoSignedUrl(publicAvailability, "public availability");
  assert.equal(publicAvailability.available, true);
  assert.equal(publicAvailability.canImportProducts, false);
  assert.equal(publicAvailability.feedPermission?.state, "ambiguous");
  assert.equal(publicAvailability.programme?.feedEntryCount, 2);
});

/* ------------------------------------------------------------------ */
/* Route-level: the real handlers must not echo a signed URL either.   */
/* ------------------------------------------------------------------ */

const ENV_KEYS = [
  "ADMITAD_CLIENT_ID",
  "ADMITAD_CLIENT_SECRET",
  "ADMITAD_ACCESS_TOKEN",
  "ADMITAD_WEBSITE_ID",
  "N8N_WEBHOOK_SECRET",
] as const;

async function withLiveAdmitad(handler: (req: Request) => Promise<Response>, token: string) {
  const realFetch = globalThis.fetch;
  const previous: Record<string, string | undefined> = {};
  for (const key of ENV_KEYS) {
    previous[key] = process.env[key];
    delete process.env[key];
  }
  Object.assign(process.env, {
    N8N_WEBHOOK_SECRET: "redaction-secret",
    ADMITAD_CLIENT_ID: "mock-id",
    ADMITAD_CLIENT_SECRET: "mock-secret",
    ADMITAD_WEBSITE_ID: "3025495",
  });

  globalThis.fetch = (async (input: string | URL | Request) => {
    const url = new URL(typeof input === "string" ? input : input instanceof URL ? input.href : input.url);
    const json = (body: unknown) =>
      new Response(JSON.stringify(body), { status: 200, headers: { "Content-Type": "application/json" } });

    if (url.pathname === "/token/") {
      return json({ access_token: "test-token", token_type: "bearer", expires_in: 3600 });
    }
    if (url.pathname === "/websites/v2/3025495/") {
      return json({ id: 3025495, name: "Fyundra", status: "active", validation_passed: false });
    }
    if (url.pathname === "/advcampaigns/website/3025495/") {
      return json({
        _meta: { count: 1, limit: 100, offset: 0 },
        // The full live record, signed links and long advertiser blobs included.
        results: [
          {
            ...liveProgramme(),
            description: "advertiser blurb",
            raw_description: `<p>signed ${exportLink("14267")}</p>`,
            gotolink: "https://rzekl.com/g/tracked",
            site_url: "https://www.aliexpress.com",
            currency: "USD",
            regions: [{ region: "PK" }],
          },
        ],
      });
    }
    throw new Error(`Unexpected mocked call: ${url.pathname}`);
  }) as typeof fetch;

  try {
    const res = await handler(
      new Request("https://fyndra.test/api", { headers: { Authorization: `Bearer ${token}` } }),
    );
    return { status: res.status, text: await res.text() };
  } finally {
    globalThis.fetch = realFetch;
    for (const key of ENV_KEYS) {
      if (previous[key] === undefined) delete process.env[key];
      else process.env[key] = previous[key];
    }
    resetTokenCache();
    clearProgrammeCache();
  }
}

test("GET /api/n8n/admitad/status never returns a signed feed URL", async () => {
  const { status, text } = await withLiveAdmitad(statusRoute, "redaction-secret");
  assert.equal(status, 200);

  assertNoSignedUrl(JSON.parse(text), "status response");

  const body = JSON.parse(text);
  // The contract the workflow depends on still holds.
  assert.equal(body.live, true);
  assert.equal(body.feedPermission.state, "ambiguous");
  assert.equal(body.aliExpress.canImportProducts, false);
  assert.deepEqual(
    [...body.aliExpress.programme.feedIds].sort(),
    ["14267", "15830"].sort(),
  );
  // A 65 KB raw blob would blow past this; the projection is small.
  assert.ok(text.length < 8_000, `status response grew to ${text.length} bytes`);
});

test("GET /api/n8n/admitad/aliexpress never returns a signed feed URL", async () => {
  const { status, text } = await withLiveAdmitad(aliExpressRoute, "redaction-secret");
  assert.equal(status, 200);
  assertNoSignedUrl(JSON.parse(text), "aliexpress response");

  const body = JSON.parse(text);
  assert.equal(body.checked, true);
  assert.equal(body.canImportProducts, false);
  assert.deepEqual([...body.programme.feedIds].sort(), ["14267", "15830"].sort());
});

test("a refused request leaks nothing", async () => {
  const realFetch = globalThis.fetch;
  const previous = process.env.N8N_WEBHOOK_SECRET;
  process.env.N8N_WEBHOOK_SECRET = "redaction-secret";
  globalThis.fetch = (async () => {
    throw new Error(`connection refused: ${exportLink("14267")}`);
  }) as unknown as typeof fetch;
  try {
    const res = await statusRoute(
      new Request("https://fyndra.test/api", { headers: { Authorization: "Bearer wrong" } }),
    );
    assert.equal(res.status, 401);
    assertNoSignedUrl(await res.json(), "401 body");
  } finally {
    globalThis.fetch = realFetch;
    if (previous === undefined) delete process.env.N8N_WEBHOOK_SECRET;
    else process.env.N8N_WEBHOOK_SECRET = previous;
  }
});

/* ------------------------------------------------------------------ */
/* Upstream failures: adapters and the remaining routes must scrub.     */
/* ------------------------------------------------------------------ */

function stubFetch(body: string, status: number) {
  return (async () =>
    new Response(JSON.stringify({ error_description: body }), {
      status,
      headers: { "Content-Type": "application/json" },
    })) as typeof fetch;
}

/**
 * `admitadRequest` builds its error message from the request path plus the
 * upstream error body. A feed download passes `absoluteUrl`, so a future
 * change that echoed the whole URL would put `code=`/`user=` into a thrown
 * Error - which routes then return to the workflow caller. Scrubbed at source.
 */
test("an upstream API error never carries a signed URL into its message", async () => {
  const { admitadRequest } = await import("../src/lib/admitad/client.ts");
  const realFetch = globalThis.fetch;
  const previousToken = process.env.ADMITAD_ACCESS_TOKEN;
  process.env.ADMITAD_ACCESS_TOKEN = "test-token";
  globalThis.fetch = stubFetch(`upstream said no: ${exportLink("14267")}`, 400);
  try {
    await assert.rejects(
      () => admitadRequest("/advcampaigns/"),
      (err: Error) => {
        assertNoSignedUrl(err.message, "API error message");
        assert.match(err.message, /failed [(]400[)]/);
        return true;
      },
    );
  } finally {
    globalThis.fetch = realFetch;
    if (previousToken === undefined) delete process.env.ADMITAD_ACCESS_TOKEN;
    else process.env.ADMITAD_ACCESS_TOKEN = previousToken;
  }
});

test("validateDeeplink scrubs a signed URL out of its failure message", async () => {
  const { validateDeeplink } = await import("../src/lib/admitad/deeplink.ts");
  const realFetch = globalThis.fetch;
  const previousToken = process.env.ADMITAD_ACCESS_TOKEN;
  const previousWebsite = process.env.ADMITAD_WEBSITE_ID;
  process.env.ADMITAD_ACCESS_TOKEN = "test-token";
  process.env.ADMITAD_WEBSITE_ID = "3025495";
  globalThis.fetch = stubFetch(`rejected: ${exportLink("14267")}`, 403);
  try {
    const result = await validateDeeplink("https://www.aliexpress.com/item/1.html");
    assert.equal(result.ok, false);
    assertNoSignedUrl(result.message, "deeplink validation message");
    assert.match(result.message, /failed [(]403[)]/);
  } finally {
    globalThis.fetch = realFetch;
    if (previousToken === undefined) delete process.env.ADMITAD_ACCESS_TOKEN;
    else process.env.ADMITAD_ACCESS_TOKEN = previousToken;
    if (previousWebsite === undefined) delete process.env.ADMITAD_WEBSITE_ID;
    else process.env.ADMITAD_WEBSITE_ID = previousWebsite;
  }
});
