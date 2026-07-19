# CONTEXT

## What this is

JKNM (Jamarski klub Novo mesto) is a Slovenian caving club's public news site: articles, an authors/members page, an archive, contact/verification pages, and an admin editor for writing and publishing articles. Single maintainer, actively iterating. Public traffic is small; the pain is entirely on the admin/editing side.

## Current stack

Next.js 16 (App Router) · Drizzle + Postgres (via Supabase) · tRPC + TanStack Query · NextAuth (Google) · EditorJS (admin article editor) · Backblaze B2 (media storage, S3-compatible) · Algolia (search) · Resend (email) · Tailwind v4 · hosted on Vercel.

A rewrite is underway (tracked as a `/wayfinder` map — GitHub issue [#1](https://github.com/lukaprsina/jknm/issues/1)) to swap tRPC → **oRPC**, move hosting Vercel → **VPS**, and redesign the media/status-lifecycle backend. Framework (Next.js), data layer (Drizzle/Postgres), and editor (EditorJS) are **staying** — see the map for the locked decisions and rationale.

## Code structure

- `src/app/` — Next App Router. `(static)` = static content pages, `novica` = article pages, `uredi` = the admin editor, `arhiv`/`avtorji`/`kontakt`/`preveri` = archive/authors/contact/verify, `api/` = route handlers. The one-time 2008-site migration script (`converter/`) has been deleted (#26); `scripts/migrate-legacy-articles.ts` remains for the still-pending production data migration.
- `src/server/` — backend logic called from tRPC routers: `article/` (create-draft, save-draft, publish, unpublish, delete, sync-duplicate-urls), `author/` (insert, rename, delete, sync from Google), `db/schema.ts` (Drizzle schema), `auth.ts`.
- Current schema splits articles into **separate `published_article` / `draft_article` tables** with a copy-on-publish/unpublish dance — this is the exact leak the rewrite's media/status-lifecycle tickets are replacing with a single status-enum model.

## `jknm-convex` — the reference design

`D:\dev\js\jknm-convex` (sibling repo) is a **previously-built, validated prototype** of the target backend design — ~150h of work, built on Convex + PlateJS + better-auth. It is **not being adopted as-is**. What's being ported is its *design*:

- a single `articles` table with a `draft/published/archived/deleted` status enum + per-transition timestamps, instead of two copied tables
- an immutable `media` table (original + avif/jpeg variants + srcsets + blur placeholder) linked to articles via a `media_to_articles` join table, never copied between states
- typed-RPC + TanStack Query as the transport shape (Convex functions → **oRPC procedures** in the port)

Convex itself and PlateJS are explicitly **out of scope** for this rewrite (see map [#1](https://github.com/lukaprsina/jknm/issues/1) "Out of scope") — Drizzle/Postgres and EditorJS stay. Auth is different: NextAuth/Auth.js is now in maintenance mode (the better-auth team took over its upkeep in 2025), so the auth *decision* is already settled — better-auth is the successor, no real alternative — but the *migration itself* is deferred to its own standalone ticket outside this map (see [#6](https://github.com/lukaprsina/jknm/issues/6)), since it doesn't block the backend/media work this rewrite targets. Treat `jknm-convex` as a reference to read from, not a dependency or a merge target.

## Why this file is small, and why `AGENTS.md` stays split

This repo follows the `docs/agents/` layout (mattpocock/skills-style) instead of one large `AGENTS.md`: domain context lives here, issue-tracker conventions in `docs/agents/issue-tracker.md`, label vocabulary in `docs/agents/triage-labels.md`. Decisions with real rationale get their own ADR under `docs/adr/` rather than a bullet point here.

This isn't just tidiness — there's a real cost to cramming everything into one instruction file. Several published evals on long system-prompt/instruction-following report meaningful accuracy degradation (tens of percent in places) once a prompt accumulates on the order of 40–50 discrete imperative rules ("use bun not npm", "never do X", "always do Y") — later instructions get silently dropped or contradicted as earlier ones compete for attention. Keeping each doc scoped to one concern (domain vocabulary, tracker mechanics, this rewrite's decisions) keeps each individual file well under that threshold, and skills pull in only the doc relevant to the task at hand instead of the whole pile.
