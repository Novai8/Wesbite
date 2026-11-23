# Admitad Publisher API — verified notes

Source: official documentation at `developers.mitgo.com` (the old
`developers.admitad.com` links now redirect there). Every endpoint below was
checked against the published method reference, and the base host was probed
live (`401` on `/advcampaigns/` confirms the path exists and is auth-guarded;
unlisted paths answer `404`).

**Checked:** 2026-11-22.

---

## 1. Authentication — OAuth2 client credentials

```
POST https://api.admitad.com/token/
Authorization: Basic base64(client_id:client_secret)
Content-Type: application/x-www-form-urlencoded

grant_type=client_credentials
client_id=<client_id>
scope=advcampaigns advcampaigns_for_website websites deeplink_generator ...
```

- Scopes are **space-separated**. The `client_id` also appears in the body in
  the documented example.
- Response: `access_token`, `token_type` (`bearer`), `expires_in`
  (`604800` — 7 days), `refresh_token`, `scope`, `group`, `username`.
- Refresh: same URL with
  `grant_type=refresh_token&client_id=…&client_secret=…&refresh_token=…`.
- Credentials live at **store.admitad.com → Account → Settings → Credentials →
  Show credentials**.
- Custom error codes: `0` token expired, `1` invalid token, `2` insufficient
  rights, `3` incorrect request, `4` rate limit exceeded, `5` refresh token
  unavailable, `6` too many tokens.

Implementation: `src/lib/admitad/auth.ts`.

---

## 2. Programmes

| Method | Path | Notes |
| --- | --- | --- |
| GET | `/advcampaigns/` | Catalogue. `offset`, `limit`, `language`, `website`, `has_tool`, `traffic_id`. |
| GET | `/advcampaigns/{id}/` | Single programme. |
| GET | `/advcampaigns/website/{w_id}/` | **Your** programmes. `connection_status=active\|pending\|declined`, `has_tool=products\|deeplink\|…` |

Fields that matter for Fyndra:

- `connected`, `connection_status` — whether *you* may promote it.
- `show_products_links` — product feeds are allowed for this programme.
- `allow_deeplink`, `allowed_deeplink_domains` — deeplink eligibility.
- `products_csv_link`, `products_xml_link`, `feeds_info[]` — **where the product
  data actually lives**.
- `currency`, `regions`, `categories`, `actions`, `site_url`, `rating`.

Implementation: `src/lib/admitad/programmes.ts`.

---

## 3. Product data — the important finding

**There is no product-data REST endpoint in the Admitad Publisher API.**

Verified three ways:

1. The full "Publisher API Methods" index (21 articles) contains no product or
   feed-listing method.
2. Help-centre search for "feed" returns only marketing pages.
3. ~40 candidate paths (`/products/`, `/feeds/`, `/product_feeds/`,
   `/advcampaigns/{id}/products/`, …) all answer `404`.

Product data is therefore obtained the way Admitad intends: from the
**advertiser's feed file**, whose signed URLs are returned on the ad-space
programme object as `products_csv_link` / `products_xml_link` / `feeds_info[]`.
Feed URLs are signed and expire, so they must be re-read from the programme
endpoint rather than stored long-term.

Fyndra's approach: `feed-parser.ts` (CSV/XML/JSON) → `mapper.ts` →
`products.ts` (deeplink per row). No scraping, no invented catalogue.

---

## 4. Deeplinks

```
GET /deeplink/{w_id}/advcampaign/{c_id}/?ulp=<urlencoded source url>&subid=…
```

- `ulp` **required**, max 200 characters, repeatable.
- `subid`, `subid1`–`subid3` max 50 chars; `subid4` max 120. `%00` forbidden.
- Response: `[{ "link": "https://ad.admitad.com/g/…", "is_affiliate_product": true|false|null }]`
- `is_affiliate_product` is only meaningful for AliExpress.

Implementation: `src/lib/admitad/deeplink.ts`.

---

## 5. Link validation

```
GET /validate_links/?link=<urlencoded>
```

Returns `{ "message": "Link successfully tested." }` or an
`error_description` such as `Wrong domain name`, `Wrong link`,
`Advertiser doesn't pay`, `non-affiliated`, `Inactive cooperation status`.

A `200` only means the request was understood — the **message** decides whether
the link is payable. Fyndra treats anything but "success" as a failure and does
not publish that row.

---

## 6. Ad spaces

`GET /websites/v2/` and `/websites/v2/{id}/` → `id`, `name`, `site_url`,
`status`, `validation_passed`. Use this to confirm `ADMITAD_WEBSITE_ID`.

Implementation: `src/lib/admitad/websites.ts`.

---

## 7. AliExpress commission

```
POST /aliexpress/commission_rates/
{ "urls": ["https://…", "…"] }
```

→ `product_name`, `commission_rate`, `hot_commission_rate`, `is_hot`.
Nulls mean "not matched" — never treated as zero.

---

## 8. Statistics

`GET /statistics/{websites|campaigns|dates|actions|months|sources|sub_ids|keywords}/`

Common params: `offset`, `limit`, `date_start`, `date_end` (`dd.mm.yyyy`),
`website`, `campaign`, `subid`, `total` (`1` for aggregated), `order_by`
(prefix `-` for descending).

Implementation: `src/lib/admitad/statistics.ts`.

---

## 9. Limits & requirements

- **600 requests/minute per application.** Exceeding it returns `503` with
  `error_code 4`. The client retries with exponential backoff.
- OAuth tokens last ~7 days; refresh proactively (the client refreshes 5 minutes
  early).
- Programme participation requires the advertiser's approval. `pending` and
  `declined` states are normal and must be surfaced, not worked around.
- Feeds are gated per programme by `show_products_links`; an approved programme
  can still have no feed.
- `attach`/`detach` programme methods are documented as **disabled** (`410`).
  Joining a programme is an account action, not an API action.

---

## 10. Discarded sources

`api.takeads.com` ("Get list of merchants", "Get affiliate link") is a
**different Mitgo product**, not Admitad. Its endpoints and limits do not apply
here and are not used.