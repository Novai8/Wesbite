# Testing

## Checks run on this branch

| Check | Command | Status |
| --- | --- | --- |
| Unit tests (offline) | `npm run test:unit` | 53 passed |
| TypeScript strict | `npx tsc --noEmit` | clean |
| ESLint | `npm run lint` | clean |
| Next.js production build | `npm run build` | 24 routes pass |
| OpenNext Cloudflare bundle | `npx opennextjs-cloudflare build` | worker saved |
| Playwright E2E + axe | `npx playwright test` | 168 passed (4 viewports) |

## Admitad unit tests

`npm run test:unit` runs the suites in `tests/` with Node's built-in runner.
They are fully offline: `tests/setup.ts` replaces `fetch` with a throwing guard
so a unit test can never quietly depend on Admitad being reachable.

| Suite | Covers |
| --- | --- |
| `feed-parser.test.ts` | CSV quoting/BOM/CRLF/semicolon, XML attributes + CDATA, JSON shapes, column mapping, number formats, skip reasons, `maxRows` |
| `mapper.test.ts` | Category inference, budget tiers, slug stability, dedupe key, currency normalisation, no invented previous prices/pros/specs |
| `import-pipeline.test.ts` | Full pipeline against a mocked Admitad API: dedupe, per-row failures, off-domain rejection, blocked-run reporting |
| `affiliate-safety.test.ts` | Admitad link acceptance, merchant-URL rejection, look-alike host rejection, non-HTTPS, unknown programmes, `outboundPath` |
| `admitad-config.test.ts` | Honest config reporting: missing vars, blank values, static tokens, deeplink capability |
| `supabase-store.test.ts` | `Product` ↔ row round-trip, null tolerance, JSON-string columns, AI fields kept separate |
| `enrich.test.ts` | Quality flags from record completeness; fabrication guard rejects invented ratings/discounts/counts |

### What is not covered

Live Admitad calls (OAuth, programme listing, deeplink generation, link
validation) and real Supabase writes have **never been executed** — no
credentials were available. They are exercised only through mocks and a mocked
PostgREST surface. See the verification section of
`docs/ADMITAD-INTEGRATION.md`.

## Browser verification (done)

Playwright (`playwright.config.ts`, tests in `e2e/`) covers the key
journeys at four viewports — 1440×900, 1280×800, 390×844 and 375×812 —
with axe-core accessibility checks (wcag2a + wcag2aa, zero violations)
and console-error assertions on every static route:

- All 15 static routes render 200 with no console errors
- 404 page renders for unknown products
- Home: centred Fyndra wordmark and static typographic story, no canvas,
  3D, video, scroll rail or scroll-scrubbed animation; category strip →
  filtered discover; one real product from every category in the
  catalogue shelf
- Assistant: full wizard flow → deterministic results with score
  breakdown, remaining budget, alternatives; back navigation preserves
  state
- Setup builder: category chips toggle, budget allocation with
  per-category picks
- Problem solver: problem in → fix + alternative approaches out
- Discover: search narrows results, sort, pagination, and an empty
  state with a distinct "Show the full catalogue" reset so its label
  never clashes with the toolbar's "Clear filters"
- Product page: specs, pros/cons, affiliate link with
  `rel="nofollow sponsored noopener"`
- Compare: pick two, table renders merged spec rows
- `/api/go` guard: 400 without id, 404 for unknown id
- Navigation: header links, skip link first focusable, mobile menu
  opens and navigates at 390×844 and 375×812

Contrast issues found by axe were fixed before merge: `--color-faint`
darkened from `#a8a29e` to `#78716c`, and the dark assistant-preview
band no longer uses a `.panel` background override.

## Manual smoke test

```bash
npm run dev
```

Then exercise `/assistant` end to end without a `GROQ_API_KEY`: results
should arrive from the deterministic engine with `generatedBy:
"deterministic"` and honest reasoning. With a budget set, the remaining
budget should be shown and never silently exceeded.
