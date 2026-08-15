# Algolia vs. Orama for `/arhiv` search

Primary sources: Algolia's own pricing/docs pages (WebFetch, cited by URL — a couple of Algolia's
support-center pages 403'd the fetcher; those are flagged inline as secondhand-but-corroborated,
not primary), the vendored Orama source/docs at `vendor/orama/packages` and
`vendor/orama-docs/content/docs` (cited by repo-relative path), and this repo's actual
`/arhiv` and search-bar implementation (cited by file/line). The first pass of this research
over-weighted a generic assumption about `react-instantsearch` UI cost without checking whether
this codebase actually uses the parts of that library that would make it true. It doesn't. This
revision corrects that after reading the real components.

Scope: this is about the self-hosted `@orama/orama` JS library, not Orama Cloud (the hosted,
Rust-based "OramaCore" product). Cloud has its own account/billing model and isn't a fit for a
700-record single-maintainer site any better than Algolia is — mentioned only to rule it out.

---

## 1. What this site currently spends on Algolia

- [`src/lib/algoliasearch.ts`](../../src/lib/algoliasearch.ts) (`convert_new_article_to_algolia_object`)
  flattens each article to a record: `title`, `article_kind`, `url`, three timestamps,
  `content_preview` (EditorJS blocks flattened to plain text), `year`, `author_ids`,
  `first_author`, `first_author_sort` (a second, sort-only field just to get "Priimek, Ime"
  ordering into a replica's custom-ranking attribute), `has_thumbnail`, `image`.
- [`src/app/arhiv/components.tsx:39-49`](../../src/app/arhiv/components.tsx#L39) defines six
  named sort refinements — `published_at_asc/desc`, `title_asc/desc`, `author_asc/desc` — each
  backed by a `replica()` helper, i.e. **six standard replica indices plus the base index** (7
  total). The task brief mentioned eight replicas; the code shows six — treating this as the
  authoritative number since it's what's actually deployed.
- Client libs: `algoliasearch@^5.55.1`, `instantsearch.js@^4.111.0`, `react-instantsearch@^7.44.0`,
  `react-instantsearch-router-nextjs@^7.44.0`, `@algolia/autocomplete-js` is in `package.json`
  but the live quick-search ([`src/components/shell/searchbar.tsx`](../../src/components/shell/searchbar.tsx))
  actually uses shadcn's `CommandDialog` (cmdk), not `autocomplete-js` — one fewer real
  dependency than the brief assumed.
- Sync is a full diff-and-repair job (`src/server/article/sync-algolia.ts`,
  `sync-algolia-diff.ts`): browse the whole Algolia index, browse the whole `published` set in
  Postgres, diff, then add/update/remove per row. Algolia is a second, independently-mutable copy
  of the data that can drift from Postgres and needs an explicit reconciliation pass.

## 2. Algolia's actual Free-tier limits, and which one this site is closest to

Fetched directly from Algolia's own pages (2026-08-15).

**Records/storage: not the constraint.** `algolia.com/pricing` — Free ("Build") tier: 50K
records, 10K search requests/month, no credit card. At 700 articles × 7 indices (base + 6
replicas) = 4,900 records, that's ~90% headroom. Storage (~7MB reported) against the 1GB/app
Free cap is ~99% headroom. Record size (3.58KB avg) against the documented 10KB/record Free-plan
cap (`algolia.com/doc/guides/sending-and-managing-data/prepare-your-data/in-depth/index-and-records-size-and-usage-limitations/`)
is comfortable.

**Index *count* is the real constraint.** The same limits page states the Free plan caps
**indices per app at 10** (Grow: 50, Premium: 1,000). And per
`algolia.com/doc/guides/managing-results/refine-results/sorting/in-depth/replicas-impact-on-pricing`
(quoted verbatim):

> if your primary has 1,000 records and you create two standard replicas, you end up with 3,000
> Algolia records. total records size = number of records in primary index * (1 + number of
> standard replicas)

> Virtual replicas do not affect record count [...] only changes to the primary index count
> toward your operation costs

Both standard *and* virtual replicas count against the 10-index cap regardless (secondhand via a
403'd support article's search snippet, corroborated across two independent fetches — flagged as
not-fully-primary). This site is on **standard** replicas (`replica()` creates named index
clones; the ~7MB total file size in the brief is only possible if each replica copies the data —
a virtual replica wouldn't add file size). So: **7 of 10 indices already spoken for**, 70% of the
entire index budget, before any staging index or new sort field. That's the actual wall — not
records, not storage, not the 10KB/record cap. It doesn't move by trimming record size; it only
moves by adding replicas or apps.

## 3. What Orama is, from the vendored source

`@orama/orama` v3.2.0 (`vendor/orama/packages/orama/package.json`), Apache-2.0
(`vendor/orama/LICENSE.md`), zero dependencies, "any JS runtime"
(`vendor/orama-docs/content/docs/orama-js/index.mdx`). No Node-native bindings in the package
`exports` map — should load in a Next.js Route Handler on Node or Edge.

**Sorting kills the replica mechanism outright.**
`vendor/orama-docs/content/docs/orama-js/search/sorting.mdx`: `sortBy: { property, order }` is
one argument to one `search()` call against a single index. The word "replica" doesn't appear
anywhere in `vendor/orama-docs/content/docs/orama-js`. Four fields × two directions is eight
argument combinations against the same index, not eight copies of the data — this is what
eliminates the index-count pressure from §2, categorically, not as a bigger-headroom trade.

**Facets and filters are also single-index, same query.**
`vendor/orama-docs/content/docs/orama-js/search/facets.mdx` /
`.../search/filters.mdx`: facets are a `facets` object keyed by schema property (string facets —
author — return `{count, values}`; this site already stores `year` as a string, which maps
cleanly to an `enum` facet with no range config). Filters support OR-across-selected-values on
one field (`where: { author_ids: [...] }`) — exactly the multiselect case. `term` + `where` +
`facets` + `sortBy` all compose in one call.

**Fuzzy search is core, not a plugin.**
`vendor/orama-docs/content/docs/orama-js/search/index.mdx`: `tolerance` (Levenshtein distance) is
a `search()` parameter. Default scorer is BM25.

**Slovenian is fully supported, no caveats.**
`vendor/orama-docs/content/docs/orama-js/supported-languages/index.mdx`: 33 languages built in,
each with tokenizer/stop-words/stemmer. Slovenian has all three, unlike some neighboring
languages on the same table which carry footnotes.

**Persistence at ~700 records.**
`vendor/orama-docs/content/docs/orama-js/plugins/plugin-data-persistence.mdx`: `persist()` /
`restore()` to JSON or binary, in-memory or to disk (`persistToFile`/`restoreFromFile` need
Node's `fs`). No stated record-count ceiling anywhere in the vendored docs — unverified beyond
the structural fact that ~700 short text records (no full article bodies, same
`content_preview`-sized text already generated for Algolia today) is trivially small for any JS
runtime.

**No official Next.js adapter.** `vendor/orama/packages` has `plugin-astro`,
`plugin-docusaurus`(-v3), `plugin-nextra`, `plugin-vitepress` — SSG build-hook plugins — but no
`plugin-nextjs`. The "index it, keep it, query it" glue is something to write, not import.

**No UI kit for the self-hosted library.** `vendor/orama-docs/content/docs/cloud/ui-library/introduction.mdx`:
`@orama/ui` "is designed to work with Orama Cloud projects" and needs an active Cloud
account — it's a Cloud client, React-19-only, not a component library for `@orama/orama`. This
matters far less than it sounds, per §4.

## 4. What this site's UI actually costs to port — checked against the real components, not an assumption

The first pass of this research treated `react-instantsearch`'s UI layer as a cost center on the
assumption this site uses its prebuilt widgets (`InfiniteHits`, `RefinementList`, `SortBy`).
**It doesn't.** Reading `src/app/arhiv/` and the quick-search bar directly:

- **Author facet** — [`src/components/multi-select.tsx`](../../src/components/multi-select.tsx)
  is a fully hand-built shadcn `Command`/`Popover` component. Its only contact with Algolia is
  one call in [`components.tsx:130-134`](../../src/app/arhiv/components.tsx#L130): `useRefinementList({ attribute: "author_ids" })`,
  consumed purely as `{value, count, isRefined}[]`.
- **Year facet** — [`components.tsx:174-211`](../../src/app/arhiv/components.tsx#L174)
  (`TimelineRefinement`) is a custom bar-chart, same input shape.
- **Sort** — `MySortBy` is a plain shadcn `Select` bound to `useSortBy`'s current value + a
  `refine()` callback.
- **Search box** — `MySearchBox2` is a plain `Input` bound to `useSearchBox`.
- **Active filter chips** — hand-built, same pattern.
- **Infinite scroll** — [`src/app/arhiv/infinite-hits.tsx`](../../src/app/arhiv/infinite-hits.tsx)
  uses a custom `useInfiniteAlgoliaArticles` hook, but the pattern is identical to
  [`src/app/infinite-articles.tsx`](../../src/app/infinite-articles.tsx), which already runs the
  homepage feed on plain TanStack `useInfiniteQuery` against Postgres directly — proof this exact
  intersection-observer pagination UI is already done search-engine-agnostically elsewhere in
  this codebase.
- **Quick search (⌘K)** — [`src/components/shell/searchbar.tsx`](../../src/components/shell/searchbar.tsx)
  is shadcn's `CommandDialog` (cmdk) with a `useEffect` that calls Algolia and sets local state.
  Not `@algolia/autocomplete-js` in practice, despite it being a dependency.

What's actually InstantSearch-specific, in the whole `/arhiv` surface: the `InstantSearch`
provider, four hooks (`useRefinementList`/`useSortBy`/`useSearchBox`/`useStats`), the
`algoliasearch/lite` client, and the routing glue in
[`src/app/arhiv/search.tsx`](../../src/app/arhiv/search.tsx) — which is arguably the *worst* part
of the current setup, not an asset worth preserving: a custom `historyRouter`, a patched
`stateMapping`, and a `without_page` hack purely to stop InstantSearch's router from polluting the
URL with scroll position. Replacing that with locally-owned `useState` + URL sync is less code
than what's there now, because it removes a fight with someone else's router instead of adding
one.

**Conclusion: the UI is not the migration cost.** It's already decoupled into shadcn primitives
that take plain data (`{value, count, isRefined}[]`, a query string, a sort key) — swapping the
five or six lines per component that call InstantSearch hooks for local state + a fetch to a
self-hosted Orama route is a small, mechanical change per component, not a UI rebuild.

## 5. What actually needs building

- **A Route Handler** (`term`/`where`/`facets`/`sortBy` → one `search()` call against one Orama
  index) serving both `/arhiv` and the ⌘K quick search.
- **Index build/sync**, replacing `sync-algolia.ts`'s diff job with something structurally
  simpler because there's no second mutable copy to reconcile:
  - *(a) Build once, persist, restore per request* — a server action off the
    publish/archive/unarchive/delete lifecycle (same trigger points as
    `apply_server_invalidations`) rebuilds the index from Postgres via
    `create()`/`insertMultiple()`, then `persist()`s a JSON/binary snapshot (Vercel Blob or
    Supabase Storage). Each request/cold-start `restore()`s it.
  - *(b) Rebuild from Postgres on cold start, no persistence layer.* At ~700 small records this
    is plausibly fast enough to do inline before serving the first search on a cold instance,
    reusing the warm in-memory instance after that. Simpler (no blob storage, no persistence
    plugin) but re-pays the Postgres read on every cold start instead of once at publish time.
  - *(c) One long-running process holding the index in RAM forever* — only available off Vercel
    (§6). No restore cost at all, ever; the index is updated in place on the same
    publish/archive/unarchive/delete triggers.
- **Local state + URL sync** to replace the InstantSearch provider/routing (§4) — net simplification,
  not new complexity, given what it replaces.
- **Ranking**: Algolia's `first_author_sort` field exists only to feed a replica's custom-ranking
  attribute for author sort. Orama's `sortBy` covers this directly (sort by a string field); no
  custom-ranking-tuning logic beyond BM25 defaults was found to exist here in the first place, so
  nothing else carries over or needs replacing.

## 6. Vercel vs. a VPS

On Vercel: not a real concern at this scale. ~7MB parsed into an in-memory Orama index
(`insertMultiple` or `restore()`) is single-digit milliseconds; a warm Vercel function instance
serves subsequent requests from the same in-memory index, so that cost is paid once per cold
start, not per request. 700 short text records is far below where serverless memory limits would
start to matter.

A VPS removes the question entirely rather than just making it cheap: one long-running Node
process holds the Orama index in memory permanently, updated in place on the same
publish/archive/unarchive/delete triggers, no restore/rebuild step ever. Given the club has spare
funds and no fixed use for them, this is a reasonable, low-risk place to spend a little — cheap
and boring to run for a single-maintainer site, and it also removes the last sliver of
uncertainty in §3 (no vendored Orama docs address Vercel/serverless deployment directly — a VPS
sidesteps that gap instead of resolving it). It's not a reason to move the *whole app* off Vercel
by itself — that's a separate, bigger decision — but if a VPS exists for other reasons (or gets
stood up anyway), hosting the search index/query endpoint there is a clean, low-effort fit.

---

## 7. So what?

**Ideologically, yes — Orama is the better fit here, and it isn't close.** The deciding facts:

- **The 10-index Free-tier ceiling is a real, structural risk, and Orama removes the mechanism
  causing it, not just the symptom.** Sorting is a query-time argument in Orama; there's no
  replica concept to run out of. This site is already at 7/10 indices before any growth.
- **The UI migration cost that made this look expensive was based on a wrong assumption.**
  This codebase's `/arhiv` and quick-search UI are already hand-built shadcn components consuming
  plain data through thin InstantSearch hooks — not `react-instantsearch`'s prebuilt widgets.
  Porting them to a self-hosted Orama backend is a small, mechanical, per-component change, not a
  UI rebuild. The routing/state-mapping glue InstantSearch currently requires
  ([`search.tsx`](../../src/app/arhiv/search.tsx)) is arguably worse than what replaces it.
- **The sync pipeline gets simpler either way** — no more diff-and-repair against a second
  mutable copy of the data; either a snapshot-persist step or a rebuild-on-cold-start, both
  structurally simpler than reconciling two independently-mutable systems.
- **Vercel isn't a blocker** at 700 records; a VPS (funded by the club's spare cave-cleanup money)
  removes even the small cold-start question entirely and is a reasonable, low-stakes place to
  spend that money if the club wants to.

**Recommendation:** do the migration. The engineering shape is: one Route Handler, one
index-build hook off the existing publish/archive/unarchive/delete lifecycle, and a handful of
mechanical per-component swaps from InstantSearch hooks to local state — smaller than the
diff-and-repair sync job and InstantSearch routing glue it replaces. The only genuinely open
question is deployment shape (persist-and-restore on Vercel vs. a VPS holding the index in RAM
permanently) — either is fine at this scale; a VPS is the more defensively simple of the two if
the club is willing to spend on it.
