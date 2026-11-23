import assert from "node:assert/strict";
import { test } from "node:test";
import { GET } from "../src/app/api/n8n/admitad/status/route.ts";
import { resetTokenCache } from "../src/lib/admitad/auth.ts";
import { clearProgrammeCache } from "../src/lib/admitad/programmes.ts";

/**
 * These tests exercise the real status route with a mocked Admitad API.
 * They prove the reporting logic and the fail-closed auth. They are NOT
 * evidence that a live Admitad account works.
 */

const ENV_KEYS = [
  "ADMITAD_CLIENT_ID",
  "ADMITAD_CLIENT_SECRET",
  "ADMITAD_ACCESS_TOKEN",
  "ADMITAD_WEBSITE_ID",
  "N8N_WEBHOOK_SECRET",
] as const;

function withEnv(vars: Partial<Record<(typeof ENV_KEYS)[number], string>>, fn: () => Promise<void>) {
  const previous: Record<string, string | undefined> = {};
  for (const key of ENV_KEYS) {
    previous[key] = process.env[key];
    delete process.env[key];
  }
  Object.assign(process.env, vars);
  return fn().finally(() => {
    for (const key of ENV_KEYS) {
      if (previous[key] === undefined) delete process.env[key];
      else process.env[key] = previous[key];
    }
    resetTokenCache();
    clearProgrammeCache();
  });
}

function request(token?: string): Request {
  return new Request("https://fyndra.test/api/n8n/admitad/status", {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
}

test("status fails closed when N8N_WEBHOOK_SECRET is unset", async () => {
  await withEnv({}, async () => {
    const res = await GET(request("anything"));
    assert.equal(res.status, 503);
    const body = await res.json();
    assert.match(body.error, /N8N_WEBHOOK_SECRET/);
  });
});

test("status rejects a wrong bearer token", async () => {
  await withEnv({ N8N_WEBHOOK_SECRET: "real-secret" }, async () => {
    const res = await GET(request("wrong"));
    assert.equal(res.status, 401);
  });
});

test("status reports Admitad as unconfigured and never claims a live check", async () => {
  await withEnv({ N8N_WEBHOOK_SECRET: "real-secret" }, async () => {
    const res = await GET(request("real-secret"));
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.live, false);
    assert.equal(body.admitad.configured, false);
    assert.equal(body.checks.oauth.status, "skipped");
    assert.equal(body.checks.productImport.status, "not_run");
    assert.match(body.message, /not configured/i);
  });
});

test("status reports each live check separately against a mocked Admitad API", async () => {
  const realFetch = globalThis.fetch;
  globalThis.fetch = (async (input: string | URL | Request) => {
    const url = new URL(typeof input === "string" ? input : input instanceof URL ? input.href : input.url);
    if (url.pathname === "/token/") {
      return new Response(
        JSON.stringify({ access_token: "test-token", token_type: "bearer", expires_in: 3600 }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      );
    }
    if (url.pathname === "/websites/v2/777/") {
      return new Response(
        JSON.stringify({ id: 777, name: "Fyndra", status: "active", validation_passed: true }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      );
    }
    if (url.pathname === "/advcampaigns/website/777/") {
      return new Response(
        JSON.stringify({
          _meta: { count: 1, limit: 100, offset: 0 },
          results: [
            {
              id: 20523,
              name: "AliExpress WW",
              status: "active",
              connection_status: "active",
              allow_deeplink: true,
              show_products_links: true,
              products_csv_link: "https://feeds.admitad.com/a.csv",
              site_url: "https://www.aliexpress.com",
            },
          ],
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      );
    }
    throw new Error(`Unexpected mocked call: ${url.pathname}`);
  }) as typeof fetch;

  try {
    await withEnv(
      {
        N8N_WEBHOOK_SECRET: "real-secret",
        ADMITAD_CLIENT_ID: "mock-id",
        ADMITAD_CLIENT_SECRET: "mock-secret",
        ADMITAD_WEBSITE_ID: "777",
      },
      async () => {
        const res = await GET(request("real-secret"));
        assert.equal(res.status, 200);
        const body = await res.json();

        assert.equal(body.checks.oauth.status, "ok");
        assert.equal(body.checks.website.status, "ok");
        assert.equal(body.checks.website.data.id, 777);
        assert.equal(body.checks.programmes.status, "ok");
        assert.equal(body.checks.programmes.data.connectedProgrammes, 1);
        assert.equal(body.checks.programmes.data.programmesWithProducts, 1);
        assert.equal(body.checks.programmes.data.aliExpress.available, true);
        assert.equal(body.checks.programmes.data.aliExpress.canImportProducts, true);

        // Still honest: nothing was imported by a status read.
        assert.equal(body.checks.productImport.status, "not_run");
        assert.equal(body.checks.feedDownload.status, "not_run");
      },
    );
  } finally {
    globalThis.fetch = realFetch;
  }
});

test("status reports OAuth failure instead of falling through to success", async () => {
  const realFetch = globalThis.fetch;
  globalThis.fetch = (async () =>
    new Response(JSON.stringify({ error: "invalid_grant", error_description: "bad credentials" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    })) as typeof fetch;

  try {
    await withEnv(
      {
        N8N_WEBHOOK_SECRET: "real-secret",
        ADMITAD_CLIENT_ID: "mock-id",
        ADMITAD_CLIENT_SECRET: "mock-secret",
        ADMITAD_WEBSITE_ID: "777",
      },
      async () => {
        const res = await GET(request("real-secret"));
        assert.equal(res.status, 502);
        const body = await res.json();
        assert.equal(body.live, false);
        assert.equal(body.checks.oauth.status, "failed");
        assert.equal(body.checks.website.status, "skipped");
        assert.match(body.checks.oauth.detail, /bad credentials/);
      },
    );
  } finally {
    globalThis.fetch = realFetch;
  }
});
