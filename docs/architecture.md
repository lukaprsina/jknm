# Architecture (as-is)

What the app is actually built from, right now. This is a **state** document, not a
decision record — when reality changes, edit this file. Decisions and their rationale
live in `docs/adr/`; domain vocabulary lives in `CONTEXT.md`.

> Keep this honest. This file exists because the stack description previously lived in
> `CONTEXT.md`, was owned by nobody, and drifted badly out of date (it described a tRPC
> layer that had already been removed).

## Stack

Next.js 16.2.10 (App Router) · Drizzle + Postgres (via Supabase) · **Server Actions +
TanStack Query** · better-auth (Google) · EditorJS (admin article editor) ·
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
- **Cache invalidation goes through one typed mapping** (`src/lib/cache-policy.ts`, #31
  step 1). Mutations emit a `DomainEvent` and never name tags or paths; the pure
  `invalidations_for` returns a descriptor that two dumb adapters consume —
  `src/server/cache-invalidation.ts` (`revalidateTag`/`revalidatePath`) and
  `src/lib/cache-invalidation-client.ts` (`invalidateQueries`). Those two files are the
  only places in `src/` that call the underlying primitives. A reachability test asserts
  every declared cache tag is invalidated by at least one event, so the
  `homepage-feed`/`all-published` dead-tag bug cannot recur.

## Caching

`unstable_cache` at 5 sites (`infinite-server.tsx`, `preveri/page.tsx`, `draft-articles.tsx`,
`archived-articles.tsx`, `cached-global-state.tsx`), plus `src/lib/revive-cache-dates.ts` —
a workaround that exists purely because `unstable_cache` JSON-mangles `Date` values.

Five cache tags are declared, all with `revalidate: false`: `homepage-feed`, `all-published`,
`drafts`, `archive`, `authors`. Each site declares its tags `satisfies CacheTag[]`
(`src/lib/cache-policy.ts`), so the union and the cache sites cannot drift: a tag declared at a
site but absent from `CACHE_TAGS` fails typecheck, and one added to `CACHE_TAGS` that no event
invalidates fails the reachability test. Bounding the `revalidate` windows is #31 step 2, still
pending.

**Staying on `unstable_cache`** — migrating to Cache Components (`use cache`) was investigated
and rejected (ADR-0005). What remains planned is
consolidating invalidation (#31), not replacing the caching primitive.

## Auth

**better-auth** 1.6.23, Google provider only, gated on verified `@jknm.si` emails. Database
sessions via `drizzleAdapter` (cookie caching deliberately off, so sign-out means sign-out).
Migrated from NextAuth v4 in #32.

- No `middleware.ts`/`proxy.ts` anywhere — access is enforced per-page/per-action via
  `getServerAuthSession()` + `redirect()`/`notFound()`, which is also what better-auth's own
  Next.js guidance recommends.
- No `SessionProvider` and no `useSession`; session data is passed down from RSC as props.
  Client code only calls the imperative wrappers in `src/lib/auth-client.ts`.
- `src/server/auth/` holds all server-side library contact bar the route handler:
  - `index.ts` — the `betterAuth` instance and `getServerAuthSession()`.
  - `sign-in-gate.ts` — the whole "who may enter" rule as one pure predicate. It is wired in
    via a custom `getUserInfo` on the Google provider, because better-auth has no equivalent
    of NextAuth's `signIn` callback and the other two candidate hooks silently fail (see #32).
    That custom callback *replaces* Google's built-in `hd` check, which is why `hd` is not set.
  - `session-shape.ts` — adapts better-auth's `{ session, user }` into the app's established
    `{ user, expires }` shape, so all **15** `getServerAuthSession()` reads and every component
    taking a `Session` prop were left untouched by the migration.
- `Session` is exported from `~/server/auth`, not from the library. Swapping the library again
  does not mean editing UI components.
- Surface: 1 route handler (`api/auth/[...all]`), 15 server reads, 4 client call sites.
- Env: `BETTER_AUTH_SECRET`, `BETTER_AUTH_URL` (must be explicit — an inferred base URL makes
  Google answer `redirect_uri_mismatch`), `GOOGLE_CLIENT_ID`/`_SECRET`. The Google redirect URI
  `{BETTER_AUTH_URL}/api/auth/callback/google` is unchanged from NextAuth v4.

## Code structure

- `src/app/` — App Router. `(static)` = static content pages, `novica` = article pages,
  `uredi` = admin editor, `arhiv`/`avtorji`/`kontakt`/`preveri` = archive/authors/contact/verify,
  `api/` = route handlers (better-auth, media upload, contact email, Supabase keep-alive).
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
