# Deployment

Target: Cloudflare Workers via OpenNext, exactly as configured in the
original repo. The deployment configuration is preserved, not redesigned.

## Build locally

```bash
npm ci
npm run build                      # Next.js production build
npx opennextjs-cloudflare build    # bundle to .open-next/worker.js
```

Both must pass before any deploy. `npm run lint` and `npx tsc --noEmit`
should also be clean.

## Deploy

```bash
npx opennextjs-cloudflare deploy
```

Requires Cloudflare credentials (`wrangler login` or `CLOUDFLARE_API_TOKEN`).
The worker name is `wesbite` (see `wrangler.jsonc`); static assets are
served from the `ASSETS` binding.

**Note:** deploying makes the site publicly visible — this is a
production action and needs explicit human approval. No deploy is run
automatically by any agent or workflow.

## Preview without deploying

```bash
npx opennextjs-cloudflare preview
```

## Environment variables in Workers

Set server-side secrets with `wrangler secret put` (e.g. `GROQ_API_KEY`,
`SUPABASE_SERVICE_ROLE_KEY`, `N8N_WEBHOOK_SECRET`). Never put secrets in
`wrangler.jsonc` `[vars]` — that file is committed.

## What we never touch

DNS records, registrar settings, and Cloudflare custom-domain mappings are
explicitly out of scope. Domain configuration is changed only by the site
owner in the Cloudflare dashboard.
