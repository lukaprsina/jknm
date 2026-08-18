# Legacy-site / migration reference notes

Non-obvious facts about the old `www.jknm.si` (classic ASP, 2008–2025) site and how it maps onto
this rewrite, collected while building the verification scripts (`scripts/legacy-link-diff.ts`,
`scripts/legacy-media-hash-diff.ts`, `scripts/audit-all-discrepancies.ts`) and fixing what they
found. Reference material, not open work — see GitHub issues for anything still to decide or do.

## Legacy content range and sources

- `legacy_id` 1–691 is real migrated content. **692 is the old site's goodbye page**
  ("www.jknm.si se je odselil"), not an article — `LAST_REAL_LEGACY_ID` in
  `audit-all-discrepancies.ts` encodes this. Getting this wrong once let a genuinely-new
  post-migration article that landed on `legacy_id` 692 (a by-date reconciliation boundary bug)
  sail past the out-of-range check and get buried as an ordinary `title_mismatch`.
- `legacy_id` is **not contiguous** — some early articles were hard-deleted on the old site, so
  gaps are expected and not a migration bug.
- Two independent sources cover the legacy body content, and which one has a given `legacy_id`
  is not predictable from the id alone — always load both and merge:
  - `artifacts/Objave.txt` — the old admin DB's own CSV export. Columns are positional, not
    named: `record[0]`=legacy_id, `record[4]`=title, `record[6]`=full HTML body (already an
    isolated `<p>`-tag fragment, no need to strip page chrome), `record[8]`=published date
    (`d/m/yyyy h:mm:ss`).
  - `artifacts/legacy-html/<id>.html` — scraped directly from the live site
    (`scripts/scrape-legacy-articles.ts`), covering ids the CSV export doesn't (later articles).
    The body is the `<h1>`'s **parent node**'s innerHTML — same extraction
    `scripts/migrate/html-to-blocks.ts` used for the original static-page migration
    (`extract_static_content_html`). The sibling `<div class="columnRight">` (year-archive
    sidebar) is *not* inside that container, so no separate stripping is needed.
- The 5 evergreen content pages (`/klub`, `/publiciranje`, `/raziskovanje`, `/varstvo`,
  `/zgodovina`) were **rebuilt from scratch** for the rewrite, not migrated from legacy content —
  confirmed correct by the maintainer. There is nothing to diff them against, and no need to try.
- The `served` mirror (`D:\Luka\JKNM\served`, a 2023 snapshot of the live site) has real static
  HTML for **articles**, but its `si/<section>/default.asp` files (the pages behind the 5
  evergreen sections) are **empty ASP redirect stubs**, not saved output — e.g.
  `si/klub/default.asp` is just `response.Redirect(".../si/klub/zgodovina/")`. If you go looking
  for legacy content-page bodies there, they aren't there.
- The mirror's image tree (`served/media/img/novice/<year>/<mm>/`) verifiably stops at **2023**
  — 2024/2025 `novice` directories exist but are empty. Media from `legacy_id` roughly 625–691
  needs a live fetch against `www.jknm.si` (still up, `robots.txt`-disallowed for crawlers but
  not otherwise blocked) as a fallback, not just the mirror.

## Legacy link/media shapes

- Internal article links: `www.jknm.si/si/?id=<legacy_id>` (sometimes with a trailing
  `&l=<year>`, which is decorative and safe to drop).
- Static-section links: `www.jknm.si/si/<section>/...`, mapped to the new site's equivalent (or
  a deliberate `410`) by `src/lib/legacy-si-paths.ts`'s `resolve_legacy_static_path`. Two of the
  "dropped" sections (`izobrazevanje/kodeks`, `klub/interes`) aren't actually lost content —
  they're folded into the `/klub` content page's prose at a different URL, verified against
  `Article.content_json` directly rather than assumed.
- Legacy images live under a fixed scheme: `/media/img/novice/<year>/<mm>/<filename>` —
  `extract_legacy_media_paths` in `src/lib/legacy-media-source.ts` matches on that prefix. That
  prefix is **not exclusive to images** — besides the PDFs noted below, four legacy articles
  (ids 210, 264, 305, 356) link a `.doc`/`.xls` attachment (course sign-up sheets, a cleanup
  report) from the exact same folder scheme. `extract_legacy_media_paths` now excludes `.pdf`
  explicitly (see below) but still matches `.doc`/`.xls`; those get caught downstream by the
  image magic-byte check and surfaced as `unresolved` rather than a false `missing_hash`.
- Legacy **PDFs have no fixed path prefix** — seen under `/media/pdf/`, `/media/DK/`, and even
  `/media/img/novice/<year>/<mm>/*.pdf` (the same per-article folder scheme as images). PDF
  extraction has to scan every `href` ending in `.pdf` regardless of path shape, not pattern-match
  a folder. Because that overlaps the image-path scheme, `extract_legacy_media_paths` must
  explicitly exclude `.pdf` — it didn't originally, so a PDF living under `/media/img/novice/...`
  (confirmed on legacy_id 637, 662, 667) was extracted *twice*: once correctly as `kind: "pdf"`
  via the href scan, and once incorrectly as `kind: "image"` via the path regex, inflating
  `missing_hash` with a duplicate, mislabeled finding. Fixed 2026-08-18.
- `resolve_pdf_bytes` (`src/lib/resolve-static-pdf.ts`) resolves a PDF url served-mirror-first,
  live-fetch-fallback, and verifies the `%PDF-` magic bytes either way — the old ASP server
  returns HTTP 200 with a generic HTML error page for some dead urls instead of a real 404, so
  status alone can't be trusted. `resolve_legacy_image_bytes` (`src/lib/legacy-media-bytes.ts`)
  didn't do the image equivalent until 2026-08-18 — confirmed hitting exactly this on legacy_id
  534's `slika_5.JPG` (a 529-byte "Napaka | Error" HTML page got silently hashed as if it were
  the image, producing a false `missing_hash`). Now checks JPEG/PNG/GIF magic bytes the same way,
  hardcoded like `PDF_MAGIC` rather than pulling in a `file-type`-style dependency — the legacy
  site only ever serves those three formats under this path. A served-mirror mismatch is treated
  as a miss (not thrown), unlike the PDF case, because of the `.doc`/`.xls` overlap noted above:
  there it means "this ref was never an image," not mirror corruption.
- Filenames get re-sanitized between the legacy site and whatever produced today's storage keys
  (`radescica_02__13_.JPG` on the mirror vs. `radescica_02_13.jpg` as a B2 key) — any filename
  matching has to normalize (`normalize_basename`: lowercase, alphanumeric-only) rather than
  compare verbatim.

## Media hosting: two unrelated pipelines

There are **two independent ways bytes end up hosted**, and they don't know about each other:

- `ingest_media`/`ingest_media_from_url` (`src/server/media/ingest.ts`) → `gradivo.jknm.org`,
  content-addressed (sha256 against `Media.hash`, `onConflictDoNothing`), creates a `Media` row.
  This is the path everything editor-facing and `scripts/legacy-media-hash-diff.ts` uses.
- The static dehotlinking pipeline (`scripts/dehotlink-article-links.ts`,
  `scripts/dehotlink-static-pages.ts`, via `resolve_pdf_bytes` + `static_content_url`) →
  `vsebina.jknm.org`, **no `Media` row at all** — just a bucket upload.

The same file can legitimately exist as **byte-identical copies in both places** with zero link
between them — e.g. a PDF an article links via `vsebina.jknm.org` can also have an orphaned
`Media`-table duplicate from an unrelated ingest attempt. `media-hash-diff`'s `wrong_article`
finding surfaces this: don't assume it means "attach the existing `Media` row" — check whether
the article already links a *working* url before treating it as a fix candidate (see
`scripts/fix-wrong-article-media.ts`'s two-case split).

- Dead legacy hosts to recognize on sight (`src/lib/stale-media-refs.ts`):
  `jknm.s3.eu-central-1.amazonaws.com` (original AWS bucket, still serving but on an
  unowned account) and `jknm-novice.s3.eu-central-003.backblazeb2.com` (Backblaze's native
  endpoint, already 404ing in production). `scripts/rescue-stale-media.ts` exists specifically
  to sweep these into `gradivo.jknm.org` and rewrite `content_json`, but as of 2026-08-18 it's
  still unrun against real content: a dry run finds 3 live articles matching a dead host
  substring anywhere in their serialized `content_json` — legacy_id 606, legacy_id 637, and
  637's unpublished `[2]` duplicate draft. **606's is a false alarm, not a media problem** —
  checked its actual `content_json` and all 9 images are already `gradivo.jknm.org`; the "2
  stale assets" `find_stale_asset_urls` found are two garbled outbound *text* links in the body
  (`<a href="https://jknm.s3.eu-central-1.amazonaws.com/.../si">JKNM</a>` and an even more
  mangled `https:/https://...sidg.si/` one) that happen to contain the stale-host substring —
  `find_stale_asset_urls` matches anywhere in the blob, not scoped to `image`/`file` blocks, so
  it can't tell "broken media reference" from "unrelated link that happens to contain this
  string." Running `rescue-stale-media.ts --execute` against 606 would try to "rescue" these as
  downloadable files, which they aren't — needs a manual link fix (probably meant to point at
  jknm.si and sidg.si respectively), not the rescue pipeline. **637 is the real one**: 15
  genuinely broken image/PDF refs, still on the Backblaze host, confirmed via
  `media_to_articles` being empty for that article (nothing ever reached the `Media` table) —
  this is *why* `legacy-media-hash-diff.ts` reports zero attached media / zero DINOv2 candidates
  for it, not a media-hash-diff bug.
- `media_to_articles` is **fully derived** from `content_json` on every save
  (`reconcile_media_to_articles`, `src/server/article/reconcile-media.ts`) — it is never safe to
  insert a row into it directly. Anything not reachable from `content_json`'s image blocks or
  inline `<a href>`s gets swept back out on the next save.

## The 2024–2025 "missing media" red herring

`legacy-media-hash-diff.ts`'s `missing_hash` findings are dominated by `legacy_id` ~625–691
(2024–2025 articles), and the overwhelming majority of these are **not lost media** — spot
checks showed articles with the exact same image-block *count* as legacy image-ref count, just
different bytes. The maintainer confirmed why: recent articles were migrated with **fresh
originals supplied directly** (typically 480px legacy-compressed → ~1500px original), not the
old site's compressed copies — and those originals may be cropped, color-graded, or reordered
differently from the legacy version. A sha256 diff correctly reports these as non-matching bytes;
it says nothing about whether the *photo* was lost. Don't re-ingest the legacy compressed copies
over these — that would be a quality downgrade, not a fix.

A perceptual-similarity pass (planned: DINOv2 embeddings, cosine similarity, scoped to the
same article's currently-attached images as match candidates) is the intended way to separate
"same photo, re-supplied at higher quality" from "actually missing" before deciding what, if
anything, to fix — see the waiver system below.

- **Built and running** as of 2026-08-18: `tools/perceptual-match/match.py` (DINOv2-small,
  `facebook/dinov2-small`, CLS-token cosine similarity), fed by
  `scripts/prepare-perceptual-match.ts` (downloads legacy + candidate bytes to
  `artifacts/perceptual-cache/`, gitignored) and reviewed by
  `scripts/review-perceptual-matches.ts`. Thresholds: `>= 0.90` same, `>= 0.75` maybe, else
  no_match.
- Against the current (post-dedup) 27 real image findings, every one lands in `no_match` — no
  auto-waivable "same" cases yet. Spot-checked the closest score (legacy_id 642, 0.71) by eye:
  it's a different photo of the same rappelling-training session (different person in frame), not
  the same photo re-supplied — so the threshold isn't being overly strict here, this genuinely
  reads as a different/lost photo. Worth re-checking this read if the threshold ever gets tuned
  against real ground truth (the module docstring already flags it as untuned).
- `artifacts/s3-jknm` (gitignored, not produced by any script in this repo — a local mirror the
  maintainer keeps separately) was checked as a possible source of higher-resolution originals
  for legacy_id 606 and 637's broken images. It only has the old 480px legacy-compressed copies
  (checked via JPEG SOF header parsing), not the ~1500px originals described above — not usable
  as a fix source for either article.

## Waivers

`scripts/legacy-link-diff.ts` and `scripts/legacy-media-hash-diff.ts` are meant to be re-run
freely, so any finding that's been looked at and deliberately left alone (dead upstream link,
intentional resupply, etc.) belongs in `artifacts/link-diff-waivers.jsonc` /
`artifacts/media-hash-diff-waivers.jsonc`, not in a mental list — see
`src/lib/legacy-diff-waivers.ts` for the matching key and rationale (JSONC over a database: this
is single-user, low-volume, and a human needs to read *why* next to the entries it covers).

## Misc gotchas

- Algolia facet attributes (e.g. `author_ids`) are configured by hand on the Algolia dashboard,
  not as settings-as-code — verify there before assuming a new facet needs a code change (bit the
  `/arhiv` redesign work, issue #40/#42).
- `card.tsx`'s `ArticleAlgoliaCard` has an `is_legacy_hit` branch (`/^\d+$/.test(hit.objectID)`)
  still driving which S3 thumbnail-path convention is used for the image — separate from the now
  removed `is_legacy_hit`-based permalink branch. Flagged in `TODO.md` as possibly dead (every
  live Algolia hit today has a uuid `objectID`), not yet confirmed either way.
- The vendored Next.js in this repo is a **modified fork** — read
  `node_modules/next/dist/docs/` before trusting training-data assumptions about its APIs or
  conventions (see `AGENTS.md`).
