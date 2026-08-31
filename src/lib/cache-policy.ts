/**
 * The single source of truth for what a mutation invalidates.
 *
 * Deciding *what* to invalidate is a pure function returning a value; actually
 * invalidating is left to two thin adapters — `~/server/cache-invalidation`
 * for the Next data/route cache and `~/lib/cache-invalidation-client` for the
 * TanStack Query cache. Neither adapter holds rules, so the two caches cannot
 * drift apart.
 *
 * Mutations emit a `DomainEvent`; they never name tags or paths directly.
 */

/**
 * Every cache tag **declared** at an `unstable_cache` site, regardless of
 * whether anything currently invalidates it.
 *
 * The direction matters: taking this list from the invalidation side is how
 * `homepage-feed` and `all-published` sat dead — declared, at the time, with
 * `revalidate: false`, reachable from no `revalidateTag` call, and therefore
 * serving a permanently frozen homepage feed and `/preveri` view. The
 * reachability test in `cache-policy.test.ts` exists to make that class of bug
 * fail the suite.
 *
 * The loop is closed at both ends, so a new tag cannot go dead by omission.
 * All six cache sites — `app/infinite-server.tsx`, `app/preveri/page.tsx`,
 * `components/draft-articles.tsx`, `components/archived-articles.tsx`,
 * `server/cached-global-state.tsx`, `server/article/get-article.ts` —
 * declare their tags `satisfies CacheTag[]`, so declaring a tag that isn't
 * listed here fails typecheck; adding it here then fails the reachability
 * test until some event actually invalidates it.
 */
export const CACHE_TAGS = [
	"drafts",
	"archive",
	"authors",
	"homepage-feed",
	"all-published",
	"article",
] as const;

export type CacheTag = (typeof CACHE_TAGS)[number];

/**
 * What happened, in the vocabulary of `CONTEXT.md`. One server action can emit
 * one of several events: `create_superseding_draft` emits `article.unarchived`
 * when the source was `archived` (the source row is retired, so the archive
 * listing changes) and `article.superseding_draft_created` when it was
 * `published` (the source stays live and visible, so it does not).
 */
export const DOMAIN_EVENTS = [
	"article.created",
	"article.saved",
	"article.published",
	"article.archived",
	"article.unarchived",
	"article.deleted",
	"article.draft_discarded",
	"article.superseding_draft_created",
	"author.inserted",
	"author.renamed",
	"author.deleted",
	"author.synced",
] as const;

export type DomainEvent = (typeof DOMAIN_EVENTS)[number];

export interface InvalidationDescriptor {
	readonly tags: readonly CacheTag[];
	readonly paths: readonly string[];
	readonly query_keys: readonly (readonly unknown[])[];
}

/**
 * Every article view is reachable from `/`, and every published/archived/
 * deleted change also changes what `/sitemap.xml` should list.
 */
export const CACHE_PATHS = ["/", "/sitemap.xml"] as const;

/** The homepage feed's TanStack Query key (`app/published-feed-query.ts`). */
export const PUBLISHED_FEED_QUERY_KEY = ["infinite_published"] as const;

const HOMEPAGE_FEED_KEYS = [PUBLISHED_FEED_QUERY_KEY] as const;

/**
 * Every tag touched when an article enters or leaves the published set:
 * `drafts` because the draft it was written in is gone, `archive` because a
 * superseded row can land there, the two public listings, and `article`
 * because the change is exactly what `/novica/[slug]` must stop serving
 * stale for — visibility or content changed under that URL.
 */
const PUBLISHED_SET_TAGS = [
	"drafts",
	"archive",
	"homepage-feed",
	"all-published",
	"article",
] as const satisfies readonly CacheTag[];

const DRAFTS_ONLY: InvalidationDescriptor = {
	tags: ["drafts"],
	paths: CACHE_PATHS,
	query_keys: [],
};

const PUBLISHED_SET_CHANGED: InvalidationDescriptor = {
	tags: PUBLISHED_SET_TAGS,
	paths: CACHE_PATHS,
	query_keys: HOMEPAGE_FEED_KEYS,
};

// `article` is included because the cached article-by-slug read embeds each
// article's authors for its byline (`ARTICLE_LIST_RELATIONS` in
// article-queries.ts) — renaming or deleting an author would otherwise leave
// stale bylines on every article page they wrote for, up to the revalidate
// window. `author.inserted` doesn't strictly need it (a brand-new author has
// no existing bylines yet), but one shared descriptor per event class is the
// pattern this file already uses for the published-set events, and the cost
// of over-invalidating is a few extra cache misses.
const AUTHORS_CHANGED: InvalidationDescriptor = {
	tags: ["authors", "article"],
	paths: CACHE_PATHS,
	query_keys: [],
};

/**
 * Exhaustive by construction: adding a `DomainEvent` without declaring its
 * invalidations fails typecheck rather than shipping a stale-cache bug.
 */
const INVALIDATIONS: Record<DomainEvent, InvalidationDescriptor> = {
	"article.created": DRAFTS_ONLY,
	"article.saved": DRAFTS_ONLY,
	"article.published": PUBLISHED_SET_CHANGED,
	"article.archived": PUBLISHED_SET_CHANGED,
	"article.deleted": PUBLISHED_SET_CHANGED,
	"article.draft_discarded": DRAFTS_ONLY,
	"article.superseding_draft_created": DRAFTS_ONLY,
	// The archived source row is retired as the draft is spawned, so both
	// listings that contained it change: `archive`, and `all-published` —
	// `/preveri` verifies everything that was ever public, archived rows
	// included (`find_articles_for_verification`). `homepage-feed` does not
	// change, because an archived article was already hidden from it.
	// `article` does change: the source row going from archived to deleted
	// means /novica/[slug] must stop serving it to admins, the only audience
	// who could see it there.
	"article.unarchived": {
		tags: ["drafts", "archive", "all-published", "article"],
		paths: CACHE_PATHS,
		query_keys: [],
	},
	"author.inserted": AUTHORS_CHANGED,
	"author.renamed": AUTHORS_CHANGED,
	"author.deleted": AUTHORS_CHANGED,
	"author.synced": AUTHORS_CHANGED,
};

export function invalidations_for(event: DomainEvent): InvalidationDescriptor {
	return INVALIDATIONS[event];
}
