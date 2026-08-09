# Migrating `(static)` pages into `articles` rows

Research only — no code changes. Scope: `src/app/(static)/{klub,publiciranje,raziskovanje,varstvo,zgodovina}`,
whether/how to move them onto the `articles` table's draft/edit/save/publish
pipeline (no archive/delete needed), and what's left of the PDF/image
self-hosting work.

## 1. Inventory

Five static pages, all under `src/app/(static)/`, sharing one layout:

| Route | Content file | Lines | `page.tsx` |
|---|---|---|---|
| `/klub` | `klub/content.mdx` | 289 | `klub/page.tsx` |
| `/publiciranje` | `publiciranje/content.mdx` | 477 | `publiciranje/page.tsx` |
| `/raziskovanje` | `raziskovanje/content.mdx` | 208 | `raziskovanje/page.tsx` |
| `/varstvo` | `varstvo/content.mdx` | 148 | `varstvo/page.tsx` |
| `/zgodovina` | `zgodovina/content.mdx` | 974 | `zgodovina/page.tsx` |

Each `content.mdx` exports `metadata` (title only, `content.mdx:1-3` in each
file) plus MDX body; each `content.mdx.d.ts` (e.g.
`src/app/(static)/zgodovina/content.mdx.d.ts:1-8`) declares the compiled
module's shape: default `MDXContent`, `metadata: Metadata`, and
`tableOfContents: Toc` (from `@stefanprobst/rehype-extract-toc`). Each
`page.tsx` (e.g. `src/app/(static)/zgodovina/page.tsx:1-20`) just imports
`Content`, `metadata`, `tableOfContents` from `./content.mdx`, sets
`alternates.canonical`, and renders `<StaticPageToc>` + `<Content />`.
`src/app/(static)/layout.tsx:1-23` wraps every page in `Shell` +
`ScrollProvider` + `article_variants()/page_variants()` styling +
`<ImageGallery />` + `<ScrollToTop />` — visually identical scaffolding to
`/novica/[published_url]`'s own layout (`src/app/novica/[published_url]/page.tsx:145-166`
builds the same `Shell`/`ScrollProvider`/`ImageGallery` around
`PublishedContent`).

**Rendering pipeline**: `@next/mdx` (`next.config.mjs:10,84-93`), not
`next-mdx-remote`. `pageExtensions` includes `"md", "mdx"`
(`next.config.mjs:14`); the MDX pipeline runs `remark-gfm` +
`rehype-slug` + `@stefanprobst/rehype-extract-toc` (`next.config.mjs:85-92`).
Custom MDX components are supplied by root `mdx-components.tsx:9-32`: `table`/`thead`/`tr`/`tbody`
strip whitespace-only text nodes, `strong`→`<b>`, every `<a>` gets
`target="_blank"`, and — the one non-generic override — `Image` maps to
`~/components/image-with-caption`'s `ImageWithCaption` (`mdx-components.tsx:4,29`).

**Images**: every `<Image src="..." alt="..." caption="..." priority? />` in
the MDX uses a *relative*, extension-bearing path with no leading slash (e.g.
`zgodovina/content.mdx:12` `src="zgodovina/1962_ustanovitev/ustanovni.jpg"`).
`ImageWithCaption` (`src/components/image-with-caption.tsx:26,48,61`)
prepends `https://vsebina.jknm.org/` to that path to build the real URL, and
looks up pixel dimensions from a static `image_sizes.json` sidecar generated
out-of-band by `scripts/optimize-static-content-images.ts`
(`image-with-caption.tsx:11,14-24,39-41`) — it throws if a path isn't in that
JSON (`image-with-caption.tsx:58-59`). **This means the images referenced
from the five MDX files are already fully self-hosted** at
`vsebina.jknm.org` (Cloudflare-fronted `jknm-vsebina` B2 bucket per
`docs/adr/0008-b2-buckets-fronted-by-cloudflare-custom-domains.md:5`), not
routed through the `media`/`ingest_media` pipeline used by news articles.

**PDFs and other links**: `docs/research/static-pages-jknm-si-dehotlinking.md`
documents a prior pass (§2) that found 507 `www.jknm.si/media/...pdf` links
and 52 `www.jknm.si/si/?id=...` legacy-article links across these same 5
files, and `scripts/dehotlink-static-pages.ts:1-133` is the script that
executed that migration: PDFs are copied from a local mirror of the old site
(`D:\Luka\JKNM\served`, falling back to live fetch,
`dehotlink-static-pages.ts:40,58-76`) into the `jknm-vsebina` bucket via
`env.NEXT_PUBLIC_AWS_STATIC_BUCKET_NAME` (`dehotlink-static-pages.ts:68`,
declared `src/env.js:66,109-110`) and rewritten to
`static_content_url()` (`src/lib/static-content-upload.ts:6-8`,
`https://vsebina.jknm.org/<key>`); `/si/?id=<legacy_id>` links are rewritten
to the migrated article's `/novica/<slug>` via `Article.legacy_id`
(`dehotlink-static-pages.ts:42-48,78-85`, `resolve_legacy_article_link`).
Confirmed by reading the live content: `zgodovina/content.mdx:9` already
links `https://vsebina.jknm.org/media/pdf/Ustanovni_sestanek.pdf`, not
`www.jknm.si`, and `raziskovanje/content.mdx:60` already links
`/novica/velikonocni-ponedeljek-v-misnici` (an internal article route) — so
**this dehotlinking work has already run**; the static pages as they exist
today reference no `www.jknm.si` file URLs at all (spot-checked, not
exhaustively re-grepped, since the ADR/research doc timestamp and the
observed URLs agree). `TODO.md:17-35` records that ~27 refs across 16 *news
articles* (a separate content set, not these 5 static pages) still
intentionally point at un-migrated old-site pages, and that "kras01" (one of
the `Dolenjski kras` PDF-zbornik issues linked from `publiciranje/content.mdx`)
is the next thing getting self-hosted — TODO.md doesn't say this about the
static pages' own already-migrated links.

**Other content shapes present**: extensive Markdown tables (with `&nbsp;`
placeholder cells emulating rowspans) in `varstvo/content.mdx:52-141`,
`raziskovanje/content.mdx:144-189`, and every `publiciranje/content.mdx`
zbornik table-of-contents (e.g. lines 25-45); inline `<sup>`/HTML in
`varstvo/content.mdx:32`; heavy internal cross-linking to `/novica/<slug>`
article pages from within `varstvo/content.mdx` (e.g. lines 112-141) and
`raziskovanje/content.mdx:60`.

## 2. Article pipeline contract

### `content_json` / EditorJS shape

`ArticleContentType`/`ArticleBlockType` (`src/server/db/schema.ts:20-29`) is
untyped-per-block on purpose: `{ time?, blocks: {id?, type: string, data:
object}[], version? }` — no per-type validation at the schema layer. The
admin editor's actual toolbox is `src/components/editor/plugins.ts:36-119`:
`header`, `paragraph`, `image` (with `caption`/`stretch`/`border` features,
`plugins.ts:38-60`), `attaches` (arbitrary-file blocks, e.g. PDFs,
`plugins.ts:61-68`), `table` (`@editorjs/table`, `withHeadings: true`,
`plugins.ts:74-81`), `list`, `quote`, `warning`, `code`, `checklist`,
`delimiter`, `embed`, plus inline marks `marker`/`underline`/`inlineCode`/
custom `superscript`/`subscript` (`plugins.ts:82-118`). This toolbox already
covers every content shape the 5 static MDX pages use: headings, paragraphs
with bold/links, captioned images, tables, and superscript (`m³` in
`varstvo/content.mdx:32`) — **no new block type is needed**. The public
renderer (`src/components/editor/editor-to-react.tsx:52-63`) uses
`editorjs-blocks-react-renderer`'s `Blocks` with custom renderers only for
`image`/`attaches`/`header`; everything else (`paragraph`/`list`/`quote`/…)
renders from the library's built-in HTML-string renderers passed through
`html-react-parser` (`editor-to-react.tsx:29-31`).

Two structural gaps a converter would have to bridge, not solved by the
existing plugins:
- EditorJS `table` doesn't have a native "merged/spanning cell" concept the
  way the static pages' `&nbsp;`-padded Markdown tables fake it — those would
  convert as literal `&nbsp;` cells, which is probably fine visually but is a
  lossy, not exact, conversion.
  Not confirmed further; flagged as a manual-QA item, not a blocker.
- The MDX `<Image caption priority>` component's `priority` (eager-load first
  image) prop has no EditorJS equivalent found in `plugins.ts` or
  `editor-to-react.tsx` — a data-loss item, though likely low-stakes (it's a
  performance hint, not content).

### Lifecycle state machine (`src/server/article/lifecycle-rules.ts`)

Full picture from `lifecycle-rules.ts:1-324` plus its callers in
`src/server/article/lifecycle.ts` and `src/server/article/new-article.ts`:

- Statuses: `draft → published → archived → deleted`, plus superseding drafts
  (`supersedes_id` pointing at a live/archived row) spawned by "pencil to
  edit" (`create_superseding_draft`, `lifecycle.ts:270-351`).
- `resolve_lifecycle_target` (`lifecycle-rules.ts:81-93`) redirects
  archive/delete calls on a superseding draft onto the article it supersedes,
  cascade-deleting the throwaway draft.
- `is_visible_to` (`lifecycle-rules.ts:220-224`): `deleted` 404s for
  everyone, `archived` 404s for non-admins, `published` is public.
- `publish_article` (`new-article.ts:427-539`) handles both first-publish and
  supersede-publish in one function; `save_article` (`new-article.ts:359-411`)
  is the draft-autosave path; both call `reconcile_media_to_articles`
  (`reconcile-media.ts:28-133`) after every write, which is the mechanism
  that keeps `media_to_articles` (and therefore "what media does this
  article reference") in sync purely by re-scanning `content_json` — nothing
  static-page-specific would be needed here, it already handles arbitrary
  `image`/`attaches` blocks and inline `<a href>` PDF links
  (`reconcile-media.ts:19-21,43`).

**What a "no delete" static-flavored article needs to skip, concretely**:
`archive_article`/`delete_article`/`discard_draft` (`lifecycle.ts:134-251`)
are all reachable independently of any Article field — nothing forces a
caller to expose them. The realistic way to get "no delete" is *UI-level*:
just don't render the archive/delete buttons for these rows in the admin
editor chrome (`src/app/uredi/[draft_id]/page.tsx` already branches heavily
on `article.status`, e.g. lines 108-133, so adding a branch on a new
identity marker is the same shape of change already used there). The
lifecycle *functions themselves* need no change — `create_superseding_draft`,
`save_article`, `publish_article` are all status-machine-agnostic about
*why* an article exists, they just need `draft`/`published`/`archived`
statuses to keep behaving the same. The one place a defensive assertion
could be added (not required, but consistent with the existing
`assert_can_archive`/`assert_can_delete` pattern at
`lifecycle-rules.ts:31-41`) is a new `assert_is_not_static`-style guard
inside `delete_article`/`archive_article` themselves, so a future
server-action caller can't bypass a UI-only restriction — flagged as a
design choice, not resolved here.

### Slugs (`ArticleSlug`, `src/server/db/schema.ts:301-319`)

`article_slugs`: `id`, `slug` (unique), `article_id` (cascade FK),
`is_primary`, `created_at`. Lookup is a plain `slug → article_id` map
(`get_new_article_by_slug`, `src/server/article/get-article.ts:65-68`, which
already exists and is exactly the function a fixed-route static page could
call with a hardcoded slug string, no new server function required).
Two live behaviors matter for reusing this table for fixed URLs like
`/zgodovina`:

1. **Slug is derived from title, not chosen freely, except at creation.**
   `create_article` and `resolve_first_publish_slug`/
   `generate_unique_article_slug` (`new-article.ts:36-60,273-303`) mint the
   slug from `convert_title_to_url(title)` via `find_available_slug`
   (`src/server/article/slug.ts:12-23`, `base`, `base-2`, …, `base-99`, then
   a timestamp fallback). So the *first* slug for a static-page article would
   need its title to literally be "Zgodovina"/"Klub"/etc. (matching what
   `convert_title_to_url` produces) to land on the clean slug — or the slug
   needs to be inserted directly rather than through the normal
   title-derived path. Not fully confirmed whether `convert_title_to_url`
   would need adjustment (e.g. does it strip diacritics correctly enough to
   turn "Zgodovina" into exactly `zgodovina`?) — a one-off check, not
   investigated further here.
2. **Retitling a published article auto-mints a *new* primary slug and
   demotes the old one** (`resolve_retitle_slug`, `new-article.ts:315-345`,
   invoked from `save_article` at `new-article.ts:394-404` whenever
   `existing.title !== input.article.title` on a published row). This is the
   concrete risk for fixed static URLs: if `/klub`'s Article row is looked up
   by a hardcoded slug string `"klub"` in `src/app/(static)/klub/page.tsx`,
   and an admin edits the page's H1/title text, the *next* save
   auto-demotes the `"klub"` slug to non-primary and mints e.g. `"klub-2"` as
   the new primary — the hardcoded `/klub` route would then 404 (its lookup
   is `slug === "klub"`, not "whatever the current primary slug is"). This is
   the one lifecycle behavior that genuinely needs to be suppressed for
   static-flavored articles, and it needs *some* marker on the row to know
   to suppress it (see §3 below) — it can't be inferred from `ArticleSlug`
   alone.

## 3. Evaluating the `static_slug`-field idea, and an alternative

The user's proposal: add an extra string field on `Article` (e.g.
`static_slug`) to mark/identify these rows.

**What actually needs a marker**, distilled from §2: (a) something to
short-circuit `resolve_retitle_slug`'s auto-remint so a title edit can't
silently break a hardcoded `/klub` route; (b) something to exclude these rows
from news-only surfaces that iterate "all published articles" without
knowing about static pages — confirmed concretely at `src/app/sitemap.ts:29-45`
(builds `article_entries` from every `published` `Article`, would need to
either include or, more likely, exclude-and-handle-separately these rows),
and likely also `src/server/article/sync-algolia.ts` (search index) and
`src/app/arhiv/*` (the news archive listing) — not read in this pass, but
structurally the same "loop over all articles" shape as `sitemap.ts`; (c)
something for the admin editor UI to hide archive/delete affordances (§2).

A **plain string field** (`static_slug: varchar | null`, unique) does solve
(a)/(b)/(c) but introduces a second, independent "what URL does this article
live at" fact alongside `ArticleSlug.slug` — the two could drift (e.g.
`static_slug = "klub"` but `ArticleSlug.is_primary` slug is `"klub-2"` after
a retitle nobody thought to block), and every place that currently reasons
about "the article's URL" via `ArticleSlug`/`find_primary_slug` would need a
second code path for static rows specifically to reason about
`static_slug` instead. It's essentially reinventing what `ArticleSlug`
already is, scoped to five known rows.

**Recommended alternative**: add a small enum/boolean **kind** column on
`Article` — e.g. `article_kind: pgEnum("article_kind", ["news", "static"])
.notNull().default("news")` (a boolean `is_static` works equally well given
only two values exist today; the enum is marginally more future-proof if a
third kind — e.g. a genuinely deletable "page" type — shows up later) —
and keep using `ArticleSlug` as the single source of truth for the URL,
exactly as news articles do. Concretely:
- The five `src/app/(static)/*/page.tsx` routes keep being fixed Next.js
  routes (not a dynamic `[slug]` segment — the set of static pages is small
  and curated, so hardcoding is fine and matches the existing one-file-per-page
  layout), but each calls `get_new_article_by_slug("klub")` (etc.) instead of
  importing `content.mdx`, and renders `PublishedContent`/`EditorToReact`
  exactly like `/novica/[published_url]` does.
- `resolve_retitle_slug`'s call site in `save_article`/`publish_article`
  gets one extra guard: skip the auto-remint when `article_kind === "static"`
  (or more precisely, when the title matches the *current* slug's derived
  base — either works, but a flat kind-check is simpler and matches how
  `existing.status === "published"` already gates that call today,
  `new-article.ts:394-397`).
- `sitemap.ts`/Algolia sync/`arhiv` listings filter on `article_kind = "news"`
  (or add the static rows explicitly with their own known fixed URLs,
  whichever reads better at each call site — not resolved here).
- The admin editor UI (`src/app/uredi/[draft_id]/page.tsx`) branches on
  `article.article_kind` the same way it already branches on `article.status`
  to withhold delete/archive controls (§2).

This reuses every existing mechanism (`ArticleSlug`, `get_new_article_by_slug`,
`reconcile_media_to_articles`, `publish_article`/`save_article`,
`create_superseding_draft` for the edit flow) and adds exactly one new fact
to the schema — "is this a news article or a static page" — rather than a
second, parallel URL-identity mechanism. It does *not* eliminate the need to
touch `sitemap.ts`, Algolia sync, and `arhiv` — those call sites need to
learn about the new kind regardless of which field shape is chosen, since
today they unconditionally assume "every published Article is news."

## 4. Media migration plan: `artifacts/b2-mirror/vsebina` → `media` table / `jknm-gradivo`

Repo state confirmed by direct listing:

- `artifacts/b2-mirror/vsebina/` (rsynced from the `jknm-vsebina` bucket, 629 MB
  total): 358 `.pdf`, 147 `.avif`, 145 `.jpg`, 1 `.png`, 1 `.gif` — 652 files.
  Top-level dirs: `klub/`, `media/` (with `Bilten/`, `DK/`, `img/`, `pdf/`
  subdirs — the PDF corpus behind `publiciranje.mdx`'s zbornik tables and
  `zgodovina`/`varstvo`/`raziskovanje`'s inline links), `publiciranje/`,
  `raziskovanje/` (`bioloske_raziskave/`, `dolenjski_kras/`, `grmec_bih/`,
  `kanin/`), `varstvo/`, `zgodovina/` (one subdir per historical era, e.g.
  `1962_ustanovitev/`, `2017-2022_obdobje_presezkov/`) — this directory
  structure mirrors the MDX `<Image src="zgodovina/1962_ustanovitev/...">`
  paths exactly, confirming it's the same asset set the pages already
  reference live at `vsebina.jknm.org`.
- Compare: `artifacts/b2-mirror/gradivo/` (the current `jknm-gradivo`/`media`
  table's bucket) has 13,904 entries — a much larger, unrelated corpus (news
  article media, UUID-keyed, `original.{jpg,png}` + numbered `.avif`/`.jpeg`
  variants per entry, matching `Media`'s `variants`/`srcsets` shape).

**If/when the static pages migrate to `content_json`/`media` rows** (as
opposed to staying MDX-rendered from `vsebina.jknm.org`, which is a
legitimate "don't migrate the assets, just migrate the page shell" option —
see Open Questions), the images and PDFs referenced from the five pages
would need `media` rows so they can be represented as EditorJS `image`/
`attaches` blocks and picked up by `reconcile_media_to_articles`. `ingest_media`
(`src/server/media/ingest.ts:227-301`) is the right function to reuse:
content-addressed by sha256 (idempotent re-runs, `ingest.ts:233-237,291-300`),
takes raw `{bytes, filename, content_type}`, uploads to
`env.NEXT_PUBLIC_AWS_MEDIA_BUCKET_NAME` (`jknm-gradivo`, `ingest.ts:240`) —
**not parameterized by bucket**, so ingesting from `artifacts/b2-mirror/vsebina`
would land these files in `jknm-gradivo` alongside news-article media, which
is probably the intended outcome if these become ordinary `media` rows
referenced by `content_json` (there is exactly one bucket the `media` table
points at today; splitting it further isn't supported without a code change).
Images get full derivative generation (avif+jpeg × 400/800/1600 + blur
placeholder, `ingest.ts:253-261`); non-images (PDFs) are stored original-only
(`ingest.ts:261`, confirmed — see §5).

**Gap**: there is no existing *batch/CLI* entry point that reads a local
directory tree and calls `ingest_media` per file — `ingest_media` itself is
already script-callable (that's explicitly why it was extracted from the
HTTP route, per its doc comment `ingest.ts:23-31`), and
`ingest_media_from_url`/`migrate_legacy_media` (`src/lib/migrate-legacy-media.ts`
via `scripts/migrate-legacy-media.ts`) is the closest existing precedent —
but that one fetches from *URLs* (`ingest_media_from_url`,
`ingest.ts:308-327`), not local files. A new script reading
`artifacts/b2-mirror/vsebina/**/*` and calling `ingest_media({bytes: await
fs.readFile(path), filename, content_type: mime.getType(path)})` per file
would be a small, mechanical addition following the same pattern as
`scripts/dehotlink-static-pages.ts` (dry-run flag, `--execute` to commit,
`b2.authorize()` once and pass the client through `IngestMediaDeps.b2`,
`ingest.ts:39,58`) — not written here, per task scope, but the seam is clear
and requires no changes to `ingest_media` itself.

## 5. PDF self-hosting (TODO.md's kras01–kras05 and "every pdf self-hosted")

`ingest_media` **already supports arbitrary non-image files today** —
confirmed at `sniff_content_type` (`ingest.ts:79-94`): when `sharp` can't
decode the bytes as an image, `is_image: false` and the caller's claimed
`content_type` is trusted as-is; `ingest_media` then skips
`generate_image_variants` entirely (`ingest.ts:253-261`, the ternary's
false branch: `{ variants: [], srcsets: null, blur_placeholder: null }`) and
stores the original bytes verbatim at `${id}/original.${extension}`
(`ingest.ts:244-249`) with `upload_status: "completed"` regardless. So a PDF
ingested through `ingest_media` becomes a normal `media` row with a working
`original.url`, just with an empty `variants` array — nothing is missing at
the schema or ingestion-function level for PDF support.

What TODO.md's kras01–kras05 item (`TODO.md:28-32`) is actually about is
narrower: those five links currently point at `www.jknm.si/si/publikacije/
kras0N/`, which per the dehotlinking research doc's §2.2 finding is an
**old-CMS *page* URL, not a direct file link** — i.e. there may be no
single PDF file to `ingest_media`-fetch directly; it might require locating
the actual `Dolenjski_kras_N.pdf` asset (the `publiciranje.mdx` content
already links these directly at `vsebina.jknm.org/media/DK/Dolenjski_kras_N.pdf`
per e.g. line 47, so the file-level asset is already self-hosted for at
least the `publiciranje` page's own copy) and pointing the *other* referring
articles/pages at that same already-migrated URL, rather than needing a new
upload at all. Not confirmed which of TODO.md's 16 affected news articles
overlap with files already sitting in `jknm-vsebina` vs. genuinely unmigrated
files — that reconciliation wasn't done here.

"Every PDF should be self-hosted" (per the task brief, referencing user
intent beyond what's in TODO.md verbatim): given §4's findings, the
mechanism is already fully built (`ingest_media` handles non-images;
`scripts/dehotlink-static-pages.ts` already handles the `www.jknm.si` →
`jknm-vsebina` file-copy pattern for the static pages specifically) — what's
missing is coverage, not capability: (1) the batch/local-directory ingestion
script described in §4 for `artifacts/b2-mirror/vsebina` → `jknm-gradivo`,
if these pages migrate to `content_json`; (2) whatever residual `www.jknm.si`
links remain in the 16 news articles TODO.md flags, which is a `jknm-gradivo`-via-
`ingest_media_from_url` job similar to `migrate_legacy_media`, not a new
capability.

## 6. Open questions / risks

1. **Does migrating these 5 pages to `content_json` even need to touch
   `artifacts/b2-mirror/vsebina` assets at all?** Since images/PDFs are
   already self-hosted at `vsebina.jknm.org` (§1), a lighter-weight migration
   could keep referencing those exact URLs directly inside EditorJS `image`/
   `attaches` blocks (`data.file.url = "https://vsebina.jknm.org/..."`)
   *without* re-ingesting bytes into `jknm-gradivo`/the `media` table at all.
   `reconcile_media_to_articles` (`reconcile-media.ts:33-61`) resolves URLs
   against `Media.original->>'url'` and **silently skips any URL with no
   matching `media` row** (per its own doc comment, `reconcile-media.ts:17`:
   "External images that were never uploaded ... have no `media` row and are
   simply skipped") — so this is a real, low-effort option, at the cost of
   these images/PDFs not participating in whatever `media`-table-only
   features exist (dedup-by-hash, the admin media picker/library, orphan
   sweeps). Not resolved here which the user wants; flagged as the biggest
   scope lever in this whole migration.
2. **`convert_title_to_url` exactness** (§2, slugs): not verified whether
   titling these articles exactly "Zgodovina"/"Klub"/etc. reliably produces
   the bare slugs `zgodovina`/`klub` on first publish, or whether the slug
   needs to be seeded directly (bypassing `generate_unique_article_slug`)
   to guarantee it.
3. **Where do `sitemap.ts`, Algolia sync, and `arhiv`'s article-listing
   query need to change**, precisely — only `sitemap.ts` was actually read in
   this pass; `sync-algolia.ts` and the `arhiv` route were inferred by
   structural similarity ("loops over all published Article rows") but not
   opened. Confirm both before implementing the `article_kind` filter from §3.
4. **Merged/spanning-cell tables** (varstvo/raziskovanje/publiciranje) and
   the MDX `<Image priority>` prop (§2) are the two content-fidelity gaps
   identified; whether they matter enough to block a straight EditorJS
   conversion is a judgment call, not something the code answers.
5. **`/si/?id=` and other still-manual cross-links inside the static
   pages** (`raziskovanje/content.mdx:60,80,94` link to `/novica/<slug>`
   articles already) would need to keep resolving correctly after
   migration — should be unaffected since they're already plain
   `/novica/<slug>` hrefs baked into the content, but worth a spot-check
   post-migration since the rendering path (MDX → EditorJS `paragraph`
   HTML) changes.
6. **No delete, enforcement level**: §2 recommends UI-only suppression of
   archive/delete for `article_kind === "static"` rows, with an optional
   defensive assertion inside `archive_article`/`delete_article` themselves.
   Whether the user wants the hard defensive guard (throws if ever called on
   a static row) or considers UI-only sufficient wasn't asked.

## Summary / recommendation

The `static_slug`-string-field idea works but duplicates `ArticleSlug`'s job
and risks the two drifting. A small `article_kind` enum/boolean (`"news"` /
`"static"`, defaulting to `"news"`) is recommended instead: it lets the five
fixed routes keep using the existing `get_new_article_by_slug()` lookup and
`ArticleSlug` machinery untouched, while giving exactly the one behavioral
hook actually needed — suppressing `resolve_retitle_slug`'s auto-remint (the
one place a title edit could silently break a hardcoded `/klub` route) — plus
a flag for excluding these rows from news-only surfaces (`sitemap.ts`,
Algolia, `arhiv`) and for hiding delete/archive UI. Everything else in the
draft/edit/save/publish pipeline (`create_article`, `save_article`,
`publish_article`, `create_superseding_draft`, `reconcile_media_to_articles`,
the EditorJS toolbox, `PublishedContent`/`EditorToReact`) already works
as-is for this content — no block-type gaps, no lifecycle-function changes
required beyond the one guard above.
