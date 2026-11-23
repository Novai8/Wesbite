@AGENTS.md

# Fyndra — project notes for agents

Fyndra is an AI-powered affiliate shopping discovery engine ("Search by
problem, not by product."). It replaced the Rapigents portfolio in this
repo. Stack: Next.js 16 App Router, React 19, Tailwind 4 (tokens in
`src/app/globals.css` via `@theme inline`), deployed to Cloudflare Workers
via `@opennextjs/cloudflare`.

## Non-negotiable rules

- **Never fabricate data.** No invented affiliate links, prices, specs,
  availability, testimonials, reviews or commission figures. See
  docs/AFFILIATE-DATA-POLICY.md — it is enforced in code
  (`src/lib/affiliate.ts`, `/api/go`).
- **AI never creates product facts.** The scoring engine
  (`src/lib/recommendation-engine.ts`) is deterministic. AI (Groq) only
  rewrites explanation text, and only when `GROQ_API_KEY` is set.
- **Never expose secrets.** Service-role keys and API keys stay
  server-side; `.env*` files are never committed.
- **Never touch DNS, registrar, or Cloudflare custom-domain mappings.**
- **Supabase migrations are additive only** — never reset or drop existing
  tables. See docs/DATABASE-SCHEMA.md.
- Outbound affiliate clicks only via `/api/go` (validated 302, no-store,
  no referrer, non-identifying click log).

## Conventions

- Design tokens live in `src/app/globals.css`; brand config in
  `src/lib/site.ts` (single source of truth for name, tagline, nav, links).
- All catalogue reads go through `src/lib/catalogue.ts` — the seed/Supabase
  swap point.
- Server components by default; `"use client"` only where interaction
  requires it. CSS animations are transform/opacity only.
- The homepage is a typographic, scroll-story page: a saturated blue
  stage, a centred `Fyndra` wordmark, then editorial rooms for discovery,
  the category shortlist, the method and the final call to action. The
  homepage supplies its own masthead; `ChromeGate` suppresses the global
  header on `/`. There is no 3D, video or scroll-scrubbed animation on the
  homepage — keep it static, fast and reduced-motion friendly.
- Docs live in `DESIGN.md` and `docs/`. Keep them current when behaviour
  changes.
