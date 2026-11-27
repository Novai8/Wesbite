# Fyndra Trending Product Import — 2026-11-27

Status: **blocked on a hard external limit (Oxylabs quota/auth)**. Research, workflow, and audit are complete; the live catalogue is unchanged at 55 approved products, so the 250 net-new target is **not** met. No product was approved without a verified Admitad link.

## Research summary
- Discovery source: Oxylabs Web API — `aliexpress_search` (US marketplace, `aliexpress.us`, USD only).
- Correct-price method: scrape the US domain directly; the generic `aliexpress.us` / `webapi` JSON routes returned SGD/JPY/BRL depending on egress location, so currency is verified per card and any non-USD page is rejected rather than converted.
- Candidate fields read straight from the marketplace card payload: product id, title, USD sale price, USD original price, image, `starRating`, `tradeDesc` (e.g. "5K+ sold" → 5000), category.
- Reviews: not exposed on search cards; stored as `null`, never invented.
- Google Trends was available through Oxylabs (`google_trends_explore`) and works, but was not used for ranking in this run because the scrape budget collapsed before a representative keyword set could be measured.
- Query set (category intent, 27 queries): desk accessories, travel, gaming, kitchen, storage, stationery, phone/USB-C/led/audio/wearables, laptop/peripherals, monitor, travel bags, car, pet, bathroom, bottles, fitness, wall storage, tools, kids, beauty, cooling, seasonal.

### Trend scoring (0–100, reproducible)
- Popularity: `min(100, log10(sold+1) × 25)` using the displayed sold count only.
- Rating: `min(100, max(0,(rating−3.5)/1.5 × 50))`; null rating → 0 and recorded as "not shown".
- Search-demand, review-engagement and growth-weight components are **unavailable** this run (no review count on cards; Oxylabs Trends sample insufficient) and are therefore excluded, not filled with invented values.

## Product counts
- Candidates discovered: 0 net-new this session. 84 rows already exist from an earlier run today (55 approved, 29 pending).
- Duplicates: not computed (dedupe step implemented but never reached; 0 new candidates).
- Rejected: n/a this run.
- Admitad links generated successfully: 0 this run (5 of 5 sampled products linked cleanly in a manual probe, 4 passed `validate_links`, 1 non-affiliate).
- Failed links: 0 this run.
- New Supabase rows: 0. New approved: 0. Total approved catalogue products: 236 on `/discover` (seed + 55 imported).

## Import summary
- Supabase project: `zbogqfmbephhskcdfskr` (`Fydra-Staging`).
- Destination: `public.affiliate_products` (view `catalogue_products` is read-only, never written).
- Dedupe key: existing unique index `(source, advertiser_id, external_product_id)`; importer also checks existing ids/URLs before any link generation.
- Approval: workflow inserts `approval_status = 'pending'`; nothing is auto-approved.
- Batch size: HTTP upsert batches of 10.
- Verification: direct REST counts before and after every run.

## n8n workflow (built and saved this run)
- Workflow: `dXUuO7vwKlGKENS0` — "Fyndra - AliExpress Discovery (verified affiliate)", 26 nodes.
- Flow: manual trigger → run log → Admitad OAuth (scope check) → 27 search queries → Oxylabs scrape (1 page each) → card normalize/gate → dedupe against Fyndra → Admitad deeplink + `validate_links` → verified-only upsert → run summary.
- Node configs validated via n8n `validate_node_config` (5/5 valid).
- Execution `64`: status success, 26s, run log `eca91003…` → `blocked: true`, `blocked_reason` = Oxylabs HTTP 0 (rejected). Executions `63`, `62` likewise wrote no rows.
- Diagnostics: executions without saved run data report `success` with an empty `runData`, so the run log is the source of truth; per-run `saveManualExecutions` / `saveExecutionProgress` are disabled on this instance.

## Blocker
- `OXYLABS_WEB_API_KEY` realtime (`realtime.oxylabs.io`), async (`data.oxylabs.io`) and generic-page scrapes all return **HTTP 401** starting after ~6 successful scrapes. The Web API `search` (a different product) still returns 200.
- The same key worked for search scrapes earlier today and for the account that produced the 84 existing rows, so this is a plan/quota/key-instance limit rather than a malformed request. Nothing is fabricated to work around it.
- Resolution: top up / re-enable the Oxylabs scraping product (or issue a key for it), then run `Fyndra - AliExpress Discovery (verified affiliate)` once — it is idempotent and dedupes against existing rows.

## Deployment
- Repo `Novai8/Wesbite`, branch `release/fyndra-production-nov-2026`, HEAD `aec16c0`.
- Worker `wesbite`, account `3acb6dab492985b5eb1f6b0237437dae`.
- Current production version `7ee8953c-1d1a-4cb5-a815-40c83500335c` (100% traffic), bindings/secrets intact: `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `ADMITAD_CLIENT_ID`, `ADMITAD_CLIENT_SECRET`, `ADMITAD_WEBSITE_ID`, `ASSETS`, `WORKER_SELF_REFERENCE`, plus `CLIP_WORKER_TOKEN`, `GEMINI_API_KEY`, `GROQ_API_KEY`, `OPENROUTER_API_KEY`.
- No deploy was performed: the "Fix branch mismatch" phase explicitly forbids redeploying the unreviewed HEAD that is already live on the wrong database.
- Workers Builds trigger: the wrangler OAuth token in this environment has no Workers Builds / CI scope, so the trigger branch could not be inspected or changed. It still needs auditing to `release/fyndra-production-nov-2026`.

## Live verification (unchanged catalogue)
- `https://www.rapigents.com` 200; `/discover` 200, "236 approved products".
- Product page `ali-3256808198489076` 200: `$1.09`, "Check availability at merchant" for `unknown` stock, affiliate labelled.
- `/api/go?id=857c2b57-21df-45c0-9fad-273b0fcf06e2` → 302 to `https://rzekl.com/g/…` (Admitad AliExpress WW tracking host).
- Sample only; the 250-page crawl was not performed (no new products).

## Blocker 2 — production database identity
- The live Worker (deployed 2026-11-27 16:09) serves rows that match `zbogqfmbephhskcdfskr` (same 84 ids), yet its `SUPABASE_URL` was last updated 14:31 and readback of `SUPABASE_URL` is blocked by the account's `workers (read)`-only secret scope. It cannot be confirmed the Worker points at the intended project.
- Do not run `npx opennextjs-cloudflare deploy` on this HEAD until the secret scope is widened and `SUPABASE_URL` is confirmed as `zbogqfmbephhskcdfskr`; a build from HEAD would push test-oriented config and could reintroduce the earlier outage. The OP's own rule: stop before writing to a potentially wrong database.
