# CONTEXT

## What this is

JKNM (Jamarski klub Novo mesto) is a Slovenian caving club's public news site: articles, an authors/members page, an archive, contact/verification pages, and an admin editor for writing and publishing articles. Single maintainer, actively iterating. Public traffic is small; the pain is entirely on the admin/editing side.

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
- **Reconciliation** — deriving which media rows an article uses by re-reading its `content_json` on every save, rather than tracking links at upload time (`reconcile_media_to_articles`, `src/server/article/reconcile-media.ts`). Uploads never carry an `article_id`. **No sweep job exists yet** — orphaned media (no `media_to_articles` row) accumulates in both Postgres and B2 with nothing deleting it; see the codebase-health audit in `docs/research/`.

## `jknm-convex` — the reference design

`D:\dev\js\jknm-convex` (sibling repo) is a **previously-built, validated prototype** of the target backend design (~150h, on Convex + PlateJS + better-auth). It is **not** a dependency or a merge target — treat it as a reference to read from. Its *design* is what was ported: the single status-enum `articles` table and the immutable `media` model, both of which are now live here.

Convex and PlateJS are explicitly out of scope; Drizzle/Postgres and EditorJS stay. See ADR-0001 (framework) and ADR-0002 (transport) for the reasoning.

## Keeping docs split

Keep this file to domain vocabulary. Put implementation state in `docs/architecture.md`, decisions in `docs/adr/`, tracker conventions in `docs/agents/`. Don't consolidate them into one file.

Two reasons: instruction-following degrades once a single doc accumulates dozens of imperative rules, and mixing slow-changing vocabulary with fast-changing implementation detail hides staleness.
