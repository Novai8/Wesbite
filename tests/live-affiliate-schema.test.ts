import assert from "node:assert/strict";
import { test } from "node:test";
import { readFileSync } from "node:fs";
import { runImport } from "../src/lib/admitad/import-service.ts";
import { resetTokenCache } from "../src/lib/admitad/auth.ts";
import { PRODUCT_SOURCE_UNIQUE_COLUMNS } from "../src/lib/admitad/mapper.ts";
import { fromProductRow, toProductRow } from "../src/lib/admitad/supabase-store.ts";

/**
 * The migration SQL as text, with line endings normalised.
 *
 * The assertions below slice on `\n` and anchor with `^...$` regex flags, so a
 * CRLF checkout (Windows, `core.autocrlf=true`) must not change the result.
 */
function migrationSql(): string {
  return readFileSync("supabase/migrations/0001_admitad_integration.sql", "utf8").replace(/\r\n/g, "\n");
}

/**
 * Tests against the ACTUAL Affiliate Business Supabase schema, not the earlier
 * "ideal catalogue" documentation.
 *
 * Live `public.affiliate_products` (inspected 2026-11-23):
 *   id uuid pk, created_at, product_name, product_url, affiliate_url,
 *   affiliate_network, category, target_market, price_text,
 *   commission_rate_text, evidence_notes, decision, score, target_audience,
 *   positioning_angle, content_hooks, risk_flags, research_confidence,
 *   rationale, status
 *
 * These tests use a mocked PostgREST server that enforces the live shape:
 * unknown columns are rejected, the primary key must be a UUID, and research
 * columns must survive untouched. They remain offline tests — no live
 * database is contacted.
 */

const LIVE_RESEARCH_COLUMNS = [
  "created_at",
  "product_name",
  "product_url",
  "affiliate_url",
  "affiliate_network",
  "category",
  "target_market",
  "price_text",
  "commission_rate_text",
  "evidence_notes",
  "decision",
  "score",
  "target_audience",
  "positioning_angle",
  "content_hooks",
  "risk_flags",
  "research_confidence",
  "rationale",
  "status",
] as const;

const ADDED_CATALOGUE_COLUMNS = [
  "slug",
  "title",
  "description",
  "category_slug",
  "subcategory",
  "image_urls",
  "merchant",
  "program_slug",
  "source_url",
  "price",
  "currency",
  "previous_price",
  "original_price",
  "specs",
  "pros",
  "cons",
  "availability",
  "region",
  "keywords",
  "use_cases",
  "budget_tier",
  "price_verified_at",
  "approval_status",
  "data_source",
  "source",
  "external_product_id",
  "advertiser_id",
  "commission_info",
  "last_synced_at",
  "ai_headline",
  "ai_description",
  "ai_quality_flags",
  "updated_at",
] as const;

const UUID_V5 = /^[0-9a-f]{8}-[0-9a-f]{4}-5[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

/** Mirrors the SQL trigger: a NULL data_source is treated as manual. */
function coalesceDataSource(row: Record<string, unknown>): string {
  return typeof row.data_source === "string" ? row.data_source : "manual";
}

const FEED = [
  "offer_id,Product Name,Description,Image,URL,Price,Currency,Category",
  'LIVE-1,"Monitor Arm","A clamp-on gas spring monitor arm for 13-32 inch screens with VESA mounting.","https://cdn.example.com/a.jpg","https://www.aliexpress.com/item/100.html",24.50,USD,"Computer / Monitor"',
  'LIVE-2,"Gaming Controller","A wireless controller with two analogue sticks for PC and console play.","https://cdn.example.com/b.jpg","https://www.aliexpress.com/item/200.html",32.00,EUR,"Gaming"',
  // Same external id as LIVE-1: must be deduped, not duplicated.
  'LIVE-1,"Monitor Arm duplicate","A clamp-on gas spring monitor arm for 13-32 inch screens with VESA mounting.","https://cdn.example.com/a.jpg","https://www.aliexpress.com/item/100.html",24.50,USD,"Computer / Monitor"',
  // Invalid row: no image, no price. Must be reported, never written.
  'LIVE-3,"Broken Row","A row with no image and no price, which cannot be published.","","https://www.aliexpress.com/item/300.html",,,USD,"Gadgets"',
].join("\n");

const ENV_KEYS = [
  "ADMITAD_CLIENT_ID",
  "ADMITAD_CLIENT_SECRET",
  "ADMITAD_WEBSITE_ID",
  "SUPABASE_URL",
  "SUPABASE_SERVICE_ROLE_KEY",
  "GROQ_API_KEY",
] as const;

interface LiveRow {
  id: string;
  [column: string]: unknown;
}

interface Write {
  method: string;
  path: string;
  onConflict: string | null;
  body: unknown;
}

/**
 * A mocked PostgREST endpoint whose accepted column set is the live schema.
 * Writes naming any other column fail with a 400, exactly as PostgreSQL would.
 */
function mockLiveProject(options: { rows?: LiveRow[] } = {}) {
  const realFetch = globalThis.fetch;
  const rows: LiveRow[] = options.rows ? options.rows.map((row) => ({ ...row })) : [];
  const writes: Write[] = [];
  const accepted = new Set<string>(["id", ...LIVE_RESEARCH_COLUMNS, ...ADDED_CATALOGUE_COLUMNS]);

  const reject = (message: string) =>
    new Response(JSON.stringify({ code: "PGRST204", message }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });

  const handleProductWrite = (method: string, body: unknown, onConflict: string | null): Response => {
    const incoming = (Array.isArray(body) ? body : [body]) as Array<Record<string, unknown>>;

    for (const row of incoming) {
      for (const column of Object.keys(row)) {
        if (!accepted.has(column)) {
          return reject(`Could not find the '${column}' column of 'affiliate_products' in the schema cache`);
        }
      }
      if (typeof row.id === "string" && !UUID_V5.test(row.id) && !/^[0-9a-f-]{36}$/.test(row.id)) {
        return reject(`invalid input syntax for type uuid: "${row.id}"`);
      }
    }

    if (method === "PATCH") {
      for (const row of incoming) {
        for (const target of rows) {
          if (coalesceDataSource(target) === "manual") continue;
          Object.assign(target, row);
        }
      }
      return Response.json([]);
    }

    for (const row of incoming) {
      const conflictKey = onConflict?.split(",").map((c) => c.trim()) ?? [];
      const match = rows.find((existing) =>
        conflictKey.length > 0 && conflictKey.every((column) => existing[column] === row[column]),
      );

      if (match) {
        // Merge, exactly like `resolution=merge-duplicates`.
        Object.assign(match, row);
      } else {
        rows.push({
          // The DB default supplies a UUID when the client omits one.
          id: typeof row.id === "string" ? row.id : "0d6f2b9a-4f2c-5e7a-9c31-8a7b6d5e4f31",
          created_at: "2026-11-23T00:00:00.000Z",
          data_source: row.data_source ?? "manual",
          approval_status: row.approval_status ?? null,
          ...row,
        });
      }
    }
    return Response.json(rows);
  };

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
    }

    // Must match the real endpoint in src/lib/admitad/enrich.ts.
    if (url.hostname === "api.groq.com") {
      return Response.json({
        choices: [
          {
            message: {
              content: JSON.stringify({
              // Deliberately figure-free: `looksLikeFabrication` must not have
              // a reason to discard this copy for the controller row.
              headline: "Clamp-on monitor arm",
              description: "A gas spring arm that clamps to a desk.",
              }),
            },
          },
        ],
      });
    }

    // Existing-identity lookup.
    if (method === "GET" && url.pathname.endsWith("/affiliate_products")) {
      return Response.json(rows.filter((row) => row.source === "admitad"));
    }
    // Import audit insert must return an id.
    if (url.pathname.endsWith("/admitad_import_runs")) {
      return Response.json([{ id: "11111111-2222-4333-8444-555555555555" }]);
    }
    if (url.pathname.endsWith("/admitad_import_errors")) {
      return new Response(null, { status: 201 });
    }

    const body = init?.body ? JSON.parse(String(init.body)) : null;
    if (url.pathname.endsWith("/affiliate_products")) {
      writes.push({ method, path: url.pathname, onConflict: url.searchParams.get("on_conflict"), body });
      return handleProductWrite(method, body, url.searchParams.get("on_conflict"));
    }

    return Response.json([]);
  }) as typeof fetch;

  return {
    rows,
    writes,
    restore: () => {
      globalThis.fetch = realFetch;
    },
  };
}

async function withEnv(fn: () => Promise<void>, extra: Record<string, string> = {}) {
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
    ...extra,
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

test("the migration adds every catalogue column and never drops a research column", () => {
  const sql = migrationSql();

  // A fresh database must get the research shape, not a catalogue-only table.
  const createBlock = sql.slice(
    sql.indexOf("create table if not exists public.affiliate_products"),
    sql.indexOf("-- Products: catalogue columns"),
  );
  for (const column of LIVE_RESEARCH_COLUMNS) {
    assert.match(
      createBlock,
      new RegExp(`^\\s+${column}\\b`, "m"),
      `fresh-create block must include live research column ${column}`,
    );
  }
  assert.match(createBlock, /id\s+uuid primary key/, "the live UUID primary key must be preserved");

  for (const column of ADDED_CATALOGUE_COLUMNS) {
    assert.match(
      sql,
      new RegExp(`add column if not exists ${column}\\b`),
      `migration must add ${column} with IF NOT EXISTS`,
    );
  }
  for (const column of LIVE_RESEARCH_COLUMNS) {
    assert.doesNotMatch(
      sql,
      new RegExp(`drop column[^;]*\\b${column}\\b`, "i"),
      `migration must never drop research column ${column}`,
    );
  }

  assert.doesNotMatch(sql, /drop table[^;]*affiliate_products/i, "affiliate_products must never be dropped");
  assert.doesNotMatch(sql, /rename\s+(column|to)[^;]*affiliate_products/i, "affiliate_products must never be renamed");
  assert.match(sql, /create unique index if not exists affiliate_products_source_advertiser_external_key[\s\S]*?\(source, advertiser_id, external_product_id\)/);
  assert.doesNotMatch(sql, /where source is not null/, "the dedupe index must stay non-partial for PostgREST");
  assert.match(sql, /add constraint affiliate_products_currency_iso[\s\S]*?not valid/, "currency rule must not reject legacy rows");
});

test("adding catalogue columns never attaches a DEFAULT that would backfill research rows", () => {
  const sql = migrationSql();
  const addBlock = sql.slice(
    sql.indexOf("alter table public.affiliate_products\n  add column if not exists slug"),
    sql.indexOf("-- Catalogue defaults"),
  );
  assert.ok(addBlock.length > 0, "expected the ADD COLUMN block");

  // Since PostgreSQL 11 `ADD COLUMN ... DEFAULT` evaluates the default for
  // every existing row. That would write into research rows, so the migration
  // must add all catalogue columns without a default and set defaults later.
  assert.doesNotMatch(
    addBlock,
    /\bdefault\b/i,
    "ADD COLUMN must not carry a DEFAULT; defaults belong in the separate ALTER ... SET DEFAULT block",
  );
  assert.match(sql, /alter column data_source\s+set default 'manual'/);
  assert.match(sql, /alter column approval_status set default 'pending'/);
});

test("the currency cleanup only targets a single-column currency allowlist", () => {
  const sql = migrationSql();
  const block = sql.slice(
    sql.indexOf("for con in"),
    sql.indexOf("execute format('alter table public.affiliate_products drop constraint %I', con.conname)"),
  );
  assert.ok(block.length > 0, "expected the currency constraint loop");
  assert.match(block, /!~\* '\\b\(AND\|OR\)\\b'/, "boolean combinations must be excluded");
  assert.match(block, /!~\* '\\b\(price\|product_name\|/, "other columns must be excluded");
});

test("a catalogue-only database gains the research columns so research inserts still work", () => {
  const sql = migrationSql();
  const reconcile = sql.slice(
    sql.indexOf("-- Research columns are reconciled"),
    sql.indexOf("-- Products: insert defaults and nullability"),
  );
  assert.ok(reconcile.length > 0, "expected the research reconciliation block");
  // These three exist in both table shapes (`created_at` predates the catalogue
  // columns; `id`/`affiliate_url` are reused by the catalogue), so they are not
  // part of the reconciliation list.
  const SHARED = new Set(["id", "created_at", "affiliate_url"]);
  for (const column of LIVE_RESEARCH_COLUMNS.filter((c) => !SHARED.has(c))) {
    assert.match(
      reconcile,
      new RegExp(`\\('${column}',\\s+'`),
      `catalogue-only databases must be given research column ${column}`,
    );
  }
  // Added without NOT NULL, so the research writer keeps working unchanged.
  assert.doesNotMatch(reconcile, /add column[^;]*not null/i);
});

test("the live research schema plus the migration accepts the exact toProductRow payload", () => {
  const row = toProductRow({
    id: "c2f6c9d4-3f1a-5a7b-8e42-1b2c3d4e5f60",
    slug: "monitor-arm-abc123",
    title: "Monitor Arm",
    description: "A clamp-on monitor arm.",
    categorySlug: "desk-setup",
    imageUrls: ["https://cdn.example.com/a.jpg"],
    merchant: "AliExpress WW",
    programSlug: "admitad",
    affiliateUrl: "https://ad.admitad.com/g/x/",
    sourceUrl: "https://www.aliexpress.com/item/100.html",
    price: 24.5,
    currency: "USD",
    specs: {},
    pros: [],
    cons: [],
    availability: "in_stock",
    region: ["worldwide"],
    keywords: ["monitor"],
    useCases: [],
    budgetTier: "budget",
    priceVerifiedAt: "2026-11-23",
    approvalStatus: "approved",
    dataSource: "api",
    source: "admitad",
    externalProductId: "LIVE-1",
    advertiserId: "20523",
    lastSyncedAt: "2026-11-23T00:00:00.000Z",
    createdAt: "2026-11-23T00:00:00.000Z",
    updatedAt: "2026-11-23T00:00:00.000Z",
  });

  const accepted = new Set<string>(["id", ...LIVE_RESEARCH_COLUMNS, ...ADDED_CATALOGUE_COLUMNS]);
  for (const column of Object.keys(row)) {
    assert.ok(accepted.has(column), `payload column ${column} is not in the live+added schema`);
  }

  // The UUID primary key is reused, so the payload must be a real UUID.
  assert.match(row.id, UUID_V5);
  // Research columns are never part of an import payload.
  for (const column of LIVE_RESEARCH_COLUMNS) {
    if (column === "created_at" || column === "product_url" || column === "affiliate_url") continue;
    assert.equal(column in row, false, `import must not write research column ${column}`);
  }
});

test("a real import against the live-shaped table writes only catalogue columns", async () => {
  const mock = mockLiveProject();
  try {
    await withEnv(async () => {
      const result = await runImport({
        feedText: FEED,
        campaignId: 20523,
        programme: { id: 20523, name: "AliExpress WW", currency: "USD" },
      });

      assert.equal(result.persisted, true, result.persistReason);
      assert.equal(result.report.imported, 2, "two valid rows");
      assert.equal(result.report.duplicates, 1, "the repeated offer id is deduped");
      assert.ok(result.report.errors.some((e) => e.externalProductId === "LIVE-3"));

      const upsert = mock.writes.find((w) => w.method === "POST");
      assert.ok(upsert, "expected a product upsert");
      assert.equal(upsert.onConflict, PRODUCT_SOURCE_UNIQUE_COLUMNS);
      assert.equal(upsert.onConflict, "source,advertiser_id,external_product_id");

      for (const row of mock.rows) {
        for (const column of Object.keys(row)) {
          assert.ok(
            column === "id" || (LIVE_RESEARCH_COLUMNS as readonly string[]).includes(column) || (ADDED_CATALOGUE_COLUMNS as readonly string[]).includes(column),
            `unexpected column ${column}`,
          );
        }
        assert.match(String(row.id), UUID_V5, "the live UUID primary key is satisfied");
        assert.equal(row.data_source, "api");
        assert.equal(row.approval_status, "approved");
        // Research fields are untouched by the import.
        assert.equal(row.product_name, undefined);
        assert.equal(row.evidence_notes, undefined);
        assert.equal(row.status, undefined);
      }
    });
  } finally {
    mock.restore();
  }
});

test("repeated imports update in place and never duplicate rows", async () => {
  const mock = mockLiveProject();
  try {
    await withEnv(async () => {
      await runImport({
        feedText: FEED,
        campaignId: 20523,
        programme: { id: 20523, name: "AliExpress WW", currency: "USD" },
      });
      const firstIds = mock.rows.map((row) => row.id).sort();
      assert.equal(firstIds.length, 2);

      const second = await runImport({
        feedText: FEED,
        campaignId: 20523,
        programme: { id: 20523, name: "AliExpress WW", currency: "USD" },
      });
      assert.equal(second.persisted, true, second.persistReason);

      assert.equal(mock.rows.length, 2, "a re-sync must not create new rows");
      assert.deepEqual(mock.rows.map((row) => row.id).sort(), firstIds, "primary keys stay stable");
    });
  } finally {
    mock.restore();
  }
});

test("an existing research row is never claimed by an import", async () => {
  const researchRow: LiveRow = {
    id: "8b1d2c3e-4f5a-5b6c-9d7e-8f90a1b2c3d4",
    created_at: "2026-11-01T00:00:00.000Z",
    product_name: "Researched Monitor Arm",
    product_url: "https://www.aliexpress.com/item/100.html",
    affiliate_url: "https://ad.admitad.com/g/researched/",
    evidence_notes: "Hand-checked on 2026-11-01.",
    decision: "shortlist",
    score: 87,
    status: "published",
    // The live table has no data_source value on research rows: it is NULL.
  };

  const mock = mockLiveProject({ rows: [researchRow] });

  try {
    await withEnv(async () => {
      const result = await runImport({
        feedText: FEED,
        campaignId: 20523,
        programme: { id: 20523, name: "AliExpress WW", currency: "USD" },
      });

      assert.equal(result.persisted, true, result.persistReason);

      const preserved = mock.rows.find((row) => row.id === researchRow.id);
      assert.ok(preserved, "the research row must still exist");
      assert.equal(preserved.product_name, "Researched Monitor Arm");
      assert.equal(preserved.evidence_notes, "Hand-checked on 2026-11-01.");
      assert.equal(preserved.decision, "shortlist");
      assert.equal(preserved.score, 87);
      assert.equal(preserved.status, "published");
      assert.equal(preserved.affiliate_url, "https://ad.admitad.com/g/researched/");
      assert.equal(preserved.data_source, undefined, "the research row is not converted into an imported row");

      // The importer gets its own row instead of overwriting the research one.
      const imported = mock.rows.find((row) => row.data_source === "api");
      assert.ok(imported);
      assert.notEqual(imported.id, researchRow.id);
    });
  } finally {
    mock.restore();
  }
});

test("AI copy is patched into ai_* columns only, never a research column", async () => {
  const mock = mockLiveProject();
  try {
    await withEnv(
      async () => {
        const result = await runImport({
          feedText: FEED,
          campaignId: 20523,
          programme: { id: 20523, name: "AliExpress WW", currency: "USD" },
          enrich: true,
        });
        assert.equal(result.persisted, true, result.persistReason);
        assert.equal(result.enriched, 2, "both products must actually be enriched");
        assert.equal(result.enrichmentSkipped, undefined, "enrichment must not have been skipped");

        const patches = mock.writes.filter((write) => write.method === "PATCH");
        assert.ok(patches.length > 0, "expected AI field patches");
        for (const patch of patches) {
          const body = patch.body as Record<string, unknown>;
          assert.deepEqual(Object.keys(body).sort(), ["ai_description", "ai_headline", "ai_quality_flags"]);
          assert.equal(typeof patch.onConflict, "object", "a PATCH carries no on_conflict parameter");
        }
      },
      { GROQ_API_KEY: "mock-groq-key" },
    );
  } finally {
    mock.restore();
  }
});

test("malformed feed rows and a missing price never reach the database", async () => {
  const mock = mockLiveProject();
  try {
    await withEnv(async () => {
      const malformed = [
        "offer_id,Product Name,Description,Image,URL,Price,Currency,Category",
        'M1,"No URL","A row with no usable URL at all in the feed.","https://cdn.example.com/a.jpg","",10.00,USD,"Gadgets"',
        'M2,"No image","A row with a URL and price but no image supplied.","","https://www.aliexpress.com/item/400.html",10.00,USD,"Gadgets"',
        "this is not a feed at all",
      ].join("\n");

      const result = await runImport({
        feedText: malformed,
        campaignId: 20523,
        programme: { id: 20523, name: "AliExpress WW", currency: "USD" },
      });

      assert.equal(result.persisted, true, "an import run is recorded even when no row is publishable");
      assert.equal(result.report.imported, 0);
      assert.equal(result.report.blocked, true);
      assert.equal(mock.rows.filter((row) => row.data_source === "api").length, 0);
    });
  } finally {
    mock.restore();
  }
});

test("fromProductRow reads a live research row without crashing", () => {
  const product = fromProductRow({
    id: "8b1d2c3e-4f5a-5b6c-9d7e-8f90a1b2c3d4",
    created_at: "2026-11-01T00:00:00.000Z",
    product_name: "Researched Monitor Arm",
    product_url: "https://www.aliexpress.com/item/100.html",
    affiliate_url: null,
    evidence_notes: "Hand-checked.",
    status: "published",
  });

  assert.equal(product.id, "8b1d2c3e-4f5a-5b6c-9d7e-8f90a1b2c3d4");
  assert.equal(product.price, 0);
  assert.equal(product.currency, "USD");
  assert.equal(product.dataSource, "manual", "a row with no data_source is treated as manual");
  assert.equal(product.approvalStatus, "pending", "a research row is not auto-approved for the public catalogue");
});
