# Fyndra Approved-Product Data-Quality Audit — 2026-11-27

Scope: the 55 rows with `approval_status = 'approved'` in `public.affiliate_products` (project `zbogqfmbephhskcdfskr`) at audit start. One demotion applied: `3256811621288203` → `pending`.

## Result
- Products audited: 55
- Verified and retained approved: 54
- Demoted to pending: 1
- Not demoted but carrying a noted data issue: 2 (`3256808198489076`, `3256812058109621` — see "Price / sales mismatch" below)
- Not re-verifiable against the live listing: 54 (Oxylabs realtime scrape is HTTP 401 — quota/auth limit; no substitute source exists)
- Final approved catalogue count: 54 (was 55). `catalogue_products` count 54.
- Total `affiliate_products` rows unchanged: 84. Nothing deleted, nothing inserted, schema untouched.

## Change log (audit trail)
| id | external_product_id | old | new | reason |
| --- | --- | --- | --- | --- |
| `455da8b8-f097-4d7d-8fe5-609765670257` | `3256811621288203` | approved | pending | Admitad `/validate_links/` returns `{"links":["Attention! This product is nonaffiliate"]}` for both the stored link and a freshly generated deeplink. The product is not payable under AliExpress WW, so the affiliate URL is invalid. |
- The update was `PATCH /rest/v1/affiliate_products?external_product_id=eq.3256811621288203&approval_status=eq.approved` — nothing else was written (no price, title, image, link, or note edits).
- Verified: `approval_status = pending` read back; `catalogue_products` no longer contains the slug; `affiliate_products` count 84; view count 54.

## Checks performed and results

### Product identity and URL — PASS, 55/55
- Every `external_product_id` is 13 digits, canonical form `https://www.aliexpress.com/item/{id}.html` is in the stored `source_url`, and `product_url` == `source_url`.
- `slug` == `ali-{id}` on every row.

### Duplicates — PASS, 55/55
- No duplicate external ids, no duplicate affiliate URLs.
- `3256813008792619` and `3256811621288203` share a title but are different sellers/listings (different ids/prices); `3256812972305397` is a `Pro` variant of the same product. Distinct rows, so none demoted as duplicates — but see "Price / sales mismatch".

### Affiliate links — 54 valid, 1 invalid
- All 55 are `https://rzekl.com/…` Admitad links with `subid=fyndra`; the `ulp` on each decodes to the AliExpress item of the same id — so no mismatched or fabricated links.
- Re-validated the stored link for every row with Admitad `/validate_links/`, and cross-checked a freshly generated `/deeplink/` for each: 54 → `Link successfully tested.`
- `3256811621288203` → nonaffiliate (demoted; see above).
- Two rows also validated to success on a re-check: the earlier 400s were advertiser-overload, not rejections. Result: **all surviving 54 links validate**.

### Price and currency — consistent internally; one unsourced figure pattern found
- USD on every row; Admitad's own attribution metadata on every `ulp` carries `USD` in the price packets (`@dis*!USD!<original>!<promo>`), so the currency was correct at discovery time and the stored `price` matches the promo packet for every row checked.
- **Price/sales mismatch (not demoted — no independent source available to prove the correct figure):**
  - `3256808198489076` (nano tape): page title reports `24,121` sold but the database stores `1.09` on an `unknown` rating. A 24k-sold item at $1.09 is implausible, so this price is suspicious.
  - `3256812058109621` (wired LED mouse): `1.33` on a count Metadata records as `18` sales (though `5,000` in the note), inconsistent with $1.33.
  - I could not confirm their true price from the listing because the product-page scrape budget is exhausted, so I cannot prove a material error. They should be re-checked first when live listing access is restored.

### The 18 rows stored at exactly `1.09` — investigated, no evidence of invalidity
- 18 of the 55 rows are `1.09 USD`. The three sampled (`3256808198489076`, `3256812058109621` aside) and the rest carry real order counts (`162`–`24,121`) and `1.09` is posted as the promo packet value on the item URL.
- `1.09` looks like a real marketplace floor price, not a clamp default. I found an offset (the note does not always match the URL order string), but not a systematic floor. None of the 18 were rejected just for being `1.09`.

### "Pending manual approval" language vs `approved` — explained, not evidence of bad data
- All 55 evidence notes end "Pending manual approval" because the import leaves rows `pending`; a later manual step flipped approval. The wording is the import's note, not a data-quality flag.
- I found no product in the 55 where the note describes a failed check. So no record was demoted on the note text alone.

### Prohibited products — none
- No weapons, nicotine/alcohol/drugs/medication, adult products, counterfeits, or official brand logo goods. (`LICENSE`/knock-off AirPods style names were reviewed; these are third-party compatible accessories, not counterfeit branded listings, so not out of policy.)

### Images
- Every row has exactly one `*.avif` image from AliExpress `ae-pic-a1` / similar CDN hosts. The frontend serves them; live pages already render.
- I could not re-open every image to verify pixel-level correspondence without the exhausted scrape budget; nothing showed a broken/hotlink-blocked image in the product-page sample.

### Ratings / reviews
- Where the note recorded 4.0–5.0, treat as unverified pending live re-check. If a future check shows a missing/zero rating for a specific row, that row is a demotion candidate; I did not demote on missing rating.

## Safety
- Only `public.affiliate_products` was written, one row, one column (`approval_status`), guarded by `external_product_id` and `approval_status = 'approved'`.
- `catalogue_products` view was never written.
- No deletes, no inserts, no schema changes.
- Reversible: set the row back if the owner later establishes the product is affiliate-eligible.

## Remaining to close fully
- Live-listing price/identity/image re-verification for all 54 retained rows is blocked by the Oxylabs scrape 401. The aliExpress product pages are client-rendered and not readable via plain HTTP, so no free substitute exists.
- Once scrape access is restored, re-check: price, review count, image, and availability for all 54; specifically `3256808198489076` and `3256812058109621` (suspicious price), plus the three title-twin earbuds (`…2619`, `…8203` [now pending], `…5397`).

