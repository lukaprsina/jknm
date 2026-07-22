# Appendix: `published_article`/`draft_article` deprecation audit

> **Status: historical snapshot — fully executed. Do not read as current state.**
>
> This is a point-in-time inventory taken 2026-07-18. Since then the cutover (#23/#24), the
> legacy-stack deletion (#26/#27), and the physical schema drop (`drizzle/0006_clammy_echo.sql`,
> 2026-07-22) have all landed: `published_article`, `draft_article`, their join tables, and
> `duplicate_article_urls` no longer exist, and the one-shot `scripts/migrate-legacy-*` tooling
> that produced the migrated data is deleted. Everything in this document is kept for
> archaeology: why the tables looked the way they did and what had to be ported.
>
> For current architecture see `docs/architecture.md`.

This is a research note, not an ADR — no ADR in this directory covers the
articles-table consolidation yet (the decision itself was made and largely
*executed* through GitHub issues #8/#9/#13/#16–#22, not through a `docs/adr/`
entry). This document is the concrete "as-is" inventory an eventual ADR
("retire `published_article`/`draft_article`") would cite: every code path
that touches the two legacy tables, the actual staging data footprint, and
what's already been ported vs. what's still outstanding. All citations are
`file:line` against the `rewrite` branch as of 2026-07-18, or live query
results against the `.env.staging` database (read-only `count`/`group by`
queries only — no rows were inserted, updated, or deleted).

## 0. Headline finding: the migration already ran on staging

Before reading the rest of this document: the target state isn't
hypothetical. `scripts/migrate-legacy-articles.ts` exists, is complete, and
**has already been run against staging**. A read-only count query
(`db.select({ n: count() })` grouped by status, no mutations) returned:

```json
{
  "legacy": {
    "published_article": 690,
    "draft_article_total": 3,
    "draft_article_with_published_id": 2,
    "draft_article_standalone": 1
  },
  "unified": {
    "articles_total": 694,
    "articles_by_status": [
      { "status": "published", "n": 691 },
      { "status": "draft", "n": 3 }
    ],
    "articles_with_legacy_id": 693,
    "article_slugs": 691,
    "articles_to_authors": 718,
    "media": 4990,
    "media_to_articles": 4298
  },
  "shared": { "author": 127 }
}
```

`690 + 3 = 693 = articles_with_legacy_id` — **every** legacy row (all 690
`published_article` rows and all 3 `draft_article` rows) has a migrated
counterpart in `articles` on staging. The one non-legacy `articles` row
(`694 - 693 = 1`) is a genuinely new article created directly through the new
editor path (no `legacy_id`). No `archived`/`deleted` rows exist yet (nobody
has exercised that lifecycle on staging). `duplicate_article_urls` is empty
(0 rows) on staging right now.

**This means the blocking work is not "write a migration" — it's already
written and staging-proven. What's outstanding is (a) running it for real
against production, and (b) issue #23's cutover** (see §3), which is only
partially done: `/novica/<slug>` already prefers the new table
(`src/app/novica/[published_url]/page.tsx:128-154`), but several other read
paths still hard-query the legacy tables exclusively (§2.6).

## 1. Schema definition

Both legacy tables and the new unified schema live side-by-side in the same
file, `src/server/db/schema.ts`, added as "additive alongside
PublishedArticle/DraftArticle" per the comment at line 357-358.

### 1.1 `PublishedArticle` (`published_article`) — `src/server/db/schema.ts:64-94`

Columns: `id` (serial PK), `old_id` (integer, nullable — from the 2008-site
converter), `title`, `url` (article slug, NOT unique at the DB level —
uniqueness is soft-enforced by `find_available_slug`/`sync_duplicate_urls`),
`created_at`, `updated_at`, `content` (jsonb `ArticleContentType`, EditorJS
blocks), `content_preview` (text), `thumbnail_crop` (json `ThumbnailType`).
One index: `p_created_at_idx` on `created_at` (line 83-86).

Relations (`src/server/db/schema.ts:89-94`): `many(PublishedArticlesToAuthors)`.

### 1.2 `DraftArticle` (`draft_article`) — `src/server/db/schema.ts:100-122`

Columns: `id` (serial PK), `published_id` (integer, **unique**, FK →
`PublishedArticle.id`, nullable — null means a standalone/never-published
draft), `title`, `created_at`, `updated_at`, `content`, `content_preview`,
`thumbnail_crop`. Index: `d_created_at_idx` on `created_at` (line 119-121).

Relations (`src/server/db/schema.ts:124-133`): `many(DraftArticlesToAuthors)`
+ `one(PublishedArticle)` via `published_id`.

**This FK is the "copy-on-publish/unpublish dance" CONTEXT.md refers to**:
`draft_article.published_id` is the only link between the two tables, and
every transition (publish, unpublish, delete) is a manual copy across this
seam rather than a status flip on one row — traced in §3.

### 1.3 `DuplicatedArticleUrls` (`duplicate_article_urls`) — `src/server/db/schema.ts:96-98`

Single-column table (`url`, PK), no FK — a materialized "these
`published_article.url` values collide" cache, fully rebuilt by
`sync_duplicate_urls()` (§2.4). 0 rows on staging currently.

### 1.4 Join tables — `src/server/db/schema.ts:148-222`

- `PublishedArticlesToAuthors` (`p_articles_to_authors`, lines 148-171):
  composite PK `(published_id, author_id)`, both FKs `onDelete: "cascade"` —
  `published_id` → `PublishedArticle.id`, `author_id` → `Author.id`. Plus
  `order`.
- `DraftArticlesToAuthors` (`d_articles_to_authors`, lines 187-208): same
  shape, `draft_id` → `DraftArticle.id`, `onDelete: "cascade"`.

`Author` itself (`src/server/db/schema.ts:138-146`) is **not** legacy — it's
shared unchanged by both the old and new schema (`ArticlesToAuthors` also FKs
into it, line 549). Dropping `published_article`/`draft_article` does not
touch `Author`.

### 1.5 Zod schemas coupled to the legacy tables — `src/server/db/schema.ts:224-266`

`CreateDraftArticleSchema`, `SaveDraftArticleSchema`, `PublishArticleSchema`
are hand-written Zod object schemas (not `drizzle-zod`-derived — there is no
`drizzle-zod` dependency in this repo) that mirror the legacy columns and are
imported by `src/server/article/validators.ts:3` to build
`save_draft_validator`/`publish_validator`.

### 1.6 The new schema (already built, additive) — `src/server/db/schema.ts:357-571`

`article_status_enum` (`draft`/`published`/`archived`/`deleted`, line
360-365), `media_upload_status_enum` (line 367-372), `Media` (line 395-413,
immutable — `original`/`variants`/`srcsets`/`blur_placeholder`), `Article`
(line 415-457, uuid PK, `status`, `content_json`, `thumbnail_media_id` +
percentage crop columns, `supersedes_id` self-FK for the
archived/published→superseding-draft chain, `legacy_id` unique nullable
integer — the migration's idempotency key), `ArticleSlug` (line 478-503,
many-to-one, `is_primary` flag), `MediaToArticles` (line 505-521),
`ArticlesToAuthors` (line 541-571). This is the destination schema — see §7
for how it maps to `jknm-convex`'s design.

## 2. Every code reference, classified read/write/plumbing

42 files under `src/` reference `PublishedArticle`/`DraftArticle`/
`DuplicatedArticleUrls` (confirmed via `rg 'PublishedArticle|DraftArticle|DuplicatedArticleUrls' src`).
Grouped by role:

### 2.1 Legacy write paths (mutate the legacy tables) — `src/server/article/`

- `create-draft.ts` (`src/server/article/create-draft.ts:1-188`) — `"use
  server"`. Reads `PublishedArticle`/`DraftArticle`, writes `DraftArticle` +
  `DraftArticlesToAuthors`, copies S3 thumbnails
  published→draft (`s3_copy_thumbnails`, line 141-150).
- `save-draft.ts` (`src/server/article/save-draft.ts:1-69`) — writes
  `DraftArticle` + replaces `DraftArticlesToAuthors`.
- `publish.ts` (`src/server/article/publish.ts:1-465`) — the full
  copy-on-publish: deletes old published S3 dir (line 84-89), upserts
  `PublishedArticle` (line 385-404), replaces
  `PublishedArticlesToAuthors` (line 407-419), **deletes the `DraftArticle`
  row** (line 422-431) and its S3 dir, then pushes to Algolia
  (`ALGOLIA_PUBLISHED_ARTICLE_INDEX`, line 449-458).
- `unpublish.ts` (`src/server/article/unpublish.ts:1-142`) — the inverse
  copy: deletes the Algolia object (line 517-529), upserts a `DraftArticle`
  row from the `PublishedArticle`'s data (line 552-566), **deletes the
  `PublishedArticle` row** (line 568-570), copies S3 thumbnails back.
- `delete.ts` (`src/server/article/delete.ts:1-769` in this read — three
  exports): `delete_draft` (draft-only delete), `delete_both` (deletes both
  rows + Algolia object), `delete_custom_thumbnail` (S3-only, no DB write).
- `sync-duplicate-urls.ts` (`src/server/article/sync-duplicate-urls.ts:1-49`)
  — truncates and rebuilds `DuplicatedArticleUrls` from a full scan of
  `PublishedArticle.url`.

### 2.2 Legacy read paths — `src/server/article/get-article.ts:1-150`

`get_article_by_published_id`, `get_article_by_published_url`,
`get_article_by_draft_id` — all query `PublishedArticle`/`DraftArticle`
directly (lines 31-59, 61-112, 114-150). These sit **alongside** the new
`get_article_by_new_id`/`get_new_article_by_slug` (lines 152-174) added for
issue #20.

### 2.3 New (already-built) write/read paths — parallel implementation

- `src/server/article/new-article.ts` (429 lines) — `create_article`,
  `save_article`, `publish_article` (first-publish **and**
  supersede-publish, with the slug-inherit-or-demote rule in
  `resolve_supersede_publish_slug`, lines 71-144), all operating purely on
  `Article`/`ArticleSlug`/`ArticlesToAuthors`/`Media`. No legacy table
  touched.
- `src/server/article/lifecycle.ts` (205 lines) — `archive_article`,
  `delete_article` (soft delete via status flip), `create_superseding_draft`.
  Legacy tables have **no equivalent of `archived`** — this status has no
  legacy analogue at all.
- `src/server/article/lifecycle-rules.ts` (pure functions, no DB) — status
  transition guards (`assert_can_archive`, `assert_can_delete`,
  `assert_can_supersede`), `decide_slug_transition`, `is_visible_to`,
  `get_archive_origin_label`. Unit-tested in
  `src/server/article/lifecycle-rules.test.ts`.
- `src/server/article/reconcile-media.ts` — diffs `media_to_articles`
  against `content_json`'s referenced URLs; new-schema-only, no legacy
  analogue (legacy content just embeds S3 URLs with no join table).
- `src/server/article/article-queries.ts` — `find_article_with_relations`,
  the shared "load an `Article` with its usual relations" helper used by
  both `new-article.ts`, `lifecycle.ts`, and the migration script.
- `src/server/article/authorized-mutation.ts` — `run_authorized_mutation`,
  the shared session+Zod guard used only by the new-table mutations (the
  legacy mutations each hand-roll the same check, e.g.
  `create-draft.ts:30-38`).

### 2.4 Schema/type plumbing (no runtime DB access)

- `src/server/article/validators.ts` — legacy validators (lines 5-49) vs.
  new uuid-keyed validators (lines 56-95), explicitly commented as separate:
  "*uuid-keyed validators for the new create → save → publish flow. The
  number-keyed validators above stay in use by the legacy draft/published
  server actions*" (line 51-54).
- `src/components/article/adapter.tsx:1-162` — `PublishedArticleWithAuthors`
  / `DraftArticleWithAuthors` types (Drizzle-inferred, lines 25-46) plus
  `DraftArticleDrizzleCard`/`PublishedArticleDrizzleCard`/`ArticleAlgoliaCard`
  React components that render legacy rows.
- `src/components/article/new-adapter.ts:1-125` — the bridge layer:
  `NewArticleWithRelations` (new schema type), `EditorDraftArticle` /
  `PublishedArticleView` = legacy-shaped types with `id` **widened to
  `number | string`** (line 34-40) so the existing editor tree renders both
  legacy and new rows unchanged, plus `map_new_article_to_editor_draft` /
  `map_new_article_to_published_view` which convert a real `Article` row
  into that legacy-compatible shape. **This adapter is the crux of "can we
  delete the legacy tables without touching the UI tree"** — as long as it
  exists, `Editor`/`EditorToReact`/card components never need to know which
  table a row came from.
- `src/components/article/context.tsx` — `DraftArticleContext`/
  `PublishedArticleContext`, typed against the *new-adapter* widened types,
  not the raw Drizzle types.

### 2.5 UI call sites (client components triggering mutations)

- `src/hooks/use-editor-mutations.tsx:1-379` — the single hook every editor
  mutation funnels through. Branches on `typeof draft_article.id ===
  "string"` (uuid → new-table path) vs. `"number"` (legacy path) at **four
  separate points**: `save_draft`/`save_article` (line 255-267),
  `publish`/`publish_article` (line 320-332), `delete_both`/`delete_article`
  (line 371-377). **Gap found**: `delete_draft` (line 348-359) has *no* new-
  table branch — it just toasts "Brisanje še ni na voljo" ("deletion not yet
  available") for any non-numeric id, i.e. draft-only delete (without also
  deleting a published counterpart) was never wired to `delete_article`,
  even though `delete_article` exists and is used by `delete_both`. Anyone
  relying on this document to plan the cutover should treat that toast as a
  known dead end, not a stub to preserve.
- `src/components/shell/editing-buttons.tsx:1-174` — `EditButton` (legacy,
  calls `create_draft`, line 92-98) vs. `NewArticleEditButton` (new, calls
  `create_superseding_draft`, line 145-156), selected by `typeof
  published_article.id === "number"` (line 46).
- `src/components/article/make-new-draft-button.tsx`,
  `create-superseding-draft-button.tsx`, `archive-article-button.tsx`,
  `delete-article-button.tsx` — new-table only (uuid `article_id` prop);
  archive/delete have no legacy equivalent at all (§2.3).

### 2.6 Read paths that are **still legacy-only** (not yet cut over)

These are the concrete gaps for issue #23-style cutover work, beyond what
#23's own acceptance criteria already list:

- **Homepage feed** — `src/app/infinite-server.tsx:1-42`
  (`get_infinite_published2`) queries `PublishedArticle` directly with
  cursor pagination; called from `src/app/page.tsx:13,22` and
  `src/app/infinite-no-trpc.tsx:11,18,25`. **A migrated article that only
  exists as an `articles` row (once legacy rows are actually deleted) will
  not appear on the homepage `/` feed** — this path was not touched by
  #17–#23 and has no `Article`-table equivalent yet. `/arhiv`, by contrast,
  is Algolia-driven (`src/app/arhiv/article-table.tsx` via
  `useInfiniteAlgoliaArticles`) and *does* already see both legacy and new
  hits through the shared Algolia index (§4), so it is unaffected.
- **Draft accordion on `/`** — `src/components/draft-articles.tsx:14-55`
  (`cachedDrafts`) queries `DraftArticle` only. A `draft`-status `Article`
  row (e.g. the 3 on staging) **will not show up** in this accordion; there
  is no equivalent query against `Article WHERE status = 'draft'` here
  (contrast with `src/components/archived-articles.tsx:12-22`, which
  already queries `Article WHERE status = 'archived'` — the archived
  accordion was built new-table-native because `archived` has no legacy
  concept, but the draft accordion was never updated).
- **`/preveri` (article-existence verification page)** —
  `src/app/preveri/page.tsx:19-34` (`cachedAllPublished`) selects only
  `PublishedArticle.id`/`old_id`. Doesn't see migrated-only articles either.
- **Global duplicate-URL disambiguation** —
  `src/server/cached-global-state.tsx:15-25` (`cachedDuplicateUrls`) reads
  `DuplicatedArticleUrls` on **every page load** (wired through
  `src/app/layout.tsx:14,37,53` → `src/app/provider.tsx:52-56,72` →
  consumed by `get_published_article_link` wherever a legacy URL needs
  `?dan=` day-disambiguation). `sync_duplicate_urls()` itself is invoked
  from exactly one place: the converter admin page
  (`src/app/converter/converter-editor.tsx:13,41-43,79-81`), which
  CONTEXT.md marks fully out-of-scope ("one-time 2008-site migration
  script, untouched, out of scope for anything"). On staging, this table is
  currently empty (0 rows), so it is not gating anything *today*, but the
  read-on-every-request wiring stays live and would need explicit removal.
- **Converter admin page itself** —
  `src/app/converter/{page.tsx,converter-server.ts,generate-images.ts}` —
  heavy `PublishedArticle`/`DraftArticle` reads and a `TRUNCATE ... CASCADE`
  on both tables (`src/app/converter/converter-server.ts:69,73`). Per
  CONTEXT.md this is explicitly out of scope for the rewrite; flagged here
  only because it's a real reference that would break (not because it
  should be migrated) — the honest options are "delete this route with the
  legacy tables" or "leave it permanently broken/removed," not "port it."
- **`src/app/api/wake_supabase/route.ts:8`** — a Supabase-cold-start-avoider
  that calls `db.query.PublishedArticle.findFirst()` for no reason other
  than "touch the DB." Trivial to repoint at `Article` or any other table.

## 3. The publish/unpublish/delete control flow (legacy) vs. the new status-flip

### 3.1 Legacy `publish()` — `src/server/article/publish.ts:33-204`

1. Auth check (line 35-37), Zod validate (line 40-49).
2. If `draft_id` given, load the `DraftArticle`; if it has a `published_id`,
   load the existing `PublishedArticle` too (line 56-76).
3. If a `PublishedArticle` exists, **delete its entire S3 directory** up
   front (line 79-89) — content is about to be fully overwritten, not
   diffed.
4. Compute a fresh `url` from the (possibly edited) title
   (`convert_title_to_url`, line 95), rewrite all S3 URLs embedded in
   `content` to the new published path (`rename_s3_files_and_content`, line
   102-108).
5. Copy thumbnail S3 objects draft→published (line 111-119).
6. `INSERT ... ON CONFLICT`-style manual branch: `UPDATE PublishedArticle`
   if one already existed, else `INSERT` (line 125-143).
7. Delete-then-reinsert `PublishedArticlesToAuthors` (line 146-158) — full
   replace, not a diff.
8. **Delete the `DraftArticle` row** and its S3 dir (line 161-170) — the
   draft ceases to exist; there is no "published row remembers its origin
   draft" relationship afterward.
9. Push to Algolia under the numeric `PublishedArticle.id` (line 188-197).

### 3.2 Legacy `unpublish()` — `src/server/article/unpublish.ts:24-142`

The mirror image: delete the Algolia object (line 50-62), locate any
existing in-progress `DraftArticle` for this `published_id` (line 65-70),
copy the published row's `content`/`title`/`thumbnail_crop` into a
draft-shaped object (line 85-91), upsert that into `DraftArticle` (line
93-99), **delete the `PublishedArticle` row** (line 101-103), copy S3
thumbnails published→draft, delete the published S3 dir.

### 3.3 New-schema equivalent — `src/server/article/new-article.ts:312-404` (`publish_article`) and `src/server/article/lifecycle.ts:71-108` (`archive_article`)

There is no `unpublish` in the new model — the closest analogue is
`archive_article`, which is a **single `UPDATE Article SET status =
'archived', archived_at = now()`** (`lifecycle.ts:91-95`) plus a
best-effort Algolia unlist (`remove_from_algolia`, `lifecycle.ts:31-44`).
No row copy, no S3 rename, no delete-then-reinsert of a join table (the
row's own uuid never changes, so `ArticlesToAuthors` doesn't need touching
at all on archive). `publish_article` (`new-article.ts:336-404`) is a status
flip plus author replace plus media reconcile plus slug resolution — still
one row, one transaction, no second table involved. This is the entire
point of the redesign and is fully built and unit-tested
(`src/server/article/lifecycle-rules.test.ts`).

## 4. Search/Algolia integration

- `src/lib/algoliasearch.ts` — `convert_article_to_algolia_object` (line
  10-25, legacy: numeric `objectID`) and
  `convert_new_article_to_algolia_object` (line 32-72, new: uuid
  `objectID`) both push into the **same** index,
  `ALGOLIA_PUBLISHED_ARTICLE_INDEX` (line 7-8, from
  `env.NEXT_PUBLIC_ALGOLIA_PUBLISHED_ARTICLE_INDEX`). `ArticleAlgoliaCard`
  (`src/components/article/adapter.tsx:127-161`) already branches display
  logic on `/^\d+$/.test(hit.objectID)` to distinguish legacy vs. new hits
  (line 138, comment at 135-137).
- Legacy writers: `publish.ts:188-197` (addOrUpdate), `unpublish.ts:50-62`
  (delete), `delete.ts` (`delete_both`, delete on published-with-draft
  delete).
- New writers: `new-article.ts:381-395` (`publish_article`,
  addOrUpdate), `lifecycle.ts:31-44` (`remove_from_algolia`, shared by
  `archive_article` and `delete_article`).
- `scripts/static_to_algolia.ts` (the `static` npm script) is **unrelated**
  — it indexes `src/app/(static)/*/page.mdx` content pages into a separate
  `static_pages` index, no article table involvement.
- `scripts/migrate-legacy-articles.ts:123-160` (`push_to_algolia`) is the
  one place that actively **retires** a legacy objectID after migrating —
  it deletes the old numeric objectID once the migrated row's `legacy_id >
  0` (line 154-159), which is exactly issue #23's second acceptance
  criterion. This already runs as part of the migration script, so
  re-running it (or running it against production) is most of #23's second
  bullet "done," not "to build."

## 5. Other tables with FKs into the legacy tables

Confirmed via schema read (§1) — nothing beyond what's listed there:

- `DraftArticle.published_id` → `PublishedArticle.id` (unique, nullable,
  no `onDelete` clause — a bare FK, meaning a raw `DELETE FROM
  published_article` while a linked draft exists would violate the
  constraint unless the app deletes the draft first, which is exactly what
  `publish.ts`/`unpublish.ts`/`delete_both` are careful to do).
- `PublishedArticlesToAuthors` → `PublishedArticle.id` (cascade),
  `Author.id` (cascade).
- `DraftArticlesToAuthors` → `DraftArticle.id` (cascade), `Author.id`
  (cascade).
- `DuplicatedArticleUrls` has **no FK** — it's a denormalized url-string
  cache, not referentially tied to `PublishedArticle` at all (matched by
  `url` string only). It can be dropped independently of the other three.
- Nothing in the `media`/`account`/`session`/`user`/`verification_token`
  tables references `PublishedArticle`/`DraftArticle`.
- The **new** schema's `Article.legacy_id` is the only new-side pointer back
  at the legacy id space, and it's a plain nullable unique integer, not a
  foreign key — it can't be violated by dropping the legacy tables (it just
  becomes an orphaned historical reference, which is the intended end
  state: `legacy_id` exists precisely so migrated rows keep a paper trail
  after the source rows are gone).

## 6. Actual data footprint (`.env.staging`)

See §0 for the full query result. Summary table:

| Table | Rows (staging) |
|---|---|
| `published_article` | 690 |
| `draft_article` (total) | 3 (2 attached to a `published_id`, 1 standalone) |
| `duplicate_article_urls` | 0 |
| `p_articles_to_authors` | 715 |
| `d_articles_to_authors` | 2 |
| `articles` (new) | 694 (693 with `legacy_id` set, 1 genuinely new) |
| `articles` by status | 691 `published`, 3 `draft`, 0 `archived`, 0 `deleted` |
| `article_slugs` | 691 |
| `articles_to_authors` | 718 |
| `media` | 4990 |
| `media_to_articles` | 4298 |
| `author` | 127 (shared, unaffected) |

**Every legacy row already has a migrated counterpart on staging.** This is
not a "some data, some empty tables" situation — it's a fully-populated
parallel table that has already absorbed 100% of the legacy rows. Dropping
`published_article`/`draft_article` on staging today would not lose any
*data* that isn't already present in `articles`, but it **would** break the
still-legacy-only read paths enumerated in §2.6 (homepage feed, draft
accordion, `/preveri`, the global duplicate-urls cache) and the
explicitly-out-of-scope `converter` route (§2.6), all of which query the
legacy tables directly and have no fallback.

No count was taken against production — this audit only touched
`.env.staging` per the task's read-only constraint. Before acting on this
document for production, re-run the same read-only count query against
`.env` production credentials to confirm the migration script has also been
run there (nothing in the repo state inspected here proves it has —
`migrate-legacy:staging` was run at least once per this data, but the
plain `migrate-legacy` production script's run history isn't visible from
the filesystem).

## 7. What `jknm-convex` actually did differently

`D:\dev\js\jknm-convex\convex\schema.ts` is the reference design (Convex,
not Postgres — ported, not copied, per CONTEXT.md). Concretely:

- **One `articles` table**, not two: `title`, `slug` (stored **on** the
  article, not a separate table — jknm's Postgres port splits this into
  `article_slugs` instead, because Postgres needs a real join table to
  support "old slug still resolves after a retitle," which Convex's
  single-slug-per-row design doesn't attempt), `status` (the same
  `draft`/`published`/`archived`/`deleted` union, `schema.ts:4-9`),
  `content_json` (PlateJS value, stored as a string — jknm's Postgres port
  uses EditorJS `jsonb` instead per ADR context: EditorJS is staying),
  `content_markdown` (for full-text search — Convex has a native
  `searchIndex`, `schema.ts:57-60`; jknm's Postgres port keeps
  `content_markdown` as a column but has no equivalent search index wired
  up in `src/server/db/schema.ts` — Postgres full-text search or the
  existing Algolia index would need to fill that role, and nothing in this
  audit found that decision made explicitly), `view_count` (present in
  Convex, **absent** from jknm's `Article` table — not ported), `thumbnail`
  (a single nested object `{ image_id, x, y, width, height }` in Convex,
  `schema.ts:11-17`; jknm's Postgres port flattens this into five separate
  columns — `thumbnail_media_id`/`thumbnail_x`/`thumbnail_y`/
  `thumbnail_width`/`thumbnail_height`, `src/server/db/schema.ts:427-431`),
  `legacy_id`, `updated_at`/`created_at`/`published_at`/`archived_at`/
  `deleted_at`, `published_year` (Convex stores it as a plain field
  populated at write time; jknm's Postgres port makes it a **generated
  column** — `GENERATED ALWAYS AS (EXTRACT(YEAR FROM published_at ...))`,
  `src/server/db/schema.ts:447-449` — a genuine improvement Convex's
  model doesn't have, since Postgres can maintain it automatically).
- **No `supersedes_id`** in the Convex schema at all. This is a
  jknm-Postgres-only addition (`src/server/db/schema.ts:432-434`) built for
  issue #21's "revise a live article without taking it offline" flow — it
  does not come from the Convex prototype; it's new design built during the
  Postgres port, worth knowing when comparing "what jknm-convex validated"
  vs. "what's new since."
- **`media` table**: near-identical shape (`original`/`variants`/`srcsets`/
  `blur_placeholder`/`upload_status`, `jknm-convex/convex/schema.ts:62-109`
  vs. `src/server/db/schema.ts:395-413`), except Convex additionally stores
  a `base_url` field (`schema.ts:67-68`) that jknm's Postgres port doesn't
  have a column for (the URL is presumably reconstructed from `original.url`
  instead).
  **`variants`/`srcsets` are optional in Convex** (`v.optional(...)`,
  `schema.ts:79,92`) but **`.notNull().default([])`/nullable in jknm**
  (`variants` is `.notNull().default([])`, `srcsets` is plain nullable,
  `src/server/db/schema.ts:401-402`) — a real, if minor, nullability
  divergence.
- **`articles_to_authors`/`media_to_articles`** join tables: same shape and
  purpose in both (Convex: `schema.ts:121-135`; jknm:
  `src/server/db/schema.ts:505-571`), except Convex's are Convex-native
  tables with `_id`-based references and compound indexes, while jknm's are
  Postgres tables with real composite primary keys and `onDelete: cascade`
  — the translation ADR-0002 describes ("Convex functions → oRPC
  procedures... Drizzle translation") extends structurally to these join
  tables too.
- **Auth**: Convex uses `users` + a `better-auth` component
  (`convex/betterAuth/schema.ts`, not read in depth here — out of scope per
  CONTEXT.md, which defers the auth migration to issue #6). jknm's `users`
  table is still the NextAuth/Auth.js shape
  (`src/server/db/schema.ts:268-280`) — unrelated to the articles migration
  and not something this audit's scope covers changing.
- **Search**: Convex gets full-text search "for free" via
  `searchIndex("search_content_by_year", ...)` (`schema.ts:56-60`,
  filterable by `status`/`published_year`). jknm has no Postgres-native
  equivalent — it relies entirely on Algolia (§4), which is an external
  service the Convex prototype didn't need. This is a real architectural
  difference the port doesn't paper over, not just a syntax translation.

## 8. Summary: what "deprecating the legacy tables" concretely touches

Everything in §2 is already inventoried; the practical shape of the
remaining work, purely as a checklist of *what exists to be removed or
finished* (not a plan — the actual sequencing/design belongs in the ADR,
not here):

1. **Run the migration for real** against production
   (`bun run migrate-legacy` per `package.json`) if it hasn't been — confirm
   with the same read-only count query used in §0/§6.
2. **Finish the cutover** (§2.6 gaps): homepage feed
   (`src/app/infinite-server.tsx`), draft accordion
   (`src/components/draft-articles.tsx`), `/preveri`
   (`src/app/preveri/page.tsx`) all need an `Article`-table-aware path
   analogous to what `/novica/<slug>` (`src/app/novica/[published_url]/page.tsx`)
   and `/arhiv` (Algolia-backed) already have.
3. **Retire the global duplicate-urls wiring**
   (`src/server/cached-global-state.tsx:15-25` →
   `src/app/layout.tsx`/`provider.tsx` → `get_published_article_link`) once
   no legacy `PublishedArticle.url` remains to disambiguate.
4. **Decide the fate of `src/app/converter/`** (explicitly out of scope per
   CONTEXT.md, but it's the single heaviest legacy-table consumer by line
   count and has a live `TRUNCATE ... CASCADE` on both tables) — delete it
   alongside the legacy tables, or leave it broken/removed independently.
5. **Delete the legacy write paths**: `src/server/article/{create-draft,
   save-draft,publish,unpublish,delete,sync-duplicate-urls}.ts`, their
   entries in `src/server/article/validators.ts` (lines 5-49) and
   `src/server/db/schema.ts` (`CreateDraftArticleSchema`,
   `SaveDraftArticleSchema`, `PublishArticleSchema`, lines 224-266), plus the
   legacy branches in `src/hooks/use-editor-mutations.tsx` and
   `src/components/shell/editing-buttons.tsx`.
6. **Simplify `src/components/article/new-adapter.ts`** once nothing
   legacy-shaped exists to bridge to — `EditorDraftArticle`/
   `PublishedArticleView`'s `number | string` id widening
   (`new-adapter.ts:34-40`) exists purely to unify legacy and new rows for
   the shared editor tree; once legacy rows are gone, `id` can go back to
   being a plain uuid and the mapping functions can likely be inlined or
   deleted, collapsing `adapter.tsx` and `new-adapter.ts` into one file.
7. **Drop `PublishedArticle`, `DraftArticle`, `DuplicatedArticleUrls`,
   `PublishedArticlesToAuthors`, `DraftArticlesToAuthors`** from
   `src/server/db/schema.ts` and push the migration — safe from an FK
   standpoint per §5 (nothing outside this cluster references them), but
   only after steps 1-6 land, since §2.6's read paths would 500 immediately
   otherwise.
