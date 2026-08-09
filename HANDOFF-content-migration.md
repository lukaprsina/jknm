# HANDOFF — static pages → articles migration

Picks up after chartering a Wayfinder map for migrating the 5 `src/app/(static)/` MDX pages into the `articles` table. **The plan itself lives on the issue tracker, not here** — read that first:

- **Map**: [#33 — Migrate static content pages into the articles table (article_kind: content)](https://github.com/lukaprsina/jknm/issues/33). Has Destination, Notes, every decision made so far (schema field shape, media pipeline, migration mechanism, rollout, cutover, UI parity), the open "Not yet specified" fog, and "Out of scope" boundaries. Read this in full before doing anything — it's the source of truth, this doc isn't.
- **Related**: [#30 — Rewrite table of contents](https://github.com/lukaprsina/jknm/issues/30) — reopened during this session (TOC still doesn't render, still missing H1 per `TODO.md`). Not a blocker for #33, just related.
- **Background research**: `docs/research/static-sites-to-articles-migration.md` — the pipeline/schema investigation that fed the grilling session (inventory of the 5 pages, EditorJS block-type coverage, `ingest_media` capabilities, PDF-hosting gaps).

No child tickets exist under #33 yet — the map itself has a note in its body saying that's intentional ("single issue for now, subissues later").

## What isn't in the codebase or the issue

Facts surfaced this session that a fresh agent won't get from reading source alone:

**Env / staging setup** (`.env.local` and `.env.staging`, both gitignored — do not commit or print their contents in full):
- Staging is already provisioned: a separate Supabase Postgres project and a cloned Algolia index (`published_article_staging`, same Algolia app id as prod). Run any command against staging via `dotenv -e .env.local -e .env.staging --override -- <command>` — the `--override` flag is required or dotenv-cli silently ignores `.env.staging` and runs against prod.
- B2 buckets are **not** split between staging and prod — same bucket names, same credentials, in both `.env.local` and `.env.staging`. This was a deliberate call (see #33's Notes): `ingest_media` is idempotent/content-addressed by sha256, so writes during a staging trial are real, wanted prod media, not throwaway.
- Relevant bucket env vars (names only, not secrets): `NEXT_PUBLIC_AWS_MEDIA_BUCKET_NAME=jknm-gradivo` (main media table target), `NEXT_PUBLIC_AWS_STATIC_BUCKET_NAME=jknm-vsebina` (old static-site bucket, being retired — see #33), `NEXT_PUBLIC_AWS_PUBLISHED_BUCKET_NAME=jknm-novice`.
- A local rsync mirror of the `jknm-vsebina` bucket (pulled via the B2 CLI) exists at `artifacts/b2-mirror/vsebina` — useful for the migration script to read source assets without hitting B2 for every file, though note the "Migration mechanism" decision on #33 leans toward driving the *live app's* paste/ingest path rather than a bespoke local-file uploader.

**User's working preferences** (not written down anywhere else):
- Migration/one-off scripts should default to a dry-run mode — log intended actions to a temp `.json` — with real DB/B2 writes wired in last, once the dry-run output has been checked. This is a general habit, not specific to this migration.
- Prefers a single main tracker issue over a pile of subissues until the work actually forks — don't over-ticket #33 preemptively.

## Suggested next step

Per #33's "Not yet specified" section, the most sharply-specified open item is the call-site audit (`sitemap.ts`, `si/[...path]/route.ts`, `legacy-si-paths.ts`, `static-nav-sections.ts`, `header.tsx`, `static_to_algolia.ts`, `/arhiv`, Algolia sync — everywhere that currently assumes every published article is news). That's ticket-able as a `wayfinder:research` child issue as-is. The `zgodovina` migration pilot (largest/most complex of the 5 pages) is the other natural starting point once the migration-script mechanics are nailed down.

## Suggested skills

- `/wayfinder` — resume work on map #33: pick or create the next child ticket, work it, record the resolution back onto the map. This is the primary skill for continuing this effort.
- `/research` — for the call-site audit ticket, and any other fact-finding against the codebase before it's sharp enough to decide.
- `/grilling` + `/domain-modeling` — for any ticket that turns out to be a live decision rather than a fact-find (e.g. exact `article_kind` migration shape, table-fidelity handling).
- `/prototype` — if the Playwright-driven-paste migration mechanism needs a quick spike to check it's actually viable before committing to it as the real approach.
