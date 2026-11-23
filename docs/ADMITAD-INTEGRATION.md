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
| `tests/*.test.ts` | 53 offline unit tests |

### Routes

| Route | Method | Purpose |
| --- | --- | --- |
| `/api/n8n/admitad/status` | GET | Config presence, AliExpress availability, programme counts |
| `/api/n8n/admitad/aliexpress` | GET | Focused AliExpress WW availability answer |
| `/api/n8n/admitad/preview` | POST | Parse a feed file with no credentials, no writes |
| `/api/n8n/admitad/deeplink` | POST | Generate + validate one tracked link |
| `/api/n8n/admitad/import` | POST | Run an import (inline feed, feed URL, or programme feed) |
| `/api/n8n/admitad/enrich` | POST | Generate AI copy for one stored product |

All require `Authorization: Bearer $N8N_WEBHOOK_SECRET` and are rate limited.

---

## Data model

Products reuse the existing `affiliate_products` contract and gain:

| Column | Purpose |
| --- | --- |
| `source` | `admitad`, `aliexpress`, `manual` |
| `external_product_id` | Admitad feed product id |
| `advertiser_id` | Admitad programme id |
| `original_price` | Pre-discount price, when supplied |
| `commission_info` | Structured provenance (never an estimate) |
| `last_synced_at` | Last successful import |
| `ai_headline`, `ai_description`, `ai_quality_flags` | AI copy, isolated from facts |

Duplicate prevention is a partial unique index:

```sql
create unique index ... on affiliate_products (source, external_product_id)
  where source is not null and external_product_id is not null;
```

Manual edits are protected by the `protect_manual_product` trigger: an automated
upsert cannot take ownership of a `data_source = 'manual'` row, and a manual row
never has its `source`/`external_product_id` rewritten.

RLS: `anon` may read approved products and active programmes only. Every write
path needs the service role, which exists server-side only.

> **Migration caveat.** The migration creates `affiliate_products` if it does not
> exist, using `id text`. If your Supabase project already created this table
> from the older documentation with `id uuid` (nothing in the repo ever did),
> the `create table if not exists` is skipped and imported text ids will not
> insert. Check with `\d affiliate_products` before pushing; if `id` is `uuid`,
> reconcile the column type first rather than forcing the migration.

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

**Proven offline (53 tests, `npm run test:unit`):**

- CSV/XML/JSON parsing: quoted fields, BOM, CRLF, semicolon delimiters, CDATA,
  XML attributes, nested tags.
- Column mapping across the spellings advertisers actually use.
- Number parsing for `1,234.50`, `1 234,50`, `€12.99`.
- Category inference and budget tiers.
- Stable slugs and the `source:external_product_id` dedupe key.
- `Product` ↔ row round-trip, including nulls and JSON-string columns.
- Full import pipeline against a **mocked** Admitad API: dedupe, per-row failure,
  off-domain rejection, blocked-run reporting.
- Affiliate-URL validation, including look-alike host rejection.
- AI fabrication guard.
- Honest configuration reporting (missing vars, blank values, static tokens).

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
6. **Apply the migration** (`supabase db push`, or run
   `supabase/migrations/0001_admitad_integration.sql` in the SQL editor).
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

The import route is idempotent per `(source, external_product_id)`, so re-running
is safe: existing rows are updated, new ones inserted, duplicates reported.

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
