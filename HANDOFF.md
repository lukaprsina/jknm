# Handoff: media dedup & thumbnail-flag work (JKNM, d:\dev\js\jknm)

Repo: `d:\dev\js\jknm`, branch `main`, HEAD at commit `3936c99`.
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

## What's still broken: the underlying dedup problem itself

The `uploaded_custom_thumbnail` fix is a **workaround for one symptom**. The
root cause — `Media` rows can silently duplicate the same file — is
untouched and will keep causing this class of bug (thumbnail-vs-content
mismatches are only the one instance that got reported and chased down; the
same split likely affects anything else that tries to reason about "is this
media used elsewhere").

**Agreed plan for the real fix** (explicitly deferred to a separate
session — do not casually fold it into unrelated work, it touches live
storage/data):

0. Back up B2 buckets and the DB before touching anything. One backup
   already exists at `D:\Luka\JKNM\rewrite-28-07-206` — check whether it's
   still current enough before relying on it.
1. Add a content-hash column to `Media`, backfill it for existing rows.
2. Rewrite the upload path to check the hash first and reuse an existing
   `Media` row when one already matches, instead of always inserting a new
   one — this is what stops new duplicates from forming.
3. Write a dedupe script: find `Media` rows sharing a hash, pick a
   canonical row per hash, rewrite every article's `thumbnail_media_id` and
   `content_json` image/attaches block references to point at the
   canonical row, then deal with the now-orphaned duplicate rows (and their
   now-orphaned B2 objects).

The user explicitly wants to do this work **in a staging environment**
(`.env.staging`, not the default `.env.local` this session's scripts used)
"because I don't want to fuck this up too bad" — this is real
production-affecting data (738 articles, real B2 objects). Step 2 (hash
check on upload) should land *before* step 3 (the dedupe rewrite runs),
otherwise new duplicates keep forming while old ones are being cleaned up.

Sequencing note the user hasn't explicitly ruled on: once steps 1–3 land,
`uploaded_custom_thumbnail` becomes *theoretically* recomputable via the
same content-membership check, now made trustworthy by dedup. Don't take
that as license to revert the backfilled/wired column back to a computed
heuristic — the two questions aren't the same fact. `uploaded_custom_thumbnail`
answers "did the user explicitly click the upload button," which happens to
usually but not always coincide with "is this media also in the content."
The JSON ground truth already answers the real question for legacy rows and
doesn't depend on the dedup work succeeding; the dedup work is what would
make the heuristic *usable going forward* for new-site-only articles that
have no legacy ground truth to fall back on at all.

## Files touched / relevant this session

- `src/server/db/schema.ts` — new `uploaded_custom_thumbnail` column.
- `src/server/article/new-article.ts` — `resolve_thumbnail` write path.
- `src/components/article/new-adapter.ts` — `reconstruct_thumbnail_crop`
  read path, null-handling.
- `src/server/article/lifecycle.ts` — `create_superseding_draft` copy path.
- `scripts/audit-custom-thumbnail-heuristic.ts` — diagnostic only, already
  run, not meant to run again as part of normal operation.
- `scripts/backfill-uploaded-custom-thumbnail.ts` — already run with
  `--execute` against the live DB.
- Commit `3936c99` has the full diff and rationale; commit `4312252`
  earlier in the same session fixed unrelated bugs (settings-form date
  picker, calendar year-view navigation) — not part of this story.

## Suggested skills for the next session

- **`domain-modeling`** — worth recording an ADR for "why media has no
  dedup today and what the hash-based fix looks like" before starting
  implementation; this is exactly the kind of decision that should be
  written down once rather than re-derived.
- **`tdd`** — the hash-check-on-upload path and the dedupe script are both
  logic-heavy and currently untested; build them test-first, especially the
  "which row is canonical when hashes collide" and "rewrite all referencing
  articles" logic.
- **`diagnosing-bugs`** — if the dedupe script surfaces more
  content/thumbnail mismatches beyond what's already known, use this to
  drive the investigation rather than ad hoc scripts, so findings stay
  reproducible.
- **`code-review`** — run before committing the hash/dedupe work, same as
  this session's pattern (`/code-review HEAD`), given how much of a diff
  that work will be and the DB-mutation stakes.
