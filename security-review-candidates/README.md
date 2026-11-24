# Archived ACL-review candidates -- do not apply

These files are **rejected, historical review artifacts**. They are kept only as
evidence of the review that produced the canonical migration, and so the
canonical regression suite can prove the rejected design fails its assertions.

**Nothing in this directory may be applied to any database.** No migration
runner reads it, and no test discovery path includes it.

## Never applied

- These are not in `supabase/migrations/`. The only active migration for this
  work is `supabase/migrations/20261124130000_fyndra_public_acl_lockdown.sql`.
- They must not be copied into `supabase/migrations/`, `supabase/seed.sql`, or
  any deploy path.
- They must not be run by hand against Supabase, staging, or production.

## Why they are retained

`tests/test_catalogue_acl_lockdown.py` reads
`archived/20261124130000-concurrent-rejected/20261124130000_fyndra_public_acl_lockdown.sql`
as a **negation control**. It asserts that the rejected implementation fails
open (it aborts on its own superuser guard, leaving `anon DELETE` granted), so
the canonical assertions cannot silently rot into no-ops. If that file is
deleted, that single test reports as skipped rather than passing vacuously.

## Contents

| Path | Status | Policy |
| --- | --- | --- |
| `archived/20261124120000-original-12000/` | superseded | first revision; inserted the incident |
| `archived/20261124120000-revised-12000/` | accepted design | canonical SQL derives from this design, re-issued under the `20261124130000` filename |
| `archived/20261124130000-concurrent-rejected/` | **rejected** | concurrent implementation; required by the negation-control test |
| `archived/20261124120000-admitad-fyndra-acl-candidate/` | superseded | earlier review copy; the `20261124120000-revised-12000` archive is authoritative |

The canonical migration uses no event trigger and requires no superuser. The rejected `archived/20261124130000-concurrent-rejected/` candidate does use one; that, plus its superuser requirement, is why it was rejected.

## Integrity

Byte-for-byte recording. `sha256` of each file is listed in the final review
report. Do not re-save, reformat, or "fix" these files: their value is that they
are exactly what was reviewed.