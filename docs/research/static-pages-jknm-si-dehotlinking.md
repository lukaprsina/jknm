# Self-hosting `www.jknm.si` assets referenced from static MDX pages

Research only — no script written, per task scope. Findings cited to file:line
where feasible; speculation is labeled.

## 1. Bucket names/purposes — user's belief mostly correct, with one gap

- `src/env.js:60-61` declares exactly two bucket-name env vars:
  `NEXT_PUBLIC_AWS_PUBLISHED_BUCKET_NAME` and `NEXT_PUBLIC_AWS_MEDIA_BUCKET_NAME`.
- `.env.local:53-54` sets these to `NEXT_PUBLIC_AWS_PUBLISHED_BUCKET_NAME="jknm-novice"`
  and `NEXT_PUBLIC_AWS_MEDIA_BUCKET_NAME="jknm-gradivo"` — matching the user's
  description (legacy EditorJS bucket, unused; current EditorJS media bucket).
- **There is no `jknm-vsebina` bucket, and no dedicated env var for
  static-page assets, anywhere in `src/`.** Grepped `src/` for
  `PUBLISHED_BUCKET_NAME|MEDIA_BUCKET_NAME|s3\.|S3Client|new S3|B2\b` — every
  hit resolves to one of the two known buckets (`src/lib/s3-utils.ts:15-51`,
  `src/lib/s3-publish.ts:3-6`, `src/app/api/media/route.ts`,
  `src/lib/media-upload.ts`, `scripts/migrate-legacy-media.ts:35`). The
  `jknm-vsebina` name is **not attested in the codebase** — either it doesn't
  exist yet as a bucket, or it exists only in the B2 account and was never
  wired into the app (the `b2` CLI check in §4 can settle which, by listing
  actual buckets). This is the first thing to verify before writing any
  script: run `b2 bucket list` and see what bucket names actually exist.
- The B2 endpoint and URL-construction convention live in
  `src/lib/s3-publish.ts:3-6`:
  ```ts
  export function get_s3_prefix(url: string, bucket: string) {
    return `https://${bucket}.s3.${env.NEXT_PUBLIC_AWS_REGION}.backblazeb2.com/${url}`;
  }
  ```
  and `src/lib/s3-utils.ts:19` hardcodes the S3-compatible endpoint
  `https://s3.eu-central-003.backblazeb2.com` for the AWS SDK client. Both are
  scoped only to `jknm-novice`/`jknm-gradivo` call sites — nothing here
  currently constructs a URL into a hypothetical static-assets bucket.

## 2. How `www.jknm.si` actually appears in the static MDX

- Affected files (5 total, confirmed by `grep -rl "jknm\.si" src/app/(static)`):
  `klub/content.mdx`, `publiciranje/content.mdx`, `raziskovanje/content.mdx`,
  `varstvo/content.mdx`, `zgodovina/content.mdx`.
- Total raw `jknm.si` occurrences across those 5 files: **468** lines matched
  (grep counts lines, not links; many lines are markdown table rows with one
  link each, so the true link count is close to this).
- **Two distinct categories of link, which matter for scripting:**
  1. **File assets** — all absolute `https://www.jknm.si/media/...` URLs.
     Grepping matched links by extension across the static pages: **507 `.pdf`
     matches, 0 of any other extension** (no `.jpg`/`.png`/etc., and no
     `<img>` or `![...]` Markdown-image syntax reference `jknm.si` at all —
     grep for `!\[` in `src/app/(static)/**` returned zero hits, so the
     static pages currently contain **no images at all**, hotlinked or
     otherwise). This directly answers the user's suspicion about img srcs:
     **there is nothing to find there** — confirmed absence, not missing
     coverage.
     Two consistent path prefixes recur: `https://www.jknm.si/media/pdf/...`
     and `https://www.jknm.si/media/DK/...` (e.g.
     `publiciranje/content.mdx:25-107`, `klub/content.mdx:235,237`). This
     prefix consistency is exactly what makes scripted extraction and
     resolution tractable — a static-asset ref is identifiable by regex
     `https://www\.jknm\.si/media/[^)\s"]+` with high precision.
  2. **Internal old-CMS page links** — `https://www.jknm.si/si/?id=<n>[&l=<year>]`,
     e.g. `klub/content.mdx` and others; **52 occurrences** counted via
     `grep -c "jknm\.si/si/?id="`. These are links to old news-article pages
     on the 2008 CMS, not files — they are **not** "missing asset" problems.
     Speculatively, some may have a corresponding migrated `/novica/<slug>`
     article and could be redirected there instead of simply de-hotlinked;
     others may have no migrated counterpart. This is a **separate
     sub-problem** from file self-hosting and should not be folded into the
     same script/pass without a deliberate decision — flagging it so it
     isn't silently dropped, but no further investigation was done here since
     it's outside the "self-host referenced files" framing of the task.
- No `http://` (non-`www`) variant or bare `jknm.si` (no `www`) variant was
  found distinct from the `https://www.jknm.si` form in the sampled grep
  output — the 468/507 figures above should already cover the corpus, but a
  final script should still defensively match `https?://(www\.)?jknm\.si`.

## 3. No existing pattern for referencing static-page assets from MDX

- Grepped the 5 affected MDX files for `jknm-gradivo|jknm-novice|backblaze` —
  **zero hits**. The static pages currently reference **no** B2-hosted asset
  at all; every non-text asset reference in them is the still-unconverted
  `www.jknm.si` link.
- Conclusion (a finding, not speculation): there is **no seam yet** for
  "static-page asset URL" in this codebase. `get_s3_prefix()`
  (`src/lib/s3-publish.ts:3-6`) is the only existing helper that builds a B2
  URL from a bucket + key, and it's a generically-shaped deep-enough function
  (bucket name is a parameter, not hardcoded) that a new static-asset bucket
  could reuse as-is — call it with whatever bucket the `b2 bucket list` check
  in §1 turns up (or a newly created one), rather than inventing a second URL
  builder. If a static-assets bucket doesn't exist yet, this is the point
  where the user needs to decide/create one (candidate name `jknm-vsebina` is
  unverified — see §1).

## 4. `b2` CLI — available in this environment

- `b2 version` → `b2 command line tool, version 4.7.0 (b2sdk version 2.12.0)`,
  found at `/c/Users/peter/.local/bin/b2`. It is installed and on `PATH` in
  this sandbox.
- Auth: the B2 application key pair already sits in `.env.local` as
  `AWS_ACCESS_KEY_ID`/`AWS_SECRET_ACCESS_KEY` (labeled "Backblaze B2 app" in
  `.env.local`, just above the `NEXT_PUBLIC_AWS_PUBLISHED_BUCKET_NAME` /
  `NEXT_PUBLIC_AWS_MEDIA_BUCKET_NAME` lines) — the same key pair the Next.js
  app uses via the AWS S3-compatible SDK (`src/lib/s3-utils.ts:17-20`). The B2
  CLI's own auth (`b2 account authorize` or `B2_APPLICATION_KEY_ID`/
  `B2_APPLICATION_KEY` env vars, per b2-cli convention) is a **separate**
  credential store from the app's `.env.local` — it wasn't checked whether
  `b2 account get` currently reports an authorized account in this sandbox;
  worth confirming before scripting the download/sync steps, but the
  credential material itself is already present and reusable.
- Not yet confirmed: which bucket(s) `b2 bucket list` shows as actually
  existing under this account — do that before assuming `jknm-vsebina` is
  real (see §1).

## 5. `D:\Luka\JKNM\served` — accessible from this environment

- Contrary to the "may be sandboxed" caveat in the task brief, **this
  directory is directly readable from this sandbox**: `ls "D:\Luka\JKNM\served"`
  succeeded and shows a structure that mirrors the old site's URL layout —
  top-level `media`, `img`, `inc`, `si`, `klub`, `publiciranje`, `raziskovanje`,
  `varstvo`, plus `default.asp`, `global.asa`, `robots.txt` (classic ASP-era
  static mirror). `media/` contains `DK/`, `pdf/`, `download/`, `img/`, `xls/`
  subdirectories, and `media/pdf/` and `media/DK/` contain files whose names
  line up exactly with the MDX links (e.g. `media/DK/DK1_00_Naslovnica__kolofon_in_uvodnika.pdf`
  matches `publiciranje/content.mdx:25`'s
  `https://www.jknm.si/media/DK/DK1_00_Naslovnica__kolofon_in_uvodnika.pdf`).
- This means **source (b) in the user's plan — copy from the local `served`
  mirror — is directly usable by a script run in this environment**, with
  path resolution as simple as stripping the `https://www.jknm.si` prefix
  and joining onto `D:\Luka\JKNM\served`. This is a materially better primary
  source than re-fetching from the live site: no network flakiness, no
  risk of hitting a now-moved-or-404'd URL, and the path-for-path match
  removes any need for fuzzy filename resolution. Live-site fetch should be
  treated as the fallback for any file *not* found in `served` (if any exist
  — not yet checked file-by-file), not the primary path.

## 6. Verdict on the proposed approach, and the seam it implies

**The overall shape holds up**, with two adjustments:

1. Skip step (1) as literally specified ("download the bucket locally with
   `b2 sync`"), or rather: don't gate the whole pipeline on it. Since no
   static-assets bucket is confirmed to exist yet (§1/§3), "sync down the
   current bucket" may sync down nothing. Do the `b2 bucket list` check
   first; if the bucket doesn't exist, step (1) becomes "create the bucket,"
   not "download it."
2. Prefer `D:\Luka\JKNM\served` over live-site fetch as the default resolver
   (§5), with live fetch as fallback only, and treat the `/si/?id=` internal
   links (§2.2) as an explicitly separate, deferred decision rather than
   something the same script tries to resolve.

The rest of the pipeline — scan → resolve → place in local mirror → rewrite
MDX → `b2 sync` up — decomposes cleanly into two deep, independently testable
modules, at seams that already match natural unit boundaries in the data:

- **Module A — extraction**: interface `find_external_asset_refs(mdx_source: string): AssetRef[]`
  where `AssetRef` is `{ url: string, position: ... }` (or just distinct
  `url`s, since MDX rewriting can be a global string replace per unique URL).
  Given the 100% `.pdf`-under-`/media/` shape found in §2, this can be a pure
  string→data function, deep in the sense that a caller doesn't need to know
  the regex or which of the 5 files are affected — feed it MDX text, get refs
  back. Trivially unit-testable with literal MDX fixtures, no I/O, no network,
  no B2 — the kind of module that earns the "one adapter means a hypothetical
  seam" caution: there's no need for multiple extraction adapters, so this
  doesn't need an injected strategy, just a pure function.
- **Module B — resolution**: interface
  `resolve_asset(url: string): Promise<{ local_path: string } | null>`,
  internally trying the `served` mirror first (path-translate and stat) and
  falling back to an injected fetcher for the live site. This is the actual
  deep module — the two adapters (local-mirror lookup, live HTTP fetch) are a
  **real** seam (per the skill's "two adapters means a real one" rule) since
  behavior genuinely varies across them (local mirror can 404 for files never
  archived; live site can 404 for files since removed) and a caller (or a
  test) shouldn't need to know which one satisfied a given request — just
  whether resolution succeeded and where the bytes ended up. Accepting the
  fetcher as a dependency rather than constructing it internally also makes
  this trivially testable against a fake `served` directory and a fake
  fetcher, per the skill's testability guidance.
- **Module C — placement + rewrite**: given a resolved `{ old_url, local_path }`,
  copies the file into the local bucket-mirror tree at a decided key
  (speculative: mirror the original `/media/...` path structure into the new
  bucket, since that's a legible, collision-free key scheme and requires no
  new naming decision) and returns the new canonical URL via
  `get_s3_prefix()` (§3) — this is the one place a **new** helper might be
  worth adding next to `get_s3_prefix` if the URL shape for static assets
  ends up different from EditorJS media, but reusing the existing function
  as-is is the default until proven otherwise.
- The MDX rewrite itself (replace every matched old URL with its resolved new
  URL) is a thin, uninteresting string-replace pass over Module A's + C's
  outputs — no need for its own seam.
- `b2 sync` up (final step) is an external-process call, not something to
  wrap in an interface; it's already a deep tool provided by the `b2` CLI
  itself.

Net effect: three small, pure-ish modules instead of one monolithic script —
each independently testable without touching the network, the real `served`
directory, or B2, and each deletable/replaceable on its own (e.g. swapping
the live-fetch adapter for a different HTTP client later doesn't touch
Module A or C).

## 7. Out of scope — noted for follow-up only

The EditorJS-article migration script's PDF/image-link bug (`/novica/<slug>`
articles) is a **separate** pipeline from everything above. The migration
script most likely to be the one in question is
`d:\dev\js\jknm\scripts\migrate-legacy-media.ts`, which uploads legacy media
referenced by article content into the `jknm-gradivo` bucket
(`scripts/migrate-legacy-media.ts:34-40`) by calling
`extract_media_refs_from_content` from `src/lib/editor-utils.ts` (not read in
this pass). This is plausibly where a PDF/href-vs-image-src parsing gap could
live, but this was not investigated further — deliberately, per the task's
explicit out-of-scope instruction. Left here only as a pointer for whoever
picks that follow-up up next.
