# Legacy-site / migration reference notes

Non-obvious facts about the old `www.jknm.si` (classic ASP, 2008–2025) site and how it maps onto
this rewrite. Reference material, not open work — see GitHub issue #48 and `TODO.md` for anything
still to decide or do.

## Legacy content range and sources

- `legacy_id` 1–691 is real migrated content; 692 is the old site's goodbye page, not an article
  (`LAST_REAL_LEGACY_ID` in `audit-all-discrepancies.ts`). Not contiguous — some early articles
  were hard-deleted on the old site.
- Two sources cover legacy body content, merge both: `artifacts/Objave.txt` (old admin DB's CSV
  export, positional columns — `[0]`=legacy_id, `[4]`=title, `[6]`=HTML body, `[8]`=published
  date) and `artifacts/legacy-html/<id>.html` (scraped, covers ids the CSV misses — body is the
  `<h1>`'s parent node's innerHTML).
- The 5 evergreen content pages (`/klub`, `/publiciranje`, `/raziskovanje`, `/varstvo`,
  `/zgodovina`) were **rebuilt from scratch**, not migrated — nothing to diff them against.
  Their static-page-link/PDF-hotlink cleanup is a separate, manual, one-off pass (see below),
  not something the two diff scripts cover.
- `served` mirror (`D:\Luka\JKNM\served`, 2023 snapshot) has real article HTML but its
  `si/<section>/default.asp` files are empty ASP redirect stubs — no legacy content-page bodies
  there. Its image tree stops at 2023; `legacy_id` ~625–691 media needs a live fetch against
  `www.jknm.si` (still up, `robots.txt`-disallowed but not blocked).

## Legacy link/media shapes

- Internal article links: `www.jknm.si/si/?id=<legacy_id>` (optional decorative `&l=<year>`).
- Static-section links: mapped by `src/lib/legacy-si-paths.ts`'s `resolve_legacy_static_path`.
  `izobrazevanje/kodeks` and `klub/interes` aren't lost — folded into `/klub`'s prose at a
  different URL (verified against `content_json` directly).
- Images: fixed scheme `/media/img/novice/<year>/<mm>/<filename>`. Not exclusive to images —
  legacy_id 210/264/305/356 link `.doc`/`.xls` attachments from the same scheme; those fail the
  image magic-byte check and surface as `unresolved`, not `missing_hash`.
- PDFs have **no fixed path prefix** (`/media/pdf/`, `/media/DK/`, even
  `/media/img/novice/<year>/<mm>/*.pdf`) — extraction scans every `href` ending in `.pdf`.
- Dead legacy urls often return HTTP 200 with a generic HTML error page instead of a real 404 —
  `resolve_pdf_bytes`/`resolve_legacy_image_bytes` verify magic bytes (`%PDF-`, JPEG/PNG/GIF)
  rather than trusting status codes.
- Filenames are re-sanitized inconsistently across sources — match by `normalize_basename`
  (lowercase, alphanumeric-only), never verbatim.

## Media hosting: two unrelated pipelines

- `ingest_media`/`ingest_media_from_url` (`src/server/media/ingest.ts`) → `gradivo.jknm.org`,
  content-addressed (sha256 against `Media.hash`), creates a `Media` row. Everything
  editor-facing and `legacy-media-hash-diff.ts` uses this path.
- The static dehotlinking pipeline (`scripts/dehotlink-static-pages.ts`, via `resolve_pdf_bytes`
  + `static_content_url`) → `vsebina.jknm.org`, **no `Media` row**.
- The same file can legitimately exist as byte-identical copies in both places with no link
  between them. `media-hash-diff`'s `wrong_article` finding means "a `Media` row with this hash
  exists somewhere" — not "this article's link is broken." `scripts/fix-wrong-article-media.ts`'s
  two-case split only rewrites *dead*-host links (`stale-media-refs.ts`'s two hardcoded hosts);
  a working `vsebina.jknm.org` link is left alone by design, reported as "already on a working
  host" rather than touched. The 4 `wrong_article` findings on legacy_id 659/663/664 (shared DK
  journal PDFs) were exactly that case — confirmed 2026-08-20 as harmless — but the maintainer
  later decided (2026-08-21) these 3 articles specifically should be on the tracked
  `gradivo`/`Media` pipeline rather than the untracked `vsebina` bucket, so
  `scripts/retired/repairs/fix-vsebina-to-gradivo-media.ts` (a one-off, not
  `fix-wrong-article-media.ts`) repointed all 4 links at the existing `gradivo` `Media` rows and
  reconciled. `legacy-media-hash-diff.ts` now finds 0 unwaived findings.
- `media_to_articles` is **fully derived per-article** from that article's own `content_json` on
  save (`reconcile_media_to_articles`) — never insert a row directly. Two articles legitimately
  sharing one `Media` row (same PDF cited from both) each need their *own* save/reconcile to get
  their own join row — an article whose `content_json` already links a shared PDF but was never
  itself re-saved has no join row of its own, and `sweep-stale-content.ts`'s orphan check only
  looks at `media_to_articles`, not `content_json` text. So it can look orphaned and get deleted
  even while still genuinely referenced.

## The 2024–2025 "missing media" red herring

Most `missing_hash` findings in `legacy_id` ~625–691 are **not lost media** — recent articles
were migrated with fresh ~1500px originals supplied directly (not the old site's ~480px
compressed copies), so a sha256 diff correctly reports different bytes without the photo being
lost. Don't re-ingest the legacy compressed copies over these.

A DINOv2 perceptual-similarity pass (`tools/perceptual-match/match.py`, CLS-token cosine
similarity, thresholds `>= 0.90` same / `>= 0.75` maybe) separates "re-supplied at higher
quality" from "actually missing" before deciding what to waive vs. fix. Waived matches go in
`artifacts/media-hash-diff-waivers.jsonc`.

## Fixing findings

- `missing_article_link`/`missing_static_link`: `scripts/propose-link-fixes.ts` finds the
  legacy anchor's own text in the target article's `content_json` blocks; a unique hit is an
  unambiguous insertion point (`unique_match.json`), applied by `scripts/apply-link-fixes.ts`.
  0 or >1 hits fall to `no_match.json`/`ambiguous.json` (manual). Fully resolved as of
  2026-08-20 — re-running `legacy-link-diff.ts` finds 0 `missing_article_link`/
  `missing_static_link` findings left.
- `wrong_article`: `scripts/fix-wrong-article-media.ts` — see two-case split above. 2026-08-21:
  all remaining findings resolved via the `vsebina`→`gradivo` one-off, not this script — see
  above.
- Static content-page hotlinks (Klub/Varstvo/Zgodovina) aren't legacy_id-driven, so there's no
  findings JSON for them — fixed with a hardcoded one-off, `scripts/fix-static-page-links.ts`.
  2026-08-20: ingested & rewrote 8 Zgodovina `Dolenjski_kras_N.pdf` links (old target was the
  `/si/publikacije/krasNN/` landing page, not the PDF itself — resolve via `curl`/page scrape,
  not WebFetch's AI summary, which hallucinated a wrong domain here) and 21 Varstvo PDF links
  (already direct PDF urls, just never ingested). Klub's self-link was already fixed by hand.
  legacy_id 300/504 (separate news articles also linking `krasNN`) confirmed done/non-issues by
  2026-08-20.
- `scripts/rescue-stale-media.ts` sweeps the two dead legacy hosts
  (`jknm.s3.eu-central-1.amazonaws.com`, `jknm-novice.s3.eu-central-003.backblazeb2.com`, see
  `src/lib/stale-media-refs.ts`) into `gradivo.jknm.org`. `find_stale_asset_urls` matches
  anywhere in the serialized blob, so a text link that merely *contains* the stale-host string
  (not an actual media reference) can false-positive — check before running `--execute`.

## Waivers

Any finding deliberately left alone (dead upstream link, intentional resupply, etc.) belongs in
`artifacts/link-diff-waivers.jsonc` / `artifacts/media-hash-diff-waivers.jsonc`
(`src/lib/legacy-diff-waivers.ts`), not a mental list.

## Misc gotchas

- editorjs's core Link inline tool (`vendor/editorjs/src/components/inline-tools/inline-tool-link.ts`,
  `addProtocol`) treats a bare `"/"` as *not* internal (`/^\/[^/\s]/` needs a char after the
  slash) and prepends `http://`, producing `http:///`. Use an absolute URL instead of a bare `/`
  for self-links; not worth patching the vendored tool for one link.
- Algolia facet attributes (e.g. `author_ids`) are configured by hand on the dashboard, not as
  settings-as-code — verify there before assuming a new facet needs a code change.
- `card.tsx`'s `ArticleAlgoliaCard` still has an `is_legacy_hit` branch
  (`/^\d+$/.test(hit.objectID)`) driving which S3 thumbnail-path convention is used — flagged in
  `TODO.md` as possibly dead, not yet confirmed.
- The vendored Next.js in this repo is a modified fork — read `node_modules/next/dist/docs/`
  before trusting training-data assumptions (see `AGENTS.md`).
