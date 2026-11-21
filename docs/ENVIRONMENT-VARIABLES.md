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
