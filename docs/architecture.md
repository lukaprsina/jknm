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
    `{ user, expires }` shape, so all **11** `getServerAuthSession()` reads and every component
    taking a `Session` prop were left untouched by the migration.
- `Session` is exported from `~/server/auth`, not from the library. Swapping the library again
  does not mean editing UI components.
- Surface: 1 route handler (`api/auth/[...all]`), 11 server reads, 4 client call sites.
- Env: `BETTER_AUTH_SECRET`, `GOOGLE_CLIENT_ID`/`_SECRET`, plus `NEXT_PUBLIC_DEPLOYMENT_ORIGIN`
  (`~/lib/domains.ts`'s `DEPLOYMENT_ORIGIN`) for `baseURL` — must be explicit, an inferred base
  URL makes Google answer `redirect_uri_mismatch`. The Google redirect URI
  `{DEPLOYMENT_ORIGIN}/api/auth/callback/google` is unchanged from NextAuth v4. `trustedOrigins`
  additionally lists `jknm.org` and `jknm-si.vercel.app` for the domain transition — see
  [Domains](#domains) below.

## Domains

All named in `src/lib/domains.ts`, one binding per role rather than one shared string — the
roles have independent lifecycles (per-environment vs. flips-once-at-cutover vs. never-changes)
and different owners (Vercel, Cloudflare, Google Workspace, Resend), so collapsing them risks an
edit to one silently meaning another. See [ADR-0010](adr/0010-domains-modeled-by-role.md).

| Constant | Value today | Role | Changes when |
| --- | --- | --- | --- |
| `DEPLOYMENT_ORIGIN` | `https://jknm-si.vercel.app` (prod) / `http://localhost:3000` (dev) | Where this deployment is reachable. Drives better-auth's `baseURL`, must match the Google OAuth redirect URI exactly | Per environment; env-sourced (`NEXT_PUBLIC_DEPLOYMENT_ORIGIN`), never inferred from `VERCEL_URL` |
| `CANONICAL_ORIGIN` | = `DEPLOYMENT_ORIGIN` today | Public identity for `metadataBase`, `sitemap.ts`, `robots.ts`, Algolia permalinks, JSON-LD | Hand-edited once, on jknm.si cutover day |
| `LEGACY_SITE_ORIGIN` | `https://www.jknm.si` | Recognizing/rewriting links pasted from the pre-rewrite 2008 site into content | Never — names a fact about old content, not app deployment |
| `MEDIA_CDN_ORIGIN` | `https://gradivo.jknm.org` | Cloudflare-routed custom domain in front of the `jknm-gradivo` B2 bucket (ADR-0008) | Never automatically — see cutover checklist |
| `WORKSPACE_EMAIL_DOMAIN` / `CONTACT_EMAIL` | `jknm.si` / `info@jknm.si` | Google Workspace membership check (`sign-in-gate.ts`) + human-facing contact address | Never |
| `MAIL_FROM_DOMAIN` | `jknm.org` | Resend-verified sender domain for the contact form | Once `jknm.si` is SPF/DKIM-verified in Resend |

`MEDIA_CDN_ORIGIN` staying `.org` is deliberate even after the `.si` cutover: it's Cloudflare's
domain, mapped independently of the app's own origin, and every existing article's
`content_json` already has `gradivo.jknm.org` URLs baked in. Moving it to `.si` is a separate,
optional future migration (rewrite every article's stored media URLs, then repoint Cloudflare),
not something the cutover itself requires.

Full rollover checklist: `docs/domain-cutover-checklist.md`.

## Code structure

- `src/app/` — App Router. `(static)` = static content pages, `novica` = article pages,
  `uredi` = admin editor, `arhiv`/`avtorji`/`kontakt`/`preveri` = archive/authors/contact/verify,
  `api/` = route handlers (better-auth, media upload, contact email, Supabase keep-alive).
  The 2008-site converter and `scripts/migrate-legacy-articles.ts` were deleted (#26); the
  article migration has run, and every migrated article carries its 2008-site id in
  `Article.legacy_id` (verified row-by-row against the old site via `/preveri`), so `legacy_id`
  can be treated as complete. `scripts/migrate-legacy-media.ts` is still present.
  `si/route.ts` (exact `/si`) 308-redirects old `?id=<legacy_id>` article URLs to
  `/novica/<slug>`; `si/[...path]/route.ts` (catch-all, coexists since it requires ≥1 segment)
  covers the rest of the old classic-ASP site's static tree — a fixed allowlist in
  `~/lib/legacy-si-paths.ts` (`resolve_legacy_static_path`) 308-redirects the sections the admin
  kept current (`klub`, `klub/zgodovina`, `publikacije`, `raziskovanje`, `varstvo`,
  `etc/kontakt`, `etc/iskanje`) to their new-site equivalent, and 410s everything else
  (deliberately-dropped sections like `jame`/`kataster`/`jrs` — their cadastre data now lives on
  JZS's own site, so those 410 rather than redirecting off-domain). Both routes share
  `legacy_gone()`/`legacy_redirect()`/`REDIRECT_CACHE_CONTROL` from `~/lib/site-config.ts`.
- Metadata: `layout.tsx` sets `twitter: { card: "summary_large_image" }` site-wide (Next
  populates `twitter:image` from `openGraph.images` automatically when no `twitter-image` file
  convention exists, so no per-page duplication is needed). `novica/[published_url]/page.tsx`'s
  `generateMetadata` adds an `openGraph.images` entry from `article.thumbnail_media.original`
  (real pixel `width`/`height`, no crop applied) only when a thumbnail exists — leaving
  `openGraph` unset otherwise so the root `opengraph-image.png` file convention keeps applying as
  the fallback (setting `openGraph` at all, even without `images`, would shallow-replace it per
  Next's segment-metadata merge rules). `page.tsx` (homepage) renders a static `Organization`/
  `WebSite` JSON-LD `<script>` (`ORGANIZATION_JSON_LD`). `alternates.canonical` is set on every
  static page (`/`, `/arhiv`, `/kontakt`, `/klub`, `/publiciranje`, `/raziskovanje`, `/varstvo`,
  `/zgodovina`) matching `sitemap.ts`'s `STATIC_ROUTES`, mirroring the pattern already used on
  `/novica/[slug]`. `/avtorji` is deliberately excluded — it `redirect()`s anonymous visitors to
  `/` before rendering, so a canonical pointing at itself would be misleading.
- `src/server/article/` — `new-article.ts` (`create_article`, `save_article`, `publish_article`),
  `lifecycle.ts` (archive/delete/discard/supersede), `get-article.ts`, `article-queries.ts`,
  `slug.ts`, `validators.ts` (Zod input validators for the oRPC procedures), and the
  framework-agnostic `lifecycle-rules.ts` / `reconcile-media.ts`. `authorized-mutation.ts`
  (`run_authorized_mutation`) is gone — oRPC's `authed` builder (`src/server/orpc/base.ts`)
  replaced it.
- `src/server/orpc/` — `base.ts` (`authed`/`actionableOptions`), `context.ts` (`ORPCContext`),
  `article/procedures.ts`, `author/procedures.ts`.
- `src/server/author/` — insert, rename, delete, sync from Google.
- `src/server/db/schema.ts` — Drizzle schema.

## Article schema

The unified model is **live**: a single `articles` table with a
`draft`/`published`/`archived`/`deleted` status enum, plus `media`, `article_slugs`,
`media_to_articles`, `articles_to_authors`. Reads and writes all go through it.

The legacy `published_article` / `draft_article` tables (plus their join tables and
`duplicate_article_urls`) are **gone** — dropped in `drizzle/0006_clammy_echo.sql` once
`find_available_slug` (`src/server/article/slug.ts`) no longer needed the
`published_article.url` collision check and `wake_supabase` was repointed at `Article`. The
one-shot article-migration tooling that produced the migrated data is deleted along with them
(`scripts/migrate-legacy-media.ts` remains).

## `/novica/<slug>` response contract

One pure rule decides every response: `resolve_slug_request` in
`src/server/article/lifecycle-rules.ts`, unit-tested in `lifecycle-rules.test.ts`. The page
(`src/app/novica/[published_url]/page.tsx`) only translates its three outcomes into Next calls.

| Request | Response |
| --- | --- |
| Primary slug of a visible article | **200**, renders |
| Non-primary (renamed-away) slug of a visible article | **308** to the primary slug |
| Unknown slug | **404** (`not-found.tsx` in the route folder) |
| `deleted`, or `archived` for a non-admin | **404** |

Two things this deliberately gets right, and which are easy to regress:

- **Visibility is checked before slug canonicality.** An old slug of an article that is now
  hidden must 404, not redirect — a redirect to a URL that then 404s is a wasted crawler hop
  and an ambiguous canonical signal.
- **The status codes are real, not rendered.** Returning an error *component* with HTTP 200 is
  a soft 404: it tells Google a real page lives at that URL, so the phantom URL stays indexed
  and keeps consuming crawl budget. This route did exactly that until the fix. Any future
  "not found" state on a public route must go through `notFound()`, never a 200 with error copy.

Background and the primary sources behind these choices:
`docs/research/legacy-id-redirects-and-seo-metadata.md`.
