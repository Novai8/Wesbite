# Environment Variables

All optional except where noted. The app runs fully without any credentials —
every integration degrades gracefully and says so rather than pretending.

| Variable | Required | Scope | Purpose |
| --- | --- | --- | --- |
| `NEXT_PUBLIC_SITE_URL` | recommended | build | Canonical site URL for metadata/sitemap. Defaults to `http://localhost:3000`. |
| `GROQ_API_KEY` | optional | server only | Enables the Groq explanation layer (`/api/recommend`). Without it, explanations are generated deterministically. |
| `SUPABASE_URL` | optional | server only | Enables the Supabase catalogue layer. Without it, the seed catalogue is used. |
| `SUPABASE_ANON_KEY` | optional | server only | Keyed access matching RLS policies for anon. |
| `SUPABASE_SERVICE_ROLE_KEY` | optional | server only | Bypasses RLS for admin write paths. **Never** exposed to the browser; never logged; never committed. |
| `N8N_WEBHOOK_SECRET` | optional | server only | Shared secret for n8n workflow callbacks. When unset, workflow endpoints refuse all traffic (fail closed). |
| `ADMIN_PASSWORD` or Supabase Auth | optional | server only | Gate for `/admin`. Without it, `/admin` is unreachable and says so. |

### Admitad

| Variable | Required | Scope | Purpose |
| --- | --- | --- | --- |
| `ADMITAD_CLIENT_ID` | for Admitad | server only | OAuth client id from store.admitad.com → Settings → Credentials. |
| `ADMITAD_CLIENT_SECRET` | for Admitad | server only | OAuth client secret. **Never** in a `NEXT_PUBLIC_` variable. |
| `ADMITAD_WEBSITE_ID` | for Admitad | server only | Publisher ad-space id. Needed for programme listing, deeplinks and AliExpress availability checks. |
| `ADMITAD_CAMPAIGN_ID` | optional | server only | Default advertiser programme to import. Import routes also accept `campaignId` per request. |
| `ADMITAD_ACCESS_TOKEN` | optional | server only | Pre-obtained bearer token. Used verbatim and **not refreshed**; prefer the client credentials. |
| `ADMITAD_SCOPE` | optional | server only | Space- or comma-separated scopes. Defaults to the documented publisher set. |
| `ADMITAD_FEED_URL` | optional | server only | Pinned feed download link instead of resolving it from the programme object. |

`ADMITAD_ACCOUNT_ID` is **not** used: no endpoint in this integration needs it.
The access token is derived by OAuth, so it is not required either.

See `docs/ADMITAD-INTEGRATION.md` for the connection walkthrough.

### Supabase (as used by the catalogue)

| Variable | Required | Scope | Purpose |
| --- | --- | --- | --- |
| `SUPABASE_URL` | for storage | server only | Project URL. Without it the seed catalogue is served. |
| `SUPABASE_SERVICE_ROLE_KEY` | for storage | server only | Used by the import pipeline and catalogue reads. Bypasses RLS — server only, never logged. |
| `SUPABASE_ANON_KEY` | optional | server only | Present for completeness; the current server reads use the service role. |

## Rules

- Variables prefixed `NEXT_PUBLIC_` are inlined into the client bundle —
  only ever used for non-sensitive values.
- Any key ending in `SERVICE_ROLE_KEY`, `API_KEY` or `SECRET` stays
  server-side. No `process.env` reference to them may appear in a
  `"use client"` module.
- `.env*` files are git-ignored. Documented here, never committed.
- Missing credentials are reported honestly: the UI shows the fallback
  behaviour (deterministic explanations, seed catalogue) and the docs
  describe how to enable the integration. The app never fabricates a
  "connected" state.
