# Replacing InstantSearch's router with nuqs on `/arhiv`

Primary sources: this repo's actual `/arhiv` implementation (cited by file/line), `nuqs`'s
installed version and manifest (`package.json:118`, `bun.lock:104,1862` — `nuqs@2.9.5`, exact,
not assumed), `react-instantsearch`/`instantsearch.js`'s actual shipped type declarations under
`node_modules` (cited by repo-relative path — confirms `routing` is optional at the type level,
not inferred from docs prose), and nuqs's official docs at `nuqs.dev` (cited by URL, fetched
2026-08-16). Prior related research at
[`docs/research/algolia-vs-orama-search.md`](./algolia-vs-orama-search.md) already flagged this
routing glue as the worst part of the current setup, in the context of a deferred, separate
Algolia→Orama backend migration ("after v1"). **This research is independent of that decision**:
it assumes the Algolia backend and `useSearchBox`/`useSortBy`/`useRefinementList`/`useStats`
hooks stay exactly as they are, and asks only who should own reading/writing the URL.

---

## 1. What's actually there today

- [`src/app/arhiv/search.tsx`](../../src/app/arhiv/search.tsx) is the `<InstantSearch>` root. It
  passes `routing={{ router, stateMapping }}` (line 167), where:
  - `router` (lines 87–101) is a patched `historyRouter` whose `createURL` re-reads the current
    `view` param out of `location.search` and splices it back into whatever URL InstantSearch's
    own router would otherwise produce — purely because InstantSearch's default router rebuilds
    the *entire* query string from its own route state on every write, which would silently drop
    `view` (a param InstantSearch knows nothing about) on the next debounced write.
  - `stateMapping` (lines 123–130) wraps `simpleStateMapping()` with a `without_page` filter
    (lines 110–121) that strips `page` out of both `stateToRoute` and `routeToState`, because
    `page` is infinite-scroll position, not a link-worthy param, and leaving it in produced
    `?published_article_..._page%5D=3`-style URLs plus wrong-page restores on tab switch.
  - `ResetPageOnTabChange` (lines 138–146) calls `setIndexUiState` to clear `page` from
    InstantSearch's *internal* ui-state (not the URL) whenever the card/table tab changes, since
    both tabs share one underlying widget/index and would otherwise inherit each other's scroll
    position.
  - `future={{ preserveSharedStateOnUnmount: true }}` (line 164) — an InstantSearch-router-era
    flag for keeping widget state alive across mount/unmount within the `routing`-managed
    lifecycle.
  - `Search()` (lines 148–191) *also* independently reads/writes `view` via
    `useShallowSearchParams()` (line 149, `write()` at line 157) — i.e. today there are **two**
    writers touching the URL (InstantSearch's router for query/sortBy/refinements, and the
    shallow-params hook for `view`), and the entire `createURL` patch exists solely to keep those
    two writers from clobbering each other.
- [`src/hooks/use-shallow-search-params.ts`](../../src/hooks/use-shallow-search-params.ts) — a
  small hook (`{ searchParams, write }`) that patches params via `window.history.replaceState`
  directly, bypassing Next's router (no Suspense refetch, no server round trip, stays
  bookmarkable). Grepped across `src/` — exactly three call sites, **all three in scope for this
  migration** (the site owner opted to wrap all of them together rather than leave two stragglers
  behind):
  - `search.tsx` (`/arhiv`, covered in detail above).
  - [`src/app/avtorji/table.tsx:76`](../../src/app/avtorji/table.tsx#L76) — `AuthorsDataTable`'s
    `sort`/`dir`/`page` params for a `@tanstack/react-table` instance. Two hand-rolled parse
    functions do exactly what nuqs parsers do natively: `sorting_from_search_params`
    (`table.tsx:61–67`) reads `sort`/`dir` into a `SortingState` tuple; `page_index_from_search_params`
    (`table.tsx:69–73`) reads `page` as 1-based-in-the-URL/0-based-internally with a hand-written
    `NaN`/negative guard. `setSorting`/`setPagination` (`table.tsx:88–116`) both wrap a React
    `useState` setter *and* call `write(...)` inside the same callback — state and URL are updated
    together, by hand, on every change.
  - [`src/app/preveri/preveri-client.tsx:32`](../../src/app/preveri/preveri-client.tsx#L32) —
    `PreveriClient`'s `id` (legacy article ID) param. `current_legacy_id` (`preveri-client.tsx:34–38`)
    is a hand-rolled `searchParams.get("id")` → `Number()` → `Number.isNaN` guard → fallback to
    `DEFAULT_LEGACY_ID` (`= 1`, line 19) — precisely the shape `parseAsInteger.withDefault(...)`
    exists to replace. `set_legacy_id` (`preveri-client.tsx:40–43`) is a one-line `write({ id:
    String(legacy_id) })`.
- [`src/app/arhiv/components.tsx`](../../src/app/arhiv/components.tsx) — `MySearchBox2` (line 77,
  wraps `useSearchBox`), `MySortBy` (line 56, wraps `useSortBy`), `AuthorRefinement` (line 161,
  wraps `useRefinementList({ attribute: "author_ids" })`), `TimelineRefinement` (line 208, wraps
  `useRefinementList({ attribute: "year" })`), `MyStats` (line 148, wraps `useStats`),
  `ResetFiltersButton` (line 286). All consume/produce plain values (`query: string`,
  `currentRefinement: string`, `items: {value,count,isRefined}[]`) — none of them touch the URL
  directly; today the URL sync happens entirely through InstantSearch's `routing` prop acting on
  the ui-state these hooks read from.
- [`src/app/arhiv/search-controls.tsx`](../../src/app/arhiv/search-controls.tsx) — pure layout,
  no URL logic at all.
- [`src/app/arhiv/infinite-hits.tsx`](../../src/app/arhiv/infinite-hits.tsx) and
  [`src/app/arhiv/article-table.tsx`](../../src/app/arhiv/article-table.tsx) — both driven by
  [`src/hooks/use-infinite-algolia.ts`](../../src/hooks/use-infinite-algolia.ts)
  (`useInfiniteAlgoliaArticles`, confirmed by full read): this hook wraps
  `useInfiniteHits`/`useIntersectionObserver` and drives pagination purely via `showMore()` off an
  intersection-observer callback (lines 32–42). **It does not read or write any URL param at
  all** — `page` lives only in InstantSearch's in-memory ui-state, confirming the task brief's
  premise. Nothing here changes under any URL-library swap.

## 2. What's installed

`package.json:118` / `bun.lock:104,1862`: `"nuqs": "^2.9.5"`, exact locked version
`2.9.5`. Grepped `src/` and (non-`node_modules`) the whole repo for `NuqsAdapter` — **zero
matches**. `nuqs` is installed but entirely unused; no `<NuqsAdapter>` exists anywhere, including
[`src/app/layout.tsx`](../../src/app/layout.tsx) (read in full — wraps children in `Providers` →
`QueryClientProvider` → `AllAuthorsContext.Provider`, no nuqs) or
[`src/app/provider.tsx`](../../src/app/provider.tsx) (read in full — same). **Wiring the adapter
in is a prerequisite step**, not something to discover was already done.

Per nuqs's own docs (`nuqs.dev/docs/adapters`, fetched 2026-08-16), for Next.js App Router the
adapter goes in the root layout, wrapping `children`:

```tsx
import { NuqsAdapter } from 'nuqs/adapters/next/app'
// ...
<NuqsAdapter>{children}</NuqsAdapter>
```

The natural spot in this repo is inside `Providers` in `src/app/provider.tsx` (client component
already), rather than directly in `layout.tsx` (server component) — either works per nuqs's docs,
but `provider.tsx` keeps client-only wrapping in one place, consistent with how
`QueryClientProvider` is already handled there.

## 3. nuqs API surface relevant here

Fetched from `nuqs.dev/docs/parsers`, `nuqs.dev/docs/basic-usage`, `nuqs.dev/docs/options`
(2026-08-16):

- **`parseAsString`** — `useQueryState('q', parseAsString.withDefault(''))`. Fits the search
  query 1:1.
- **`parseAsStringLiteral(values)`** — validates against a fixed set, e.g.
  `parseAsStringLiteral(['card', 'table'] as const)` for `view`, or
  `parseAsStringLiteral(SORT_BY_ITEMS.map(i => i.value) as const)` for `sortBy` (sortBy's values
  are the six replica index name constants from `components.tsx:43–54`, which are stable strings
  known at module-load time — a literal union is a natural fit, not a stretch).
- **`parseAsArrayOf(parser, separator?)`** — `parseAsArrayOf(parseAsString)` for
  `author_ids` (currently an array of numeric-string ids per `AuthorRefinement`'s
  `refinement_list.items`/`selected_values`, `components.tsx:188–190`).
- **`parseAsInteger`** — direct fit for `avtorji/table.tsx`'s `page` (replacing
  `page_index_from_search_params`'s hand-written `Number()`/`NaN`/negative guard,
  `table.tsx:69–73`, with `parseAsInteger.withDefault(0)`) and `preveri-client.tsx`'s `id`
  (replacing `current_legacy_id`'s identical hand-written guard, `preveri-client.tsx:34–38`, with
  `parseAsInteger.withDefault(DEFAULT_LEGACY_ID)`) — nuqs falls back to the parser's default on any
  unparseable/missing value, which is exactly what both call sites hand-roll today. `dir` (asc/desc)
  is another `parseAsStringLiteral(['asc', 'desc'] as const)` case, same shape as `view`/`sortBy`.
  Note the one behavioral wrinkle to preserve deliberately, not accidentally: `table.tsx`'s URL
  `page` is 1-based (`next.pageIndex + 1`, `table.tsx:110`) while the internal `pageIndex` state is
  0-based — a straight `parseAsInteger` swap must keep that offset (e.g. store the URL value
  1-based and subtract 1 when handing it to `useTable`, same as today), not silently flatten it to
  match the internal representation.
- **`useQueryStates`** — batches multiple keys into one hook call, one shared object of setters,
  documented for exactly this "several related URL params, one component" shape
  (`nuqs.dev/docs/batching`) — the natural fit for `q` + `sort` + `authors` + `year` + `view`
  living together instead of five separate `useQueryState` calls each doing their own
  `history.replaceState`.
- **`shallow`** (default `true`): "query state updates are done in a client-first manner: there
  are no network calls to the server" — i.e. nuqs already does, by default, exactly what
  `useShallowSearchParams` hand-rolls today (`replaceState`, no Next navigation/refetch). This is
  not an opt-in feature to configure; it's the default behavior.
- **History mode**: default `'replace'` — matches `useShallowSearchParams`'s
  `window.history.replaceState` today; `'push'` is opt-in and not wanted here (nobody wants a
  back-button entry per keystroke).
- **`clearOnDefault`** (default `true` since v2.0.0): a state matching its default is dropped
  from the URL entirely rather than written as `?sort=published_article_published_at_desc`. This
  directly replaces `router`'s `createURL` special-casing and gets `view=card` (the default tab)
  out of the URL for free, matching current behavior (`view` param is currently written as `null`
  → deleted for the card case, `write({ view: tab === "card" ? null : tab })`,
  `search.tsx:157`).
- **`throttleMs`** is deprecated as of nuqs 2.5.0 (repo is on 2.9.5, past that point) in favor of
  `limitUrlUpdates: throttle(ms)`. Relevant only for the search query box, where nuqs would
  otherwise fire a `replaceState` per keystroke. **This is not a double-debounce risk**: any
  throttle nuqs applies would govern *URL-write* frequency only, a client-only, network-free
  operation; Algolia's actual network request is already driven independently by whatever
  `MySearchBox2`'s `setQuery` → `search_refine(new_query)` does today (InstantSearch's
  `connectSearchBox`'s `queryHook`, confirmed by reading
  `node_modules/instantsearch.js/es/connectors/search-box/connectSearchBox.js` — no built-in
  debounce inside the connector itself; any perceived debounce today is a side effect of the old
  router's own write cadence, not something this migration needs to preserve). The two concerns
  (when to hit the network vs. when to touch the URL) are already decoupled in the current code
  and stay decoupled under nuqs; a light `throttle(300)` on the URL write alone is a nice-to-have,
  not a correctness requirement.

## 4. Is `routing` on `<InstantSearch>` actually optional?

Yes, confirmed at the type level, not just by docs prose:
`node_modules/instantsearch.js/es/lib/InstantSearch.d.ts:86` —
`routing?: RouterProps<TUiState, TRouteState> | boolean;` — optional. And
`react-instantsearch-core`'s own `InstantSearchProps` (`InstantSearch.d.ts:4`) just spreads
`UseInstantSearchApiProps`, which is the same optional field. Every hook this codebase actually
uses (`useSearchBox`, `useSortBy`, `useRefinementList`, `useStats`) reads/writes InstantSearch's
internal ui-state via `setIndexUiState`/`setUiState` regardless of whether a router is attached —
routing is an optional *URL-sync* layer bolted on top of ui-state, not a requirement for the hooks
to function. Dropping `routing` entirely and driving the same hooks from nuqs state via
`.refine()` calls in `useEffect`s (or on user interaction directly) is the intended, supported
shape of "controlled InstantSearch," not a hack.

## 5. What gets deleted, what gets rewritten, what stays

### Deleted outright
- **`router` (`search.tsx:82–101`) and the `createURL` patch.** Its entire reason to exist is
  reconciling two independent URL writers (InstantSearch's router vs. the shallow `view` write).
  With nuqs as the *only* writer, there's nothing to reconcile — `q`, `sort`, `authors`, `year`,
  and `view` all live in one `useQueryStates` call in `Search()`. ~20 lines gone.
- **`stateMapping` / `without_page` (`search.tsx:103–130`).** This exists only to scrub `page`
  out of InstantSearch's own route↔URL mapping. If InstantSearch never writes to the URL at all
  (no `routing` prop), there's no mapping to scrub in the first place — the constraint "`page`
  must never be a URL param" is satisfied trivially by omission, not by a filter. ~20 lines gone.
- **`future={{ preserveSharedStateOnUnmount: true }}` (`search.tsx:164`).** This flag exists to
  govern widget-state lifecycle specifically in relation to the router integration
  (`instantsearch.js`'s changelog ties it to `routing`); with `routing` removed, it has nothing
  left to configure and can be dropped along with it.
- **`useShallowSearchParams` usage inside `search.tsx`** (`search.tsx:16,149,157` and the
  `tab_from_search_params` helper at lines 22–26) — `view` moves into the same nuqs
  `useQueryStates` call as everything else, so `Search()` stops calling this hook.
- **`use-shallow-search-params.ts` itself, in full.** Since all three call sites
  (`search.tsx`, `avtorji/table.tsx`, `preveri-client.tsx`) are in scope together, there's no
  straggler consumer left once the migration lands — the whole file goes, not just the `/arhiv`
  import of it. (Scope note for whoever picks this up: this only holds if all three land in the
  same pass. Doing `/arhiv` alone and leaving the other two, as originally scoped, would leave the
  file in place for those two — see the earlier revision of this doc, superseded by this section.)
- **`sorting_from_search_params` and `page_index_from_search_params`** (`table.tsx:61–73`) —
  both are hand-written equivalents of a `parseAsStringLiteral`/`parseAsInteger` parser pair; once
  `useQueryStates` owns `sort`/`dir`/`page` for this table, both helper functions have nothing left
  to do and are deleted, not refactored.
- **The `Number()`/`NaN`-guard block inside `current_legacy_id`** (`preveri-client.tsx:34–38`) —
  replaced outright by `parseAsInteger.withDefault(DEFAULT_LEGACY_ID)`; the `useMemo` wrapper goes
  too, since nuqs's returned value is already stable across renders.

### Rewritten, and drastically smaller
- **`search.tsx`**: net effect is the file shrinks from ~191 lines to roughly the JSX
  scaffolding plus one `useQueryStates` call and a small `useEffect` (or per-handler calls)
  syncing nuqs state into the four Algolia hooks. Rough shape:
  ```tsx
  const [state, setState] = useQueryStates({
    q: parseAsString.withDefault(""),
    sort: parseAsStringLiteral(SORT_VALUES).withDefault(DEFAULT_REFINEMENT),
    authors: parseAsArrayOf(parseAsString).withDefault([]),
    year: parseAsString,
    view: parseAsStringLiteral(["card", "table"]).withDefault("card"),
  });
  ```
  `<InstantSearch>` loses its `routing` prop entirely; `ResetPageOnTabChange` (see below) is the
  only piece of InstantSearch-router-adjacent code that survives.
- **`components.tsx`'s four hook-wrapping components** (`MySearchBox2`, `MySortBy`,
  `AuthorRefinement`/`TimelineRefinement` via `useRefinementList`) each need a small addition:
  syncing the nuqs-owned value into the corresponding Algolia hook's `refine()` on change (or
  passing nuqs's value down as the controlling source of truth and calling `.refine()` from the
  component that also calls `setState`). This is mechanical — the task brief calls it "each
  hook's own controlled-value props or calling `.refine()` imperatively from a `useEffect`", and
  that's exactly the shape: no new state model, just a wire from nuqs's setter into an already-
  existing `.refine()` call each component already makes. Net line delta per component is small
  (a few lines added, nothing structural removed, since these components never touched the URL
  directly in the first place — see §1).
- **`avtorji/table.tsx`'s `setSorting`/`setPagination`** (`table.tsx:88–116`): each currently
  does two things in one callback — update React state, then hand-call `write(...)`. With
  `useQueryStates` these collapse to one nuqs setter call each; the separate `useState` for
  `sorting`/`pagination` goes away entirely, since nuqs's returned state *is* the state (same
  pattern nuqs recommends generally — one source of truth instead of state+effect-synced-to-URL).
  `AuthorsDataTable` loses `sorting_from_search_params`/`page_index_from_search_params` (deleted,
  see above) and both `useState` calls; `useTable`'s `state.sorting`/`state.pagination` read
  straight from the nuqs-returned object instead.
- **`preveri-client.tsx`**: `current_legacy_id` drops its `useMemo`+parse-guard down to a single
  `useQueryState` call; `set_legacy_id` becomes a direct nuqs setter instead of a `write()` wrapper.
  Net change is a handful of lines, in the same shallow-not-structural sense as the `/arhiv`
  components above — this file was already using the hook correctly, it just had to hand-roll the
  parsing nuqs does for free.

### Stays as real, necessary logic — no shortcut exists
- **`ResetPageOnTabChange` (`search.tsx:138–146`).** This has nothing to do with which library
  owns the URL. Card and table share one InstantSearch widget/index; switching tabs must reset
  `page` in InstantSearch's *internal* ui-state (via `setIndexUiState`) regardless of whether that
  state is ever mirrored to the URL. It survives unchanged, keyed by `activeTab` exactly as today
  (`search.tsx:169`).
- **The "page is never a URL param" constraint itself.** Confirmed at `use-infinite-algolia.ts`
  (full read, §1 above): infinite-scroll position is driven by an intersection observer calling
  `showMore()`, with no URL involvement today and no URL involvement possible without changing
  the actual pagination UX (e.g. to numbered pages) — a decision this research's scope
  (URL-ownership only, backend/UX untouched) explicitly excludes. This is real product logic, not
  routing-library cruft.
- **The empty-query ↔ relevance-sort auto-toggle in `MySearchBox2`** (`components.tsx:95–119`).
  Pure business logic over `currentRefinement`/`inputValue`, orthogonal to who owns URL state.
  Unaffected either way.
- **`useShallowSearchParams` as a file.** Stays alive for `avtorji` and `preveri`. Only its
  `/arhiv`-side caller disappears.

## 6. So what?

**Do it — this is a clean, low-risk deletion, not a rewrite in disguise.** The evidence:

- `routing` on `<InstantSearch>` is confirmed optional at the type-declaration level
  (`InstantSearch.d.ts:86`), and every hook `/arhiv` actually uses operates on InstantSearch's
  internal ui-state independent of whether a router is attached — there is no hidden coupling
  forcing `routing` to stay.
- Every piece of custom routing glue in `search.tsx` — the `createURL` patch, `without_page`, the
  `preserveSharedStateOnUnmount` flag — exists *only* to manage the friction between InstantSearch
  owning part of the URL and `useShallowSearchParams` owning the rest. Once nuqs is the single
  owner of the entire URL surface (`q`, `sort`, `authors`, `year`, `view`), that friction has
  nothing left to manage. This isn't "nuqs replaces InstantSearch's router with a nicer one" —
  it's "there is no router left to have friction with." nuqs's own `useQueryStates` batching,
  `clearOnDefault`, and `shallow: true`-by-default behavior covers what `useShallowSearchParams`
  hand-rolls today, with less code per call site.
- The two things that must stay (`ResetPageOnTabChange`, the never-URL-encode-`page` constraint)
  stay because they're genuine product behavior about a shared widget and non-shareable scroll
  position — not because any URL library forces them to.
- Setup cost is small and one-time: add `<NuqsAdapter>` to `src/app/provider.tsx` (currently
  missing entirely, confirmed by repo-wide grep — this is the one prerequisite step, not
  optional), then move `q`/`sort`/`authors`/`year`/`view` into one `useQueryStates` call in
  `Search()`, then wire each of the four hook-wrapping components in `components.tsx` to read
  their controlling value from that same state and call `.refine()` on change.
- Net result, doing all three call sites together (the site owner's call — "we can wrap it all
  together"): `search.tsx` loses roughly half its current body (the entire router/stateMapping
  block, `future` flag, and the ad hoc `view` handling); `avtorji/table.tsx` loses two hand-written
  parse functions and a `useState`+`write()` double-update pattern in favor of nuqs state being the
  single source of truth; `preveri-client.tsx` loses a `useMemo`-wrapped parse guard for a
  one-line `useQueryState` call; and `use-shallow-search-params.ts` — with zero consumers left —
  is deleted outright, not just trimmed. No new files are needed beyond wiring `NuqsAdapter` into
  an already-existing provider file. This is the aggressive option the brief asked for, and it's
  justified end-to-end now: nothing here is being kept "just in case," including the shared hook
  file itself.
