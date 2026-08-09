# Call-site audit: `article_kind` ("article" vs "content")

Closes #34 (child of map #33). Read-only investigation — no code changed here.
Every location below was opened and read directly against the current
`main`/`vsebina` branch; `article_kind` does not exist in the schema yet
(confirmed: `src/server/db/schema.ts` only defines `author_type_enum`,
`article_status_enum`, `media_upload_status_enum` — #35 adds the column).
This document assumes #35 lands first: `articles.article_kind` enum
(`"article" | "content"`, `.notNull().default("article")`).

Two decisions already made on #33 and taken as given here, not re-litigated:

- Content-kind pages suppress news-specific UI chrome (byline, published-date-
  as-news-event, related-articles).
- `/novica/<slug>` stays resolvable for content-kind rows for free via the
  existing generic slug lookup, with `<link rel="canonical">` pointing at the
  fixed content route.

---

## `src/app/sitemap.ts`

**Current behavior**: `sitemap()` (lines 29–51) queries every `status:
"published"` `Article` row with no kind filter (line 30–34) and emits one
`/novica/<slug>` URL per row (lines 37–45). Separately, `STATIC_ROUTES`
(lines 17–27) is a hardcoded array already containing `/klub`,
`/publiciranje`, `/raziskovanje`, `/varstvo`, `/zgodovina` — the five fixed
routes content-kind rows will live at.

**Required change: EXCLUDE content-kind rows from the `/novica/<slug>` loop.**
Once migrated, a content-kind row would otherwise emit a *second* sitemap
entry at `/novica/<its-slug>` — a duplicate-content entry alongside the fixed
route already in `STATIC_ROUTES`, undermining the canonical-link decision
above (the sitemap would be actively pointing crawlers at the non-canonical
URL).

**Sketch**: add `import { ne } from "drizzle-orm"` (or `and(eq(status,
"published"), ne(article_kind, "content"))`) to the `where` at line 31, e.g.:
```ts
where: and(eq(Article.status, "published"), ne(Article.article_kind, "content")),
```
`STATIC_ROUTES` needs no change — it already lists the fixed routes and is
independent of the DB query.

---

## `src/app/si/[...path]/route.ts` and `src/lib/legacy-si-paths.ts` (+ test)

**Current behavior**: `resolve_legacy_static_path` (`legacy-si-paths.ts:24-49`)
is a pure, DB-free string-mapping table from old `/si/<segment>/...` paths to
fixed new paths (`/klub`, `/zgodovina`, `/publiciranje`, `/raziskovanje`,
`/varstvo`, `/kontakt`, `/arhiv`) or `{ outcome: "gone" }`. The route handler
(`route.ts:12-24`) just calls it and 301/410s. Neither touches the `articles`
table, `article_kind`, or any article row at all.

**Required change: NO CHANGE NEEDED.** This redirects to fixed URL strings
that will keep existing regardless of how the pages backing them are
rendered (MDX today, an `article_kind: "content"` row after migration). The
test file (`legacy-si-paths.test.ts`) is a pure unit test of the same
string-mapping table and likewise needs no change.

---

## `src/lib/static-nav-sections.ts`

**Current behavior**: `STATIC_NAV_SECTIONS` (lines 37-47) is computed once at
module load by statically importing `tableOfContents` from each of the five
`content.mdx` files (lines 2-6) and flattening each `Toc` into `{id, title}`
heading entries for the navbar dropdown (`flatten_toc(toc, [2])`, line 41).

**Required change: INCLUDE with different handling — this file breaks
entirely once the `content.mdx` files are deleted as part of the migration.**
It is not an "exclude a row" change like the others; it is a data-source
swap. The five static imports at lines 2-6 have no post-migration
equivalent (the content moves into `content_json` DB rows), so this module
must instead derive each page's `{id, title}` heading list at request/build
time from the migrated row's `content_json`, the same way
`editor-to-react.tsx`'s `extract_headings_from_content` (`~/lib/editor-utils`)
already extracts headings for the article ToC. Concretely: replace the
static `STATIC_PAGES` array (lines 15-21) with a function that calls
`get_new_article_by_slug("zgodovina")` (etc., one per fixed route) and runs
`extract_headings_from_content(article.content_json)` (filtered to h2, as
`flatten_toc(toc, [2])` does today) to build the same `NavSection` shape.
This turns the module from synchronous/module-load-time into an async,
DB-backed computation, which is a bigger structural change than the other
call sites in this audit — flagged as the one item here that's more "rewrite"
than "add a filter." Not blocked on `article_kind` itself (it doesn't need to
distinguish kinds, since it only ever look up these five known slugs) — it's
blocked on the migration itself. Listed here because #34 asked for every
call site touching these five pages' rendering path, not because it needs an
`article_kind` predicate.

`ARHIV_SECTION` (lines 25-29) is a static constant, unaffected.

---

## `src/components/shell/header.tsx`

**Current behavior**: `LinksMenu` (lines 15-47) hardcodes five `<Link
href="/zgodovina">` etc. `DesktopHeaderLink` components pointing at the fixed
static routes, plus a static `/arhiv` link and a handful of dead/empty-href
`ListItem`s in the "Klub" dropdown (lines 29-39, `href=""`, filtered out at
render by `ListItem`'s `if (!href) return null` guard, line 79-81).

**Required change: NO CHANGE NEEDED.** These are plain `<Link href="/fixed-
path">` elements; they don't query the `articles` table, don't render
article content, and don't care whether the page behind `/zgodovina` is
MDX-rendered or DB-rendered. The routes stay the same fixed paths per the
"five fixed Next.js routes, not a dynamic `[slug]` segment" decision in the
prior research doc (`static-sites-to-articles-migration.md` §3).

---

## `scripts/static_to_algolia.ts`

**Current behavior**: A standalone script (wired to `bun run scripts/
static_to_algolia.ts` via the `"static"` npm script in `package.json:16`)
that globs `src/app/(static)/*/page.mdx` (line 54) — **note: this pattern
does not match any file that exists today**; the actual files are named
`content.mdx`, not `page.mdx` (confirmed against §1 of the prior research
doc and the directory listing). This means the script currently finds zero
files and pushes an empty array to Algolia's `static_pages` index every time
it's run — **it appears to already be broken/dead code**, independent of
`article_kind`. It parses each MDX file into H2-delimited markdown sections
(`splitMarkdownByHeading`, lines 23-46) and pushes `{index, section, text}`
objects to a **separate** Algolia index named `"static_pages"` (line 71) —
distinct from `ALGOLIA_PUBLISHED_ARTICLE_INDEX` (the news index synced by
`src/server/article/sync-algolia.ts`). `src/components/shell/searchbar.tsx`
(lines 58-70) confirms this index is live in the UI: the command-palette
search queries `static_pages` and `ALGOLIA_PUBLISHED_ARTICLE_INDEX` in
parallel and renders them under separate "Vsebina" / "Novice" headings
(lines 117-136).

**Required change: INCLUDE, but this needs a human decision on scope before
it can be sketched precisely — flagged as the one genuinely ambiguous item
in this audit.** Two designs are both structurally sound with what's read
here:
1. Fix the glob bug (`content.mdx`, not `page.mdx`) and keep this script
   MDX-file-based as-is until the five pages are actually migrated, then
   retire it. Zero relation to `article_kind` — the static/DB split doesn't
   exist yet from this script's point of view.
2. Once migration lands, rewrite this script (or fold its logic into
   `sync-algolia.ts`) to read `article_kind: "content"` DB rows instead of
   files, keeping the `static_pages` index (and the searchbar's "Vsebina"
   section) as the deliberate non-news search bucket these five pages should
   land in — i.e. content-kind rows should be **excluded** from
   `ALGOLIA_PUBLISHED_ARTICLE_INDEX`/`sync-algolia.ts` (see below) and
   **included** in a DB-backed successor of this script instead.
Which of these (or some third option) the maintainer wants is not decided by
anything in the code or the #33 comment thread — this is the one open
question in this document. Recommendation, not a decision: option 2, since
it preserves the existing "Vsebina" vs "Novice" UX split in `searchbar.tsx`
that a human already designed, and because leaving `static_pages` file-backed
after `content.mdx` is deleted would make it permanently stale.

---

## `src/server/article/sync-algolia.ts` (+ `sync-algolia-diff.ts`)

**Current behavior**: `fetch_db_published_articles` (lines 71-92) queries
every `status: "published"` `Article` with no kind filter and maps each into
a `DbArticleSummary` for `compute_algolia_sync_diff`, which then pushes
missing/stale rows to `ALGOLIA_PUBLISHED_ARTICLE_INDEX` — the same index
`searchbar.tsx` labels "Novice" and `arhiv/article-table.tsx`/`arhiv/
infinite-hits.tsx` (via `ArticleTable`, `MyInfiniteHits`) render as the news
archive. `sync-algolia-diff.ts` itself is pure diffing logic with no DB
access, so it has nothing kind-specific to change — it only ever sees
whatever `DbArticleSummary[]` it's handed.

**Required change: EXCLUDE content-kind rows from the query at lines 72-81.**
Pushing a content-kind row (e.g. "Zgodovina") into the news index would
surface it in `/arhiv`'s news archive and searchbar's "Novice" results,
mislabeling it as a news item — exactly the assumption #34 exists to catch.
This is the highest-risk finding in this audit: unlike the sitemap/preveri/
homepage-feed cases (which are about listing correctness), a wrong Algolia
push is externally visible search UX and would need a manual `sync_algolia()`
re-run or an orphan-removal pass to undo once discovered.

**Sketch**: add `ne(Article.article_kind, "content")` to the `where` at line
73 (same pattern as `sitemap.ts`), i.e.:
```ts
where: and(eq(Article.status, "published"), ne(Article.article_kind, "content")),
```
This also determines what `orphaned` reports in `preview_algolia_sync`: any
content-kind objectID that a *previous*, pre-fix sync already pushed into
`ALGOLIA_PUBLISHED_ARTICLE_INDEX` will show up as `orphaned` on the next
sync and get cleaned up automatically via `remove_from_algolia` — no manual
cleanup script needed as long as `sync_algolia()` (not just `preview_
algolia_sync()`) is re-run once after this filter ships.

---

## `src/app/arhiv/page.tsx`, `arhiv/search.tsx`, `arhiv/article-table.tsx`, `arhiv/infinite-hits.tsx`, `arhiv/search-controls.tsx`, `arhiv/components.tsx`

**Current behavior**: None of these query Postgres directly. `page.tsx`
renders `<Search session={session} />`; `search.tsx` wires up
`InstantSearch` against `DEFAULT_REFINEMENT` (`ALGOLIA_PUBLISHED_ARTICLE_INDEX`
implicitly, via the shared Algolia client/index config in `components.tsx`
and `~/lib/algoliasearch.ts`) and renders either `MyInfiniteHits` (card view)
or `ArticleTable` (table view, `article-table.tsx:27-143`), both of which
just iterate whatever hits Algolia returns.

**Required change: NO CHANGE NEEDED, contingent on the `sync-algolia.ts` fix
above.** Once content-kind rows are excluded from `ALGOLIA_PUBLISHED_ARTICLE_
INDEX` at the sync layer, every one of these components is already correct
by construction — they render "whatever's in the index," and the index will
correctly contain only news. If the `sync-algolia.ts` exclude is *not* done,
these would all need their own defensive filtering; doing it once at the
sync boundary avoids that.

---

## `src/components/shell/searchbar.tsx`

**Current behavior**: Already queries `static_pages` and
`ALGOLIA_PUBLISHED_ARTICLE_INDEX` as two separate, explicitly-labeled result
groups ("Vsebina" / "Novice", lines 117-136) — this is a call site that
already anticipated the article/content split at the UX level, just not
backed by the unified table yet.

**Required change: NO CHANGE NEEDED to this file itself.** It already does
the right thing structurally (two labeled buckets); it just inherits
whatever `static_pages` and `ALGOLIA_PUBLISHED_ARTICLE_INDEX` actually
contain, which is the `static_to_algolia.ts` / `sync-algolia.ts` decisions
above, not this component's own logic.

---

## `src/app/infinite-server.tsx` + `src/server/article/article-queries.ts` (`find_published_articles_page`) — homepage feed

**Current behavior**: `find_published_articles_page` (`article-queries.ts:
34-46`) is `Article.status = "published"`, cursor-paginated by
`created_at desc`, with no kind filter — this is exactly the query behind
the public homepage's infinite-scroll news feed (`get_infinite_published2`
in `infinite-server.tsx`, rendered by `<InfiniteArticles />` in
`src/app/page.tsx:82,98`).

**Required change: EXCLUDE content-kind rows.** The homepage feed is
explicitly a chronological "latest news" stream (cards sorted by
`created_at`); a content-kind row like "Zgodovina" has no natural place in a
reverse-chronological news feed and would look like a bug to a visitor (an
old, rarely-updated page suddenly appearing at the top after an edit bumps
its `updated_at`/`created_at`... actually `created_at desc`, so it would sit
wherever its original `created_at` falls — either way, out of place).

**Sketch**: add the same `ne(Article.article_kind, "content")` to the
`where` inside `withCursorPagination` at `article-queries.ts:41`:
```ts
where: and(eq(Article.status, "published"), ne(Article.article_kind, "content")),
```
(`withCursorPagination` takes a `where` clause already — confirm it composes
with `and()` the same way the other call sites do; not verified against
`~/lib/drizzle-pagination`'s exact signature in this pass, but structurally
this is the same shape as the `sitemap.ts`/`sync-algolia.ts` fix.)

---

## `src/server/article/article-queries.ts` (`find_article_with_relations`, `find_draft_articles`, `find_articles_for_verification`)

Three more exports in the same file, each evaluated separately:

**`find_article_with_relations`** (lines 20-28): a generic `where`-parameterized
single-row lookup, used by `/novica/[slug]`, `/si/route.ts` (legacy-id
redirect), and `sync-algolia.ts`'s per-article refresh. **NO CHANGE
NEEDED** — it's a lookup-by-caller-supplied-condition helper, not a
listing; each *caller* decides what it's looking up, and none of its
current callers need to exclude content-kind rows (the `/novica/[slug]`
page is specifically the one place content-kind rows are *supposed* to
stay resolvable, per the #33 canonical-link decision; `/si/route.ts`'s
legacy-id redirect only ever matches rows with a `legacy_id`, which
content-kind rows — being new, migrated-by-hand rows — won't have, so this
is moot in practice, not because of a filter).

**`find_draft_articles`** (lines 49-55): every `status: "draft"` row, feeding
the homepage's admin-only `<DraftArticles />` accordion (`draft-articles.tsx`).
**NO CHANGE NEEDED.** This is an admin-facing "what's in progress" list; an
admin drafting a content-kind edit (e.g. revising "Zgodovina" via a
superseding draft) should see it here exactly like a news draft — hiding it
would be surprising, not helpful, and nothing in the #33 decisions asks for
draft-list segregation by kind.

**`find_articles_for_verification`** (lines 63-71): every row whose status
is not `draft`/`deleted` (i.e. `published`/`archived`), columns
`id`/`legacy_id`, feeding `/preveri` — the legacy-migration verification
tool that cross-checks the unified table against the old CMS's
`published_article` set (per its own doc comment, lines 57-61: "mirroring
the legacy `published_article`-only set this replaces"). **EXCLUDE
content-kind rows.** These five rows have no legacy counterpart to verify
against (they're not migrated *from* the old CMS's article table — they're
migrated from static MDX pages that were never in `published_article`), so
including them would either show up as unexplained rows with `legacy_id:
null` in a tool whose entire purpose is a 1:1 legacy-vs-new reconciliation,
or (worse) coincidentally collide with real verification logic downstream in
`preveri-client.tsx` that this pass didn't open. Safer and more consistent
with the tool's stated purpose to exclude them.

**Sketch**: `where: and(notInArray(Article.status, ["draft", "deleted"]),
ne(Article.article_kind, "content"))` at line 68.

---

## `src/components/archived-articles.tsx`

**Current behavior**: `cachedArchived` (lines 16-35) queries `status:
"archived"` with no kind filter, feeding the homepage's admin-only `<Archiv
Articles />` accordion.

**Required change: NO CHANGE NEEDED, in practice — but worth a defensive
note.** Per the task brief, content-kind rows won't expose archive/delete in
the UI (a separate ticket, out of scope here) — if that guard holds, no
content-kind row can ever reach `status: "archived"` and this query is
naturally always news-only. This is one filter that *could* be added
defensively (`ne(Article.article_kind, "content")`) for belt-and-suspenders
correctness against a future bug in the archive-guard ticket, but nothing in
the current code makes it necessary — flagged as optional, not required.

---

## `src/app/novica/[published_url]/page.tsx`

**Current behavior**: This is the generic slug-resolution route that #33
already decided should keep serving content-kind rows (so they resolve at
both `/novica/<slug>` and their fixed route). Three things inside it need
scrutiny individually:

1. **`generateMetadata`** (lines 81-114): sets `alternates.canonical` to
   `/novica/<requested_slug>` unconditionally (line 92). Per the #33
   decision, a content-kind row must instead canonicalize to its **fixed**
   route (e.g. `/zgodovina`), not to `/novica/zgodovina`, to avoid the
   duplicate-content problem the decision explicitly calls out.
   **Required change: INCLUDE with different handling.** Sketch: branch on
   `article.article_kind === "content"` and set `alternates.canonical` to a
   lookup table (slug → fixed path, the same mapping `STATIC_ROUTES`/
   `legacy-si-paths.ts` already encode) instead of the `/novica/...` self-
   reference.
2. **`build_article_json_ld`** (lines 125-143): emits schema.org `Article`
   JSON-LD with `url: .../novica/<slug>` (line 132) and `author` (line
   133-136, empty array if no authors). For a content-kind row this `url`
   has the same canonical-mismatch problem as (1) — it should point at the
   fixed route too, and an empty `author` array for an authorless content
   page is fine as-is (schema.org allows omitting/empty `author`, and this
   file already conditionally omits `image` when absent, lines 137-139, so
   the same conditional-omission pattern applies here without new
   invention). **Required change: INCLUDE with different handling** — reuse
   whatever fixed-route resolution (1) adds, and pass that as `url` instead
   of the `/novica/<slug>` self-reference when `article_kind === "content"`.
3. **The page body** (lines 145-167) renders `<PublishedContent
   article={new_view} />`, which delegates to `EditorToReact` — see the
   dedicated entry below for the byline/date chrome question. This file
   itself does not render the byline directly, so no further change is
   needed here beyond passing whatever kind-aware prop `EditorToReact` ends
   up needing.

Note: this file was **already writing `"Article"`, not `"NewsArticle"`**,
for the JSON-LD `@type` (line 117-120 doc comment: "a caving club isn't a
news publisher") — so the #33 concern about `NewsArticle`-typed structured
data doesn't apply; that decision was already made independently of this
audit.

---

## `src/components/editor/editor-to-react.tsx` (`ArticleDescription` byline/date)

**Current behavior**: `EditorToReact` (lines 104-191) unconditionally
renders `<ArticleDescription type="page" author_ids={author_ids}
created_at={article.created_at} />` twice (desktop card at line 165-169,
mobile at line 182-186). `ArticleDescription` (`src/components/article/
description.tsx`) renders the byline (`<Authors author_ids .../>`) and
`format_date_for_human(created_at)` — this is precisely the "byline,
published-date-as-news-event" chrome #33 already decided to suppress for
content-kind pages. This is shared by both the editor draft view and the
public `/novica/[slug]` view (it takes `EditorDraftArticle |
PublishedArticleView`, line 107), so it's also what the fixed `/zgodovina`-
style route will render through once built on the same `PublishedContent`/
`EditorToReact` pipeline (per the prior research doc's plan).

**Required change: INCLUDE with different handling.** `EditorToReact` needs
an `article_kind`-aware prop (or a `suppress_news_chrome` boolean, simpler
and more explicit than threading the raw enum through a presentation
component) to conditionally skip rendering `<ArticleDescription>` for
content-kind articles. Neither `EditorDraftArticle` nor `PublishedArticleView`
(`src/components/article/new-adapter.ts`, lines 27-59) currently carries
`article_kind` — both would need the field added and populated from the
underlying `Article` row in `map_new_article_to_editor_draft`/
`map_new_article_to_published_view` (lines 119-160) for `EditorToReact` to
branch on it.

**Related-articles widget**: searched for one (`related`/`Related` across
`src/`) — none exists in the current codebase. The #33 decision to suppress
it for content-kind pages is therefore pre-emptive for a UI element not yet
built; no current call site needs a change for this specifically, but
whoever builds a related-articles feature later should gate it on
`article_kind` from the start rather than retrofitting it.

---

## `src/lib/static-nav-sections.ts` header ToC vs. `src/components/toc/table-of-contents.tsx`

Not a separate finding — folded into the `static-nav-sections.ts` entry
above; the in-page ToC (`<TableOfContents entries={headings} />`,
`editor-to-react.tsx:156`) already derives from `content_json` via
`extract_headings_from_content` regardless of article kind, so it needs
**NO CHANGE** — it's already generic. Only the *navbar's* precomputed
section list (`static-nav-sections.ts`) has the static-import problem.

---

## Other surfaces checked, no findings

- **RSS/Atom feed**: none exists (`rss`/`feed.xml`/`atom` grepped across
  `src/`, zero hits besides an unrelated media filename comment).
- **Admin editor list / `uredi` routes, `procedures.ts`**: `src/server/orpc/
  article/procedures.ts` is thin auth+validation wrappers around
  `lifecycle.ts`/`new-article.ts`/`sync-algolia.ts` — no listing query of its
  own; whatever those underlying functions do is covered by the entries
  above. The archive/delete-button suppression for content-kind rows in
  `src/app/uredi/[draft_id]/page.tsx` is explicitly out of scope per the
  task brief (separate ticket).
- **Breadcrumbs**: `src/components/ui/breadcrumb.tsx` is a generic shadcn/ui
  primitive with no article-fetching logic of its own; not used anywhere
  that lists/queries articles in bulk (only `page.tsx`/`novica/[published_
  url]/page.tsx` matched the earlier `BreadcrumbList`/`NewsArticle` grep, and
  both are already covered above — page.tsx's `OrganizationJsonLd` is a
  static, per-club constant with no article loop in it).
- **`preveri-client.tsx`**: not opened in this pass (referenced by `preveri/
  page.tsx` but is a pure client-side renderer of whatever `find_articles_
  for_verification` already filtered) — since the exclude is applied at the
  query in `article-queries.ts`, this component needs no separate change,
  but flagging that it wasn't directly read as a minor completeness gap.

---

## Consolidated checklist

| # | File | Change |
|---|---|---|
| 1 | `src/app/sitemap.ts` | EXCLUDE — add `ne(Article.article_kind, "content")` to the published-articles query (line ~31) |
| 2 | `src/server/article/sync-algolia.ts` (`fetch_db_published_articles`) | EXCLUDE — same filter on the query at lines 72-81 (highest-risk item: wrong Algolia push is externally visible) |
| 3 | `src/server/article/article-queries.ts` (`find_published_articles_page`) | EXCLUDE — same filter, used by the homepage infinite feed |
| 4 | `src/server/article/article-queries.ts` (`find_articles_for_verification`) | EXCLUDE — same filter, used by `/preveri` |
| 5 | `src/lib/static-nav-sections.ts` | INCLUDE (rewrite) — replace static `content.mdx` `tableOfContents` imports with a DB-backed lookup via `get_new_article_by_slug` + `extract_headings_from_content`, once the five pages are migrated |
| 6 | `src/app/novica/[published_url]/page.tsx` (`generateMetadata`) | INCLUDE — canonicalize content-kind rows to their fixed route instead of `/novica/<slug>` |
| 7 | `src/app/novica/[published_url]/page.tsx` (`build_article_json_ld`) | INCLUDE — same fixed-route `url` for JSON-LD when `article_kind === "content"` |
| 8 | `src/components/editor/editor-to-react.tsx` + `src/components/article/new-adapter.ts` | INCLUDE — thread `article_kind` (or a derived `suppress_news_chrome` flag) through `EditorDraftArticle`/`PublishedArticleView` so `EditorToReact` can skip rendering `<ArticleDescription>` (byline/date) for content-kind rows |
| 9 | `scripts/static_to_algolia.ts` | INCLUDE, scope ambiguous — needs a human decision (see its section above); recommendation is to eventually make it DB-backed and keep content-kind rows in the separate `static_pages` index rather than `ALGOLIA_PUBLISHED_ARTICLE_INDEX` |
| 10 | `src/components/archived-articles.tsx` | Optional defensive EXCLUDE (not required if the archive/delete UI guard from the separate ticket holds) |

Everything else read in this pass — `src/app/si/[...path]/route.ts`,
`src/lib/legacy-si-paths.ts` (+ test), `src/components/shell/header.tsx`,
`src/app/arhiv/*` (page/search/article-table/infinite-hits/search-controls/
components), `src/components/shell/searchbar.tsx`, `src/server/article/
article-queries.ts`'s `find_article_with_relations`/`find_draft_articles`,
`src/server/article/sync-algolia-diff.ts`, `src/app/si/route.ts` (legacy-id
redirect), `src/app/preveri/page.tsx` — is **NO CHANGE NEEDED**, for the
specific reasons given in each section above (either already generic, or
correct-by-construction once the excludes above are applied at their
respective source queries).
