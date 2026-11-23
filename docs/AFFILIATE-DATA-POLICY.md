# Affiliate Data Policy

This is the integrity contract for every product record in Fyndra. It
applies to seed data, admin imports, workflow submissions, and anything a
future integration produces.

## Hard rules

1. **Never fabricate affiliate links.** A destination URL must be a real,
   public listing page on an approved programme's domain. Generated or
   invented tracking links are refused by `validateAffiliateUrl` and never
   opened.
2. **Never fabricate availability.** If a record doesn't know its stock
   state, `availability` is `unknown` and the buy button renders
   accordingly — no optimistic "in stock".
3. **Never fabricate prices or specs.** Every price carries a
   `price_verified_at` timestamp. Specs must be traceable to the source
   listing. An LLM may structure data from a source; it may not create
   facts absent from that source.
4. **Never fabricate testimonials or reviews.** Fyndra shows pros/cons and
   engine reasoning. No star ratings, no review counts, no quotes from
   "customers" that don't exist.
5. **Never fabricate commission figures.** Actual rates live in the
   merchant's reporting portal, not in this app or its copy.

## Where the data comes from

| Field | Allowed sources |
| --- | --- |
| Price | Merchant listing at fetch time, recorded with timestamp |
| Specs / pros / cons | Source listing, structured by a human or workflow with source traceability |
| Availability | Source listing at fetch time, or `unknown` |
| Images | Source listing URLs or approved renders; placeholder SVGs until then |
| Keywords / use cases | Editorial curation — these describe *problems*, and human judgement is expected |
| Affiliate URL | Merchant programme, validated against `affiliate_programs.destination_domain` |

### Admitad imports

Admitad records follow the same rules, with these specifics:

| Field | Source |
| --- | --- |
| Title, description, image, price, currency, availability | The advertiser's feed file, unchanged |
| Original price | The feed's own `oldprice`-style column, and only shown when cheaper than the current price |
| Category | Deterministic keyword rules in `mapper.ts` — never a model |
| Budget tier | Fixed price thresholds |
| Affiliate URL | `GET /deeplink/…`, validated to be on `ad.admitad.com` |
| AI headline / description | Groq, constrained to copy; discarded if it contains numbers not present in the source |

A row without a price, image, source URL or valid tracked link is **not
imported**. It is counted as an error with a reason, not silently dropped.

Import summary counters are the record of what happened: `imported`,
`duplicates`, `skipped`, `errors`. A run that imports nothing is reported as
`blocked` with a cause — never as a success.

## Enforcement points

- `src/lib/affiliate.ts` — HTTPS-only, programme-domain-validated URLs;
  refusals logged and surfaced as a 502, never a silent redirect.
- `/api/go` — refuses to open any URL that fails validation. Click events
  are recorded only after validation passes.
- Seeded records are labelled as seed data in `src/data/seed-products.ts`
  and must be replaced through the admin dashboard or the n8n workflow
  before production launch.
- `src/lib/admitad/mapper.ts` — `productPublishBlockers` refuses incomplete
  records at import time.
- `src/lib/admitad/feed-parser.ts` — rows with no absolute product URL or no
  title are skipped with a stated reason.
- `src/lib/admitad/enrich.ts` — `looksLikeFabrication` discards AI copy that
  introduces unverifiable figures.

## Click tracking

Non-identifying by design: product id, programme, merchant, internal
campaign label, timestamp. No IP, no user agent, no session identifier.
The redirect sends `Referrer-Policy: no-referrer` and `Cache-Control:
no-store`.
