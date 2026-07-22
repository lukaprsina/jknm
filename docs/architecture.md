# Architecture (as-is)

What the app is actually built from, right now. This is a **state** document, not a
decision record — when reality changes, edit this file. Decisions and their rationale
live in `docs/adr/`; domain vocabulary lives in `CONTEXT.md`.

> Keep this honest. This file exists because the stack description previously lived in
> `CONTEXT.md`, was owned by nobody, and drifted badly out of date (it described a tRPC
> layer that had already been removed).

## Stack

Next.js 16.2.10 (App Router) · Drizzle + Postgres (via Supabase) · **oRPC + TanStack
Query** · better-auth (Google) · EditorJS (admin article editor) ·
Backblaze B2 (media storage, S3-compatible) · Algolia (search) · Resend (email) ·
Tailwind v4 · hosted on Vercel.

## Data transport

**oRPC** (`src/server/orpc/`) is live (ADR-0002, #31 step 4). tRPC was removed earlier in
the rewrite; oRPC replaced the hand-rolled Server Action + `run_authorized_mutation`
pattern that stood in for it.

- **Writes** — client mutations call the procedure directly as a real Next.js Server
  Action: `src/server/orpc/*/procedures.ts` exports end each chain with
  `.actionable(actionableOptions)` (`@orpc/next`'s extension, wired in `src/server/orpc/base.ts`),
  so the same procedure object is both a typed oRPC procedure and an importable server
  function. Client components `useMutation({ mutationFn: () =>
  unwrap_server_function(theProcedure(input)), ... })` (`src/lib/orpc-action.ts` unwraps the
  `[error, data]` tuple server functions resolve to, back into throw-on-error for TanStack
  Query). This — not the HTTP route — is required: Next 16's `updateTag` (what
  `apply_server_invalidations` uses) only works inside a genuine Server Action, not a Route
  Handler. Procedures themselves are thin: the `authed` builder (`context.session` from
  `src/server/orpc/context.ts`) handles auth, `.input(validator)` handles validation, and the
  handler calls straight into the same framework-agnostic business-logic functions in
  `src/server/article/`, `src/server/author/` that existed before (now taking already-validated
  input, plus an explicit `session` param where identity is needed). The old shared guard,
  `run_authorized_mutation`, is deleted. There is no HTTP mount or router — `.actionable()`
  is the only transport, so each procedure is imported and called directly; reads go
  straight to RSC/Drizzle, not through oRPC.
- **Reads** — mostly RSC calling query helpers / Drizzle directly. Client-side TanStack Query
  is used in three places: the infinite homepage feed (`src/app/infinite-no-trpc.tsx`,
  a filename fossil from the tRPC era), the `/preveri` admin tool, and the member-sync
  preview in `src/components/settings/index.tsx`.
  - The member-sync preview (`previewMemberSync`) is a deliberate exception to "reads go
    through RSC, not oRPC": it's a read, but it calls the Google Admin API, which is too
    slow to run on every render of the settings menu — it only runs when the sync dialog is
    opened, from a client component, so it's wired as an `.actionable()` procedure like the
    writes are, not as an RSC data fetch.
- **Cache invalidation goes through one typed mapping** (`src/lib/cache-policy.ts`, #31
  step 1). Mutations emit a `DomainEvent` and never name tags or paths; the pure
  `invalidations_for` returns a descriptor that two dumb adapters consume —
  `src/server/cache-invalidation.ts` (`updateTag`/`revalidatePath`) and
  `src/lib/cache-invalidation-client.ts` (`invalidateQueries`). Those two files are the
  only places in `src/` that call the underlying primitives. A reachability test asserts
  every declared cache tag is invalidated by at least one event, so the
  `homepage-feed`/`all-published` dead-tag bug cannot recur.

## Caching

`unstable_cache` at 6 sites (`infinite-server.tsx`, `preveri/page.tsx`, `draft-articles.tsx`,
`archived-articles.tsx`, `cached-global-state.tsx`, `server/article/get-article.ts`), plus
`src/lib/revive-cache-dates.ts` — a workaround that exists purely because `unstable_cache`
JSON-mangles `Date` values.

Six cache tags are declared: `homepage-feed`, `all-published`, `drafts`, `archive`, `authors`,
`article`. Each site declares its tags `satisfies CacheTag[]` (`src/lib/cache-policy.ts`), so the
union and the cache sites cannot drift: a tag declared at a site but absent from `CACHE_TAGS`
fails typecheck, and one added to `CACHE_TAGS` that no event invalidates fails the reachability
test.

`article` covers `get_new_article_by_slug` (`/novica/[published_url]`'s only data read),
`cache()`-deduped per request (it's called from both `generateMetadata` and the page body) and
`unstable_cache`-backed across requests. Invalidated by the events that touch the published set
(`article.published`/`archived`/`unarchived`/`deleted`) and every `author.*` event, since the
cached read embeds each article's byline. See [ADR-0006](adr/0006-no-isr-on-article-pages.md)
for why this exists instead of ISR.

Every site has a **finite `revalidate` window** (#31 step 2) — 3600s for the public reads
(`homepage-feed`, `authors`, `article`), 300s for the editor-facing ones (`drafts`, `archive`,
`all-published`). These are a safety net, not the refresh mechanism: invalidation is what makes a
mutation show up. `apply_server_invalidations` uses `updateTag`, not `revalidateTag(tag, "max")`
— every call site is inside a Server Action, and `updateTag` blocks the next reader on fresh data
instead of `"max"`'s stale-while-revalidate (which let a reader right after a mutation still get
the pre-mutation value; concretely, an admin republishing an article under a new slug could still
load the stale old-slug page and crash clicking edit on its now-`deleted` source). The window only
bounds how long a *missing* invalidation could serve a frozen view.

**Staying on `unstable_cache`** — migrating to Cache Components (`use cache`) was investigated
and rejected ([ADR-0005](adr/0005-stay-on-unstable-cache.md)). What remains planned is
consolidating invalidation (#31), not replacing the caching primitive.

**There is no ISR.** All 18 routes are `ƒ (Dynamic)` per `next build`. Not pursuing this is a
deliberate decision, not a gap — see [ADR-0006](adr/0006-no-isr-on-article-pages.md) for why
it's blocked on Next 16 regardless of the Suspense work below, and why that's an acceptable
trade at this site's traffic.

## Auth

**better-auth** 1.6.23, Google provider only, gated on verified `@jknm.si` emails. Database
sessions via `drizzleAdapter` (cookie caching deliberately off, so sign-out means sign-out).
Migrated from NextAuth v4 in #32.

- No `middleware.ts`/`proxy.ts` anywhere — access is enforced per-page/per-action via
  `getServerAuthSession()` + `redirect()`/`notFound()`, which is also what better-auth's own
  Next.js guidance recommends.
- No `SessionProvider` and no `useSession`; session data is passed down from RSC as props.
  Client code only calls the imperative wrappers in `src/lib/auth-client.ts`. The shell is the
  exception and passes only a **primitive**: since #31 step 3 the session read lives in
  `components/shell/editor-controls.tsx`, and the two headers receive the result as an opaque
  `editor_controls` slot, so no `Session` reaches those client components at all.
- `src/server/auth/` holds all server-side library contact bar the route handler:
  - `index.ts` — the `betterAuth` instance and `getServerAuthSession()`, the latter memoized
    per request with React `cache` (the shell renders it once per header breakpoint).
  - `sign-in-gate.ts` — the whole "who may enter" rule as one pure predicate. It is wired in
    via a custom `getUserInfo` on the Google provider, because better-auth has no equivalent
    of NextAuth's `signIn` callback and the other two candidate hooks silently fail (see #32).
    That custom callback *replaces* Google's built-in `hd` check, which is why `hd` is not set.
  - `session-shape.ts` — adapts better-auth's `{ session, user }` into the app's established
    `{ user, expires }` shape, so all **16** `getServerAuthSession()` reads and every component
    taking a `Session` prop were left untouched by the migration.
- `Session` is exported from `~/server/auth`, not from the library. Swapping the library again
  does not mean editing UI components.
- Surface: 1 route handler (`api/auth/[...all]`), 16 server reads, 4 client call sites.
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
