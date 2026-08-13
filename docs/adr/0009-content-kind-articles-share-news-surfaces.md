# Content-kind articles share the news Algolia index and query surfaces, not a parallel set

**Status: decided, in effect now.** Part of map [#33](https://github.com/lukaprsina/jknm/issues/33)
(migrated the 5 static pages into the `articles` table as `article_kind: "content"` rows), following
the call-site audit in [#34](https://github.com/lukaprsina/jknm/issues/34). This is the durable
record of the design reasoning and the final shape.

Every surface that currently assumes "published article = news" needed a decision on how a
`content`-kind row should be treated once these 5 pages start publishing through it. They split
into two different shapes of change, not one uniform rule.

## The two shapes

**EXCLUDE outright** — the surface is a literal, single-purpose news listing with no filtering
mechanism available at render time:

- `src/app/sitemap.ts` — emits one `/novica/<slug>` URL per published row; a content-kind row
  would duplicate the fixed-route entry already in `STATIC_ROUTES`.
- `find_published_articles_page` (homepage infinite feed) — a reverse-chronological "latest news"
  stream; a content page has no natural position in it.
- `find_articles_for_verification` (`/preveri`) — mirrors the legacy CMS's `published_article`
  table 1:1; content-kind rows have no legacy counterpart to reconcile against.

These are direct Postgres queries with no downstream filter UI. The only place to exclude
content-kind rows is the `where` clause itself: `ne(Article.article_kind, "content")`.

**INCLUDE, with kind-aware handling** — the surface already renders content-kind rows (by design,
per the `/novica/<slug>` canonical-resolution decision on #33) but needs to behave differently for
them:

- `/novica/[published_url]`'s `generateMetadata` and `build_article_json_ld` — canonical URL and
  JSON-LD `url` must point at the row's **fixed route** (e.g. `/zgodovina`), not
  `/novica/<slug>`, or the two URLs become duplicate-content in search engines' eyes.
- `EditorToReact`'s `<ArticleDescription>` (byline, published-date-as-news-event) — suppressed for
  content-kind rows, since a caving-club history page isn't authored-and-dated the way a news post
  is.

These aren't listing queries; they're per-row rendering decisions, so the fix is a branch on
`article_kind`, not a `where` clause.

## Algolia: one index with a facet, not a second index

The audit flagged this as the one genuinely open question (§9): keep `scripts/static_to_algolia.ts`
and its separate `static_pages` index, or fold content-kind rows into
`ALGOLIA_PUBLISHED_ARTICLE_INDEX` alongside news.

### Considered options

- **Keep two indices** (`static_pages` for content, `ALGOLIA_PUBLISHED_ARTICLE_INDEX` for news),
  either file-backed (as today, effectively dead code — the glob pattern doesn't match any
  existing file) or rewritten to be DB-backed. Rejected: doubles the sync surface for no ranking
  benefit, and raised the question of whether the 5 content rows would need their own copy of the
  8 sort replicas `/arhiv` uses (`published_article_{created_at,title,author,updated_at}_{asc,desc}`).
- **One shared index, `article_kind` as a filterable facet.** Chosen.

### Why one index is correct, not just cheaper

An Algolia index is the unit that needs its own ranking config and record shape — you split into a
second index when those genuinely diverge, not merely because two subtypes exist.
`convert_new_article_to_algolia_object`'s output already works unmodified for a content page:
`author_ids: []` for an authorless page is a legitimate empty state, not a schema mismatch. Faceting
one field to distinguish subtypes within a single collection is Algolia's own recommended pattern
for exactly this situation.

The 8 existing `/arhiv` sort replicas do not need duplicating, because a replica mirrors 100% of
its primary's records — it cannot hold a different subset. Content-kind rows never need those sort
orders (they're reached via fixed nav links and quick search, never via `/arhiv`'s sortable table),
so the fix is a **static filter**, not a parallel replica set: `arhiv/search.tsx` gains
`filters: "article_kind:article"`, keeping the 8 replicas' behavior byte-for-byte identical to
today while excluding content rows from them.

`searchbar.tsx`'s two labeled result groups ("Vsebina" / "Novice") don't require two indices
either — they become two `facetFilters`-scoped queries against the same index
(`article_kind:content` / `article_kind:article`) instead of one query per index.

### What ships

- `convert_new_article_to_algolia_object` gains an `article_kind` field.
- `sync-algolia.ts`'s `fetch_db_published_articles` pushes **all** published rows, both kinds —
  no exclude filter, unlike the three Postgres-only surfaces above. This is deliberately the
  opposite of what the #34 audit sketched for this file, because that sketch assumed a second
  index; faceting removes the need for the exclude.
- `article_kind` is declared as a filterable attribute (`attributesForFaceting`) on the index —
  a one-time manual step in the Algolia dashboard (no settings-as-code exists in this repo to
  script it).
- `arhiv/search.tsx` adds `filters: "article_kind:article"`.
- `searchbar.tsx`'s two requests both target `ALGOLIA_PUBLISHED_ARTICLE_INDEX`, scoped by
  `facetFilters`.
- `scripts/static_to_algolia.ts` and the `static_pages` index are **deleted outright**, not kept
  as a fallback — matching #33's own hard-cutover stance on the rest of the old split system.

## Consequences

- If the index has any `customRanking` (e.g. a recency tie-breaker), it now also applies to the 5
  content rows when "Vsebina" is queried. Low-risk: custom ranking is Algolia's last tie-breaker
  after text-relevance signals, and 5 near-always-present items rarely collide on relevance in the
  first place. Not fixed proactively — noted here so a future reader who spots odd Vsebina ordering
  knows where to look first.
- Any code that queries `ALGOLIA_PUBLISHED_ARTICLE_INDEX` without a `facetFilters`/`filters` scope
  will now see content-kind rows mixed in with news. `/arhiv` and `searchbar.tsx` are the only two
  read paths today and both are scoped as part of this decision; a new read path added later must
  remember to scope itself too — there is no index-level enforcement of the split.

## What would change the answer

- **Content-kind rows growing far beyond 5**, or needing their own sort/ranking behavior (e.g. a
  browsable, sortable content-pages archive analogous to `/arhiv`) — at that point the "no
  replicas needed" argument above no longer holds, and a second index starts looking cheaper than
  bolting more replicas onto the shared one.
- **A ranking requirement for content pages that conflicts with news' `customRanking`** — the one
  scenario where faceting genuinely can't reconcile two subtypes within one index.
