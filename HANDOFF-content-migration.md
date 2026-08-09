# HANDOFF — static pages → articles migration

Continuation of the same effort as before — this file replaces the previous version (which predates #34/#35/#36). **The plan lives on the issue tracker, not here**:

- **Map**: [#33 — Migrate static content pages into the articles table (article_kind: content)](https://github.com/lukaprsina/jknm/issues/33). Destination, Notes, Decisions-so-far, "Not yet specified" fog, "Out of scope". Read in full before doing anything.
- **Closed**: [#34 — Audit call sites assuming every published article is news](https://github.com/lukaprsina/jknm/issues/34) (resolved, see `docs/research/article-kind-call-site-audit.md`). [#35 — Add article_kind schema field and gate retitle-remint](https://github.com/lukaprsina/jknm/issues/35) (resolved, commit `7ec8adf`).
- **Open, claimed (assigned lukaprsina)**: [#36 — Zgodovina migration pilot](https://github.com/lukaprsina/jknm/issues/36) — the current frontier ticket, **mid-flight, architecture just changed** (see below). Do not close it without a real staging run validating the approach.

## Current state of #36 — read this before writing code

A first pass built a Playwright-based pilot (`scripts/migrate/`: `capture-admin-session.ts`, `pages.ts`, `paste-static-page.ts`, `pdf-postpass.ts`) that drove a real browser to paste a live static page's rendered HTML into a fresh admin draft's EditorJS instance via a synthetic `paste` `ClipboardEvent`. That work is documented in a progress comment on #36, but **the user rejected the direction**: "playwright is weak for my use case." Two alternatives were offered (drop Playwright for a normal route/button/API-call approach, or add email+password auth to better-auth to make headless login scriptable) — the user picked the first, specifically:

**Chosen direction**: write a **deterministic HTML → EditorJS-blocks converter** (pure function, unit-testable with vitest) instead of simulating a browser paste. This also removes the auth problem entirely — no browser session needed, because the resulting draft gets written directly to the DB the same way every other script in `scripts/` already does (see `scripts/apply-article-kind-migration.ts` for the established pattern: shared `db` client, `main().catch().finally(() => process.exit())`).

**Confirmed, non-obvious**: `vendor/editorjs/src/components/modules/paste.ts` (the library's internal paste-handling module, ~1000 lines) is **not reusable** as a headless conversion API — it's tightly coupled to a live browser DOM and running `Block`/`BlockAPI` instances, and isn't part of the documented public API (`vendor/editorjs/docs/` only covers tool-authoring, not paste internals). So the converter has to be hand-written against our own toolbox, not borrowed from the library.

**Resolved since**: the block-shape mapping table is written — see `docs/research/zgodovina-html-to-editorjs-mapping.md`. It also revises the render approach: no browser needed at all (not even headless) — `/zgodovina` is a server component, so a plain `fetch()` against a running dev server already returns full server-rendered HTML. The `scripts/migrate/` tree was also cleaned up: `capture-admin-session.ts` and the Playwright-driven half of `paste-static-page.ts` are deleted; the reusable draft-insert helpers moved to `scripts/migrate/create-draft.ts`; the `playwright` devDependency and its two `package.json` scripts are removed. `pages.ts` and `pdf-postpass.ts` are unchanged and still the right shape. **Next actual step: write the converter** (HTML string → `ArticleContentType`, pure function, fixture-tested) per the mapping table — this was deliberately not started this session.

### What the converter needs to know (gathered this session, not yet written down elsewhere)

- **Source HTML**: don't build a separate MDX→HTML render step. `/zgodovina` (and the other 4 `src/app/(static)/*/page.tsx` routes) are already live, working Next.js routes rendering exactly the target HTML. Confirmed `TableOfContents` (`src/components/toc/table-of-contents.tsx`) and `ImageGallery` (`src/components/image-gallery.tsx`) both render via React `createPortal` elsewhere in the DOM — so the DOM element wrapping the page's `<h1>` (i.e. its parent) contains *only* the MDX content, nothing to strip out. This still holds true if the converter reads from a fetched/rendered HTML string rather than a live Playwright DOM — the container boundary just needs to be found by parsing (`node-html-parser`, already a devDependency, currently unused anywhere in the repo — no existing usage convention to copy).
- **Block toolbox** (what to map onto): `src/components/editor/plugins.ts` — `header`, `paragraph`, `image` (caption/stretch/border), `attaches`, `table` (`@editorjs/table`, `withHeadings: true`), `list`, `quote`, `warning`, `code`, `checklist`, `delimiter`, `embed`, inline marks (`marker`/`underline`/`inlineCode`/custom `superscript`/`subscript`). Covers every shape the 5 MDX pages use.
- **Block data shapes** (exact fields, from `src/lib/editor-utils.ts:34-54`):
  - `image`: `{ caption: string, file: { url, width?, height? }, stretched?, withBackground?, withBorder? }`
  - `attaches`: `{ file: { url, size, name, extension }, title }`
  - Headers/paragraphs store raw HTML strings for inline content (bold/links/superscript) — the existing MDX renderer already handles `strong`→`<b>` and forces `target="_blank"` on `<a>` (`mdx-components.tsx`), so the converter's inline-HTML handling should match that, not reinvent it.
- **Images**: ingest directly via `ingest_media` (`src/server/media/ingest.ts`) — content-addressed by sha256 (safe to re-run), NOT via the browser's `/api/media` route (no browser involved anymore). Same function the PDF post-pass already calls (`ingest_media_from_url`).
- **PDF links**: decided to keep them as **inline links**, not convert to `attaches` blocks. `extract_inline_media_urls` (`src/lib/editor-utils.ts:120-133`) already treats an inline `<a href="https://gradivo.jknm.org/...">` as a first-class reconciled media reference (`MEDIA_PUBLIC_DOMAIN = "gradivo.jknm.org"`, `src/lib/media-upload.ts:4`) — exactly how news articles link PDFs from prose today. So: ingest via `ingest_media_from_url`, then string-replace the old `vsebina.jknm.org` href with the new `gradivo.jknm.org` one. `scripts/migrate/pdf-postpass.ts` already implements this half correctly and can likely be reused/merged into the new converter almost as-is (its regex: `https://vsebina\.jknm\.org/[^"'\s\\<>)]+\.pdf`).
- **Draft creation**: mirror `create_article` (`src/server/article/new-article.ts`) as a direct DB insert — not the `createArticle` oRPC action (it's an `@orpc/next` server action, no stable fetchable endpoint from a script). `scripts/migrate/paste-static-page.ts` already has a working version of this insert to copy from.
- **Admin user id for `created_by`**: no scripted login means no "current user" — the old script just picked the first `users` row (or matched `--admin-email`). Same approach still works since it's a raw DB read, not an authenticated action.

### Files in `scripts/migrate/` (post-cleanup, current)

- `pages.ts` — the 5-page slug/route/title config, unchanged.
- `create-draft.ts` — `pick_admin_user_id` + `create_draft`, extracted from the old `paste-static-page.ts` (which is deleted). Direct-DB-insert draft creation, no auth/browser involved.
- `pdf-postpass.ts` — unchanged, still correct: dry-run-by-default PDF re-ingestion/href-rewrite.
- `capture-admin-session.ts` is **deleted** (no browser session needed once there's no browser). The `playwright` devDependency and the `migrate:capture-session`/`migrate:paste` `package.json` scripts are removed too.
- **Not yet written**: the converter itself, and a script that wires `fetch(static route) → converter → create_draft insert → pdf-postpass` end to end.

### Environment constraint discovered this session

**This sandbox's Bash tool has no network path to `localhost`** — a `next dev` server started fine in the background, but `curl localhost:3000` from the same tool timed out (connection refused/000), even though the server logged "Ready". Don't waste time trying to spin up a live dev server + browser/HTTP client to test against from this environment; the eventual converter should be unit-tested with fixture HTML instead (vitest, no server needed), and any live-staging verification needs to happen on the user's own machine.

## Carried over from the original handoff (still true)

**Env / staging setup** (`.env.local` / `.env.staging`, gitignored):
- Run staging commands via `dotenv -e .env.local -e .env.staging --override -- <command>` — `--override` is required or `.env.staging` is silently ignored.
- B2 buckets are shared between staging and prod (not split) — deliberate, since `ingest_media` is idempotent/content-addressed.
- Bucket env vars: `NEXT_PUBLIC_AWS_MEDIA_BUCKET_NAME=jknm-gradivo`, `NEXT_PUBLIC_AWS_STATIC_BUCKET_NAME=jknm-vsebina` (old bucket, being retired), `NEXT_PUBLIC_AWS_PUBLISHED_BUCKET_NAME=jknm-novice`.
- A local rsync mirror of `jknm-vsebina` exists at `artifacts/b2-mirror/vsebina` if useful for reading source assets without hitting B2 directly.
- Prod backup convention: PostgreSQL 17 CLI (`pg_dump`/`pg_restore`, winget-installed at `C:\Program Files\PostgreSQL\17\bin`), custom format, dumped to `D:\Luka\JKNM\rewrite-backups\`, `--schema=public --no-owner --no-privileges`. Most recent: `prod-public-20260809-172121.dump`.

**User's working preferences**:
- Migration/one-off scripts default to dry-run (log to a temp/artifacts `.json`), real DB/B2 writes wired in last, opt-in via `--execute`.
- Prefers one main tracker issue over premature subissues.
- Reacts against browser-automation/Playwright-driven approaches for this kind of scripted migration — prefers deterministic, testable, script-only solutions. Worth remembering for future tickets on this map (e.g. the remaining 4 pages will likely reuse whatever converter comes out of #36, not a browser-driven approach).

**Uncommitted from an earlier session, still pending a decision**: `package.json`'s `"db:push:staging"` script addition — user was asked whether to fold it into an earlier commit or commit separately; no answer given yet.

## Suggested skills

- `/wayfinder` (arg: work #36) — resume the pilot ticket once the converter direction is settled; it's still open and claimed, not ready to close.
- `/tdd` — the converter is a pure function (HTML string → `ArticleContentType`) with no I/O in its core, a good fit for red-green-refactor with fixture HTML (e.g. real snippets from `zgodovina/content.mdx`'s rendered output) as test cases.
- `/grilling` — if the block-shape mapping table (tables with merged cells, image priority, superscript) needs a real decision conversation rather than just being read off `plugins.ts`.
