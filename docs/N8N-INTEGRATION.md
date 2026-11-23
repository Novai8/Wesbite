# n8n Integration

Fyndra's catalogue is fed and maintained by six n8n workflows. This document
is the contract between the workflows and the application: endpoints,
payloads, authentication and the approval lifecycle.

## Status

No n8n instance is currently connected. Every integration described here is
**designed and documented but not yet active**. Endpoints that accept
workflow callbacks are authenticated and return `401` when the shared secret
is missing from the environment. The app never pretends a workflow ran when
it did not.

The one workflow with a written, importable definition is
`n8n/fyndra-admitad-import.json` — see
[Workflow 7 — Admitad import](#workflow-7--admitad-import). It is tested
offline but has never been executed against a live Admitad account.

## Authentication

All workflow-facing endpoints require a shared secret header:

```
Authorization: Bearer $N8N_WEBHOOK_SECRET
```

- The secret is set server-side only (`N8N_WEBHOOK_SECRET` env var). It is
  never exposed to the browser.
- Requests without the header, or with the wrong value, get `401` and are
  rate limited like any other traffic.
- When the env var is unset, the endpoints refuse all workflow traffic
  (fail closed) — a missing secret is treated as "no integration", never as
  "allow everything".

## Workflow 1 — Product discovery

Purpose: find candidate products for a category, fetch their public listing
data, and submit them as `pending` records for evaluation.

- Trigger: schedule (e.g. daily) or manual.
- Reads: category slugs from the catalogue.
- Writes: `affiliate_products` rows with `approval_status = 'pending'`,
  `data_source = 'n8n_workflow'`.
- Callback endpoint (planned): `POST /api/n8n/products` with a batch of
  candidate records.

Payload shape per product:

```json
{
  "slug": "gas-spring-monitor-arm",
  "title": "…",
  "description": "…",
  "categorySlug": "desk-setup",
  "merchant": "AliExpress seller",
  "affiliateUrl": "https://aliexpress.com/item/….html",
  "price": 24.5,
  "currency": "USD",
  "sourceUrl": "https://…",
  "keywords": ["monitor arm", "desk"],
  "useCases": ["neck pain", "small desk"]
}
```

Rules the workflow must obey:

- `affiliateUrl` must be a real, public listing URL on an approved programme
  domain. Fabricated tracking links are rejected by the app's URL validator.
- No availability, review or rating claims may be invented. If the listing
  doesn't state something, leave it out.
- Prices are recorded with a `price_verified_at` timestamp of the fetch time.

## Workflow 2 — Product evaluation

Purpose: enrich `pending` products with structured data (specs, pros, cons,
budget tier) and produce a recommendation for the human reviewer.

- Trigger: new `pending` product.
- Writes: spec/pro/con fields on the same `pending` row, plus a
  `evaluation_notes` summary for the reviewer.
- The workflow may use an LLM to *structure* information from the source
  listing, but every field must trace back to the source page. The app
  never accepts LLM-authored facts that don't exist in the source data.

## Workflow 3 — Approval

Purpose: move products through `pending → approved` or `pending → rejected`.
Approval is a human decision made in `/admin`; the workflow only notifies.

- Trigger: admin approval/rejection event.
- Reads: product record.
- Writes: notification (email/Slack via the user's own n8n credentials).
- The app's `/admin` UI is the only place approval status changes. There is
  no endpoint that lets n8n set a product to `approved`.

## Workflow 4 — Content generation

Purpose: draft guide copy and product description polish for editorial
review.

- Trigger: admin request from `/admin`.
- Writes: `content_guides` rows with `status = 'draft'`.
- Nothing generated is ever published automatically. A human publishes from
  `/admin`.

## Workflow 5 — Canva rendering

Purpose: generate product cards / social imagery via the Canva API.

- Trigger: approval event (optional) or manual.
- Reads: product title, price, merchant.
- Writes: image URLs back onto the product record (replacing the
  placeholder SVGs).
- Requires the user's own Canva credentials in n8n; the app stores only the
  resulting public image URLs.

## Workflow 6 — Social publishing

Purpose: post approved picks to social channels.

- Trigger: manual or scheduled, over products approved since last run.
- Reads: approved products marked `ready_for_social` in `/admin`.
- Writes: nothing in the app; posts externally via the user's own channel
  credentials.
- The app records nothing about a post unless the workflow calls back with
  the post URL, which is stored as a non-critical annotation.

## Error handling contract

- Every callback endpoint validates the payload and returns `422` with a
  field-level error list on bad data. The workflow should treat `4xx` as
  "fix the payload", `5xx` as "retry later".
- Rate limits apply (10 requests/min/IP). Workflows should batch.
- All callbacks are logged server-side with their outcome; `/admin`
  surfaces recent activity.

## Workflow 7 — Admitad import

Importable definition: `n8n/fyndra-admitad-import.json`.

Runs on a schedule, checks the integration, imports a programme feed, and
reports a summary. It holds **no Admitad credentials** — those stay in the
Fyndra app. The workflow needs a single HTTP Header Auth credential:

```
Authorization: Bearer $N8N_WEBHOOK_SECRET
```

### Endpoints

| Route | Method | Purpose |
| --- | --- | --- |
| `/api/n8n/admitad/status` | GET | Config presence, AliExpress availability, programme counts |
| `/api/n8n/admitad/aliexpress` | GET | AliExpress WW availability (`?refresh=1` bypasses cache) |
| `/api/n8n/admitad/preview` | POST | Parse a feed with no credentials and no writes |
| `/api/n8n/admitad/deeplink` | POST | Generate + validate one tracked link |
| `/api/n8n/admitad/import` | POST | Run an import |
| `/api/n8n/admitad/enrich` | POST | Generate AI copy for one stored product |

### Import payload

```json
{
  "campaignId": 20523,
  "useProgrammeFeed": true,
  "enrich": true,
  "maxRows": 100,
  "subid": "n8n-admitad"
}
```

`feedText` (inline file contents) or `feedUrl` (a specific signed link) can be
used instead of `useProgrammeFeed`. Signed feed links expire, so
`useProgrammeFeed` is preferred: it re-reads the link from the ad-space
programme object on every run.

### Response contract

- `200` — import ran and produced at least one publishable product.
- `409` — import ran but produced **zero** publishable products. `blockedReason`
  says why; this is not a success.
- `422` — payload problem. Fix and retry.
- `429` — rate limited. Retry after `Retry-After`.
- `502/500` — Admitad or Supabase failure. Retry later.

The response includes `summary` (`totalRows`, `imported`, `duplicates`,
`skipped`, `errors`, `unmappedColumns`, `durationMs`), `persisted`,
`persistReason`, `enriched`, and an `errorSample` of the first ten row
failures. `report.blocked` is `true` whenever nothing was imported.

### Re-run safety

Imports upsert on `(source, external_product_id)`, so re-running updates
existing rows instead of duplicating them. An import never overwrites a
manually curated row (enforced by a database trigger), and AI fields are written
separately so a re-sync cannot erase generated copy.
