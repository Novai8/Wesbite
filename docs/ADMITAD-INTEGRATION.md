# Admitad Integration

How Fyndra imports products from Admitad, stores them, shows them, and keeps
their affiliate links honest.

> **Status:** implemented and unit-tested. **Live API calls have not been run** —
> no Admitad credentials were available while building this. See
> [Verification status](#verification-status) for exactly what is proven and what
> is not.

---

## Architecture

```
Admitad Publisher API            Fyndra (server only)
─────────────────────            ─────────────────────────────────────────
POST /token/          ────────▶  lib/admitad/auth.ts        token cache + refresh
GET  /advcampaigns/   ────────▶  lib/admitad/programmes.ts  eligibility + feed URLs
GET  /deeplink/…      ────────▶  lib/admitad/deeplink.ts    tracked links
GET  /validate_links/ ────────▶  lib/admitad/deeplink.ts    payable-link check
                                 lib/admitad/feed-parser.ts  CSV/XML/JSON → rows
                                 lib/admitad/mapper.ts       rows → Product
                                 lib/admitad/products.ts     pipeline + dedupe
                                 lib/admitad/import-service.ts  enrichment + storage
                                 lib/supabase-rest.ts        PostgREST writes/reads
                                 lib/catalogue-server.ts     seed + imported merge
```

Everything in `src/lib/admitad/` is **server-only**. No Admitad or Supabase
secret is reachable from a client component; the importable n8n workflow holds
only `N8N_WEBHOOK_SECRET`.

### Why the catalogue stays static-first

`lib/catalogue.ts` remains synchronous and seed-backed so client components
(`discover-grid`, `compare-tool`, `setup-builder-form`) and the build need
neither credentials nor a network. `lib/catalogue-server.ts` is the server view:
it merges imported rows with the seed, caches the Supabase read for
`CATALOGUE_REVALIDATE_SECONDS` (300s), and falls back to the seed — with a logged
warning — if Supabase is down.

### Product acquisition (the important constraint)

Admitad has **no product-data REST endpoint**. Products come from the
advertiser's feed file, whose signed link is returned by
`GET /advcampaigns/website/{w_id}/` as `products_csv_link`, `products_xml_link`
or an entry in `feeds_info[]`. Fyndra parses those files directly. Full evidence
is in `docs/research/admitad-api-notes.md`.

---

## File map

| File | Purpose |
| --- | --- |
| `src/lib/admitad/config.ts` | Env reading, capability report, `AdmitadNotConfiguredError` |
| `src/lib/admitad/types.ts` | API response types, exactly as Admitad returns them |
| `src/lib/admitad/auth.ts` | OAuth client-credentials + refresh, per-isolate cache |
| `src/lib/admitad/client.ts` | Authenticated fetch, 401 retry, 429/503 backoff |
| `src/lib/admitad/programmes.ts` | Programme listing, AliExpress availability |
| `src/lib/admitad/deeplink.ts` | Deeplink generation + link validation |
| `src/lib/admitad/websites.ts` | Ad-space lookup |
| `src/lib/admitad/statistics.ts` | Reports + AliExpress commission rates |
| `src/lib/admitad/feed-parser.ts` | CSV / XML / JSON → canonical rows |
| `src/lib/admitad/mapper.ts` | Rows → `Product`, with category/tier rules |
| `src/lib/admitad/products.ts` | Import pipeline, dedupe, per-row errors |
| `src/lib/admitad/import-service.ts` | Persistence, audit rows, AI enrichment |
| `src/lib/admitad/enrich.ts` | Groq copy generation + fabrication guard |
| `src/lib/admitad/supabase-store.ts` | `Product` ↔ database row mapping |
| `src/lib/admitad/index.ts` | Barrel export (server only) |
| `src/lib/catalogue-server.ts` | Seed + imported merge, cached |
| `src/lib/supabase-rest.ts` | Minimal PostgREST client |
| `src/lib/workflow-auth.ts` | Bearer auth for `/api/n8n/*`, fail-closed |
| `supabase/migrations/0001_admitad_integration.sql` | Additive schema + RLS |
| `n8n/fyndra-admitad-import.json` | Importable workflow |
| `tests/*.test.ts` | 81 offline unit tests |

### Routes

| Route | Method | Purpose |
| --- | --- | --- |
| `/api/n8n/admitad/status` | GET | Per-check report: OAuth, ad space, programme eligibility, AliExpress availability |
| `/api/n8n/admitad/aliexpress` | GET | Focused AliExpress WW availability answer |
| `/api/n8n/admitad/preview` | POST | Parse a feed file with no credentials, no writes |
| `/api/n8n/admitad/deeplink` | POST | Generate + validate one tracked link |
| `/api/n8n/admitad/import` | POST | Run an import (inline feed, feed URL, or programme feed) |
| `/api/n8n/admitad/enrich` | POST | Generate AI copy for one stored product |

All require `Authorization: Bearer $N8N_WEBHOOK_SECRET` and are rate limited.

---

## Data model

The integration targets the **actual Affiliate Business Supabase project**,
whose `public.affiliate_products` table already exists as an affiliate
*research* table (20 columns, UUID primary key). The migration is additive: it
never drops, renames or recreates that table, and it never writes a research
column.

| Field group | Columns | Written by |
| --- | --- | --- |
| Research (pre-existing) | `product_name`, `product_url`, `affiliate_network`, `category`, `target_market`, `price_text`, `commission_rate_text`, `evidence_notes`, `decision`, `score`, `target_audience`, `positioning_angle`, `content_hooks`, `risk_flags`, `research_confidence`, `rationale`, `status` | research workflow |
| Shared | `id` (uuid pk), `created_at`, `affiliate_url` | either |
| Catalogue (added) | `slug`, `title`, `description`, `category_slug`, `subcategory`, `image_urls`, `merchant`, `program_slug`, `source_url`, `price`, `currency`, `previous_price`, `original_price`, `specs`, `pros`, `cons`, `availability`, `region`, `keywords`, `use_cases`, `budget_tier`, `price_verified_at`, `approval_status`, `data_source`, `source`, `external_product_id`, `advertiser_id`, `commission_info`, `last_synced_at`, `ai_headline`, `ai_description`, `ai_quality_flags`, `updated_at` | Admitad importer |

`status` and `approval_status` are **different columns with different
meanings** and are never mapped onto each other. A research row has
`approval_status = NULL` and therefore never appears in the public catalogue.

Duplicate prevention is a non-partial unique index scoped to the advertiser:

```sql
create unique index ... on affiliate_products (source, advertiser_id, external_product_id);
```

It is deliberately not partial, because PostgREST can only use a non-partial
unique index as an `on_conflict` target. NULLs are distinct in a PostgreSQL
unique index, so manual and research rows are unaffected.

`src/lib/admitad/mapper.ts` exports the conflict target:

```ts
export const PRODUCT_SOURCE_UNIQUE_COLUMNS = "source,advertiser_id,external_product_id";
```

The columns and their order must stay identical to the index, or every upsert
fails with PostgreSQL error `42P10`.

Manual edits are protected by the `protect_manual_product` trigger: an automated
upsert cannot take ownership of a manual row. A row counts as manual when
`data_source = 'manual'` **or `data_source IS NULL`** — the second branch is what
protects pre-existing research rows. A manual row never has its `source` /
`external_product_id` / `advertiser_id` rewritten.

RLS: `anon` may read approved products and active programmes only. Every write
path needs the service role, which exists server-side only.

> **ID compatibility.** The live project already has `id uuid primary key`. The
> migration reuses it: it only adds a `gen_random_uuid()` default when `id` is
> already `uuid`, and never changes the column type. Imported records carry a
> deterministic, RFC 4122 version-5 UUID derived from
> `(source, advertiser_id, external_product_id)`, which stays stable across
> re-syncs.
>
> The migration widens `price` / `previous_price` to `numeric(12,2)` only when
> they are already numeric, so a `price_text` column is never converted. Any
> single-column currency allowlist is replaced by an ISO-4217 shape check added
> `NOT VALID`, so existing rows are never rejected or rewritten. A combined
> constraint that also references another column is left untouched.

---

## Honesty rules (enforced in code)

1. **Never fabricate.** Missing price, image, description or availability stays
   missing. `productPublishBlockers` refuses to import a row without a price,
   image, source URL or tracked link.
2. **No untracked links.** Every outbound URL is a generated deeplink validated
   against the programme domain (`ad.admitad.com`) before storage, and again at
   `/api/go`. `validateAffiliateUrl` matches the exact host or a true subdomain —
   tests cover `evil-ad.admitad.com` look-alikes.
3. **AI writes copy only.** `enrich.ts` outputs `ai_headline` and
   `ai_description`; `looksLikeFabrication` discards any output containing
   numbers that were not in the source.
4. **Failures are reported.** An empty import is never returned as success: the
   report carries `blocked: true`, a reason, and per-row errors.
5. **No silent degradation.** Missing credentials produce a 503 that names the
   missing variables, never a fake "no products" result.

---

## Verification status

**Proven offline (81 tests, `npm run test:unit`):**

- CSV/XML/JSON parsing: quoted fields, BOM, CRLF, semicolon delimiters, CDATA,
  XML attributes, nested tags.
- Column mapping across the spellings advertisers actually use.
- Number parsing for `1,234.50`, `1 234,50`, `€12.99`.
- Category inference and budget tiers.
- Stable slugs and the `source:advertiser_id:external_product_id` dedupe key.
- Advertiser-scoped dedupe keys, UUID-shaped deterministic ids that fit both
  `id text` and `id uuid`, and an upsert conflict target that matches the
  migration's non-partial unique index.
- Import persistence request shapes: merge-duplicates on the provenance tuple,
  reuse of an existing row's id/slug, no `manual` writes, and graceful
  degradation when the identity lookup fails.
- `/api/go` redirects, 404 handling for unknown ids, and refusal to resolve an
  arbitrary destination.
- Status-route auth (fail-closed 503, 401 on a wrong token) and per-check
  reporting against a mocked API, including the OAuth-failure path.
- `created_at` is excluded from the import upsert, so re-syncs preserve the
  original creation timestamp.
- `Product` ↔ row round-trip, including nulls and JSON-string columns.
- Full import pipeline against a **mocked** Admitad API: dedupe, per-row failure,
  off-domain rejection, blocked-run reporting.
- Affiliate-URL validation, including look-alike host rejection.
- AI fabrication guard.
- Honest configuration reporting (missing vars, blank values, static tokens).
- The migration against the actual live schema (`tests/live-affiliate-schema.test.ts`):
  a mocked PostgREST surface accepts only the live + added columns, enforces the
  UUID primary key and the exact `on_conflict` tuple, keeps research rows
  untouched, and is exercised for repeated imports, AI-field patches and
  malformed rows.

**Proven against real PostgreSQL (disposable cluster seeded with the live
schema, not the Supabase project):**

- All 20 research columns keep their exact types after the migration runs.
- All 33 catalogue columns are added; the table ends at 53 columns.
- The migration is idempotent: running it twice changes nothing.
- `ADD COLUMN` carries no default, so research rows are not backfilled.
- The dedupe index is unique and non-partial; the slug index rejects duplicates;
  the exact `on_conflict` tuple upserts instead of inserting a second row.
- The currency rule is added `NOT VALID`; an invalid new value is rejected, and a
  combined currency+price constraint survives the migration.
- `protect_manual_product` blocks an import from claiming a manual row **and** a
  research row whose `data_source` is NULL.
- A catalogue-only database gains the research columns, and a research-only
  insert still works afterwards.

**Not proven — requires credentials:**

- Live OAuth token exchange and refresh.
- Live programme listing and AliExpress WW availability.
- Live feed download and deeplink generation.
- Live `/validate_links/` responses.
- Actual Supabase insert/upsert (the SQL is written, not executed).

When credentials exist, run the checks in
[Connecting your account](#connecting-your-admitad-account) to convert these
into verified results.

---

## Connecting your Admitad account

1. **Create / log in to a publisher account** at <https://store.admitad.com>.
2. **Add your ad space.** Admitad calls it a "website". Use your site's URL and
   wait for validation (`validation_passed`). Copy its numeric id —
   that is `ADMITAD_WEBSITE_ID`.
3. **Create API credentials.** Account → Settings → Credentials → *Show
   credentials*. Copy `client_id` and `client_secret`.
4. **Join the AliExpress WW programme.** Catalogue → search "AliExpress WW" →
   *Join*. Approval is the advertiser's decision. Check it landed:

   ```bash
   curl -s "$SITE/api/n8n/admitad/aliexpress" \
     -H "Authorization: Bearer $N8N_WEBHOOK_SECRET" | jq
   ```

   `connectionStatus` must be `active`. `canImportProducts` additionally requires
   the programme to expose a feed.
5. **Set the variables** (see `.env.example`): `ADMITAD_CLIENT_ID`,
   `ADMITAD_CLIENT_SECRET`, `ADMITAD_WEBSITE_ID`, plus `N8N_WEBHOOK_SECRET` and
   the Supabase pair.
6. **Apply the migration.** It is **not applied yet**. Snapshot the project,
   dry-run the file on a scratch copy, then run
   `supabase/migrations/0001_admitad_integration.sql` in the SQL editor or via
   `supabase db push`. Post-verify and re-run it once to prove idempotency —
   see [Applying the migration](DATABASE-SCHEMA.md#applying-the-migration).
7. **Confirm the connection:**

   ```bash
   curl -s "$SITE/api/n8n/admitad/status" \
     -H "Authorization: Bearer $N8N_WEBHOOK_SECRET" | jq
   ```

8. **Test one deeplink** before importing anything:

   ```bash
   curl -s -X POST "$SITE/api/n8n/admitad/deeplink" \
     -H "Authorization: Bearer $N8N_WEBHOOK_SECRET" \
     -H "Content-Type: application/json" \
     -d '{"campaignId": <ALIEXPRESS_CAMPAIGN_ID>, "url": "https://www.aliexpress.com/item/<id>.html"}' | jq
   ```

   `validation.ok` must be `true`. If it is not, the link is not payable and
   nothing should be imported.
9. **Preview a feed** before writing rows:

   ```bash
   curl -s -X POST "$SITE/api/n8n/admitad/preview" \
     -H "Authorization: Bearer $N8N_WEBHOOK_SECRET" \
     -H "Content-Type: application/json" \
     -d "{\"campaignId\": <ID>, \"feedText\": $(jq -Rs . < feed.csv)}" | jq
   ```

10. **Import:** `POST /api/n8n/admitad/import` with
    `{"campaignId": <ID>, "useProgrammeFeed": true, "enrich": true}`.

### Approval requirements

- AliExpress WW (and most programmes) require advertiser approval. `pending` and
  `declined` are normal states; the API exposes them and Fyndra reports them
  rather than working around them.
- Product feeds are separately gated by `show_products_links`.
- `attach`/`detach` via API are disabled by Admitad (`410`); joining is a manual
  account action.

---

## n8n

Import `n8n/fyndra-admitad-import.json`. It:

1. runs every 6 hours (editable),
2. checks `/api/n8n/admitad/status`,
3. stops with a clear message if Admitad is not configured,
4. imports via `useProgrammeFeed`,
5. summarises `imported / total / duplicates / errors`,
6. routes to an alert or a success log.

Create one credential — **HTTP Header Auth**, header `Authorization`, value
`Bearer <N8N_WEBHOOK_SECRET>` — and attach it to all three HTTP nodes. No
Admitad secret is stored in n8n.

The import route is idempotent per
`(source, advertiser_id, external_product_id)`, so re-running is safe: existing
rows are updated, new ones inserted, duplicates reported. `advertiser_id` is part
of the key because feed product ids are only unique inside one advertiser's feed.

---

## Performance & limits

- Admitad allows **600 requests/minute per application**. The client retries
  `429`/`503`/`error_code 4` with exponential backoff and honours `Retry-After`.
- Imports are sequential by design (one deeplink per row). Use
  `throttleMs` for large feeds and `maxRows` to bound a run.
- Tokens are cached per isolate and refreshed 5 minutes before expiry.
- Catalogue reads are fetch-cached for 300s; `revalidatePath` runs after an
  import so new products appear without waiting.

---

## Future: social automation

The data needed for Canva/Buffer workflows now exists on each product:
`source`, `approval_status`, `availability`, `ai_headline`, `ai_description`,
`image_urls`, `affiliate_url`. Nothing publishes automatically, and image use
remains subject to each programme's terms — see
`docs/AFFILIATE-DATA-POLICY.md`.
