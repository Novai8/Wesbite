import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

/**
 * Static contracts for the security and ordering design.
 *
 * These do not replace the live PostgreSQL tests in `catalogue-security.sql`
 * and `test_combined.sql`; they lock the *file* shape so a later edit cannot
 * quietly drop the view, re-grant the base table, or reintroduce updated_at
 * ordering.
 */

function read(relative: string): string {
  return readFileSync(relative, "utf8").replace(/\r\n/g, "\n");
}

const migration = () => read("supabase/migrations/20261123150000_fyndra_3d_models.sql");

const SENSITIVE_COLUMNS = [
  "evidence_notes",
  "score",
  "research_confidence",
  "decision",
  "model_error",
];

test("the migration creates the public catalogue view", () => {
  const sql = migration();
  assert.match(sql, /create or replace view public\.catalogue_products/i);
  assert.match(sql, /with \(security_barrier = true\)/i);
  assert.match(sql, /from public\.affiliate_products/i);
});

test("the view excludes every sensitive column", () => {
  const sql = migration();
  const viewStart = sql.indexOf("create or replace view public.catalogue_products");
  const viewEnd = sql.indexOf("comment on view public.catalogue_products");
  assert.ok(viewStart > -1 && viewEnd > viewStart, "expected the view definition block");

  const viewSql = sql.slice(viewStart, viewEnd).toLowerCase();
  for (const column of SENSITIVE_COLUMNS) {
    assert.doesNotMatch(
      viewSql,
      new RegExp(`^\\s*${column}\\s*,?\\s*$`, "m"),
      `the view must not project ${column}`,
    );
  }
});

test("the view exposes the customer-facing product fields", () => {
  const sql = migration().toLowerCase();
  for (const column of [
    "id", "slug", "title", "description", "category_slug", "image_urls",
    "merchant", "program_slug", "affiliate_url", "price", "currency",
    "approval_status", "data_source", "ai_headline", "ai_description",
    "model_url", "model_format", "model_status", "model_provider",
    "model_generated_at",
  ]) {
    assert.match(sql, new RegExp(`^\\s*${column},?\\s*$`, "m"), `view must expose ${column}`);
  }
});

test("the view only exposes approved rows", () => {
  const sql = migration();
  assert.match(sql, /where approval_status = 'approved'/i);
});

test("public roles lose direct table access but gain the view", () => {
  const sql = migration().toLowerCase();
  assert.match(sql, /revoke all on public\.affiliate_products from anon, authenticated/);
  assert.match(sql, /grant select on public\.catalogue_products to anon, authenticated/);
});

test("the row policy on the base table is preserved as defence in depth", () => {
  // The Fyndra migration must not drop Admitad's policy; it is still the
  // row-level backstop if a future grant is reintroduced.
  assert.doesNotMatch(
    migration().toLowerCase(),
    /drop policy if exists "products_read_approved"/,
    "the approved-row policy must not be dropped",
  );
});

test("no public write grants are introduced for products", () => {
  const sql = migration().toLowerCase();
  assert.doesNotMatch(sql, /grant\s+(insert|update|delete|all)\s+on\s+public\.affiliate_products\s+to\s+(anon|authenticated)/);
  assert.doesNotMatch(sql, /create policy[^;]*on public\.affiliate_products[^;]*to (anon|authenticated)[^;]*for (insert|update|delete|all)/);
});

test("the base table still grants service_role everything", () => {
  // Admitad's migration owns this policy; verify it still exists there.
  const admitad = read("supabase/migrations/0001_admitad_integration.sql");
  assert.match(admitad, /create policy "products_service_write"[\s\S]*?to service_role/i);
});

test("catalogue reads go through the view, not the base table", () => {
  const server = read("src/lib/catalogue-server.ts");
  assert.match(server, /SUPABASE_TABLES\.catalogueProducts/);
  assert.doesNotMatch(server, /SUPABASE_TABLES\.products\b/, "catalogue reads must not hit the base table");
});

test("the public view is registered as a distinct table handle", () => {
  const rest = read("src/lib/supabase-rest.ts");
  assert.match(rest, /catalogueProducts: VIEW_CATALOGUE_PRODUCTS/);
  assert.match(rest, /const VIEW_CATALOGUE_PRODUCTS = "catalogue_products"/);
});

test("page reads never request model_error", () => {
  const store = read("src/lib/model-store.ts");
  const publicColumns = /const PUBLIC_MODEL_COLUMNS =\s*([\s\S]*?);/.exec(store);
  assert.ok(publicColumns, "expected PUBLIC_MODEL_COLUMNS");
  assert.doesNotMatch(publicColumns[1], /model_error/, "page reads must not select model_error");
  assert.match(publicColumns[1], /model_url/);
});

test("catalogue ordering does not depend on updated_at", () => {
  const server = read("src/lib/catalogue-server.ts");
  const order = /const CATALOGUE_ORDER = "([^"]+)"/.exec(server);
  assert.ok(order, "expected a single CATALOGUE_ORDER constant");
  assert.doesNotMatch(order[1], /updated_at/, "3D writes bump updated_at and must not drive ranking");
  assert.match(order[1], /last_synced_at/);
  assert.doesNotMatch(server, /order: "updated_at\.desc"/);
});

test("the queue's updated_at trigger is still defined", () => {
  assert.match(migration(), /create trigger product_model_jobs_set_updated_at/i);
});