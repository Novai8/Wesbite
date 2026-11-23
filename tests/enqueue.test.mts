/**
 * Regression tests for the 3D enqueue API.
 *
 * Run with: npm test
 *
 * These exercise the real route handler, the real validator, and the real
 * model-store dedupe logic. Only the network is replaced, by a small
 * PostgREST-shaped fake keyed off the request URL.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { afterEach, beforeEach, describe, it } from "node:test";

import * as supabaseServer from "@/lib/supabase-server";
import { isUuid, parseEnqueueRequest } from "@/lib/validation";

const PRODUCT_ID = "0d5a1f2e-7b64-4c31-9f3a-2c8d1e5b7a90";
const IMAGE_URL = "https://cdn.example.com/products/desk-lamp.png";
const IMAGE_BYTES = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 1, 2, 3, 4]);

type Row = Record<string, unknown>;

interface FakeTable {
  rows: Row[];
  /** Every write request, in order, so tests can assert what was (not) sent. */
  writes: { method: string; query: URLSearchParams; body: unknown }[];
}

interface FakeSupabaseOptions {
  products?: Row[];
  jobs?: Row[];
}

function createFakeSupabase({ products = [], jobs = [] }: FakeSupabaseOptions) {
  const tables: Record<string, FakeTable> = {
    affiliate_products: { rows: products, writes: [] },
    product_model_jobs: { rows: jobs, writes: [] },
  };

  const matches = (row: Row, query: URLSearchParams): boolean => {
    for (const [key, raw] of query.entries()) {
      if (["select", "order", "limit", "on_conflict", "offset"].includes(key)) continue;
      const [operator, ...rest] = raw.split(".");
      const expected = rest.join(".");
      if (operator === "eq" && String(row[key] ?? "") !== expected) return false;
    }
    return true;
  };

  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), {
      status,
      headers: { "content-type": "application/json" },
    });

  const fakeFetch: typeof fetch = async (input, init) => {
    const url = new URL(typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url);
    const method = (init?.method ?? "GET").toUpperCase();

    if (url.hostname === "cdn.example.com") {
      return new Response(IMAGE_BYTES, { status: 200, headers: { "content-type": "image/png" } });
    }

    const match = /^\/rest\/v1\/([^/]+)$/.exec(url.pathname);
    if (!match) return json({ message: "unexpected url " + url.pathname }, 404);
    const table = tables[match[1]];
    if (!table) return json({ message: "unknown table" }, 404);

    if (method === "GET") {
      const limit = Number(url.searchParams.get("limit") ?? "1000");
      const selected = table.rows.filter((row) => matches(row, url.searchParams)).slice(0, limit);
      const columns = url.searchParams.get("select");
      if (!columns || columns === "*") return json(selected);
      const projection = columns.split(",").map((column) => column.trim());
      return json(selected.map((row) => Object.fromEntries(projection.map((column) => [column, row[column]]))));
    }

    const body = init?.body ? JSON.parse(String(init.body)) : undefined;
    table.writes.push({ method, query: url.searchParams, body });

    if (method === "POST") {
      const incoming: Row[] = Array.isArray(body) ? body : [body as Row];
      const onConflict = url.searchParams.get("on_conflict");
      const conflictColumns = onConflict ? onConflict.split(",") : [];
      const saved = incoming.map((row) => {
        const existing = conflictColumns.length
          ? table.rows.find((candidate) =>
              conflictColumns.every((column) => String(candidate[column]) === String(row[column])),
            )
          : undefined;
        if (existing) {
          Object.assign(existing, row);
          return existing;
        }
        const created = { id: `job-${table.rows.length + 1}`, created_at: "2026-11-23T00:00:00Z", ...row };
        table.rows.push(created);
        return created;
      });
      return json(saved, 201);
    }

    if (method === "PATCH") {
      const updated = table.rows.filter((row) => matches(row, url.searchParams));
      for (const row of updated) Object.assign(row, body);
      return json(updated);
    }

    return json({ message: "method not modelled" }, 405);
  };

  return { tables, fakeFetch };
}

const originalFetch = globalThis.fetch;

function setEnv() {
  process.env.SUPABASE_URL = "https://project.supabase.co";
  process.env.SUPABASE_SERVICE_ROLE_KEY = "service-role-test-key";
  process.env.FYNDRA_3D_WORKER_SECRET = "worker-secret";
}

function clearEnv() {
  delete process.env.SUPABASE_URL;
  delete process.env.SUPABASE_SERVICE_ROLE_KEY;
  delete process.env.FYNDRA_3D_WORKER_SECRET;
}

function post(body: unknown, token = "worker-secret"): Request {
  return new Request("https://fyndra.test/api/products/3d-model", {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${token}` },
    body: JSON.stringify(body),
  });
}

async function loadRoute() {
  return import("@/app/api/products/3d-model/route");
}

beforeEach(() => setEnv());
afterEach(() => {
  clearEnv();
  globalThis.fetch = originalFetch;
});

describe("productId validation", () => {
  it("accepts canonical UUIDs only", () => {
    assert.equal(isUuid(PRODUCT_ID), true);
    assert.equal(isUuid(PRODUCT_ID.toUpperCase()), true);
    assert.equal(isUuid("p-monitor-arm-gas"), false);
    assert.equal(isUuid("0d5a1f2e7b644c319f3a2c8d1e5b7a90"), false);
    assert.equal(isUuid(`${PRODUCT_ID.slice(0, -1)}z`), false);
    assert.equal(isUuid(""), false);
    assert.equal(isUuid(undefined), false);
  });

  it("rejects a seed catalogue id with a clear message", () => {
    const result = parseEnqueueRequest({ productId: "p-monitor-arm-gas", imageUrl: IMAGE_URL });
    assert.equal(result.ok, false);
    assert.match((result as { error: string }).error, /must be a UUID/i);
    assert.match((result as { error: string }).error, /p-monitor-arm-gas/);
  });

  it("rejects a missing productId", () => {
    const result = parseEnqueueRequest({ imageUrl: IMAGE_URL });
    assert.equal(result.ok, false);
    assert.match((result as { error: string }).error, /productId is required/i);
  });

  it("accepts a UUID productId with a raster image URL", () => {
    const result = parseEnqueueRequest({ productId: ` ${PRODUCT_ID} `, imageUrl: IMAGE_URL });
    assert.deepEqual(result, { ok: true, value: { productId: PRODUCT_ID, imageUrl: IMAGE_URL } });
  });
});

describe("POST /api/products/3d-model", () => {
  it("returns 400 for a malformed productId without touching Supabase", async () => {
    const { fakeFetch, tables } = createFakeSupabase({ products: [] });
    globalThis.fetch = fakeFetch;
    const route = await loadRoute();

    const response = await route.POST(post({ productId: "p-monitor-arm-gas", imageUrl: IMAGE_URL }));
    assert.equal(response.status, 400);
    const body = await response.json();
    assert.match(body.error, /UUID/);
    assert.equal(tables.affiliate_products.writes.length, 0);
    assert.equal(tables.product_model_jobs.writes.length, 0);
  });

  it("returns 404 when the UUID does not belong to a product", async () => {
    const { fakeFetch, tables } = createFakeSupabase({ products: [] });
    globalThis.fetch = fakeFetch;
    const route = await loadRoute();

    const response = await route.POST(post({ productId: PRODUCT_ID, imageUrl: IMAGE_URL }));
    assert.equal(response.status, 404);
    assert.equal((await response.json()).error, "Unknown product");
    assert.equal(tables.product_model_jobs.writes.length, 0);
  });

  it("queues a new job exactly once", async () => {
    const { fakeFetch, tables } = createFakeSupabase({
      products: [{ id: PRODUCT_ID, slug: "desk-lamp", model_status: null, model_url: null }],
    });
    globalThis.fetch = fakeFetch;
    const route = await loadRoute();

    const response = await route.POST(post({ productId: PRODUCT_ID, imageUrl: IMAGE_URL }));
    assert.equal(response.status, 202);
    const body = await response.json();
    assert.equal(body.reason, "queued");
    assert.equal(body.status, "pending");

    const inserts = tables.product_model_jobs.writes.filter((write) => write.method === "POST");
    assert.equal(inserts.length, 1);
    assert.equal(inserts[0].query.get("on_conflict"), "product_id,source_image_hash");
    const inserted = inserts[0].body as Row[];
    assert.equal(inserted[0].product_id, PRODUCT_ID);
    assert.equal(inserted[0].status, "pending");
    assert.match(String(inserted[0].source_image_hash), /^[0-9a-f]{64}$/);
  });

  it("deduplicates a repeat enqueue for the same image", async () => {
    const { fakeFetch, tables } = createFakeSupabase({
      products: [{ id: PRODUCT_ID, slug: "desk-lamp", model_status: "pending", model_url: null }],
    });
    globalThis.fetch = fakeFetch;
    const route = await loadRoute();

    const first = await route.POST(post({ productId: PRODUCT_ID, imageUrl: IMAGE_URL }));
    assert.equal(first.status, 202);
    assert.equal((await first.json()).reason, "queued");
    const inserted = tables.product_model_jobs.rows[0];

    const second = await route.POST(post({ productId: PRODUCT_ID, imageUrl: IMAGE_URL }));
    assert.equal(second.status, 202);
    const body = await second.json();
    assert.equal(body.reason, "already_pending");
    assert.equal(body.jobId, inserted.id);
    assert.equal(tables.product_model_jobs.writes.filter((write) => write.method === "POST").length, 1);
    assert.equal(tables.product_model_jobs.rows.length, 1);
  });

  it("does not re-enqueue a completed model for the same image", async () => {
    const { fakeFetch, tables } = createFakeSupabase({
      products: [{ id: PRODUCT_ID, slug: "desk-lamp", model_status: null, model_url: null }],
    });
    globalThis.fetch = fakeFetch;
    const route = await loadRoute();

    const first = await route.POST(post({ productId: PRODUCT_ID, imageUrl: IMAGE_URL }));
    assert.equal(first.status, 202);
    const hash = tables.product_model_jobs.rows[0].source_image_hash as string;
    tables.affiliate_products.rows[0].model_status = "completed";
    tables.affiliate_products.rows[0].model_url = "https://project.supabase.co/storage/v1/object/public/product-models/x.glb";
    tables.affiliate_products.rows[0].source_image_hash = hash;

    const second = await route.POST(post({ productId: PRODUCT_ID, imageUrl: IMAGE_URL }));
    const body = await second.json();
    assert.equal(body.reason, "already_completed");
    assert.match(body.modelUrl, /product-models/);
    assert.equal(tables.product_model_jobs.writes.filter((write) => write.method === "POST").length, 1);
  });

  it("reports quota exhaustion instead of retrying", async () => {
    const { fakeFetch, tables } = createFakeSupabase({
      products: [{ id: PRODUCT_ID, slug: "desk-lamp", model_status: "quota_exhausted", model_url: null }],
    });
    globalThis.fetch = fakeFetch;
    const route = await loadRoute();

    await route.POST(post({ productId: PRODUCT_ID, imageUrl: IMAGE_URL }));
    const hash = tables.product_model_jobs.rows[0].source_image_hash as string;
    tables.affiliate_products.rows[0].source_image_hash = hash;
    tables.product_model_jobs.rows[0].status = "quota_exhausted";

    const response = await route.POST(post({ productId: PRODUCT_ID, imageUrl: IMAGE_URL }));
    const body = await response.json();
    assert.equal(body.reason, "quota_exhausted");
    assert.equal(tables.product_model_jobs.writes.filter((write) => write.method === "POST").length, 1);
  });
});

describe("server-only Supabase helpers", () => {
  it("exposes no client-side upload helpers", () => {
    const exported = Object.keys(supabaseServer);
    assert.equal(exported.includes("uploadObject"), false);
    assert.equal(exported.includes("publicObjectUrl"), false);
    assert.equal(supabaseServer.MODEL_BUCKET, "product-models");
  });
});

describe("updated_at ownership", () => {
  it("the app never sends updated_at; the trigger owns it", () => {
    const sources = ["src/lib/model-store.ts", "scripts/3d_worker.py"].map((file) =>
      readFileSync(new URL(`../${file}`, import.meta.url), "utf8"),
    );
    for (const source of sources) {
      assert.doesNotMatch(source, /updated_at\s*:/, "TS writes must not set updated_at");
      assert.doesNotMatch(source, /"updated_at"\s*:/, "Python writes must not set updated_at");
    }
  });
});
