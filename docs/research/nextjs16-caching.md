# Next.js caching: v13 → v16, and the path off `unstable_cache`

Researched against the docs bundled with the installed `next@16.2.10` package
(`node_modules/next/dist/docs/`, read via the `mcp__next-devtools__nextjs_docs`
tool, which resolves to those exact files for this repo) plus the installed
package's own source. Every claim below is cited to one of those two.

## 1. Timeline: what exists, and its status in 16.2.x

| API | Introduced | Status in Next.js 16.2.10 |
|---|---|---|
| `fetch()` caching (Data Cache) + `next.revalidate`/`next.tags` | v13 (App Router launch) | Still the default caching model **unless** `cacheComponents` is enabled. Docs explicitly split into two guides: "Caching" (Cache Components) vs. "Caching and Revalidating (Previous Model)" — `node_modules/next/dist/docs/01-app/02-guides/caching-without-cache-components.md` is the previous-model doc, still shipped and current. |
| `unstable_cache` | v14.0.0 | **Deprecated**, not removed. The bundled doc's first line: "This API has been replaced by `use cache` in Next.js 16. We recommend opting into Cache Components and replacing `unstable_cache` with the `use cache` directive." (`node_modules/next/dist/docs/01-app/03-api-reference/04-functions/unstable_cache.md:6-8`). It still works unchanged — no runtime warning found in source — but is the legacy path. |
| `"use cache"` directive | v15.0.0, experimental | v15: experimental only, gated behind `experimental.dynamicIO` / `experimental.useCache` flags. |
| `"use cache"` directive | **v16.0.0** | **Stable**, gated behind the single top-level `cacheComponents: true` config flag (not `experimental.*` anymore). Version History table in the doc: "`v16.0.0` — `"use cache"` is enabled with the Cache Components feature." (`.../01-directives/use-cache.md:684-689`). `cacheComponents` "controls the `ppr`, `useCache`, and `dynamicIO` flags as a single, unified configuration" (`.../05-config/01-next-config-js/cacheComponents.md:56`). |
| `experimental.dynamicIO` / `experimental.useCache` | — | **Deprecated in v16**, replaced by top-level `cacheComponents`. The v16 upgrade guide has a dedicated section: "The `experimental.dynamicIO` and `experimental.useCache` flags are deprecated. Use top-level `cacheComponents` instead." (`.../02-guides/upgrading/version-16.md:1211-1213`). |

**Bottom line for this repo (16.2.10, `cacheComponents` currently absent from
`next.config.ts`):** `"use cache"` is a fully stable, first-party API — it is
*not* gated behind an experimental flag anymore in v16, but it does require
explicitly turning on `cacheComponents: true` in `next.config.ts`. Without
that flag, `"use cache"` is inert/unavailable and the old `fetch`-Data-Cache +
`unstable_cache` model is what's actually in effect (confirmed: this repo's
`next.config.ts` has no `cacheComponents`, so right now it is on the pre-16
model even though it's running Next 16 binaries).

## 2. Does `"use cache"` have the same Date-serialization footgun?

**No — verified two ways, not assumed.**

**a) Docs are explicit about supported types.** The `use-cache` reference doc
lists, under "Serialization → Supported types":

> **Arguments:** Primitives, plain objects, arrays, **Dates, Maps, Sets,
> TypedArrays, ArrayBuffers**, React elements (pass-through)
> **Return values:** same as arguments, plus JSX elements

(`node_modules/next/dist/docs/01-app/03-api-reference/01-directives/use-cache.md:112-124`)

It also states the mechanism isn't ad-hoc JSON: arguments use "React Server
Components serialization" and return values use "React Client Components
serialization" (same file, lines 101-110), linking to
`react.dev/reference/rsc/use-server#serializable-parameters-and-return-values`.

**b) Source confirms it's Flight, not `JSON.stringify`.** Grepping the
installed package:

- `node_modules/next/dist/server/web/spec-extension/unstable-cache.js:23` — inside
  `cacheNewResult()`, the value written to the cache is literally
  `body: JSON.stringify(result)`. This is the exact root cause of the bug
  already diagnosed: on a cache hit the stored JSON string is parsed back with
  plain `JSON.parse`, which has no `Date` revival step, so `Date` objects come
  back as ISO strings.
- `node_modules/next/dist/server/use-cache/use-cache-wrapper.js` uses
  `renderToReadableStream` (line 593) over the result, and `decodeReply` /
  `encodeReply` (lines 453-455, 1000) for arguments — i.e. the same
  React Server Actions / Flight wire protocol used to serialize Server
  Component payloads and Server Action arguments. That protocol has built-in
  support for `Date`, `Map`, `Set`, etc. (this is the same serializer that
  already round-trips `Date` correctly through every Server Action call in
  this app today), which is why the docs can promise Date/Map/Set survive a
  cache hit.

So `"use cache"` structurally cannot have this bug — it never touches
`JSON.stringify`/`JSON.parse` for the cached payload. The `unstable_cache`
bug is specific to `unstable_cache`'s implementation, not something inherent
to "Next.js caching" broadly.

## 3. Migration path: from `unstable_cache(drizzleQuery, ...)` to `"use cache"`

**Requires enabling `cacheComponents`.** Add to `next.config.ts`:

```ts
const config = {
  cacheComponents: true,
  // ...
}
```

(`.../03-api-reference/01-directives/use-cache.md:27-46`, same requirement repeated on
the `cacheTag` and `cacheLife` reference pages).

**Direct migration mapping**, per the dedicated
"Migrating to Cache Components" guide's `unstable_cache` section
(`.../02-guides/migrating-to-cache-components.md:282-344`), using literally a
Drizzle example:

```ts
// Before
export const getUser = unstable_cache(
  async (id: string) => db.query.users.findFirst({ where: eq(users.id, id) }),
  ['user'],
  { tags: ['users'], revalidate: 3600 }
)

// After
import { cacheLife, cacheTag } from 'next/cache'

export async function getUser(id: string) {
  'use cache'
  cacheLife('hours')
  cacheTag('users')
  return db.query.users.findFirst({ where: eq(users.id, id) })
}
```

Mapping of concepts:
- `unstable_cache`'s `keyParts` array → **not needed**. `"use cache"`'s cache
  key is derived automatically from (build ID, function ID, serializable
  arguments, and anything captured from closure) — see "Cache keys"
  (`.../01-directives/use-cache.md:76-99`). Closure-captured variables are
  *automatically* bound into the key, unlike `unstable_cache` where the docs
  warn you must manually add them to `keyParts` or risk cache collisions.
- `options.tags` → `cacheTag('tag1', 'tag2')` call inside the function body.
- `options.revalidate` (seconds) → `cacheLife('profile')` (named preset:
  `seconds`/`minutes`/`hours`/`days`/`weeks`/`max`) or an inline object
  `cacheLife({ stale, revalidate, expire })`.
- `revalidateTag('tag')` continues to work unchanged as the invalidation call
  from a Server Action or Route Handler.

**Gotchas called out directly in the docs, all first-party:**

1. **Persistence differs.** `unstable_cache` (like the `fetch` Data Cache)
   persists cached results across deployments and across serverless
   instances. `"use cache"` defaults to **in-memory** storage: "in serverless
   environments... cache entries typically don't persist across requests...
   Self-hosted: cache entries persist across requests" (use-cache.md:198-209,
   repeated at migrating-to-cache-components.md:278-280, 344). For durable,
   cross-instance caching you'd need `"use cache: remote"` or a custom cache
   handler (`cacheHandlers` config) — since this repo is mid-migration from
   Vercel to a self-hosted VPS (per `CONTEXT.md`), this matters: on Vercel
   serverless today, in-memory `"use cache"` will re-run the Drizzle query far
   more often than the old `unstable_cache`; once self-hosted on the VPS,
   in-memory cache persists per-instance and behaves closer to what
   `unstable_cache` gave you.
2. **`cacheLife` can't be abstracted into a shared helper** — must be called
   directly inside the same function/component carrying `"use cache"`, not in
   a utility called from within it (cacheLife.md:49).
3. **Nested `"use cache"` calls without an explicit `cacheLife` inherit a
   `default` 15-min revalidate**, and nesting a short-lived cache under an
   unconfigured outer cache throws a build-time error (cacheLife.md
   "Nested caching behavior" and "Nested short-lived caches" sections,
   lines 391-526). Always set `cacheLife(...)` explicitly.
4. **Draft Mode bypasses the cache entirely** — "When Draft Mode is enabled,
   all cached functions and components re-execute on every request, and
   results are not saved to the cache" (use-cache.md:215-217). This repo has
   no draft-mode admin preview today, so not currently relevant, but worth
   knowing if one gets added.
5. **`React.cache` (request memoization) is isolated from `"use cache"`
   scopes** — values stored via `React.cache` outside a `use cache` function
   are invisible inside it (use-cache.md:239-265). This repo doesn't appear
   to lean on `React.cache` for these query paths, so low risk here, but a
   real gotcha if request-level memoization is layered on top later.
6. **Cached functions can't call `cookies()`/`headers()`/read `searchParams`
   directly** — must read those outside the cached scope and pass extracted
   primitive values in as arguments (use-cache.md "Request-time APIs",
   line 194-196). `find_draft_articles`/`find_published_articles_page` don't
   touch these, so unaffected, but `getServerAuthSession()` in `page.tsx`
   would need to stay outside any cached scope.
7. **Serialization of arguments is stricter than of return values** — class
   instances, functions (except pass-through), Symbols, WeakMaps/WeakSets,
   and `URL` instances are unsupported on either side (use-cache.md:126-131).
   The `db` executor argument this repo currently threads through
   (`find_published_articles_page(db, {...})`) is a Drizzle client instance —
   **that itself is not a valid `"use cache"` argument** (it's a class-like
   object, not a plain serializable value). It must not be passed in; call
   the module-level `db` import directly from inside the cached function
   instead (see recommendation below).

## 4. Does `cacheComponents` change anything else site-wide?

**Yes, non-trivially** — it's not just a caching primitives swap, it flips the
whole rendering model on. From `cacheComponents.md:6` and the migration guide:

- **Partial Prerendering (PPR) becomes the default behavior for every route.**
  Any component that reads runtime-only data (`cookies()`, `headers()`,
  `searchParams`, non-deterministic calls like `Math.random()`/`Date.now()`/
  `crypto.randomUUID()`, or any uncached async call) **must** be wrapped in
  `<Suspense>`, or the build/dev server throws (`blocking-route` error,
  `.../01-getting-started/08-caching.md:292` and
  migrating-to-cache-components.md:458-554 "Wrap runtime data access in
  `<Suspense>`").
- **Concretely for this repo's `src/app/page.tsx`:** it currently does
  `await getServerAuthSession()` directly at the top of an `async` Server
  Component, unwrapped in `<Suspense>`, alongside
  `queryClient.prefetchInfiniteQuery(...)` (also unwrapped). Under
  `cacheComponents: true`, `getServerAuthSession()` almost certainly reads
  `cookies()`/`headers()` internally (NextAuth session lookup), which would
  trip the "blocking-route" build error unless that read is pushed into its
  own component wrapped in `<Suspense>`, per the exact pattern shown in
  migrating-to-cache-components.md's "cookies, headers, searchParams"
  section (read runtime data in an inner, `Suspense`-wrapped component;
  pass extracted primitive values down to any `"use cache"` children).
  This is real rework, not a drop-in flag flip.
- `generateStaticParams` returning `[]` (defer everything to runtime) becomes
  a **build error** — must return at least one param
  (migrating-to-cache-components.md:420-455). Worth checking `novica/[slug]`
  and similar dynamic routes if any use this pattern.
- `runtime = 'edge'` is **no longer supported** under Cache Components —
  Node.js runtime only (migrating-to-cache-components.md:673-675). Not
  currently used in this repo's routes, verify before migrating.
- Client-side navigation state preservation changes: routes are kept mounted
  via React's `<Activity>` in `"hidden"` mode instead of unmounting on
  navigate-away, which can surface subtly different behavior for
  dropdowns/dialogs/forms that relied on unmount-to-reset
  (cacheComponents.md:36-50).

**Given this, enabling `cacheComponents: true` site-wide is a bigger, riskier
change than "swap `unstable_cache` for `use cache`" — it re-verifies every
route's dynamic-data access at build/dev time.** It is the *only* way to use
`"use cache"`/`cacheTag`/`cacheLife` at all (there is no standalone flag for
just `"use cache"` without full Cache Components), so ripping out
`nextjs-better-unstable-cache` via `"use cache"` is inseparable from taking on
that site-wide change.

## Recommendation for this repo

### Option A — adopt Cache Components now

Flip `cacheComponents: true` in `next.config.ts`, then:

```ts
// src/app/infinite-server.tsx
"use server";

import { cacheLife, cacheTag } from "next/cache";
import { find_published_articles_page } from "~/server/article/article-queries";
import { db } from "~/server/db";

async function cachedPublishedPage({
	pageParam,
	limit,
}: {
	pageParam: Date | undefined;
	limit: number;
}) {
	"use cache";
	cacheLife("minutes"); // pick a profile matching how often articles publish
	cacheTag("homepage-feed");
	return find_published_articles_page(db, { limit, cursor: pageParam });
}

export async function get_infinite_published2({ pageParam, limit }: { pageParam: Date | undefined; limit: number }) {
	const data = await cachedPublishedPage({ pageParam, limit });
	return { data, next_cursor: data.at(-1)?.created_at };
}
```

Note `db` is now called from *inside* the cached function (module-level
import), not passed as an argument — passing the Drizzle client instance in
would violate the argument-serialization constraints (§3, point 7).
`pageParam: Date | undefined` and the returned rows (which include `Date`
columns like `created_at`) are both fine as-is per §2 — no more manual
`Date` rehydration needed anywhere downstream.

This pattern applies **cleanly and identically** to `draft-articles.tsx`'s
`cachedDrafts` and `archived-articles.tsx`'s `cachedArchived` — both are
zero-argument, non-`fetch`, Drizzle-backed functions, the simplest possible
case for `"use cache"`. Same shape: drop `memoize`, add `'use cache'` +
`cacheLife(...)` + `cacheTag(...)` directly in the function body, keep
`revalidateTag`/`revalidatePath` call sites in the publish/unpublish/archive
server actions unchanged (just swap `revalidateTag` from whatever import it
currently uses, if any, to `next/cache`'s `revalidateTag`).

The real cost is **not** in these three files — it's in `src/app/page.tsx`,
which will need its `getServerAuthSession()` call moved into a `<Suspense>`-
wrapped inner component (§4), and a wider sweep for any other unwrapped
runtime-data reads across the app before `cacheComponents: true` can ship
without breaking the build.

### Option B — fix the bug without adopting Cache Components yet

If the site-wide PPR/`<Suspense>` rework in §4 is out of scope right now, the
narrower fix is to stop relying on `unstable_cache`'s JSON round-trip: keep
`unstable_cache` (still fully supported, not removed, per §1) but rehydrate
`Date` fields explicitly after every cache read (e.g. a small `reviveDates`
mapper applied to `find_published_articles_page`/`find_draft_articles`
results), or drop the third-party `nextjs-better-unstable-cache` wrapper and
call `unstable_cache` directly with manual `keyParts`/`tags`/`revalidate`
(removing one indirection layer without waiting on Cache Components). This
avoids the Date bug's actual trigger but doesn't remove the underlying
JSON.stringify serialization limitation (e.g. it would resurface for any
future `Map`/`Set`/`Buffer` column added to these queries).

Given the CONTEXT.md rewrite is already in progress and touching the
article/status model, Option A is the more durable fix — it removes the
dependency, removes the bug class entirely (not just today's Date instance
of it), and each of the three call sites is a small, mechanical change. The
cost center is the `<Suspense>` work on `page.tsx`, which is worth scoping as
its own step before flipping `cacheComponents` on.
