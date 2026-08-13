# CONTEXT

## What this is

JKNM (Jamarski klub Novo mesto) is a Slovenian caving club's public news site: articles, an archive, contact/verification pages, and an admin editor for writing and publishing articles. The authors page (`/avtorji`) and verification page (`/preveri`) are admin-only internal tooling, not public. Single maintainer, actively iterating. Public traffic is small; the pain is entirely on the admin/editing side.

## Where things are written down

This file is **domain vocabulary only** — the shared language for talking about articles and their lifecycle. Everything else has its own home:

- **What the app is built from** (stack, transport, auth, code layout) → `docs/architecture.md`
- **Why we chose something** → `docs/adr/`
- **Issue-tracker conventions** → `docs/agents/issue-tracker.md`, `docs/agents/triage-labels.md`
- **Open work** → GitHub issues, mapped from [#1](https://github.com/lukaprsina/jknm/issues/1)

## Glossary

- **Standalone draft** — a `draft`-status `articles` row with `supersedes_id = null`. Never been published; archiving or deleting it acts on itself.
- **Superseding draft** — a `draft`-status row with `supersedes_id` pointing at a `published`/`archived` row (spawned by the pencil-to-edit or "restore from archive" actions). The live/archived source stays untouched and visible until the draft is published. Because of this, archive/delete on a superseding draft act on the **source**, not the draft — see `resolve_lifecycle_target` in `src/server/article/lifecycle-rules.ts`. To cancel the revision without touching the source, discard the draft instead (`discard_draft`).
- **Article status** — one of `draft` / `published` / `archived` / `deleted`. `archived` covers both "hide a mistake" and "archive something stale"; archived and deleted articles 404 for non-admins.
- **Admin** — anyone with a session. `sign-in-gate.ts` only admits verified `@jknm.si` Google identities, so "signed in" and "is admin" are the same fact everywhere in the codebase (`is_visible_to(status, is_admin)` in `lifecycle-rules.ts`, `is_admin` in `editing-buttons.tsx`) — there is no separate role check to add.
- **Slug** — an article's public URL segment, held in the `article_slugs` table rather than on the article row, so renames can leave a redirect behind. Collisions are resolved by suffixing.
- **Reconciliation** — deriving which media rows an article uses by re-reading its `content_json` on every save, rather than tracking links at upload time (`reconcile_media_to_articles`, `src/server/article/reconcile-media.ts`). Uploads never carry an `article_id`. Orphaned media (no `media_to_articles` row, 48h old) and terminal `deleted` articles past their grace window are both cleared by `scripts/sweep-stale-content.ts` (`bun run sweep`).
- **Article kind** — `article_kind` column, `"article"` (news, the default) or `"content"` (one of the 5 fixed evergreen pages — `/klub`, `/publiciranje`, `/raziskovanje`, `/varstvo`, `/zgodovina` — migrated from static MDX). A content-kind row lives at both its fixed route and `/novica/<slug>` (the latter resolves for free via the generic slug lookup, but canonicalizes to the fixed route — see ADR-0009), never gets a byline/published-date treated as a news event, and is excluded from anything that's a literal news listing (sitemap, homepage feed, `/preveri`, the archive's sortable Algolia replicas) while still being searchable in the same Algolia index as news, scoped by facet. See ADR-0009 for the full surfacing rules.

## `jknm-convex` — the reference design

`D:\dev\js\jknm-convex` (sibling repo) is a **previously-built, validated prototype** of the target backend design (~150h, on Convex + PlateJS + better-auth). It is **not** a dependency or a merge target — treat it as a reference to read from. Its *design* is what was ported: the single status-enum `articles` table and the immutable `media` model, both of which are now live here.

Convex and PlateJS are explicitly out of scope; Drizzle/Postgres and EditorJS stay. See ADR-0001 (framework) and ADR-0002 (transport) for the reasoning.

## Keeping docs split

Keep this file to domain vocabulary. Put implementation state in `docs/architecture.md`, decisions in `docs/adr/`, tracker conventions in `docs/agents/`. Don't consolidate them into one file.

Two reasons: instruction-following degrades once a single doc accumulates dozens of imperative rules, and mixing slow-changing vocabulary with fast-changing implementation detail hides staleness.
