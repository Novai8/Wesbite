# Testing

## Checks run on this branch

| Check | Command | Status |
| --- | --- | --- |
| TypeScript strict | `npx tsc --noEmit` | clean |
| ESLint | `npm run lint` | clean |
| Next.js production build | `npm run build` | 24 routes pass |
| OpenNext Cloudflare bundle | `npx opennextjs-cloudflare build` | worker saved |
| Playwright E2E + axe | `npx playwright test` | 168 passed (4 viewports) |

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
