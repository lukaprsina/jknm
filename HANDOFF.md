# Handoff: media dedup & thumbnail-flag work (JKNM, d:\dev\js\jknm)

Repo: `d:\dev\js\jknm`, branch `main`, HEAD at commit `26a69fd` (this doc's own commit; the fix itself landed in `3936c99`).
Read `AGENTS.md` and `CONTEXT.md` at repo root first — they're the standing
domain/agent-skill docs and this doc assumes you already have them.

## The core problem: media has no dedup, and that breaks more than storage

`Media` rows (`src/server/db/schema.ts`) are content-addressed in spirit —
comments in the codebase call media "immutable, decoupled (#18): every
upload gets a fresh URL" — but there is **no actual dedup**: no hash column,
no upload-time check for "do we already have this file." Two different
`Media` rows can hold byte-identical images with no way to know it from the
schema.

This isn't hypothetical. Concrete proof, from `Article.legacy_id = 1`
("Potop v termalni izvir"): its `thumbnail_media_id` points at `Media` row
`8987136f-1105-4296-bc92-323e8f00c9ba`
(`gradivo.jknm.org/8987136f-.../original.jpg`). One of the article's own
`content_json` image blocks, captioned "Razpoki v steni" — visibly the same
photo the thumbnail is a crop of (matches the legacy filename
`2_razpoki_v_steni.jpg`) — points at a **different** row,
`0257131b-4765-4dfb-8c6c-c1a6583d1dcb`. Same picture, two unrelated UUIDs.
This happened during the historical rehosting/migration onto the current
`gradivo.jknm.org/<uuid>/original.jpg` scheme, which didn't dedupe a photo's
"used as thumbnail crop" copy against its "embedded in content" copy.

**Why this matters beyond wasted storage**: any code that tries to answer
"is this thumbnail also one of the article's content images" by comparing
`Media` ids or URLs will get it wrong, because the split happened at the
`Media`-row level, not at the "is it the same photo" level. This was proven
empirically, not just reasoned about — see below.

## What broke because of it: the thumbnail-picker bug

Bug report: "when I make a draft from a published article, open settings,
the already-published thumbnail isn't shown as selected in the image
picker."

Root cause chain:
- `src/app/uredi/[draft_id]/image-selector.tsx` only shows a thumbnail as
  already-selected if it's either (a) one of the article's own embedded
  content images, or (b) flagged `uploaded_custom_thumbnail` on the
  client-side `ThumbnailType` (`src/lib/validators.ts`).
- That flag *was* already being sent client→server on every save (part of
  the `thumbnail_crop` payload) but `resolve_thumbnail` in
  `src/server/article/new-article.ts` silently dropped it — no column
  existed to persist it in.
- So every fresh read (`reconstruct_thumbnail_crop` in
  `src/components/article/new-adapter.ts`) produced a `ThumbnailType`
  missing the flag, which defaulted to "not custom." A custom-uploaded
  thumbnail (not one of the article's embedded images) could never be
  recognized as already-selected after a fresh page load — exactly what a
  pencil-to-edit (`create_superseding_draft`) navigation is.

The natural instinct — "just recompute the flag: check whether the
thumbnail's `Media` row is referenced anywhere in the article's own
content" — **does not work**, and this was verified empirically, not
assumed:

- `scripts/audit-custom-thumbnail-heuristic.ts` (already run, output
  committed at `artifacts/custom-thumbnail-heuristic-audit.json`) compared
  that content-membership heuristic against real historical ground truth
  (see next section) for 589 articles with both a thumbnail and a known
  legacy answer. **The heuristic agreed on only 22 of 589 (96%
  disagreement).** That's not "the old data was mostly custom uploads" —
  it's the heuristic being wrong almost every time, because of exactly the
  `Media`-row-split problem above.

## The fix that shipped this session (commit `3936c99`)

Since recomputation doesn't work, the fix uses **real historical ground
truth** instead of a heuristic:

- `scripts/articles.json` — the pre-rewrite export — still carries the
  actual `uploaded_custom_thumbnail` flag per article from before the
  rewrite dropped the column, keyed by the JSON's `old_id` field (which is
  what today's `Article.legacy_id` was reconciled to point at — see
  `scripts/fix-legacy-ids-final-reconcile.ts` for why `id` in that JSON is
  the *wrong* key to use).
- Added `Article.uploaded_custom_thumbnail` (nullable boolean,
  `src/server/db/schema.ts`) and backfilled it for all legacy-matched
  articles via `scripts/backfill-uploaded-custom-thumbnail.ts` (dry-run by
  default, `--execute` to apply; already run for real — 590 rows updated:
  18 `true`, 572 `false`; plan output at
  `artifacts/backfill-uploaded-custom-thumbnail-plan.json`). Rows with no
  `legacy_id` or no match in the JSON (148 of them) were deliberately left
  `null` ("unknown") rather than guessed.
- Wired the column through the live path so it stops going stale for
  anything saved from now on: `resolve_thumbnail` (write),
  `reconstruct_thumbnail_crop` (read — and note: `null`/"unknown" defaults
  to `true`, not `false`, specifically because defaulting to "not custom"
  would silently reintroduce this exact bug for those 148 rows; caught by
  this session's `/code-review` before commit), and
  `create_superseding_draft` (copies the flag onto a fresh superseding
  draft alongside the other `thumbnail_*` fields it already copies).

Full detail of *why* each piece is shaped the way it is lives in the doc
comments at each call site and in the commit message of `3936c99` — not
duplicated here.

## Media dedup: resolved

The underlying dedup problem described above (`Media` rows silently
duplicating the same file) is fixed, on both staging and production:

0. Full `pg_dump` backups taken before touching production
   (`D:\Luka\JKNM\rewrite-backups\prod-pre-media-hash-*.dump`).
1. `Media.hash` (sha256 of the original bytes) added and backfilled for
   every row, via `scripts/analyze-media-duplicates.ts --execute`.
2. `ingest_media()` (`src/server/media/ingest.ts`) now hashes incoming
   bytes first and reuses an existing row on a match instead of always
   inserting a new one — this is what stops new duplicates from forming.
   A unique constraint on `Media.hash` plus an `onConflictDoNothing`
   fallback closes the race between two concurrent uploads of identical
   bytes.
3. `scripts/dedupe-media.ts --execute` rewrote every affected article's
   `thumbnail_media_id`/`content_json` to point at the canonical row (28
   duplicate groups, 34 rows, 15 articles on both environments); the 34
   now-unreferenced duplicate rows and their B2 objects were then deleted.

Note on sequencing that mattered in practice: `dedupe-media.ts` only
*unlinks* duplicates by design (it defers deletion to
`scripts/sweep-stale-content.ts`'s 48h grace window, reusing already-working
deletion code). Pushing the unique constraint on `Media.hash` requires the
duplicate rows to actually be gone first, so on production this needed one
extra manual step — deleting exactly those 34 already-verified-unreferenced
rows — rather than waiting out the grace window or running the general
sweep script (which would have also hard-deleted ~45 unrelated soft-deleted
articles, out of scope for this work).

Sequencing note on `uploaded_custom_thumbnail`: now that dedup is trustworthy,
`uploaded_custom_thumbnail` becomes *theoretically* recomputable via the
same content-membership check. Don't take that as license to revert the
backfilled/wired column back to a computed heuristic — the two questions
aren't the same fact. `uploaded_custom_thumbnail` answers "did the user
explicitly click the upload button," which happens to usually but not
always coincide with "is this media also in the content." The JSON ground
truth already answers the real question for legacy rows; dedup is what
makes the heuristic *usable going forward* for new-site-only articles that
have no legacy ground truth to fall back on at all.

## Files touched / relevant

- `src/server/db/schema.ts` — `uploaded_custom_thumbnail` column; `Media.hash`
  column + unique constraint.
- `src/server/article/new-article.ts` — `resolve_thumbnail` write path.
- `src/components/article/new-adapter.ts` — `reconstruct_thumbnail_crop`
  read path, null-handling.
- `src/server/article/lifecycle.ts` — `create_superseding_draft` copy path.
- `src/server/media/ingest.ts` — upload-time hash dedup in `ingest_media()`.
- `scripts/analyze-media-duplicates.ts` — hash backfill + duplicate-group
  detection, already run with `--execute` on staging and production.
- `scripts/dedupe-media.ts` — already run with `--execute` on staging and
  production.
- `scripts/audit-custom-thumbnail-heuristic.ts` — diagnostic only, already
  run, not meant to run again as part of normal operation.
- `scripts/backfill-uploaded-custom-thumbnail.ts` — already run with
  `--execute` against the live DB.
- Commit `3936c99` has the `uploaded_custom_thumbnail` diff and rationale;
  commit `e15ecc7` has the upload-time hash dedup.

## Still open, deliberately left alone

- One orphaned, unreferenced media file — a cave photo ("astinova jama",
  `ce94bf52-2471-4ba2-8193-dafce744b7e9`) — sits in the `jknm-gradivo-orphaned`
  B2 bucket with no `Media` row and no article reference. Identified but its
  fate (delete / re-link / leave in quarantine) was explicitly left
  undecided.
- `jknm-gradivo-orphaned` itself (the ~8,647-object bucket of pre-rewrite
  legacy keys and confirmed-duplicate re-upload artifacts moved out of the
  live bucket) is being kept around rather than purged, for now.
