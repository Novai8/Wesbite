# Fyndra

**Search by problem, not by product.**

Fyndra is an AI-powered shopping discovery engine. People describe what
they're trying to solve, set a budget, and get products selected around
their actual requirements — with a transparent score and plain-English
reasoning behind every recommendation.

> People search for solutions. The platform finds the products.

## How it works

1. Describe the problem — "my back hurts at my desk all day", not "office chair".
2. Set budget, currency and preferences.
3. The deterministic scoring engine ranks the curated catalogue across six
   axes: relevance, budget fit, features, data quality, price freshness and
   category fit.
4. Every recommendation shows its score breakdown and reasoning. AI may
   rewrite the *explanation* only — it can never invent prices, specs,
   availability or reviews, and never changes scores.
5. Buy from the merchant. Links marked Affiliate earn us a commission; that
   never changes what we recommend. Outbound links are validated against the
   approved affiliate programme domain before they open.

Runs fully without credentials: explanations are generated deterministically
and the seed catalogue backs every page. See
[docs/ENVIRONMENT-VARIABLES.md](docs/ENVIRONMENT-VARIABLES.md) to enable
Groq explanations and the Supabase catalogue layer.

## Install and run

```bash
npm install
npm run dev
```

Production checks:

```bash
npm run lint
npx tsc --noEmit
npm run build
npx opennextjs-cloudflare build
```

The dev server runs at [http://localhost:3000](http://localhost:3000).

## Pages

- `/` — what Fyndra is, how it works, featured catalogue
- `/assistant` — 4-step wizard: describe → budget → preferences → scored results
- `/setup-builder` — one total budget, allocated across categories with a visible breakdown
- `/problem-solver` — describe an annoying daily problem, get the fix
- `/discover` — the full catalogue: search, filters, sort, pagination
- `/products/[slug]` — product detail with verified specs and labelled affiliate link
- `/compare` — up to three products side by side
- `/guides` — how scoring works, briefing the assistant, reading a recommendation
- `/about`, `/contact`, `/privacy`, `/terms`, `/affiliate-disclosure`
- `/admin` — protected dashboard (products, approvals, imports, stats)

## Documentation

| Doc | Contents |
| --- | --- |
| [DESIGN.md](DESIGN.md) | design system: tokens, type, motion rules |
| [docs/BRAND-GUIDELINES.md](docs/BRAND-GUIDELINES.md) | Fyndra brand: voice, colour usage, logo |
| [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) | layered design, AI boundary, data flow |
| [docs/DATABASE-SCHEMA.md](docs/DATABASE-SCHEMA.md) | Supabase tables, RLS, additive migrations |
| [docs/AFFILIATE-DATA-POLICY.md](docs/AFFILIATE-DATA-POLICY.md) | the no-fabrication contract |
| [docs/N8N-INTEGRATION.md](docs/N8N-INTEGRATION.md) | six workflow contracts, auth, payloads |
| [docs/ENVIRONMENT-VARIABLES.md](docs/ENVIRONMENT-VARIABLES.md) | optional credentials, what each unlocks |
| [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md) | Cloudflare Workers via OpenNext |
| [docs/TESTING.md](docs/TESTING.md) | checks run and browser test plan |
| [docs/INSTALLED-DESIGN-RESOURCES.md](docs/INSTALLED-DESIGN-RESOURCES.md) | skills and UI libraries, licences |

## Deployment

Cloudflare Workers via `@opennextjs/cloudflare`, configuration preserved
from the original repo (`wrangler.jsonc`, `open-next.config.ts`). See
[docs/DEPLOYMENT.md](docs/DEPLOYMENT.md).
