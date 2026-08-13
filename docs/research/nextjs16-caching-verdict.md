# Verdict: should this repo migrate `unstable_cache` → Cache Components?

Answers "is it worth it" for migrating off `unstable_cache`.

Sources: bundled docs for the installed `next@16.2.10`
(`node_modules/next/dist/docs/`, cited `file:line`), Vercel's own documentation
(cited by URL), and this repo's source. No blog posts, no secondary write-ups.

**Verdict: Option B — stay on `unstable_cache`.** Full reasoning in §7.

---

## 1. Persistence on Vercel — the crux. The prior doc is CORRECT.

The prior research claimed `use cache` is in-memory by default and that this is a
regression versus `unstable_cache`, which persists across deployments and
instances. **This holds up on Vercel specifically.** Both first-party sources agree,
and Vercel does *not* silently upgrade `use cache` to durable storage.

Next's own reference, `use-cache.md` "Runtime caching considerations"
(`node_modules/next/dist/docs/01-app/03-api-reference/01-directives/use-cache.md:198-209`):

| Environment | Runtime Caching Behavior |
| --- | --- |
| **Serverless** | Cache entries typically don't persist across requests (each request can be a different instance), or during revalidation. Build-time caching works normally. |
| **Self-hosted** | Cache entries persist across requests. |

And `use-cache-remote.md:96`: *"`use cache` stores entries in-memory. In serverless
environments, memory is not shared between instances and is typically destroyed
after serving a request, leading to frequent cache misses for runtime caching."*

Vercel's documentation says the same thing about its own platform, in its own
words — <https://vercel.com/docs/caching/runtime-cache>, "Next.js 16 and above":

> **Note:** `use cache` is in-memory by default. This means that it is ephemeral,
> and disappears when the instance that served the request is shut down.
> `use cache: remote` is a declarative way telling the system to store the cached
> output in a remote cache such [as] Vercel runtime cache.

The same page's version matrix is explicit that on Vercel, the durable path for
Next 16 runtime caching is `use cache: remote` (backed by Vercel Runtime Cache), and
that `unstable_cache` is the durable path on Next 15 (backed by Vercel Data Cache).
So the two are **not** at parity out of the box: today's `unstable_cache` calls are
durable on Vercel; a naive `use cache` port would not be.

Two important qualifications that sharpen — but do not overturn — the prior doc:

1. **The fix is one token, not a rewrite.** `'use cache: remote'` instead of
   `'use cache'`, and Vercel supplies the handler automatically
   (`use-cache-remote.md:50`: *"The handler implementation is configured via
   `cacheHandlers`, though hosting providers should typically provide this
   automatically"*). Vercel Runtime Cache is documented as **"Persistent across
   deployments"** (<https://vercel.com/docs/caching/runtime-cache>, "How runtime
   cache works") — actually *stronger* than Next's own generic warning at
   `migrating-to-cache-components.md:280` that "even with durable storage, expect
   cached values to recompute after a new deployment."
2. **It is metered.** Runtime Cache is billed usage with a per-project LRU storage
   cap, a 2 MB item-size limit, and a documented "Latency impact: cache handler
   lookup" (`use-cache-remote.md:82-90`; Vercel "Limits and usage"). The homepage
   feed page of 31 articles with joined authors and thumbnails is unlikely to
   exceed 2 MB, but it is a new limit that `unstable_cache` did not impose.

**Net:** migrating correctly means adopting `use cache: remote` (paid, network hop)
just to get back to where `unstable_cache` already is for free. That is the single
most decision-relevant fact and it argues against migrating.

## 2. Deprecation risk on `unstable_cache`: low, and nothing is committed in writing

- The header note is *"This API has been replaced by `use cache` in Next.js 16.
  We recommend opting into Cache Components…"*
  (`.../04-functions/unstable_cache.md:6-8`). It is a recommendation, not a
  deprecation warning.
- The **Version History table at the bottom of that same page has exactly one row**:
  `v14.0.0 — unstable_cache introduced`. No deprecation row, no removal row, no
  target version. Compare `revalidateTag.md:54`, where Next *does* commit
  deprecations in writing: *"The single-argument form `revalidateTag(tag)` is
  deprecated… this behavior may be removed in a future version."* Nothing
  equivalent exists for `unstable_cache`.
- No runtime deprecation warning is emitted (checked
  `node_modules/next/dist/server/web/spec-extension/unstable-cache.js`).
- The "previous model" guide is still shipped and current:
  `01-app/02-guides/caching-without-cache-components.md`, titled *"Caching and
  Revalidating (Previous Model)"*, opening *"This guide assumes you are **not**
  using Cache Components."* Next maintains a full parallel documentation track for
  the non-Cache-Components model. That is a strong signal of a multi-major support
  horizon, not an imminent removal.
- Vercel's platform docs likewise still document `unstable_cache` as a supported
  path (<https://vercel.com/docs/caching/runtime-cache>).

**Net:** there is no forcing function. Nothing says v17 removes it. This is not a
deadline-driven migration.

## 3. Lock-in — adopting Cache Components directly contradicts ADR-0002

ADR-0002 rejects Server Actions as the strategic transport with the reasoning:
*"the whole surface is Next-locked in a repo whose stated destination is TanStack
Start"*, and its `docs/adr/0002-orpc-not-server-actions.md:64-66` lists
**"Next Server Actions + Cache Components as the strategic choice"** as an
explicitly *rejected* option. ADR-0001 accepts Next-specific investment as
"potentially throwaway" and points at ADR-0002 as "which deliberately minimizes
that throwaway."

Cache Components is maximally Next-locked, by construction:

- `cacheComponents: true` is a `next.config` flag with no analogue elsewhere.
- `'use cache'` / `'use cache: remote'` / `'use cache: private'` are **compiler
  directives** processed by the Next build, not library calls.
- `cacheTag`/`cacheLife`/`revalidateTag`/`updateTag` all import from `next/cache`.
- Enabling it turns on **PPR site-wide** (`cacheComponents.md:30`: *"`cacheComponents`
  implements Partial Prerendering (PPR) as the default behavior in the App Router"*)
  and changes navigation semantics by keeping routes mounted via React `<Activity>`
  in `"hidden"` mode (`migrating-to-cache-components.md:715-721`). The
  `<Suspense>` boundaries and component splits you add to satisfy it are structural
  changes to the component tree, made for a Next-only render model.

If the ADR-0001 TanStack Start rewrite happens, the directives and `next/cache`
imports are **100% throwaway**; the `<Suspense>` restructuring is partially
salvageable (Suspense is React, not Next), but it was undertaken for a reason that
no longer exists.

Adopting Cache Components now would mean writing an ADR that reverses ADR-0002's
stated rationale on the same question, three weeks after ADR-0002 was corrected.
That is not fatal — ADRs can be superseded — but it should be named, and the
benefit would have to be large. Per §1 and §5, it is not.

## 4. Cost of adoption — concrete counts against this repo

Better news than the prior doc feared on two of the three flagged risks, worse on
one.

**Not a problem (verified by grep across `src/`):**

- **`generateStaticParams` returning `[]` → build error**
  (`migrating-to-cache-components.md:420-455`): **zero occurrences of
  `generateStaticParams` anywhere in the repo.** Non-issue.
- **`runtime = 'edge'` unsupported** (`migrating-to-cache-components.md:673-675`):
  **zero occurrences.** Non-issue.
- **`export const revalidate`**: zero occurrences. Nothing to port.

**The actual problem — one shared component, ten routes.** Under
`cacheComponents`, any unwrapped runtime-data read is a `blocking-route` build
error (`01-getting-started/08-caching.md:292`;
`migrating-to-cache-components.md:458-554`). Cached scopes also *cannot* call
`cookies()`/`headers()` (`use-cache.md:194-196`), which `getServerAuthSession()`
does internally (NextAuth v4 `getServerSession`, `src/server/auth.ts:108`).

Unwrapped `await getServerAuthSession()` in the render path:

| # | File | Notes |
|---|---|---|
| 1 | `src/components/shell/index.tsx:28` | **`Shell`, the app frame.** Rendered by 10 route files — see below. Fixing this one component fixes most of the blast radius. |
| 2 | `src/app/page.tsx:19` | homepage, in a `Promise.all` alongside `prefetchInfiniteQuery`; the session gates the whole tree (admin vs public branch), so it can't just be pushed into a leaf |
| 3 | `src/app/arhiv/page.tsx:10` | already `export const dynamic = "force-dynamic"` |
| 4 | `src/app/avtorji/page.tsx:16` | |
| 5 | `src/app/novica/[published_url]/page.tsx:33` | inside `generateMetadata` |
| 6 | `src/app/novica/[published_url]/page.tsx:54` | the article page itself — the only route where ISR would actually pay |
| 7 | `src/app/prijava/page.tsx:8` | |
| 8 | `src/app/uredi/[draft_id]/page.tsx:40` | admin editor, always dynamic — fine to leave uncached, still needs a boundary |
| 9 | `src/app/uredi/[draft_id]/page.tsx:70` | |

`<Shell>` render sites (all inherit #1):
`(static)/layout.tsx`, `arhiv/page.tsx`, `avtorji/page.tsx`, `kontakt/page.tsx`,
`not-found.tsx`, `novica/[published_url]/page.tsx`, `page.tsx`, `preveri/page.tsx`,
`prijava/page.tsx`, `uredi/[draft_id]/page.tsx`.

Also: `src/app/layout.tsx:31` awaits `cachedAllAuthors()` unwrapped in the **root
layout** — that one is benign under Cache Components (it becomes a `use cache`
function and stays in the static shell), but it means the root layout is on the
critical path for every route.

Auth reads in Server Actions (`authorized-mutation.ts:15`, `author/*.ts`,
`api/media/route.ts:93`) are **not** affected — the constraint is about render, not
actions.

**Honest sizing:** ~9 call sites across 8 files, dominated by one shared component.
This is a day or two of careful work, not a week — the prior doc's "site-wide
rework" framing was somewhat overstated. But it touches every route in the app, in
a codebase with no automated route-level tests, maintained by one person. The risk
is not the line count; it's that a `blocking-route` regression can only be caught
by building and clicking through every page.

## 5. Option C — is app-level caching even needed here?

**Today the app has no ISR at all.** No `export const revalidate` anywhere; no
`generateStaticParams`; `arhiv/page.tsx` and `api/wake_supabase/route.ts` are
explicitly `force-dynamic`; and critically, **`Shell` reads the session, so every
route that renders it is dynamic anyway.** Nothing in this app is currently served
from Vercel's ISR cache. The entire caching story is the five `unstable_cache`
entries.

That means `revalidatePath("/")` — fired at **16 call sites** across
`src/server/article/lifecycle.ts`, `new-article.ts`, and `src/server/author/*` —
is doing very little. Per `revalidatePath.md:16-30` it invalidates page/layout
route-cache entries and fetch Data Cache entries for that path. There are no ISR
entries for `/` to invalidate, and it does **not** reach `unstable_cache` entries,
which are keyed by function identity + `keyParts`, not by path. Its only real
effect is the documented client-side side effect: *"Updates the UI immediately (if
viewing the affected path). Currently, it also causes all previously visited pages
to refresh when navigated to again"* (`revalidatePath.md:16`).

**Which exposes a live bug that matters more than the API choice.** There are
**five** tags in the repo, not three:

| Tag | Defined | `revalidate` | Ever invalidated? |
|---|---|---|---|
| `homepage-feed` | `src/app/infinite-server.tsx:12-13` | `false` | **NO** |
| `all-published` | `src/app/preveri/page.tsx:13-14` | `false` | **NO** |
| `drafts` | `src/components/draft-articles.tsx:18-19` | `false` | yes (7 sites) |
| `archive` | `src/components/archived-articles.tsx:26-27` | `false` | yes (4 sites) |
| `authors` | `src/server/cached-global-state.tsx:7-8` | `false` | yes (4 sites) |

`revalidateTag("homepage-feed", …)` and `revalidateTag("all-published", …)` appear
**nowhere in the repo**. Combined with `revalidate: false` (cache forever), that
means **publishing an article never updates the homepage feed** on Vercel — the
entry is durable in the Data Cache and survives until the next deployment happens
to change the cache key. The `/preveri` admin verification tool has the same
defect. Every mutation site fires `revalidatePath("/")` instead, which as
established does not touch these entries.

**Could you delete app-level caching entirely?** No — keep it. `cachedAllAuthors`
runs in the **root layout**, i.e. on literally every request, and Supabase's free
tier pauses on inactivity with connection caps (ADR-0004 cites exactly these as
reasons to leave it). The cache is protecting a fragile DB from a query on every
page view. Deleting it is the wrong direction.

**Correction (post #31 step 3): this paragraph was wrong.** `/novica/[published_url]` — 700
article pages, publicly readable, rarely changing, the site's whole SEO surface — looked like
the genuinely valuable Option-C move: static/ISR-cache it at the CDN via a plain
`export const revalidate`, no Cache Components required, once `Shell`'s session read was
Suspense-wrapped.

That premise doesn't hold on Next 16. A `<Suspense>` boundary only partitions a route into a
static shell plus a dynamic hole **under Partial Prerendering**, and PPR has no standalone flag
in Next 16 — it ships only as part of `cacheComponents` (`cacheComponents.md`: *"cacheComponents
implements Partial Prerendering (PPR) as the default behavior… the `experimental.ppr`
configuration flag and the `experimental_ppr` route segment configuration are no longer
necessary and have been removed"*). Without it, `headers()` opts the whole route into dynamic
rendering regardless of Suspense (`headers.md:48`). Measured after doing the extraction: all 18
routes report `ƒ (Dynamic)`; stubbing the session read out entirely flips only the routes that
don't read it elsewhere.

`/novica/[published_url]` reads the session a second time anyway, directly in the page, for its
`is_visible_to` gate — admins see archived articles at the public URL, visitors don't. That's a
second, independent blocker: even with PPR available, serving the route from one shared static
cache is incompatible with that gate, short of dropping it.

The Suspense extraction still shipped (§7 item 4, first half) — it's real, portable-React value,
just not sufficient for ISR by itself. **Reaching ISR now would need reversing this doc's own
§7 verdict** (enable `cacheComponents`) **or removing the admin gate**, and neither is worth it
against `CONTEXT.md`'s "public traffic is small." See `docs/architecture.md`'s Caching section
for the decision and the measurement.

## 6. Timing — does the VPS move flip the calculus?

Partly, and in the direction of waiting.

- On the VPS (ADR-0004: single Hetzner box, Kamal, `standalone` output, one app
  container), plain `use cache` in-memory becomes *good enough* by Next's own
  table: *"Self-hosted: cache entries persist across requests"*
  (`use-cache.md:207`). Single instance ⇒ no cross-instance coordination problem
  (`deploying-to-platforms.md:51`), no Runtime Cache bill, no network hop. The §1
  objection largely evaporates.
- ADR-0004 is explicit that the move is **deferred** and "no code or environment
  changes happen now." So this is not a reason to act — it is a reason to *not*
  act, because the environment that makes Cache Components attractive does not
  exist yet.
- **Cost of deferring: near zero.** No removal deadline (§2), no forcing function,
  and per ADR-0002 the read-path and invalidation refactor is already scheduled to
  land *together* with the oRPC work, gated behind better-auth (#6). Migrating
  caching now means touching those same call sites twice — the exact
  double-payment ADR-0002 was written to avoid.

## 7. Recommendation

### **Option B — stay on `unstable_cache`.**

Not "stay and do nothing." Stay, and fix the things that are actually broken:

1. **Add the two missing invalidations.** `revalidateTag("homepage-feed", "max")`
   wherever articles are published/unpublished/archived/deleted, and
   `revalidateTag("all-published", "max")` alongside. This is the highest-value
   change in this entire document and it takes minutes. Today, publishing an
   article does not update the homepage.
2. **Reconsider `revalidate: false` on all five entries.** Belt-and-braces: a
   finite `revalidate` bounds the damage from any future missing tag.
3. **Keep `src/lib/revive-cache-dates.ts`.** It is the correct workaround for
   `unstable_cache`'s `JSON.stringify` round-trip
   (`node_modules/next/dist/server/web/spec-extension/unstable-cache.js:23`), it is
   already written, and it is ~20 lines.
4. **Suspense-wrap the session read in `Shell`.** Done in #31 step 3. Still worth
   doing on its own portable-React merits — it removed a `Session` object from
   two client components and cut the shell's session query in half via
   `React.cache`. **It does not unlock ISR on `/novica/[published_url]`, and
   nothing short of it does either without reversing this doc's own verdict**;
   see the correction above §6. Superseded: do not plan further work against
   the original claim.
5. **Revisit at the VPS move**, with the caching/oRPC/better-auth work, as ADR-0002
   already sequences.

**Why not A:** on Vercel today, a correct migration requires `use cache: remote`
(metered, network hop) merely to match the durability `unstable_cache` already has
for free (§1); there is no deprecation deadline forcing the timing (§2); it
directly contradicts ADR-0002's own recorded rejection of Cache Components on
portability grounds, with a TanStack Start rewrite still live (§3); it costs a
site-wide `<Suspense>` pass touching all 10 routes in an untested codebase (§4);
and it fixes none of the defects that are actually hurting the site (§5) — those
are two missing `revalidateTag` calls.

**Why not C:** deleting app-level caching would put `cachedAllAuthors` back on
every request against a pause-prone Supabase free tier. C's *good* half — lean
on ISR/CDN — turned out to be blocked regardless of cache API (see the correction
above §6); the DB-protection motivation behind it is instead covered by caching
`get_new_article_by_slug` under the same `unstable_cache` regime as everything
else (`article` tag, `docs/architecture.md`).

**What would change this answer:**

- **→ A** if the Hetzner/Kamal VPS move (ADR-0004) is actually executed. Single
  persistent Node instance makes plain `use cache` durable for free
  (`use-cache.md:207`) and deletes the §1 objection entirely. Do it as part of that
  migration, not before.
- **→ A** if the TanStack Start rewrite (ADR-0001) is **formally abandoned**. That
  kills the §3 lock-in objection, and ADR-0002 already says it should be revisited
  in that event.
- **→ A** if Next ships a Version-History deprecation row or a removal target for
  `unstable_cache` — i.e. an actual written commitment rather than a "we recommend"
  note (§2). Recheck `.../04-functions/unstable_cache.md` on each major upgrade.
- **→ A** if `cacheComponents: true` becomes the default in a future major. Nothing
  in the 16.2.10 docs states this, but it would make the Suspense work mandatory
  regardless, at which point adopting the directives is free.
- **→ A (partially)** if a `Map`/`Set`/`Buffer`-valued column enters any cached
  query. `revive-cache-dates.ts` only handles `Date`; the underlying
  `JSON.stringify` limitation would resurface, and the structural fix is `use cache`
  (Flight serialization handles non-JSON-safe values natively).
- **Nothing about traffic growth changes this**, and item 4 is no longer the
  traffic-relief lever it was written as — see the correction above §6. Traffic
  growth would instead argue for revisiting the `cacheComponents` question itself.
