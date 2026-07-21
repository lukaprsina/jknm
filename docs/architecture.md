# Architecture (as-is)

What the app is actually built from, right now. This is a **state** document, not a
decision record — when reality changes, edit this file. Decisions and their rationale
live in `docs/adr/`; domain vocabulary lives in `CONTEXT.md`.

> Keep this honest. This file exists because the stack description previously lived in
> `CONTEXT.md`, was owned by nobody, and drifted badly out of date (it described a tRPC
> layer that had already been removed).

## Stack

Next.js 16.2.10 (App Router) · Drizzle + Postgres (via Supabase) · **Server Actions +
TanStack Query** · NextAuth **v4** (Google) · EditorJS (admin article editor) ·
Backblaze B2 (media storage, S3-compatible) · Algolia (search) · Resend (email) ·
Tailwind v4 · hosted on Vercel.

## Data transport

There is **no tRPC and no oRPC** in this repo. tRPC was removed earlier in the rewrite;
oRPC is a decided-but-unimplemented future step (see ADR-0002).

- **Writes** — module-level `"use server"` Server Actions in `src/server/`, imported
  directly and called as `mutationFn` inside TanStack Query hooks. `run_authorized_mutation`
  (`src/server/article/authorized-mutation.ts`) is the shared auth guard — the closest thing
  to a `protectedProcedure`.
- **Reads** — mostly RSC calling query helpers / Drizzle directly. Client-side TanStack Query
  is used in only **two** places: the infinite homepage feed (`src/app/infinite-no-trpc.tsx`,
  a filename fossil from the tRPC era) and the `/preveri` admin tool.
- **Cache invalidation is split-brained**: each mutation hand-fires *both*
  `queryClient.invalidateQueries` (client cache) and `revalidateTag`/`revalidatePath`
  (server cache), duplicated across 16+ call sites. Consolidating this is #31.

## Caching

`unstable_cache` at 5 sites (`infinite-server.tsx`, `preveri/page.tsx`, `draft-articles.tsx`,
`archived-articles.tsx`, `cached-global-state.tsx`), plus `src/lib/revive-cache-dates.ts` —
a workaround that exists purely because `unstable_cache` JSON-mangles `Date` values.

Five cache tags are declared, all with `revalidate: false`: `homepage-feed`, `all-published`,
`drafts`, `archive`, `authors`.

**Staying on `unstable_cache`** — migrating to Cache Components (`use cache`) was investigated
and rejected; see `docs/research/nextjs16-caching-verdict.md`. What remains planned is
consolidating invalidation (#31), not replacing the caching primitive.

## Auth

NextAuth **v4** (`NextAuthOptions` + `getServerSession`, not the v5 pattern), Google provider
only, gated on verified `@jknm.si` emails. Database sessions via `DrizzleAdapter`.

- No `middleware.ts` anywhere — access is enforced per-page/per-action via
  `getServerAuthSession()` + `redirect()`/`notFound()`.
- No `SessionProvider` and no `useSession`; session data is passed down from RSC as props.
  Client code only calls imperative `signIn`/`signOut`.
- Surface: 1 config (`src/server/auth.ts`), 1 route handler, **15** `getServerAuthSession()`
  reads, 4 client `signIn`/`signOut` call sites.
- **The wrapper leaks.** `getServerAuthSession()` was meant to be the only place the app
  touches its auth library, but `next-auth`'s `Session` type is imported directly by
  **7** modules (`arhiv/article-table`, `arhiv/search`, `prijava/signin`, `shell/desktop-header`,
  `shell/editing-buttons`, `shell/mobile-header`, `server/article/authorized-mutation`).
  `src/server/db/schema.ts` also imports `next-auth/adapters` for the `AdapterAccount` type.
- The sign-in gate (Google + verified email + `@jknm.si`) lives inside a NextAuth config
  callback and has **no test covering it**.
- Migration to better-auth is decided (#6) and specified (#32), not started.

## Code structure

- `src/app/` — App Router. `(static)` = static content pages, `novica` = article pages,
  `uredi` = admin editor, `arhiv`/`avtorji`/`kontakt`/`preveri` = archive/authors/contact/verify,
  `api/` = route handlers (NextAuth, media upload, contact email, Supabase keep-alive).
  The 2008-site converter was deleted (#26); `scripts/migrate-legacy-articles.ts` remains for
  the still-pending production data migration.
- `src/server/article/` — `new-article.ts` (`create_article`, `save_article`, `publish_article`),
  `lifecycle.ts` (archive/delete/discard/supersede), `get-article.ts`, `article-queries.ts`,
  `slug.ts`, `authorized-mutation.ts`, and the framework-agnostic `lifecycle-rules.ts` /
  `reconcile-media.ts`.
- `src/server/author/` — insert, rename, delete, sync from Google.
- `src/server/db/schema.ts` — Drizzle schema.

## Article schema

The unified model is **live**: a single `articles` table with a
`draft`/`published`/`archived`/`deleted` status enum, plus `media`, `article_slugs`,
`media_to_articles`, `articles_to_authors`. Reads and writes all go through it.

The legacy `published_article` / `draft_article` tables still **physically exist** with two
remaining readers: `find_available_slug` (`src/server/article/slug.ts`) uses
`published_article.url` for legacy slug-collision avoidance, and the `wake_supabase` route
pings it. Dropping the tables is gated on removing that slug read — see ADR-0003.
