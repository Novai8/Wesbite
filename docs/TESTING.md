# Testing

## Checks run on this branch

| Check | Command | Status |
| --- | --- | --- |
| Unit tests (offline) | `npm run test:unit` | 107 passed |
| TypeScript strict | `npx tsc --noEmit` | clean |
| ESLint | `npm run lint` | clean |
| Next.js production build | `npm run build` | 24 routes pass |
| OpenNext Cloudflare bundle | `npx opennextjs-cloudflare build` | worker saved |
| Playwright E2E + axe | `npx playwright test` | 168 passed (4 viewports) |

## Catalogue ACL security tests

Two suites cover the catalogue access-control boundary, and they prove different
things. Neither one substitutes for the other.

| Suite | Needs PostgreSQL | Command |
| --- | --- | --- |
| Static contracts (72 tests) | no | `python -m unittest tests.test_catalogue_acl_static` |
| Live privilege tests (49 tests) | yes, `psql` on `PATH` | `python -m unittest tests.test_catalogue_acl_lockdown` |

### Static contracts

`tests/test_catalogue_acl_static.py` parses the shipped migration and asserts on
statement structure: comments are stripped, statements are split on semicolons
outside literals and dollar-quoted bodies, and then each statement is classified.
It fails if `security_invoker` is turned off, if an event trigger or `rolsuper`
check appears, if a table-wide `SELECT` replaces the derived column grant, if
either default-ACL scope is dropped, if the `TRUNCATE`/`MAINTAIN` revokes are
weakened, or if a function redefinition or `search_path` pin is absorbed into the
lockdown migration.

It also contains parser self-tests, so a parser bug cannot silently turn the
assertions into no-ops.

### Live privilege tests

`tests/test_catalogue_acl_lockdown.py` creates a throwaway database per test
class, applies the real migration files, and checks actual privilege results with
`has_table_privilege`, real `SET ROLE` statements and real `DELETE` attempts. It
needs a role with `CREATEDB`, `CREATE ROLE` and `ALTER DEFAULT PRIVILEGES` -- a
superuser satisfies all three.

```
PGHOST=/path/to/socket PGPORT=5432 PGUSER=postgres \
  python -m unittest tests.test_catalogue_acl_lockdown
```

Run it against PostgreSQL 17 and 18; the `MAINTAIN` path only exists on 17+.

### Skipped is not passed

When PostgreSQL is unreachable the live tests skip, and `unittest` still exits 0
with `OK (skipped=N)`. That is *not* evidence of database security.

`FYNDRA_REQUIRE_DATABASE_TESTS` controls that. It is **optional locally and
mandatory in CI**:

- **Locally it is optional.** Leave it unset and the suite skips cleanly when you
  have no server running, which keeps frontend-only work unblocked. Set it to
  `1` when you do want a missing database to be an error:

  ```
  FYNDRA_REQUIRE_DATABASE_TESTS=1 python -m unittest tests.test_catalogue_acl_static
  ```

- **In the PostgreSQL CI job it is mandatory.** `.github/workflows/fyndra-ci.yml`
  sets `FYNDRA_REQUIRE_DATABASE_TESTS=1` at job level for both matrix entries
  (PostgreSQL 17 and 18), so the static suite fails outright if it cannot connect
  to the service container. The workflow additionally fails the job when the
  integration suite reports anything but "at least 49 tests ran, 0 skipped",
  so a skipped run can never be recorded as a passing security result.

The workflow never relies on the exit code alone, because `unittest` exits 0 for
a fully skipped run. It parses the `Ran N tests` and `OK (skipped=N)` summary
line and rejects a short count or any skip.

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
| `live-affiliate-schema.test.ts` | Migration against the actual live research schema: UUID pk, research columns preserved, exact `on_conflict` target, manual-row protection, AI patches, repeated imports, malformed rows |
| `aliexpress-canonical.test.ts` | Canonical product URLs from feed ids, strict id validation, long-URL replacement, `ulp` limit unchanged |
| `admitad-tracking-domains.test.ts` | `rzekl.com` as a provider tracking host, arbitrary rzekl URLs rejected, bad hosts / HTTP links, `validate_links` requirement, merchant-destination validation |
| `feed-permission.test.ts` | Fail-closed on `show_products_links: false`, no feed read, route returns 403, parsing still testable offline |
| `enrich.test.ts` | Quality flags from record completeness; fabrication guard rejects invented ratings/discounts/counts |

### What is not covered

Live Admitad calls (OAuth, programme listing, deeplink generation, link
validation) and real Supabase writes have **never been executed** — no
credentials were available. They are exercised only through mocks and a mocked
PostgREST surface. The migration SQL itself *has* been executed against a
disposable local PostgreSQL cluster seeded with the live schema; the Supabase
project has not been touched. See the verification section of
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
