# Legacy `?id=` redirects, sitemaps, robots, and SEO metadata for the rewrite

Primary sources only: the bundled docs for the **installed** `next@16.2.10`
(`node_modules/next/dist/docs/`, cited by repo-relative path), Google Search Central
(cited by full URL), Vercel's own docs, first-party crawler-vendor docs, `node_modules/next/dist/**`
source, and **empirical probes** against a throwaway Next 16.2.10 app (`next build` + `next start`
+ `curl`) whose results are marked **[probe]**. No blog posts, no SEO-agency articles, no
YouTube. Where a source is ambiguous or I could not verify something first-party, it says so.

Scope note: `/si/` is **redirect-only** — it never renders content. That was settled by the
user mid-research and this document reflects it.

---

## 1. Verdict / what to do

### 1.1 File-by-file, for this repo

| File | Action | Why (short) |
| --- | --- | --- |
| `src/app/si/route.ts` | **CREATE** — Route Handler, code in §5.1 | Only shape that can read `?id=`, hit Postgres over TCP, and emit an author-chosen **301**. Unambiguous here because there is no `src/app/si/page.tsx` and never will be (see §3.4). |
| `src/app/sitemap.ts` | **CREATE** — code in §7.1 | Does not exist today (`grep MetadataRoute src` → 0 hits). Primary-slug URLs only, `lastModified` only. |
| `src/app/robots.ts` | **CREATE** — code in §8.2 | Does not exist today. Must `Disallow: /uredi/` and `/api/`, and declare the sitemap. |
| `src/app/layout.tsx` | **EDIT** — add `metadataBase`, fix `lang` | `metadataBase` is absent, so `alternates.canonical` cannot use relative paths (§9.3). `<html lang="en">` on a Slovenian site is wrong — set `lang="sl"`. |
| `src/app/novica/[published_url]/page.tsx` | **EDIT** — three fixes, §6 | (a) it returns **HTTP 200** with `<ArticleNotFound/>` for missing/hidden articles = textbook **soft 404**; (b) it serves non-primary (old) slugs at 200 = duplicate content; (c) no canonical, no JSON-LD. |
| `src/lib/cache-policy.ts` | **EDIT** — add `"/sitemap.xml"` to `ROOT_PATHS` | Makes the sitemap refresh on publish/archive/delete. `revalidatePath("/sitemap.xml")` verified to work **[probe]**, §7.4. |
| `src/app/novica/page.tsx` | **CREATE or don't link to it** | **`/novica` does not exist today** (`ls src/app/novica` → only `[published_url]`). It 404s. This matters because the Gemini doc's fallback redirects there (§10, item 6). |
| `next.config.mjs` `redirects()` | **DO NOT USE** for `?id=` | Can match on query (§3.2) but cannot do a DB lookup, so it cannot map ~thousands of ids to slugs. Not the 1,024-limit reason the Gemini doc gives (§10, item 8). |
| `proxy.ts` | **DO NOT ADD** | Would work technically in Next 16 (Node runtime — §3.3), but adds a global-matcher file to a codebase that deliberately has none (`docs/architecture.md`, "Auth"). No benefit over `route.ts`. |
| `generateSitemaps()` | **SKIP** | A few thousand articles is ~4% of one sitemap's 50,000-URL budget. §7.3 — and Next does **not** generate a sitemap index for you, verified **[probe]**. |
| `manifest.ts`, `opengraph-image`, JSON-LD, news sitemap, hreflang | See §9 for a one-line verdict each. | |

### 1.2 The redirect decisions, stated plainly

- **`/si/?id=<n>` where `n` resolves to a `published` article** → **301** to `/novica/<primary-slug>`.
  Use `NextResponse.redirect(url, 301)`. 301 and 308 are equivalent to Google
  (<https://developers.google.com/search/docs/crawling-indexing/301-redirects>: "The `301` and
  `308` status codes mean that a page has permanently moved to a new location"), so pick 301
  because the legacy traffic is 100% `GET` from browsers and crawlers and 301 has the widest
  client and analytics-tool support. 308 is equally correct; do not agonise.
- **`/si/` bare (no `id`)** → **301 to `/`** (the site root). Reasoning in §4.
- **`/si/?id=<unknown or non-numeric>`** → **410 Gone** (fall back to 404 if you'd rather not
  think about it — Google treats them identically). Do **not** blanket-redirect these to an
  index. §4.2.
- **legacy id → `draft` / `archived` / `deleted` article** → **410**, not a redirect. §4.3.
- **`/novica/<non-primary old slug>`** → **301 to `/novica/<primary-slug>`**. §6.2.
- **Do not** create a chain: the `?id=` handler must resolve the **primary** slug directly, so
  a legacy hit is one hop, never `?id=` → old-slug → primary-slug. §6.3.

### 1.3 The single most important correction to the Gemini doc

> The GSC **Change of Address** tool **does not apply here.** The domain is not changing.
> Google's own documentation excludes exactly this case. §11 / §10 item 1.

---

## 2. What already exists in this repo (verified, not assumed)

- `next.config.**mjs**` — not `.ts`. No `redirects()`, no `headers()`. Has `pageExtensions`,
  `experimental.serverActions.bodySizeLimit`, custom image loader, and `remotePatterns` that
  include `jknm-turborepo.vercel.app` and `jknm-si.vercel.app` (relevant to §9.10).
- **No `proxy.ts`, no `middleware.ts`** anywhere (`docs/architecture.md` says so and `find` confirms).
- **No `src/app/sitemap.ts`, no `src/app/robots.ts`, no `manifest.ts`, no `opengraph-image`,
  no `metadataBase`, no JSON-LD.** `grep -ril "metadataBase\|MetadataRoute\|application/ld" src`
  returns nothing.
- Article route is `src/app/novica/[published_url]/page.tsx`. **There is no `/novica` index page.**
- `favicon.ico` and friends live in `public/`, wired by hand as
  `icons: [{ rel: "icon", url: "/favicon.ico" }]` in `src/app/layout.tsx`.
- DB import path is **`~/server/db`** exporting `db` (`src/server/db/index.ts`), a
  `drizzle-orm/postgres-js` handle over the `postgres` TCP driver. **Not** `@/db`.
- Schema names (`src/server/db/schema.ts`): `Article` → table `articles`, with
  `legacy_id: integer(...).unique()`, `status` (`draft|published|archived|deleted`),
  `published_at`, `updated_at`, `title`, `excerpt`. `ArticleSlug` → table `article_slugs`,
  with `slug` (unique), `article_id`, `is_primary`.
- `is_visible_to(status, is_admin)` (`src/server/article/lifecycle-rules.ts:163`):
  `deleted` → never; `archived` → admins only; else visible.
- `cacheComponents` is **not** enabled in `next.config.mjs`, so `use cache` / `cacheTag` /
  `cacheLife` are **unavailable** in this repo (`node_modules/next/dist/docs/01-app/03-api-reference/05-config/01-next-config-js/cacheComponents.md`
  — those three APIs are listed as "When `cacheComponents` is enabled"). This is deliberate
  (ADR-0005). It constrains §7.4.
- `get_new_article_by_slug` (`src/server/article/get-article.ts`) looks up
  `ArticleSlug.slug` with **no `is_primary` filter** — it happily resolves old slugs. See §6.2.
- Cache invalidation funnels through `invalidations_for` in `src/lib/cache-policy.ts`
  → `apply_server_invalidations` in `src/server/cache-invalidation.ts`. `ROOT_PATHS = ["/"]`.
  This is the hook point for sitemap freshness.

---

## 3. Which mechanism can actually do the `?id=` lookup

Four candidates, scored on: (a) read query params, (b) Drizzle/Postgres lookup, (c) emit a
chosen permanent status code, plus the runtime each gets.

| Mechanism | (a) query params | (b) Postgres | (c) chosen status | Runtime in Next 16 |
| --- | --- | --- | --- | --- |
| `next.config.mjs` `redirects()` | Yes, via `has: [{type:'query'}]` | **No** — static config, evaluated at build | 307/308, or `statusCode` for any code | CDN/edge routing layer, no JS |
| `proxy.ts` | Yes (`request.nextUrl.searchParams`) | Yes | Any, via `NextResponse.redirect(url, n)` | **Node.js by default** |
| **`src/app/si/route.ts`** | **Yes** (`request.nextUrl.searchParams`) | **Yes** | **Any** | **Node.js by default** |
| `src/app/si/page.tsx` | Yes (`await searchParams`) | Yes | **307/308 only, and not reliably** — §3.5 | Node.js |

### 3.1 Route Handler runtime and Postgres — verified

`node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/02-route-segment-config/runtime.md`
lists the `runtime` option for `route.ts` as:

> - **`'nodejs'`** (default)
> - **`'edge'`**

So a Route Handler is Node.js unless you opt out. A TCP Postgres connection therefore works —
and it demonstrably already does in this repo: `src/app/api/wake_supabase/route.ts` is a Route
Handler that calls `db.query.Article.findFirst()` against the same `postgres`-driver handle, in
production, on Vercel. Vercel's function limits page lists "API Coverage: Full Node.js coverage"
and explicitly counts "Database connections" among the things consuming file descriptors
(<https://vercel.com/docs/functions/limitations>) — i.e. raw TCP sockets are a supported,
documented thing in Node.js functions. **No HTTP/WebSocket Postgres adapter is needed.**

### 3.2 Can `next.config` `redirects()` match query params? Yes — with a real interpolation caveat

`redirects.md` (`node_modules/next/dist/docs/01-app/03-api-reference/05-config/01-next-config-js/redirects.md`),
"Header, Cookie, and Query Matching":

> `type`: `String` - must be either `header`, `cookie`, `host`, or `query`.
> `key`: `String` - the key from the selected type to match against.
> `value`: `String` or `undefined` - the value to check for, if undefined any value will match.
> **A regex like string can be used to capture a specific part of the value, e.g. if the value
> `first-(?<paramName>.*)` is used for `first-second` then `second` will be usable in the
> destination with `:paramName`.**

And the doc's own worked example, for a header, shows the interpolation:

> ```js
> {
>   source: '/',
>   has: [{ type: 'header', key: 'x-authorized', value: '(?<authorized>yes|true)' }],
>   permanent: false,
>   destination: '/home?authorized=:authorized',
> }
> ```

The same doc warns about the non-capture case:

> `// the page value will not be available in the destination since value is provided and doesn't
> use a named capture group e.g. (?<page>home)`

**So yes:** `has: [{ type: 'query', key: 'id', value: '(?<id>\\d+)' }]` with
`destination: '/something/:id'` is legal and documented. It just doesn't help, because the
destination needs a **slug**, and only the database knows the id→slug mapping. `redirects()`
runs from static build-time config, so the only way to use it would be to enumerate every
legacy id at build time — see §3.6 for why that's a bad trade even though it's under the limit.

Also worth knowing (same doc): *"When a redirect is applied, any query values provided in the
request will be passed through to the redirect destination."* That's why a naive
`/si` → `/novica/x` rule would drag `?id=623&l=2023` along with it.

### 3.3 Proxy is NOT Edge in Next 16 — the Gemini doc's central technical error

`node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/proxy.md`, "Runtime":

> Proxy defaults to using the Node.js runtime. The `runtime` config option is not available in
> Proxy files. Setting the `runtime` config option in Proxy will throw an error.

And the version history on the same page:

> | `v16.0.0` | Middleware is deprecated and renamed to Proxy. **Proxy defaults to the Node.js runtime** |
> | `v15.5.0` | Middleware can now use the Node.js runtime (stable) |

The rename is real and confirmed: the doc opens with *"the `middleware` file convention is
deprecated and has been renamed to `proxy`"*, the file is `proxy.js|ts` at the project root or
inside `src`, the exported function is `proxy`, and there's a codemod
(`npx @next/codemod@canary middleware-to-proxy .`). So the user's premise was right and I
verified it rather than assuming it.

The consequence: the Gemini doc's stated reason for ranking Proxy last — *"Next.js
Proxy/Middleware runs in an Edge runtime environment. Database drivers (like PostgreSQL TCP
connections via Drizzle) often fail or require HTTP/WebSocket adapters"* — is **false for
Next 16**. It was true of Middleware up to 15.2. Proxy is still not what I recommend, but for
a different reason: it runs for **every route in your project** unless matched
(`proxy.md`, "Execution order"), the docs actively discourage it (*"We recommend users avoid
relying on Middleware unless no other options exist"*), and it warns *"you should not attempt
relying on shared modules or globals"* — which is precisely what `src/server/db/index.ts`'s
`globalForDb.conn` connection cache is.

### 3.4 `route.ts` + `page.tsx` at the same segment — one line, since it no longer matters

They **cannot** coexist. Verified empirically **[probe]**: `app/si/page.tsx` + `app/si/route.ts`
in Next 16.2.10 is a hard build failure —

```
app\si\page.tsx
You cannot have two parallel pages that resolve to the same path. Please check /si/page and /si/route.
```

Irrelevant to this repo: `/si/` is redirect-only, so `src/app/si/route.ts` is unambiguous.
(For the record: had both been needed, the correct shape is a Route Handler on a *different*
path plus a `redirects()`/proxy rule to steer `?id=` traffic to it — never both files in one
folder.)

### 3.5 `permanentRedirect()` vs `redirect()` vs `NextResponse.redirect(url, n)` — measured

Docs first. `redirect.md`:

> When used in a **streaming context, this will insert a meta tag to emit the redirect on the
> client side.** When used in a server action, it will serve a **303**. Otherwise, it will
> serve a **307**.

`permanentRedirect.md`, same structure, **308** instead of 307 (303 in server actions).

Measured, on a real `next build && next start` of 16.2.10 **[probe]**:

| Call | Context | Observed response |
| --- | --- | --- |
| `permanentRedirect('/x')` | Server Component page, before any flush | `HTTP/1.1 308 Permanent Redirect`, `location: /x` |
| `redirect('/x')` | Server Component page, before any flush | `HTTP/1.1 307 Temporary Redirect`, `location: /x` |
| `NextResponse.redirect(url, 301)` | Route Handler | `HTTP/1.1 301 Moved Permanently` |
| `NextResponse.redirect(url, 308)` | Route Handler | `HTTP/1.1 308 Permanent Redirect` |
| `NextResponse.redirect(url)` (no code) | Route Handler | **`HTTP/1.1 307 Temporary Redirect`** — the default is temporary |
| `permanentRedirect('/x')` **inside a `<Suspense>` child that resolved after the shell flushed** | Server Component page | **`HTTP/1.1 200 OK`** with `<meta id="__next-page-redirect" http-equiv="refresh" content="0;url=/x"/>` |

That last row is the load-bearing one. **A Server Component page can silently degrade a
"permanent redirect" into a 200 + meta-refresh.** Google does accept meta refresh, but ranks it
below server-side (<https://developers.google.com/search/docs/crawling-indexing/301-redirects>:
*"we recommend that you use a permanent server-side redirect whenever possible… If server-side
redirects aren't possible to implement on your platform, `meta refresh` redirects may be a
viable alternative"*). For a permanent legacy migration on a site that is #1 for its niche,
"a 200 that might be interpreted as permanent" is not a risk worth taking.

**So: does `redirect()` in a Server Component render work the same as in a Route Handler?**
No. In a Route Handler the response has not begun; you always get a real status line. In a
Server Component render it depends on whether the shell has flushed — and this repo's article
pages already stream. A Route Handler is deterministic. That is the strongest argument for
`route.ts` over `page.tsx` here, stronger than the status-code-choice argument.

One more Route Handler advantage, measured **[probe]**: the page-based 308 came back with
`Cache-Control: private, no-cache, no-store, max-age=0, must-revalidate` — hard-uncacheable.
The Route Handler redirect had **no** `Cache-Control` at all, and setting one worked:
`r.headers.set('Cache-Control', 'public, max-age=0, s-maxage=31536000, immutable')` came back
verbatim on the 308. See §4.4.

### 3.6 Why not just enumerate every id in `next.config.mjs`?

You could, and it would be under Vercel's limit — but don't.

Vercel's documented ceiling is **2,048**, not the 1,024 the Gemini doc claims:

> | Number of redirects in the array | 2,048 |
> | String length for `source` and `destination` | 4,096 |
>
> — <https://vercel.com/docs/redirects/configuration-redirects>, "Limits"

The same page confirms Next's config counts as the framework-native form of the same feature
(*"When using Next.js, you do not need to use `vercel.json`. Instead, use the framework-native
`next.config.js`"*), so treat 2,048 as the shared budget. Vercel also documents
`bulkRedirectsPath` for "many thousands of redirects per project" generated at build time
(<https://vercel.com/docs/project-configuration/vercel-json>) if you ever wanted the static route.

Reject it anyway: the mapping is **live data**. Slugs change (that's what `article_slugs` +
`is_primary` exist for), and articles get archived and deleted. A build-time snapshot goes
stale the first time an admin renames an article, and there is no test that would catch it.
A `route.ts` doing one indexed lookup on `Article.legacy_id` (already `.unique()`, so already
indexed) is correct by construction.

---

## 4. What each legacy request should return

### 4.1 Bare `/si/` — recommend **301 → `/`**

The old site redirected `/si/` to the newest article and had no homepage. Three options:

1. **301 → `/`** ← recommended
2. 301 → the newest published article
3. 301 → `/novica` (an index) — **impossible today, that route does not exist**

Grounding. `/si/` was the old site's de-facto entry point, so whatever authority the root of
that site accumulated sits on that URL. Google's site-move guidance is to map each old URL to
its closest equivalent and to keep the mapping stable: the recommended process is
"Create URL mappings" → "Implement redirects", and the explicit anti-pattern is
*"Don't redirect many old URLs to one irrelevant single URL destination, such as the home page
of the new site, as this can confuse users and might be treated as a soft 404 error"*
(<https://developers.google.com/search/docs/crawling-indexing/site-move-with-url-changes>).

Note what that warning actually forbids: **many** old URLs collapsing onto one irrelevant
destination. Here it's **one** old URL (`/si/` with no query) going to the one page that is its
genuine equivalent — the site's front door, which in the new app is a real, content-bearing
article feed (`src/app/page.tsx`). That's a relevant 1:1 mapping, not a soft-404 dumping ground.
Option 2 (newest article) reproduces the old *behaviour* but is a moving target: the redirect
target changes every time an article is published, so Google never gets a stable canonical
signal for `/si/`, and the URL's accumulated authority scatters across whichever article
happened to be newest at each crawl. Prefer the stable target.

### 4.2 Unknown or non-numeric `id` — **410** (404 is equally fine), never a bulk redirect

This is the case the "don't redirect many old URLs to one irrelevant destination" warning is
actually about. `/si/?id=99999` and `/si/?id=abc` are, as far as anyone knows, URLs that never
existed. Redirecting all of them to `/` manufactures exactly the pattern Google says
"might be treated as a soft 404 error."

Google treats 404 and 410 as equivalent for crawling:

> All `4xx` errors, except `429`, are treated the same: Google crawlers inform the next
> processing system that the content doesn't exist.
>
> — <https://developers.google.com/search/docs/crawling-indexing/http-network-errors>

410 is marginally better documentation-of-intent for content you know is gone; the crawl
outcome is identical. Pick 410 and move on. What matters is that the status code is **4xx and
not 2xx** — a 200 here is a soft 404, and Google is explicit that
*"A success status code tells search engines that there's a real page at that URL, as a result,
the page may be listed in search results, and search engines will continue trying to crawl that
non-existent URL instead of spending time crawling your real pages."*

Non-numeric ids: parse with a strict integer check and 410. Do **not** use `parseInt` +
`isNaN` (the Gemini doc's approach) — `parseInt("623abc", 10)` is `623`, so
`/si/?id=623abc` would silently redirect as if it were `623`. Use `/^\d+$/` (see §5.1).
Also range-check: `Article.legacy_id` is a Postgres `integer`, so an id above 2147483647
will make the driver throw rather than return no rows.

Note also that `l` (the sidebar archive year) is genuinely ignorable — but the redirect
**must** build a fresh destination URL rather than letting Next pass the original query
through, or `?l=2023` ends up glued onto `/novica/<slug>` as a crawlable duplicate. Building a
`new URL(...)` in the handler, as §5.1 does, avoids this. (Contrast the `next.config` path,
where `redirects.md` says query values *are* passed through by default.)

### 4.3 Legacy id resolves to a non-`published` article — **410**

`Article.status` can be `draft`, `published`, `archived`, or `deleted`, and
`is_visible_to` (`src/server/article/lifecycle-rules.ts:163`) hides `deleted` from everyone and
`archived` from non-admins.

Redirecting a crawler to a URL that will then serve a 404/410 is a **redirect to an error**,
which wastes a hop and gives Google an ambiguous signal about `?id=` — the target isn't a
canonical replacement, it's a dead end. Return **410 directly** from `/si/route.ts` for these.
One response, one honest signal.

Two sub-cases worth being deliberate about:

- **`archived`** — a human admin visiting a legacy `?id=` link would arguably like to be sent
  to the article they can still see. If you want that, gate it on the session
  (`getServerAuthSession()`) and redirect **only for admins**, while public/crawler requests
  still get 410. §5.1 includes this, commented. It is optional; the simple version is fine.
- **`draft` with `supersedes_id != null`** — a superseding draft of a live article. The *source*
  is still published and still has the slug, and `legacy_id` lives on the source row, not the
  draft, so a legacy-id lookup naturally lands on the published source. No special handling.

### 4.4 Should redirect responses be CDN-cached?

**Yes, and Next 16 will let you** — but only from a Route Handler.

- Page-based redirects come back `Cache-Control: private, no-cache, no-store, max-age=0,
  must-revalidate` **[probe]**. Every legacy hit is a function invocation and a DB query.
  You cannot fix this from a page.
- Route Handler redirects carry no `Cache-Control`, and one you set is passed through verbatim
  **[probe]**. Vercel documents Route Handler responses as cacheable at the CDN
  (<https://vercel.com/docs/functions/limitations>, "Cache responses: Yes" →
  <https://vercel.com/docs/cdn-cache#using-vercel-functions>).

Recommendation: on the **success** path (a resolved published slug), set
`Cache-Control: public, max-age=0, s-maxage=86400, stale-while-revalidate=604800`. `max-age=0`
keeps browsers honest so a slug rename isn't frozen in someone's cache forever, while
`s-maxage` lets Vercel's CDN absorb crawler traffic. Do **not** cache the 410 path for long
(`s-maxage=60` or nothing) — that's the path most likely to be wrong while you're still
reconciling `legacy_id` values during the data migration.

Also note: Vercel's own guidance leans 307/308 (*"We recommend using status code `307` or `308`
to avoid the ambiguity of non `GET` methods"*, <https://vercel.com/docs/redirects>) and
characterises **308 as "Cached by client"** and 301 as "Cached by client, the method may or may
not be changed to `GET`". For a `GET`-only legacy path this distinction is immaterial; if you'd
rather follow Vercel's house style, use 308. Google does not care (§4.5).

### 4.5 Google's actual position on 301 / 308 / 302 / 307

From <https://developers.google.com/search/docs/crawling-indexing/301-redirects>:

> The `301` and `308` status codes mean that a page has permanently moved to a new location.

> **Permanent redirects (301/308):** Googlebot follows the redirect, and the indexing pipeline
> uses the redirect as a signal that the redirect target should be canonical.

> **Temporary redirects (302/303/307):** Googlebot follows the redirect, but the indexing
> pipeline doesn't use the redirect as a signal that the redirect target should be canonical.

> If you need to change the URL of a page as it is shown in search engine results, we recommend
> that you use a permanent server-side redirect whenever possible.

So: **301 == 308** for Google's purposes, and **307 is the wrong choice** — which is exactly
what a bare `NextResponse.redirect(url)` or a bare `redirect()` gives you. This is the trap.

**Chains.** From <https://developers.google.com/search/docs/crawling-indexing/site-move-with-url-changes>:

> Googlebot can follow up to 10 hops in a "chain" of multiple redirects

with guidance to keep chains to three or fewer, preferably under five, to reduce user latency.

**How long to keep the redirects.** Same page:

> Keep the redirects for as long as possible, generally at least 1 year.

Since these are permanent URL retirements and the handler is ~40 lines with a DB index behind
it, **keep them indefinitely.** There is no upside to ever removing them.

Nothing here is John-Mueller hearsay. The Gemini doc's "John Mueller has repeatedly confirmed"
framing is unnecessary — Google's own documentation states 301 and 308 are both permanent, in
writing, on the page above. Cite that instead.

---

## 5. Real code

### 5.1 `src/app/si/route.ts`

```ts
import { and, eq } from "drizzle-orm";
import { NextResponse, type NextRequest } from "next/server";
import { db } from "~/server/db";
import { Article, ArticleSlug } from "~/server/db/schema";

/**
 * Legacy 2008-site URL compatibility.
 *
 * The old site served articles at `https://www.jknm.si/si/?id=623&l=2023`, where
 * `id` is what this schema stores as `Article.legacy_id` and `l` was a sidebar
 * archive year (ignorable — deliberately NOT forwarded, so it can't become a
 * crawlable duplicate of /novica/<slug>).
 *
 * A Route Handler, not a `page.tsx`, for three reasons — all verified against
 * next@16.2.10, see docs/research/legacy-id-redirects-and-seo-metadata.md:
 *   1. In a Server Component render, `permanentRedirect()` degrades to a 200 +
 *      `<meta http-equiv="refresh">` once the shell has flushed. A Route Handler
 *      always emits a real status line.
 *   2. Only here can we choose 301 explicitly (`permanentRedirect` is 308-only).
 *   3. Page redirects are sent `Cache-Control: private, no-store`; a Route
 *      Handler's headers are ours to set, so the CDN can absorb crawler traffic.
 *
 * Route Handlers default to the Node.js runtime in Next 16 (route-segment-config
 * `runtime.md`), so the `postgres` TCP driver in `~/server/db` works as-is —
 * same as `src/app/api/wake_supabase/route.ts` already does in production.
 *
 * There is no `src/app/si/page.tsx` and there must never be one: two files that
 * resolve to the same path is a hard build error ("You cannot have two parallel
 * pages that resolve to the same path").
 */

// Strict: `parseInt("623abc")` is 623, which would redirect a URL that never
// existed as if it were a real article.
const LEGACY_ID_PATTERN = /^\d+$/;
// `Article.legacy_id` is a Postgres `integer`; anything larger makes the driver
// throw instead of returning zero rows.
const PG_INT_MAX = 2_147_483_647;

/** Cache the id→slug hop at the CDN, but never in the user's browser: a slug
 *  rename must not be frozen client-side. */
const HIT_CACHE_CONTROL =
	"public, max-age=0, s-maxage=86400, stale-while-revalidate=604800";

function gone() {
	// 404 and 410 are equivalent to Googlebot ("All 4xx errors, except 429, are
	// treated the same"). 410 states the intent. What matters is that it is not
	// a 2xx — a 200 here would be a soft 404 and would keep these phantom URLs
	// in the index, eating crawl budget.
	return new NextResponse("Gone", {
		status: 410,
		headers: { "content-type": "text/plain; charset=utf-8" },
	});
}

async function find_primary_slug(legacy_id: number) {
	// One query, one hop: resolve straight to the *primary* slug so a legacy hit
	// never chains ?id= -> old-slug -> primary-slug.
	const row = await db
		.select({ slug: ArticleSlug.slug, status: Article.status })
		.from(Article)
		.innerJoin(
			ArticleSlug,
			and(eq(ArticleSlug.article_id, Article.id), eq(ArticleSlug.is_primary, true)),
		)
		.where(eq(Article.legacy_id, legacy_id))
		.limit(1);

	return row[0];
}

export async function GET(request: NextRequest) {
	const raw_id = request.nextUrl.searchParams.get("id");

	// Bare `/si/`. The old site sent this to the newest article; we send it to
	// `/` instead. `/` is the new site's genuine equivalent front door AND a
	// stable target — "newest article" changes on every publish, so Google would
	// never settle on a canonical for this URL.
	if (raw_id === null || raw_id === "") {
		return NextResponse.redirect(new URL("/", request.nextUrl.origin), 301);
	}

	if (!LEGACY_ID_PATTERN.test(raw_id)) return gone();

	const legacy_id = Number(raw_id);
	if (legacy_id > PG_INT_MAX) return gone();

	const found = await find_primary_slug(legacy_id);

	// Unknown id, or an article with no primary slug (shouldn't happen —
	// `create_article` always writes one — but a missing slug is not a redirect).
	if (!found) return gone();

	// draft / archived / deleted. Redirecting here would point Googlebot at a URL
	// that then 404s: a wasted hop and an ambiguous canonical signal. Answer once,
	// honestly. (If you want archived articles to stay reachable for signed-in
	// admins, gate that here on `await getServerAuthSession()` and redirect only
	// for them — public and crawler requests must still get 410.)
	if (found.status !== "published") return gone();

	const response = NextResponse.redirect(
		new URL(`/novica/${encodeURIComponent(found.slug)}`, request.nextUrl.origin),
		// 301, not 308: Google treats them identically ("The 301 and 308 status
		// codes mean that a page has permanently moved to a new location"), and
		// 301 has the widest client and analytics-tool support. All legacy traffic
		// is GET, so 308's method-preservation guarantee buys nothing.
		301,
	);
	response.headers.set("Cache-Control", HIT_CACHE_CONTROL);
	return response;
}
```

Two notes on the code as written.

- `new URL(path, request.nextUrl.origin)` rather than `request.url`: on Vercel,
  `request.url` can carry the deployment host, which would emit a `.vercel.app`
  `Location` and leak an off-canonical hostname into a permanent redirect. `nextUrl.origin`
  respects the forwarded host.
- No `export const dynamic`/`runtime`: a Route Handler that reads `request.nextUrl` is dynamic
  by definition, and Node is already the default.

### 5.2 A sanity test worth having

`src/app/si/route.test.ts` — the repo already tests server logic with vitest
(`src/server/article/*.test.ts`). Assert: bare → 301 `/`; `?id=<published>` → 301
`/novica/<primary>`; `?id=<archived>` → 410; `?id=623abc` → 410; `?id=99999999999` → 410;
`?id=<published>&l=2023` → `Location` has **no** `l`. The last one is the assertion most
likely to catch a future regression.

---

## 6. `/novica/[published_url]` — three fixes the rewrite needs

### 6.1 It currently serves a soft 404 (highest-priority fix)

`src/app/novica/[published_url]/page.tsx` today:

```tsx
if (!article || !is_visible_to(article.status, Boolean(session))) {
  return (<Shell><ArticleNotFound /></Shell>);   // <-- HTTP 200
}
```

Returning JSX means **HTTP 200 with an error page** — the exact definition of a soft 404.
Google:

> A success status code tells search engines that there's a real page at that URL, as a result,
> the page may be listed in search results, and search engines will continue trying to crawl
> that non-existent URL instead of spending time crawling your real pages.
>
> — <https://developers.google.com/search/docs/crawling-indexing/soft-404-errors> (via
> Search Central; the JS-specific guidance at
> <https://developers.google.com/search/docs/crawling-indexing/javascript/fix-search-javascript#soft-404-errors>
> gives the same two fixes: return a real error status, or `noindex`)

Fix: call `notFound()` instead. `src/app/not-found.tsx` already exists, and `notFound()` emits
a real 404. If the club wants the prettier `<ArticleNotFound/>` styling, move that component
into `not-found.tsx` — don't keep the 200.

This is not hypothetical damage. A rewrite that changes URLs while every wrong URL answers 200
is how a #1 ranking dissolves: Google indexes the error page under dozens of URLs, and the
soft-404 report in Search Console fills with them.

### 6.2 Non-primary slugs are served at 200 — duplicate content

`get_new_article_by_slug` (`src/server/article/get-article.ts`) resolves
`ArticleSlug.slug` with **no `is_primary` filter**. Since `article_slugs` deliberately retains
old slugs after a rename (`CONTEXT.md`: *"held in the `article_slugs` table rather than on the
article row, so renames can leave a redirect behind"*), the *intent* was a redirect but the
*implementation* is a 200. Every renamed article is currently reachable at two URLs, both
returning identical content, neither declaring a canonical.

Fix, in the page: after the lookup, compare the requested slug to
`article.article_slugs.find(s => s.is_primary)?.slug` (the repo already has this idiom at
`src/components/article/new-adapter.ts:64` and `src/server/article/sync-algolia.ts:26`). If they
differ, `permanentRedirect(\`/novica/${primary}\`)` — 308 is correct and there's no status-code
choice to make here.

Do this **before** rendering anything, so the page has not begun streaming and you get a real
308 rather than the meta-refresh from §3.5. In practice that means putting the check at the top
of the page component, before the `<Shell>` returns — and note `generateMetadata` runs first
and calls the same cached lookup, so there's no extra query (docs confirm `redirect()` and
`notFound()` are legal inside `generateMetadata`:
`node_modules/next/dist/docs/01-app/03-api-reference/04-functions/generate-metadata.md:197`).

### 6.3 The chain question

With §6.2 in place, is there a chain from a legacy `?id=`? **No — as long as `/si/route.ts`
resolves the primary slug**, which §5.1 does via `eq(ArticleSlug.is_primary, true)`. One hop:
`/si/?id=623` → 301 → `/novica/<primary>` → 200.

The chain only appears if someone writes the handler as "find any slug for this article" — then
a renamed article gives `?id=` → old-slug → primary-slug, two hops. Still within Google's
10-hop tolerance and its "three or fewer" advice, so it wouldn't be a disaster; it's just
avoidable for free. The `is_primary` predicate in the join is what avoids it, and the test in
§5.2 is what keeps it avoided.

### 6.4 While in this file: canonical + JSON-LD

Add to `generateMetadata`:

```ts
alternates: { canonical: `/novica/${published_url}` },
openGraph: {
  type: "article",
  title, description: article.excerpt ?? undefined,
  publishedTime: article.published_at?.toISOString(),
  modifiedTime: article.updated_at.toISOString(),
},
```

Relative `canonical` requires `metadataBase` (§9.3). Also add `robots: { index: false }` on the
admin-visible-only paths if you keep any.

---

## 7. Sitemaps

### 7.1 `src/app/sitemap.ts`

```ts
import { and, eq } from "drizzle-orm";
import type { MetadataRoute } from "next";
import { db } from "~/server/db";
import { Article, ArticleSlug } from "~/server/db/schema";

// The site's canonical origin. Hardcoded on purpose: `NEXT_PUBLIC_NEXTAUTH_URL`
// (src/env.js) is preprocessed from `VERCEL_URL`, so using it here would emit
// `https://jknm-si.vercel.app/...` into the sitemap and hand Google a second,
// off-canonical hostname for every article. See §9.10.
const ORIGIN = "https://www.jknm.si";

// A safety net, not the refresh mechanism — `revalidatePath("/sitemap.xml")`
// (wired through src/lib/cache-policy.ts) is what makes a publish show up.
// Matches the 3600s window the other public reads use (docs/architecture.md).
export const revalidate = 3600;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
	// Primary slugs only. Old slugs 301 to the primary one (see §6.2), and Google
	// asks that sitemaps list canonical URLs, not redirects.
	const articles = await db
		.select({
			slug: ArticleSlug.slug,
			updated_at: Article.updated_at,
			published_at: Article.published_at,
		})
		.from(Article)
		.innerJoin(
			ArticleSlug,
			and(eq(ArticleSlug.article_id, Article.id), eq(ArticleSlug.is_primary, true)),
		)
		.where(eq(Article.status, "published"));

	const static_routes: MetadataRoute.Sitemap = [
		{ url: ORIGIN, lastModified: new Date() },
		{ url: `${ORIGIN}/arhiv` },
		{ url: `${ORIGIN}/avtorji` },
		{ url: `${ORIGIN}/kontakt` },
		{ url: `${ORIGIN}/klub` },
		{ url: `${ORIGIN}/zgodovina` },
		{ url: `${ORIGIN}/raziskovanje` },
		{ url: `${ORIGIN}/publiciranje` },
		{ url: `${ORIGIN}/varstvo` },
	];

	// No `changeFrequency`, no `priority`: "Google ignores <priority> and
	// <changefreq> values." Emitting them is bytes Google discards.
	// No `images`/`videos`/`alternates` either — single-language site, and image
	// sitemaps earn nothing here (§9).
	const article_routes: MetadataRoute.Sitemap = articles.map((article) => ({
		url: `${ORIGIN}/novica/${encodeURIComponent(article.slug)}`,
		// Must be truthful: "Google uses the <lastmod> value if it's consistently
		// and verifiably accurate." `updated_at` is $onUpdate-maintained, so it is.
		lastModified: article.updated_at ?? article.published_at ?? undefined,
	}));

	return [...static_routes, ...article_routes];
}
```

Verify the static-route list against `src/app/(static)/` before shipping — I read the directory
names but not each page.

### 7.2 The `MetadataRoute.Sitemap` shape, and a docs bug

The **real** type, from `node_modules/next/dist/lib/metadata/types/metadata-interface.d.ts:562`:

```ts
type SitemapFile = Array<{
  url: string
  lastModified?: string | Date | undefined
  changeFrequency?: 'always'|'hourly'|'daily'|'weekly'|'monthly'|'yearly'|'never' | undefined
  priority?: number | undefined
  alternates?: { languages?: Languages<string> | undefined } | undefined
  images?: string[] | undefined
  videos?: Videos[] | undefined
}>
```

**The bundled doc's "Returns" section is wrong** — `sitemap.md`'s `type Sitemap` block omits
`images` and `videos` entirely, even though the same page documents both above it with worked
examples. The `.d.ts` is authoritative; all seven fields exist and all seven serialise
correctly **[probe]** (`xmlns:image` and `xmlns:xhtml` namespaces are added automatically when
`images`/`alternates` are present).

**Which of those Google honours:**

| Field | Google's position |
| --- | --- |
| `url` → `<loc>` | Required. |
| `lastModified` → `<lastmod>` | **Used, conditionally**: *"Google uses the `<lastmod>` value if it's consistently and verifiably (for example by comparing to the last modification of the page) accurate."* Must be a *significant* content change, not a copyright-year bump. |
| `changeFrequency` → `<changefreq>` | **IGNORED**: *"Google ignores `<priority>` and `<changefreq>` values."* |
| `priority` → `<priority>` | **IGNORED**, same sentence. |
| `alternates.languages` → `xhtml:link` | Honoured, but only meaningful for multilingual sites. N/A here (§9.9). |
| `images` | Honoured as an image sitemap. Worth it only if image search matters; see §9. |
| `videos` | Honoured. No video content here. |

All from <https://developers.google.com/search/docs/crawling-indexing/sitemaps/build-sitemap>.

**So: omit `changeFrequency` and `priority`.** They're inert. This is the one place the Gemini
doc's silence is fine and most sitemap tutorials are wrong.

### 7.3 `generateSitemaps()` — direct verdict: **you do not need it. Skip it.**

Google's limit: *"All formats limit a single sitemap to 50MB (uncompressed) or 50,000 URLs."*
A few thousand articles is under 10% of the URL budget and nowhere near 50MB. One
`src/app/sitemap.ts` is the whole answer. Revisit at ~40,000 URLs, i.e. never, for a caving
club's news archive.

But since you asked specifically, here is what it actually does — including a fact the docs
don't tell you:

**URLs.** `generate-sitemaps.md`: *"Your generated sitemaps will be available at
`/.../sitemap/[id].xml`. For example, `/product/sitemap/1.xml`."* Note `sitemap.md` states the
same thing slightly differently (*"available at `/.../sitemap/[id]`"*) — a minor internal
inconsistency in the bundled docs. **Measured [probe]** with `app/product/sitemap.ts` returning
`[{id:0},{id:1}]`, on 16.2.10:

- `/product/sitemap/0.xml` → **200**
- `/product/sitemap/1.xml` → **200**
- `/product/sitemap.xml` → **404**

The `/sitemap.xml/[id]` form the version history mentions is historical: *"`v13.3.2`
`generateSitemaps` introduced. In development, you can view the generated sitemap on
`/.../sitemap.xml/[id]`"*, and *"`v15.0.0` `generateSitemaps` now generates consistent URLs
between development and production."* On 16.2.10 it is `/sitemap/[id].xml` in both.

**Does Next auto-generate a sitemap index? NO.** This is the important part and **no Next doc
says it**. Measured **[probe]**: `/product/sitemap.xml` returns **404**. There is no index
anywhere. You must hand-write one (a static `app/sitemap.xml/route.ts` emitting
`<sitemapindex>`) or submit each shard to Search Console individually. Google permits either —
*"you must break your sitemap into multiple sitemaps. You can **optionally** create a sitemap
index file and submit that single index file to Google"* — but it's manual work Next does not
do for you. Anyone who reaches for `generateSitemaps()` expecting the index to appear is in
for a surprise.

**Does it work with `force-dynamic` / ISR?** The `id`s come from `generateSitemaps()` at build
time, so the *set of shards* is fixed per deployment (`● (SSG) … uses generateStaticParams`
in the build output **[probe]**) — a new shard needs a redeploy. Each shard's *contents* obey
the usual route-segment config, so `export const revalidate = 3600` works per shard. I did not
test `dynamic = 'force-dynamic'` with `generateSitemaps()` and won't claim it works. Moot given
the verdict.

### 7.4 Making the sitemap refresh when an article is published

The build output shows `sitemap.ts` is a cached route, not dynamic: `○ /sitemap.xml  1h  1y`
**[probe]**. The bundled doc agrees: *"`sitemap.js` is a special Route Handler that is cached by
default unless it uses a Request-time API or dynamic config option."* So without an explicit
bust, a publish would not appear for up to `revalidate` seconds.

What's available **in this repo**:

- ✅ `export const revalidate = 3600` — **works**, shown in the build table **[probe]**.
- ✅ `revalidatePath("/sitemap.xml")` — **works, verified [probe]**: with `revalidate = 86400`,
  the sitemap served stale content after its underlying data changed, then served fresh content
  on the very next request after `revalidatePath("/sitemap.xml")` ran, and stayed fresh.
  Consistent with `revalidatePath.md`: *"The path parameter can point to pages, layouts, or
  route handlers."*
- ❌ `cacheTag()` / `cacheLife()` / `use cache` — **not available.** `cacheComponents.md` lists
  them under "When `cacheComponents` is enabled", and `next.config.mjs` does not enable it.
  Enabling it is out of scope and was already rejected in ADR-0005.
- ⚠️ `revalidateTag`/`updateTag` on the existing `article` tag would refresh
  `unstable_cache` data but not the cached sitemap **route**. You need the path bust.

**The one-line change.** In `src/lib/cache-policy.ts`:

```ts
/** Every article view is reachable from `/`, so far. */
const ROOT_PATHS = ["/", "/sitemap.xml"] as const;
```

`apply_server_invalidations` (`src/server/cache-invalidation.ts`) already loops
`revalidatePath` over `paths`, and every article lifecycle event routes through
`PUBLISHED_SET_CHANGED` / the `article.unarchived` descriptor, all of which use `ROOT_PATHS`.
So publish, archive, unarchive, and delete all bust the sitemap for free. Note this also busts
it on `DRAFTS_ONLY` events (save/create), which is harmless over-invalidation and matches the
comment already in `cache-policy.ts` about preferring one shared descriptor per event class.

Also: `cache-policy.test.ts` asserts tag reachability, not path reachability, so this change
shouldn't need a test update — but run the suite.

---

## 8. `robots.txt`

### 8.1 The shape

`node_modules/next/dist/lib/metadata/types/metadata-interface.d.ts` (~line 545) and
`robots.md`:

```ts
type Robots = {
  rules:
    | { userAgent?: string | string[]; allow?: string | string[]; disallow?: string | string[]; crawlDelay?: number }
    | Array<{ userAgent: string | string[]; allow?: string | string[]; disallow?: string | string[]; crawlDelay?: number }>
  sitemap?: string | string[]
  host?: string
}
```

Multiple `rules` entries are supported, `userAgent` accepts an array (which emits repeated
`User-Agent:` lines sharing one directive block — valid grouping under RFC 9309), `sitemap`
accepts an array, and `host` emits a `Host:` line. Output order measured **[probe]**: rule
groups, then `Host:`, then `Sitemap:`.

`host` is a Yandex extension, not part of the standard and not honoured by Google. **Omit it.**

### 8.2 `src/app/robots.ts`

```ts
import type { MetadataRoute } from "next";

const ORIGIN = "https://www.jknm.si";

export default function robots(): MetadataRoute.Robots {
	return {
		rules: [
			{
				// Everything crawlable except the admin surface. `robots.txt` is not
				// an access control — `/uredi` and `/preveri` are already gated by
				// `getServerAuthSession()`. This is purely about crawl budget and
				// keeping admin URLs out of the index.
				userAgent: "*",
				allow: "/",
				disallow: ["/uredi/", "/preveri/", "/prijava/", "/api/"],
			},
		],
		sitemap: `${ORIGIN}/sitemap.xml`,
	};
}
```

That's it. **Nothing else is needed to allow AI crawlers** — and this is the part most
"allow the AI bots" advice gets backwards.

### 8.3 Allowing AI crawlers: the honest answer, then the tokens

`User-agent: * / Allow: /` **already allows every crawler in the table below.** robots.txt is
opt-*out*; a permissive `*` group grants access to everyone who isn't more specifically named.
Adding explicit `Allow: /` groups per bot is **cosmetic** — and mildly risky, because under
RFC 9309 the most-specific matching group *wins exclusively*: a `User-agent: GPTBot` group
containing only `Allow: /` means GPTBot no longer sees your `Disallow: /uredi/`, so you'd be
inviting it into the admin routes. If you want the explicit groups anyway (some people like the
documentation value, and it's a clear signal to a human auditor), **repeat the disallows in
every group.**

The two `-Extended` tokens are a different animal. `Google-Extended` and `Applebot-Extended` are
**not crawlers** — they are training-opt-out control tokens. Google is unusually explicit:

> Google-Extended doesn't have a separate HTTP request user agent string. Crawling is done with
> existing Google user agent strings; the robots.txt user-agent token is used in a control
> capacity.
>
> — <https://developers.google.com/search/docs/crawling-indexing/google-common-crawlers>

and it controls *"whether content Google crawls from their sites may be used for training
future generations of Gemini models"*, with no effect on Search inclusion or ranking. Apple's
is the same idea: *"With Applebot-Extended, web publishers can choose to opt out of their
website content being used to train Apple's general purpose foundation models"*
(<https://support.apple.com/en-us/119829>). **"Allowing" them means opting IN to AI training
— which is the default anyway if you say nothing.** There is nothing to add. Adding
`Allow: /` for them is a no-op that reads as if it does something.

**First-party-verified tokens** (each checked against that vendor's own published page, not
against a crawler-list aggregator):

| Token | What the vendor says it does | Crawler or control? | Source |
| --- | --- | --- | --- |
| `GPTBot` | "For training generative AI foundation models." | Crawler | <https://developers.openai.com/api/docs/bots> |
| `OAI-SearchBot` | "For search functionality in ChatGPT. Sites blocking this won't appear in ChatGPT search results." | Crawler | same |
| `ChatGPT-User` | "For user-initiated actions within ChatGPT and Custom GPTs. **Not used for automatic web crawling, so robots.txt rules may not apply.**" | User-triggered fetcher | same |
| `OAI-AdsBot` | "For validating ad landing pages submitted to ChatGPT." | Crawler | same |
| `ClaudeBot` | "helps enhance the utility and safety of our generative AI models by collecting web content that could potentially contribute to their training." | Crawler | <https://support.claude.com/en/articles/8896518-does-anthropic-crawl-data-from-the-web-and-how-can-site-owners-block-the-crawler> |
| `Claude-User` | "supports Claude AI users. When individuals ask questions to Claude, it may access websites using a Claude-User agent." | User-triggered fetcher | same |
| `Claude-SearchBot` | "navigates the web to improve search result quality for users." | Crawler | same |
| `PerplexityBot` | "designed to surface and link websites in search results on Perplexity. It is **not** used to crawl content for AI foundation models." | Crawler | <https://docs.perplexity.ai/guides/bots> |
| `Perplexity-User` | "supports user actions within Perplexity… it might visit a web page to help provide an accurate answer." | User-triggered fetcher | same |
| `Googlebot` | Google Search's crawler. | Crawler | <https://developers.google.com/search/docs/crawling-indexing/google-common-crawlers> |
| `Google-Extended` | Gemini **training / grounding opt-out control**. "doesn't have a separate HTTP request user agent string." | **Control token, not a crawler** | same |
| `GoogleOther`, `Google-InspectionTool`, `Googlebot-Image` | Documented on the same Google page. | Crawlers | same |
| `Applebot` | "the web crawler for Apple… used to power… Spotlight, Siri, and Safari." | Crawler | <https://support.apple.com/en-us/119829> |
| `Applebot-Extended` | Apple foundation-model **training opt-out control**. | **Control token, not a crawler** | same |

**Could NOT verify first-party — flagged rather than guessed:**

- **`Bingbot` / Microsoft.** I could not retrieve a first-party Microsoft page stating the token
  in a form I could quote. Both <https://www.bing.com/webmasters/help/which-crawlers-does-bing-use-8c184ec0>
  and the Bing webmaster blog returned no usable body text through the tooling available to me.
  `bingbot` is near-universally correct and Next's own `robots.md` uses `'Bingbot'` in its
  example, but **treat it as unverified here.** There is also a `MSNBot-Media` and historically
  a `BingPreview`; I verified neither. Note robots.txt user-agent matching is
  case-insensitive, so `Bingbot` vs `bingbot` is not a concern. **Practical upshot: none** —
  the `*` group already allows it, so nothing depends on getting this token right.
- **A Copilot-specific token.** I found no first-party Microsoft documentation of one. Do not
  invent one.
- **`anthropic-ai` / `Claude-Web`.** Widely cited in third-party lists; Anthropic's own current
  support article documents **only** `ClaudeBot`, `Claude-User`, and `Claude-SearchBot`.
  Treat the other two as legacy/unverified and don't include them.

**Recommendation for this site:** ship §8.2 exactly as written. The site *wants* AI visibility
(it's a niche authority — being the cited source in ChatGPT/Claude/Perplexity answers is pure
upside), the `*` group already grants it, and every extra group is a chance to accidentally
un-disallow `/uredi/`.

---

## 9. Everything else, one verdict each

| Item | Verdict | Grounding |
| --- | --- | --- |
| **9.1 `manifest.ts`** | **SKIP-ish.** `public/site.webmanifest` already exists and is presumably linked. Migrating to `app/manifest.ts` buys type safety and one less hand-maintained file, nothing SEO. Do it only while already editing icons. Zero ranking effect. | `manifest.md`; `public/site.webmanifest` exists |
| **9.2 `opengraph-image` / `twitter-image`** | **DO — file convention at the root, `ImageResponse` route for articles is optional.** Currently there is **no OG image at all**, so every share of every article is a bare link. Start with a static `src/app/opengraph-image.png` (auto-emits `og:image` + `type`/`width`/`height`). A per-article `opengraph-image.tsx` using `ImageResponse` is nicer but adds a rendered image per article page; defer. **No direct ranking effect** — this is CTR/social, be honest about that. Limits: `opengraph-image` ≤ 8MB, `twitter-image` ≤ 5MB, *"If the image file size exceeds these limits, the build will fail."* Add `opengraph-image.alt.txt`. | `opengraph-image.md` |
| **9.3 `metadataBase` + `alternates.canonical`** | **DO — highest-value metadata item.** Absent today. Without it, *"Using a relative path in a URL-based `metadata` field without configuring a `metadataBase` will cause a build error"*, so canonicals must be absolute strings everywhere. Set `metadataBase: new URL("https://www.jknm.si")` in `src/app/layout.tsx` and `alternates.canonical` per page. Canonicals are the direct mitigation for §6.2's duplicate slugs and for §9.10's `.vercel.app` hostnames. | `generate-metadata.md:400-428, 823-841` |
| **9.4 JSON-LD, and which type** | **DO, with honest expectations.** Use **`Article`** (or `BlogPosting`; they're interchangeable here). *"Article objects must be based on one of the following schema.org types: `Article`, `NewsArticle`, `BlogPosting`"* and *"There are no required properties."* Recommended: `author`, `headline`, `image`, `datePublished`, `dateModified`. **Be honest: this earns no rich result.** Google says *"there's no markup requirement to be eligible for Google News features like Top stories"* and *"Google does not guarantee that features that consume structured data will show up in search results."* The real payoff is unambiguous author/date extraction — and increasingly, LLM ingestion. Cheap, low-risk, do it. | <https://developers.google.com/search/docs/appearance/structured-data/article> |
| **9.5 `NewsArticle` vs `Article` vs `BlogPosting`** | **`Article`.** A caving club is not a news publisher; `NewsArticle` claims an editorial-newsroom identity the site doesn't have and unlocks nothing (Top stories needs no markup at all). `BlogPosting` is equally fine if it reads more truthfully. Don't overthink — Google accepts all three at the same page. | same |
| **9.6 Google News / `news:` sitemap** | **SKIP.** *"If you are a news publisher, use news sitemaps…"*, capped at 1,000 `<news:news>` tags, and publishers should *"only include recent URLs for articles that were created in the last two days."* A club that publishes occasionally would ship a mostly-empty news sitemap. Not eligible in spirit, zero benefit. | <https://developers.google.com/search/docs/crawling-indexing/sitemaps/news-sitemap> |
| **9.7 `favicon` / `icon` conventions** | **OPTIONAL cleanup.** `favicon.ico` can only live at the top level of `app/`; `icon.*` works at any segment; the hand-rolled `icons: [{rel:"icon", url:"/favicon.ico"}]` in `layout.tsx` works fine today. Moving `public/favicon.ico` → `src/app/favicon.ico` lets you delete the manual `icons` array. **Zero ranking effect.** | `app-icons.md` |
| **9.8 `apple-icon`** | **OPTIONAL.** `public/apple-touch-icon.png` already exists. `src/app/apple-icon.png` would emit `rel="apple-touch-icon"` automatically. Cosmetic. | `app-icons.md` |
| **9.9 hreflang** | **NOTHING TO DO. Say so and move on.** Single-language site. `/si/` was the only language path on the old site, and it's being retired. Do not emit `alternates.languages` or sitemap `xhtml:link`. Do set `<html lang="sl">` in `src/app/layout.tsx` — it currently says **`lang="en"`**, which is simply wrong for Slovenian content and is a one-character fix. | `sitemap.md`, `generate-metadata.md`; `src/app/layout.tsx:34` |
| **9.10 `.vercel.app` hostnames** | **CHECK BEFORE LAUNCH — real ranking risk.** `next.config.mjs` `remotePatterns` reference `jknm-si.vercel.app` and `jknm-turborepo.vercel.app`, so production alias URLs exist. Vercel's docs state generated URLs are *"publicly accessible by default"* and I found **no** documentation that Vercel adds `X-Robots-Tag: noindex` to *production* `.vercel.app` aliases (only preview deployments are commonly protected, and only via Deployment Protection, which is a permissions feature, not a robots feature). An indexable duplicate of the whole site on a second hostname is a classic rewrite ranking-killer. Mitigate with absolute canonicals from `metadataBase` (§9.3) **plus** a `headers()` rule in `next.config.mjs` emitting `X-Robots-Tag: noindex` when `has: [{type:'host', value:'(?<h>.*\\.vercel\\.app)'}]`. **I could not verify Vercel's current noindex behaviour first-party — test the live headers on the alias before launch.** | <https://vercel.com/docs/deployments/generated-urls>; `next.config.mjs` |

---

## 10. Audit of `redirect-to-domain-gemini.md` — every place it is wrong

Numbered so they can be worked through. The document is not summarised; it is checked.

1. **"Use the Change of Address tool inside Google Search Console once the live DNS point
   switches over."** (§3, item 2) — **WRONG, and the most consequential error.** Google's own
   documentation for the tool says it is for *"moving your website from one domain or subdomain
   to another: for instance, from example.com to example.org"*, and explicitly lists as
   **do-not-use** cases: *"Moving pages within the same domain"*, *"Moving between www and
   non-www in the same domain"*, and *"moving hosts or CDNs without visible URL modifications"*
   (<https://support.google.com/webmasters/answer/9370220>). `www.jknm.si` → `www.jknm.si` is
   precisely case 2 and 4. The tool also *"only functions on properties at the domain level"*
   and requires Search Console ownership of **two** properties — there is no second property.
   Google's own same-domain migration guide reinforces this by never mentioning the tool
   (<https://developers.google.com/search/docs/crawling-indexing/site-move-no-url-changes>).
   **Do not open the Change of Address tool. There is nothing to submit.**

2. **The whole document's framing as "a domain and architecture migration" / "domain
   migration"** (opening line, §3 title) — **WRONG.** The domain is not changing. This is a
   same-domain URL-structure change. It matters because it changes which Google playbook
   applies: "Site moves with URL changes" (mapping + redirects + monitoring), not the
   domain-move playbook (Change of Address + 180-day signal forwarding). It also means the
   `jknm.si` → `www.jknm.si` advice in §3 item 1 is not a migration task at all — it's
   pre-existing DNS/domain config that should simply not be broken.

3. **"Next.js Proxy/Middleware runs in an Edge runtime environment. Database drivers (like
   PostgreSQL TCP connections via Drizzle) often fail or require HTTP/WebSocket adapters
   (e.g. Neon Serverless / Supabase HTTP client)."** (§2, Rank 3) — **WRONG for Next 16.**
   `proxy.md`, "Runtime": *"Proxy defaults to using the Node.js runtime. The `runtime` config
   option is not available in Proxy files."* Version history: *"`v16.0.0` … Proxy defaults to
   the Node.js runtime."* This was true through Next 15.1 and is the doc's clearest sign of
   being written from pre-16 training data. (Proxy is still the wrong tool here — see §3.3 —
   but for entirely different reasons, and the doc gets the reasons wrong.)

4. **"Rank 1: Server Page (`src/app/si/page.tsx`) — RECOMMENDED … Cons: None."** — **WRONG on
   both counts.** There are two real cons, one of which is severe:
   (a) `permanentRedirect()` in a Server Component **silently degrades to `HTTP 200` +
   `<meta http-equiv="refresh">` once the response has started streaming** — measured
   **[probe]**, and documented in `redirect.md`/`permanentRedirect.md` (*"When used in a
   streaming context, this will insert a meta tag to emit the redirect on the client side"*),
   which the Gemini doc does not mention. Google explicitly prefers server-side redirects over
   meta refresh. (b) Page redirects are emitted with `Cache-Control: private, no-cache,
   no-store, max-age=0, must-revalidate` **[probe]**, so every crawler hit is an uncacheable
   function invocation + DB query. Also, "Cons: None" for any engineering choice should be read
   as a signal about the document's calibration generally.

5. **`permanentRedirect()` presented as unconditionally emitting 308** ("Sends HTTP 308
   Permanent Redirect to Google & browsers", §2 Rank 1 code comment; and §1 "Next.js built-in
   functions like `permanentRedirect()` issue an **HTTP 308**") — **IMPRECISE to the point of
   being misleading.** True only outside a streaming context and outside a Server Action.
   `permanentRedirect.md`: *"When used in a server action, it will serve a 303 HTTP redirect
   response… Otherwise, it will serve a 308."* Three possible outcomes, not one.

6. **`redirect('/novica')` as the fallback** (§2, Rank 1 and Rank 2 code) — **WRONG on two
   counts.** (a) **`/novica` does not exist in this repo.** `src/app/novica/` contains only
   `[published_url]/`. The fallback would send every unmatched legacy URL — and Googlebot — to
   a 404. (b) Even if it existed, `redirect()` emits **307 Temporary**, which per Google
   *"doesn't use the redirect as a signal that the redirect target should be canonical"* — the
   opposite of what a permanent migration wants. It should be `permanentRedirect` at minimum,
   and per §4.2 it should be a **410**, not a redirect at all.

7. **`db.query.posts.findFirst({ where: eq(posts.oldId, ...) })` and `article.slug`** (both
   code blocks) — **WRONG for this schema, and not just a naming nit.** There is no `posts`
   table (it's `Article` → `"articles"`), no `oldId` column (it's `legacy_id`), and **no `slug`
   column on the article row at all**. Slugs live in the separate `article_slugs` table with an
   `is_primary` flag (`src/server/db/schema.ts:291-309`), which is the whole rename-redirect
   mechanism described in `CONTEXT.md`. `article?.slug` would be `undefined` for every article,
   so the code as written falls through to the broken `/novica` fallback **100% of the time**.
   The import path `@/db` is also wrong — it's `~/server/db`.

8. **"hosting platforms like Vercel impose limits (e.g., max 1,024 static redirects)"** (§2,
   Rank 4) — **WRONG number.** Vercel documents **2,048**:
   *"| Number of redirects in the array | 2,048 |"*
   (<https://vercel.com/docs/redirects/configuration-redirects>, "Limits"), plus a 4,096-char
   limit on `source`/`destination` and a `bulkRedirectsPath` escape hatch for *"many thousands
   of redirects"*. More importantly, **the stated reason for rejecting `next.config` is the
   wrong reason**: the real disqualifier is that the id→slug mapping is live mutable data, not
   that the list would be long (§3.6).

9. **No `status` handling whatsoever.** Both code blocks would happily 301 a legacy id to the
   slug of a `draft`, `archived`, or `deleted` article, producing a permanent redirect to a URL
   that then 404s. `Article.status` and `is_visible_to` are core to this repo's domain model
   (`CONTEXT.md`, "Article status") and the doc is unaware of them. §4.3.

10. **`parseInt(id, 10)` + `isNaN` as the validation.** `parseInt("623abc", 10) === 623`, so
    `/si/?id=623abc` redirects as though it were a real article. Use `/^\d+$/`. Also no
    `integer` range check, so a large id makes the Postgres driver throw a 500 instead of
    returning 410. §4.2.

11. **"Google Search Advocate John Mueller has repeatedly confirmed that Google Search treats
    308 redirects identically to 301"** (§1) — **true conclusion, unsourceable premise.**
    Citing an advocate's remarks is exactly the hearsay the brief excludes, and it's
    unnecessary: Google's own documentation says it in writing —
    *"The `301` and `308` status codes mean that a page has permanently moved to a new
    location"* (<https://developers.google.com/search/docs/crawling-indexing/301-redirects>).
    Cite the doc.

12. **The closing YouTube link** ("Google SEO Redirects Explained") — **not an authoritative
    source**, and the trailing sentence describing it ("This video provides an overview of
    route parameters, query strings, and handling dynamic navigation in Next.js App Router")
    doesn't even match the link's stated title, suggesting the citation is fabricated or
    mismatched. Discard.

13. **`src/app/si/route.ts` described as "Cons: Replaces the page segment at `/si`"** (§2,
    Rank 2) — **imprecise, and it's the actual recommendation.** It doesn't "replace" a page
    segment; a `route.ts` and a `page.tsx` at the same segment is a **hard build error**
    (*"You cannot have two parallel pages that resolve to the same path"*, measured **[probe]**).
    Since `/si/` is redirect-only, this is not a con at all.

14. **Missing entirely, and load-bearing:** what to do with unknown/non-numeric ids (§4.2);
    what to do with non-`published` articles (§4.3); the `article_slugs` non-primary-slug
    redirect and the chain question (§6.2/§6.3); the existing **soft 404** at
    `/novica/[published_url]` (§6.1); redirect caching (§4.4); `changeFrequency`/`priority`
    being ignored by Google (§7.2); Google's "at least 1 year" redirect-retention guidance
    (§4.5); and the `.vercel.app` duplicate-hostname risk (§9.10).

**What the doc gets right:** 301 and 308 are equivalent for Google (right answer, wrong
citation); a dynamic DB-backed lookup beats static config (right, wrong reason); `metadataBase`
+ `alternates.canonical` are worth doing (§3 item 4 — correct, and its code snippet is the only
one in the document that would work); and a dynamic `sitemap.ts` is needed (§3 item 3 —
correct). Its ranking of the four mechanisms is roughly inverted at the top (page over route
handler) and roughly right at the bottom.

---

## 11. Launch checklists

### Pre-launch

1. **Verify the `legacy_id` data.** `scripts/migrate-legacy-articles.ts` is still pending per
   `docs/architecture.md`. Nothing in §5.1 works until `Article.legacy_id` is populated. Run
   `SELECT count(*) FROM articles WHERE legacy_id IS NOT NULL AND status = 'published'` and
   compare against the old site's article count. **This is the single point of failure.**
2. **Crawl the old site and export every live URL** before switching. Every `/si/?id=<n>` you
   can find must resolve to a 301 with a 200 target. Google's process: *"Create URL mappings"*
   → *"Implement redirects"*
   (<https://developers.google.com/search/docs/crawling-indexing/site-move-with-url-changes>).
   A spot check is not a mapping.
3. **Fix the soft 404** at `/novica/[published_url]` (§6.1). Non-negotiable.
4. **Add the non-primary-slug 301** (§6.2).
5. **Add `metadataBase` + per-page canonicals** (§9.3), and fix `<html lang>` to `sl` (§9.9).
6. **Ship `sitemap.ts` and `robots.ts`**, then fetch both on a preview deployment and read the
   actual XML/text. Confirm no `changefreq`/`priority`, no `.vercel.app` in any `<loc>`.
7. **Test the `.vercel.app` production alias** for `X-Robots-Tag` (§9.10). If absent, add the
   `headers()` rule.
8. **Write the §5.2 route tests**, especially the "`l` is not forwarded" assertion.
9. **Confirm `jknm.si` → `www.jknm.si`** (or whichever is canonical) is intact — this is
   pre-existing config; the risk is breaking it, not building it.
10. **Record the baseline.** Export Search Console Performance (queries, pages, impressions,
    average position) for the 3 months before launch, and the top-100 landing pages from
    analytics. Without a baseline you cannot tell a rewrite regression from seasonality — and
    "we're #1 for our niche" is the thing being protected.

### Post-launch

1. **Submit the new sitemap** in Search Console. *"Submit a fresh sitemap containing new URLs…
   you may initially see warnings about old URLs redirecting — this is expected during
   migration."* Remove the old sitemap once the new one is submitted.
2. **Do NOT use the Change of Address tool** (§11 / §10 item 1). There is nothing to submit.
3. **Watch the Pages report daily for 2 weeks**, specifically: *Soft 404* (should stay at or
   near zero — if it climbs, §6.1 regressed), *Not found (404)*, *Page with redirect*, and
   *Duplicate without user-selected canonical* (would indicate §6.2 or §9.10).
4. **Use URL Inspection on ~10 legacy URLs** and read the actual status chain. Confirm one hop.
5. **Watch redirect volume in Vercel Observability** — the Edge Requests tab shows counts and
   cache status per redirected route and *"You can filter by redirect location"*
   (<https://vercel.com/docs/redirects>). A `/si/` 410 rate that is high relative to 301s means
   the `legacy_id` mapping has holes.
6. **Update internal and external links.** *"After activating redirects, update internal links
   on your new site to point to new URLs based on your mapping."* Chase inbound links from
   Slovenian caving/speleology sites — those are the links carrying the ranking.
7. **Keep the redirects forever.** Google's floor is *"generally at least 1 year"*; there is no
   reason to ever delete a 40-line handler.
8. **Expect a dip and don't panic-revert.** Google documents *"temporary crawl rate
   fluctuations"* around migrations. Compare against the §10 baseline at 2, 6, and 12 weeks.

---

## 12. Open questions for the user

1. **Is `Article.legacy_id` actually populated in production yet?** `docs/architecture.md` calls
   `scripts/migrate-legacy-articles.ts` "the still-pending production data migration". Every
   recommendation in §5.1 is inert until it runs. Related: are there legacy ids whose articles
   were never migrated, and should those 410 or redirect to `/`?
2. **Bare `/si/` → `/` or → newest article?** I recommend `/` (§4.1) for the stable-canonical
   reason, but if `/si/` is a large share of legacy traffic and you'd rather reproduce the old
   UX exactly, say so — the tradeoff is a redirect target that changes on every publish.
3. **Should archived articles redirect for signed-in admins?** §4.3 offers this as an optional
   session-gated branch. Adds a `getServerAuthSession()` call to the legacy path.
4. **`/novica` index page — create it or not?** It doesn't exist. `/arhiv` seems to serve that
   role. If you never intend a `/novica` index, nothing should ever link or redirect there
   (and the Gemini doc's advice must be discarded wholesale, per §10 item 6).
5. **Is `www.jknm.si` definitely the canonical host, and is the apex→www redirect currently
   live?** Everything in §7/§9 hardcodes `https://www.jknm.si`.
6. **Do you want the cosmetic explicit AI-crawler groups in `robots.txt`?** They're no-ops
   (§8.3) and carry a footgun. I've written the file without them.
7. **Is `.vercel.app` alias indexing already a live problem?** Worth a `site:jknm-si.vercel.app`
   check in Google before launch — if those pages are already indexed, §9.10 becomes urgent
   rather than preventative.

---

## Sources

**Next.js 16.2.10, bundled with the installed package** (`node_modules/next/dist/docs/`):

- `01-app/03-api-reference/03-file-conventions/proxy.md` — Proxy rename, Node.js default runtime, execution order, matchers, version history
- `01-app/03-api-reference/03-file-conventions/route.md` — Route Handler methods, `NextRequest`, `RouteContext`
- `01-app/03-api-reference/03-file-conventions/page.md` — `searchParams` as a Promise
- `01-app/03-api-reference/03-file-conventions/02-route-segment-config/runtime.md` — `'nodejs'` is the default
- `01-app/03-api-reference/04-functions/redirect.md` — 307/303, streaming → meta tag
- `01-app/03-api-reference/04-functions/permanentRedirect.md` — 308/303
- `01-app/03-api-reference/04-functions/revalidatePath.md` — parameters; route handlers are invalidatable
- `01-app/03-api-reference/04-functions/generate-metadata.md` — `metadataBase`, `alternates`, `redirect()`/`notFound()` legal in `generateMetadata`
- `01-app/03-api-reference/04-functions/generate-sitemaps.md` — `/…/sitemap/[id].xml`, version history
- `01-app/03-api-reference/03-file-conventions/01-metadata/sitemap.md` — `Sitemap` shape (with the `images`/`videos` omission), image/video/localized examples, cached-by-default note
- `01-app/03-api-reference/03-file-conventions/01-metadata/robots.md` — `Robots` shape, multiple rules
- `01-app/03-api-reference/03-file-conventions/01-metadata/opengraph-image.md` — file conventions, 8MB/5MB limits
- `01-app/03-api-reference/03-file-conventions/01-metadata/app-icons.md` — `favicon`/`icon`/`apple-icon` valid locations
- `01-app/03-api-reference/03-file-conventions/01-metadata/manifest.md`
- `01-app/03-api-reference/05-config/01-next-config-js/redirects.md` — `has`/`missing`, query matching, named-capture interpolation, 307/308 rationale, `statusCode`
- `01-app/03-api-reference/05-config/01-next-config-js/cacheComponents.md` — `use cache`/`cacheTag`/`cacheLife` gated on the flag

**Next.js source** (`node_modules/next/dist/`):

- `lib/metadata/types/metadata-interface.d.ts:545-578` — authoritative `SitemapFile` / `RobotsFile` / `MetadataRoute` types
- `build/validate-app-paths.js` — app-path validation (does *not* contain the page/route conflict check; that surfaced at compile time instead)

**Empirical probes** — throwaway Next 16.2.10 app, `next build --webpack && next start`, `curl -si`:
`page.tsx`+`route.ts` build error; 308/307/301/no-code-307 status codes; streaming
`permanentRedirect` → 200 + `<meta http-equiv="refresh">`; `Cache-Control` on page vs route
redirects; `/product/sitemap/{0,1}.xml` 200 and `/product/sitemap.xml` **404** (no auto index);
sitemap XML with all seven fields; `robots.txt` output ordering; `export const revalidate` in
the build table; `revalidatePath("/sitemap.xml")` busting a cached sitemap.

**Google Search Central:**

- <https://developers.google.com/search/docs/crawling-indexing/301-redirects> — 301/308 permanent, 302/303/307 temporary, canonical signalling, server-side preferred over meta refresh
- <https://developers.google.com/search/docs/crawling-indexing/site-move-with-url-changes> — keep redirects "generally at least 1 year"; 10-hop limit, ≤3 preferred; URL mapping; sitemap submission; "don't redirect many old URLs to one irrelevant single URL destination"
- <https://developers.google.com/search/docs/crawling-indexing/site-move-no-url-changes> — same-domain migration guide; does not involve Change of Address
- <https://support.google.com/webmasters/answer/9370220> — Change of Address: domain-to-domain only; explicitly excludes same-domain page moves, www/non-www, and host/CDN changes
- <https://developers.google.com/search/docs/crawling-indexing/sitemaps/build-sitemap> — 50,000 URLs / 50MB; "Google ignores `<priority>` and `<changefreq>`"; `<lastmod>` used if verifiably accurate; sitemap index optional
- <https://developers.google.com/search/docs/crawling-indexing/sitemaps/news-sitemap> — news publishers, 1,000 tags, last-two-days URLs
- <https://developers.google.com/search/docs/crawling-indexing/http-network-errors> — all 4xx except 429 treated the same
- <https://developers.google.com/search/docs/crawling-indexing/soft-404-errors> and <https://developers.google.com/search/docs/crawling-indexing/javascript/fix-search-javascript#soft-404-errors> — soft 404 definition, crawl-budget cost, the two fixes
- <https://developers.google.com/search/docs/appearance/structured-data/article> — `Article`/`NewsArticle`/`BlogPosting`; no required properties; no markup needed for Top stories; no rich-result guarantee
- <https://developers.google.com/search/docs/crawling-indexing/google-common-crawlers> — `Googlebot`, `Googlebot-Image`, `GoogleOther`, `Google-InspectionTool`, and `Google-Extended` as a control token with no separate user-agent string

**Vercel:**

- <https://vercel.com/docs/redirects> — status-code semantics, 307/308 house recommendation, Observability for redirects, automatic 308 URL normalisation
- <https://vercel.com/docs/redirects/configuration-redirects> — **2,048** redirect limit, 4,096-char source/destination
- <https://vercel.com/docs/project-configuration/vercel-json> — `bulkRedirectsPath` for "many thousands of redirects"
- <https://vercel.com/docs/functions/limitations> — full Node.js coverage; database/TCP connections as file descriptors; durations; cacheable function responses
- <https://vercel.com/docs/deployments/generated-urls> — generated URLs "publicly accessible by default"

**Crawler vendors (first-party):**

- <https://developers.openai.com/api/docs/bots> — `GPTBot`, `OAI-SearchBot`, `ChatGPT-User`, `OAI-AdsBot`
- <https://support.claude.com/en/articles/8896518-does-anthropic-crawl-data-from-the-web-and-how-can-site-owners-block-the-crawler> — `ClaudeBot`, `Claude-User`, `Claude-SearchBot` (and *not* `anthropic-ai`/`Claude-Web`)
- <https://docs.perplexity.ai/guides/bots> — `PerplexityBot`, `Perplexity-User`
- <https://support.apple.com/en-us/119829> — `Applebot`, `Applebot-Extended` as a training opt-out control
- **Bing/Microsoft — NOT VERIFIED.** No first-party page retrievable through the available tooling. `bingbot` is used on faith (and appears in Next's own `robots.md` example); no Copilot-specific token found. Nothing in the recommendation depends on it.

**This repo:** `AGENTS.md`, `CONTEXT.md`, `docs/architecture.md`, `redirect-to-domain-gemini.md`,
`next.config.mjs`, `vercel.json`, `src/env.js`, `src/app/layout.tsx`, `src/app/page.tsx`,
`src/app/novica/[published_url]/page.tsx`, `src/app/api/wake_supabase/route.ts`,
`src/server/db/index.ts`, `src/server/db/schema.ts`, `src/server/article/get-article.ts`,
`src/server/article/article-queries.ts`, `src/server/article/lifecycle-rules.ts`,
`src/server/article/slug.ts`, `src/lib/cache-policy.ts`, `src/server/cache-invalidation.ts`,
`src/components/article/new-adapter.ts`, `src/server/article/sync-algolia.ts`, `public/`.
