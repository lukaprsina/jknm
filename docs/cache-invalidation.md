# Cache invalidation

This document describes the cache vocabulary used by JKNM and the meaning of
the admin cache-management page at `/dev/cache`.

The source of truth for the actual mapping is
[`src/lib/cache-policy.ts`](../src/lib/cache-policy.ts). This document explains
the operational meaning of that mapping; it does not replace the types or
tests.

## Two kinds of target

JKNM has two server-cache target types:

- A **cache tag** identifies cached data, independent of the route that reads
  it. Tags are the precise invalidation mechanism.
- A **cache path** identifies a route, such as `/` or `/sitemap.xml`. Path
  invalidation refreshes cached output associated with that route and may be
  broader than tag invalidation.

`revalidatePath("/")` does not replace invalidating the `homepage-feed` tag.
The homepage route and the homepage's cached data are separate concerns.

## Cache tags

| Tag | Cached concern | Main consumer |
| --- | --- | --- |
| `drafts` | Editable draft articles | Admin draft list and editor surfaces |
| `archive` | Archived articles | `/arhiv` |
| `authors` | Global author data | Author lists and author controls |
| `homepage-feed` | Published articles in the infinite homepage feed | `/` |
| `all-published` | Articles that have been public, including archived rows | `/preveri` |
| `article` | Individual article-by-slug reads, including embedded bylines | `/novica/[published_url]` |

The `article` tag is also invalidated when an author changes. Cached article
reads contain author data, so otherwise a renamed or deleted author could leave
old bylines on article pages.

## Cache paths

| Path | Meaning |
| --- | --- |
| `/` | Refresh the homepage route output. It does not by itself clear the `homepage-feed` data cache. |
| `/sitemap.xml` | Refresh the sitemap after publication, archival, deletion, or slug changes. |

## Normal invalidation

Application mutations emit a `DomainEvent`, such as `article.published` or
`author.renamed`. The cache policy maps that event to tags, paths, and client
query keys. Mutation code does not name cache targets directly.

This keeps the invalidation rules in one place and lets the server cache and
TanStack Query cache have separate adapters without duplicating policy.

The manual page exposes the underlying tags and paths for troubleshooting. It
does not change article data or database state.

## `updateTag` and `revalidateTag`

Next's local documentation defines the distinction as follows:

| | `updateTag` | `revalidateTag` |
| --- | --- | --- |
| Allowed from | Server Actions only | Server Actions and Route Handlers |
| Expiration | Immediately expires the cache | Stale-while-revalidate |
| Typical use | Read-your-own-writes | Background refresh where a short delay is acceptable |

`updateTag` makes the next reader wait for fresh data. That is the desired
behaviour after an admin publishes or edits content: the admin should not see
the old result immediately after the mutation.

`revalidateTag(tag, "max")` allows stale content to be served while fresh data
is generated in the background. It is used by the shared-secret internal Route
Handler because Route Handlers cannot call `updateTag`.

Both functions invalidate by tag. `revalidatePath` is the separate route-path
mechanism.

The authoritative framework explanation is in
[`node_modules/next/dist/docs/01-app/01-getting-started/09-revalidating.md`](../node_modules/next/dist/docs/01-app/01-getting-started/09-revalidating.md).

## Manual page: possible simplification

The current page exposes implementation-level targets. A more user-oriented
version could expose logical surfaces instead:

| Logical surface | Internal targets |
| --- | --- |
| Homepage | `homepage-feed` + `/` |
| Drafts | `drafts` |
| Archive | `archive` |
| Authors and bylines | `authors` + `article` |
| Article pages | `article` |
| Verification | `all-published` |
| Sitemap | `/sitemap.xml` |
| Everything | All tags and paths |

That would reduce incorrect partial selections. The raw tag/path view remains
useful while this is primarily a diagnostic tool.

## Cache Components, briefly

Cache Components is Next's newer caching model, enabled with
`cacheComponents`. It uses the `"use cache"` directive together with
`cacheTag()` and `cacheLife()` instead of the current `unstable_cache` pattern.

The invalidation concepts remain similar: data can still be tagged and tags
can still be expired. JKNM does not enable Cache Components currently; the
reasoning is recorded in
[`docs/adr/0005-stay-on-unstable-cache.md`](adr/0005-stay-on-unstable-cache.md).
