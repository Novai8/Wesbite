import assert from "node:assert/strict";
import { test } from "node:test";
import { runImport } from "../src/lib/admitad/import-service.ts";
import { resetTokenCache } from "../src/lib/admitad/auth.ts";

/**
 * Persistence tests with a mocked PostgREST server. They prove the request
 * shapes sent to Supabase (conflict target, identity handling, no manual
 * writes). They are NOT evidence against a live database.
 */

const FEED = [
  "offer_id,Product Name,Description,Image,URL,Price,Currency,Category",
  'P1,"Monitor Arm","A clamp-on gas spring monitor arm for 13-32 inch screens.","https://cdn.example.com/a.jpg","https://www.aliexpress.com/item/1.html",24.50,USD,"Computer / Monitor"',
].join("\n");

const ENV_KEYS = [
  "ADMITAD_CLIENT_ID",
  "ADMITAD_CLIENT_SECRET",
  "ADMITAD_WEBSITE_ID",
  "SUPABASE_URL",
  "SUPABASE_SERVICE_ROLE_KEY",
] as const;

interface CapturedRequest {
  method: string;
  path: string;
  onConflict: string | null;
  prefer: string | null;
  body: unknown;
}

function mockSupabase(options: { existing?: Array<Record<string, unknown>> } = {}) {
  const realFetch = globalThis.fetch;
  const requests: CapturedRequest[] = [];

  globalThis.fetch = (async (input: string | URL | Request, init?: RequestInit) => {
    const url = new URL(typeof input === "string" ? input : input instanceof URL ? input.href : input.url);
    const method = init?.method ?? "GET";

    if (url.hostname === "api.admitad.com") {
      if (url.pathname === "/token/") {
        return Response.json({ access_token: "test-token", token_type: "bearer", expires_in: 3600 });
      }
      if (url.pathname.startsWith("/deeplink/")) {
        const ulp = url.searchParams.get("ulp") ?? "";
        return Response.json([
          { link: `https://ad.admitad.com/g/tracked/?ulp=${encodeURIComponent(ulp)}`, is_affiliate_product: true },
        ]);
      }
      if (url.pathname === "/validate_links/") {
        return Response.json({ message: "Link successfully tested." });
      }
    }

    requests.push({
      method,
      path: url.pathname,
      onConflict: url.searchParams.get("on_conflict"),
      prefer: (init?.headers as Record<string, string> | undefined)?.Prefer ?? null,
      body: init?.body ? JSON.parse(String(init.body)) : null,
    });

    // Existing-identity lookup.
    if (method === "GET") return Response.json(options.existing ?? []);
    // Import run insert must return an id.
    if (url.pathname.endsWith("/admitad_import_runs")) return Response.json([{ id: "run-1" }]);
    return Response.json([]);
  }) as typeof fetch;

  return { requests, restore: () => { globalThis.fetch = realFetch; } };
}

async function withEnv(fn: () => Promise<void>) {
  const previous: Record<string, string | undefined> = {};
  for (const key of ENV_KEYS) {
    previous[key] = process.env[key];
    delete process.env[key];
  }
  Object.assign(process.env, {
    ADMITAD_CLIENT_ID: "mock-id",
    ADMITAD_CLIENT_SECRET: "mock-secret",
    ADMITAD_WEBSITE_ID: "777",
    SUPABASE_URL: "https://project.supabase.co",
    SUPABASE_SERVICE_ROLE_KEY: "service-role-test-key",
  });
  try {
    await fn();
  } finally {
    for (const key of ENV_KEYS) {
      if (previous[key] === undefined) delete process.env[key];
      else process.env[key] = previous[key];
    }
    resetTokenCache();
  }
}

test("import upserts on the migration's unique index and preserves an existing id", async () => {
  const mock = mockSupabase({
    existing: [{ id: "legacy-row-id", slug: "legacy-slug", advertiser_id: "20523", external_product_id: "P1" }],
  });

  try {
    await withEnv(async () => {
      const result = await runImport({
        feedText: FEED,
        campaignId: 20523,
        programme: { id: 20523, name: "AliExpress WW", currency: "USD" },
      });

      assert.equal(result.persisted, true, result.persistReason);
      assert.equal(result.report.imported, 1);

      const upsert = mock.requests.find((r) => r.method === "POST" && r.path.endsWith("/affiliate_products"));
      assert.ok(upsert, "expected a product upsert");
      assert.equal(upsert.onConflict, "source,advertiser_id,external_product_id");
      assert.match(String(upsert.prefer), /merge-duplicates/);

      const rows = upsert.body as Array<Record<string, unknown>>;
      assert.equal(rows.length, 1);
      assert.equal(rows[0].id, "legacy-row-id", "an existing row must keep its primary key");
      assert.equal(rows[0].slug, "legacy-slug", "an existing row must keep its URL slug");
      assert.equal(rows[0].source, "admitad");
      assert.equal(rows[0].advertiser_id, "20523");
      assert.equal(rows[0].external_product_id, "P1");
      assert.equal("created_at" in rows[0], false, "created_at must not be overwritten on re-sync");
    });
  } finally {
    mock.restore();
  }
});

test("import never sends a data_source = manual write", async () => {
  const mock = mockSupabase();

  try {
    await withEnv(async () => {
      await runImport({
        feedText: FEED,
        campaignId: 20523,
        programme: { id: 20523, name: "AliExpress WW", currency: "USD" },
      });
    });

    for (const request of mock.requests) {
      if (request.method !== "POST" && request.method !== "PATCH") continue;
      if (!request.path.endsWith("/affiliate_products")) continue;
      const rows = Array.isArray(request.body) ? request.body : [request.body];
      for (const row of rows as Array<Record<string, unknown>>) {
        assert.notEqual(row?.data_source, "manual", "an import must never claim a manual row");
      }
    }
  } finally {
    mock.restore();
  }
});

test("an existing-identity lookup failure degrades to deterministic ids, not a failed import", async () => {
  const realFetch = globalThis.fetch;
  globalThis.fetch = (async (input: string | URL | Request, init?: RequestInit) => {
    const url = new URL(typeof input === "string" ? input : input instanceof URL ? input.href : input.url);
    if (url.hostname === "api.admitad.com") {
      if (url.pathname === "/token/") {
        return Response.json({ access_token: "test-token", token_type: "bearer", expires_in: 3600 });
      }
      if (url.pathname.startsWith("/deeplink/")) {
        return Response.json([{ link: "https://ad.admitad.com/g/tracked/", is_affiliate_product: true }]);
      }
      if (url.pathname === "/validate_links/") {
        return Response.json({ message: "Link successfully tested." });
      }
    }
    if (url.pathname.endsWith("/admitad_import_runs")) return Response.json([{ id: "run-1" }]);
    if ((init?.method ?? "GET") === "GET") {
      return new Response(JSON.stringify({ message: "boom" }), { status: 500 });
    }
    return Response.json([]);
  }) as typeof fetch;

  try {
    await withEnv(async () => {
      const result = await runImport({
        feedText: FEED,
        campaignId: 20523,
        programme: { id: 20523, name: "AliExpress WW", currency: "USD" },
      });
      assert.equal(result.persisted, true, result.persistReason);
      assert.match(result.products[0].id, /^[0-9a-f-]{36}$/);
    });
  } finally {
    globalThis.fetch = realFetch;
  }
});
