"use client";

import { liteClient as algolia_search } from "algoliasearch/lite";
import historyRouter from "instantsearch.js/es/lib/routers/history";
import simpleStateMapping from "instantsearch.js/es/lib/stateMappings/simple";
import type { StateMapping, UiState } from "instantsearch.js/es/types";
import dynamic from "next/dynamic";
import { useCallback, useEffect, useState } from "react";
import {
	Configure,
	InstantSearch,
	useInstantSearch,
} from "react-instantsearch";
import { Skeleton } from "~/components/ui/skeleton";
import { env } from "~/env";
import { useShallowSearchParams } from "~/hooks/use-shallow-search-params";
import { article_grid_variants } from "~/lib/page-variants";
import { cn } from "~/lib/utils";
import type { Session } from "~/server/auth";
import { DEFAULT_REFINEMENT } from "./components";

function tab_from_search_params(
	searchParams: URLSearchParams,
): "card" | "table" {
	return searchParams.get("view") === "table" ? "table" : "card";
}

const SearchControlsDynamic = dynamic(
	() =>
		import("./search-controls").then((mod) => ({
			default: mod.SearchControls,
		})),
	{
		ssr: false,
		loading: () => <Skeleton className="h-[172px] w-full bg-[hsl(0_0%_90%)]" />,
	},
);

const ArticleTableDynamic = dynamic(
	() =>
		import("./article-table").then((mod) => ({
			default: mod.ArticleTable,
		})),
	{
		ssr: false,
		loading: () => (
			<div className="flex flex-col gap-2">
				{Array.from({ length: 10 }).map((_, index) => (
					// biome-ignore lint/suspicious/noArrayIndexKey: fixed-count, never-reordered loading placeholders
					<Skeleton key={index} className="h-9 w-full bg-[hsl(0_0%_90%)]" />
				))}
			</div>
		),
	},
);

const MyInfiniteHitsDynamic = dynamic(
	() =>
		import("./infinite-hits").then((mod) => ({
			default: mod.MyInfiniteHits,
		})),
	{
		ssr: false,
		loading: () => {
			return (
				<div className={cn(article_grid_variants())}>
					{Array.from({ length: 10 }).map((_, index) => (
						// biome-ignore lint/suspicious/noArrayIndexKey: fixed-count, never-reordered loading placeholders
						<Skeleton key={index} className="h-[441px] bg-[hsl(0_0%_90%)]" />
					))}
				</div>
			);
		},
	},
);

const searchClient = algolia_search(
	env.NEXT_PUBLIC_ALGOLIA_ID,
	env.NEXT_PUBLIC_ALGOLIA_SEARCH_KEY,
);

// InstantSearch's default history router rebuilds the URL from its own
// route state alone (query/refinementList/sortBy/…), which would wipe out
// our `view` param on every debounced write. Extending `createURL` to carry
// the current `view` value through keeps both in the same URL instead of
// racing two independent writers.
const router = historyRouter<Record<string, unknown>>({
	createURL({ qsModule, routeState, location }) {
		const currentQuery = qsModule.parse(location.search.slice(1));
		const queryString = qsModule.stringify(
			currentQuery.view
				? { ...routeState, view: currentQuery.view }
				: routeState,
		);
		const { protocol, hostname, pathname, hash } = location;
		const portWithPrefix = location.port === "" ? "" : `:${location.port}`;
		return queryString
			? `${protocol}//${hostname}${portWithPrefix}${pathname}?${queryString}${hash}`
			: `${protocol}//${hostname}${portWithPrefix}${pathname}${hash}`;
	},
});

// `page` is infinite-hits scroll position, not a link-worthy search
// parameter, and card/table share the same underlying widget: leaving it in
// the URL produced ugly `?published_article_..._page%5D=3` links, and
// restoring it on tab switch made the newly-mounted view start fetching from
// that page forward, skipping every earlier page. Stripping it from both
// directions of the mapping keeps it purely in-memory (still reset per tab
// via `setIndexUiState` below).
function without_page(state: Record<string, unknown>): Record<string, unknown> {
	return Object.fromEntries(
		Object.entries(state).map(([indexId, indexState]) => {
			if (typeof indexState !== "object" || indexState === null) {
				return [indexId, indexState];
			}
			const rest = { ...(indexState as Record<string, unknown>) };
			delete rest.page;
			return [indexId, rest];
		}),
	);
}

const base_state_mapping = simpleStateMapping();
const stateMapping: StateMapping<UiState, Record<string, unknown>> = {
	...base_state_mapping,
	stateToRoute: (uiState) =>
		without_page(base_state_mapping.stateToRoute(uiState)),
	routeToState: (routeState) =>
		base_state_mapping.routeToState(without_page(routeState) as UiState),
};

// Card and table share one infinite-hits widget, so switching tabs doesn't
// naturally reset scroll position: the tab mounting fresh would otherwise
// inherit whatever `page` the other tab had scrolled to and start fetching
// from there, skipping earlier pages entirely. Keyed by `activeTab` in the
// caller so it fully remounts (and thus resets exactly once) per tab switch,
// rather than depending on an effect that only cares about the transition.
function ResetPageOnTabChange() {
	const { setIndexUiState } = useInstantSearch();

	useEffect(() => {
		setIndexUiState((prev) => ({ ...prev, page: undefined }));
	}, [setIndexUiState]);

	return null;
}

export function Search({ session }: { session: Session | null }) {
	const { searchParams, write } = useShallowSearchParams();
	const [activeTab, setActiveTabState] = useState<"card" | "table">(() =>
		tab_from_search_params(searchParams),
	);

	const setActiveTab = useCallback(
		(tab: "card" | "table") => {
			setActiveTabState(tab);
			write({ view: tab === "card" ? null : tab });
		},
		[write],
	);

	return (
		<InstantSearch
			future={{ preserveSharedStateOnUnmount: true }}
			indexName={DEFAULT_REFINEMENT}
			searchClient={searchClient}
			routing={{ router, stateMapping }}
		>
			<ResetPageOnTabChange key={activeTab} />
			{/* Content-kind rows (the 5 fixed club pages) never belong in the
			sortable news archive — they're reached via fixed nav links and quick
			search, never here (ADR-0009). Deploy-order note: `article_kind` must
			be declared as a filterable attribute on the Algolia index (one-time
			manual dashboard step, ADR-0009 — no settings-as-code in this repo)
			before this ships, or Algolia rejects the filter and search breaks for
			everyone, not just content rows. */}
			<Configure filters="article_kind:article" />
			<div className="flex flex-col gap-4 pb-6 pt-2">
				<SearchControlsDynamic
					activeTab={activeTab}
					onTabChange={setActiveTab}
				/>
				{activeTab === "card" ? (
					<MyInfiniteHitsDynamic />
				) : (
					<ArticleTableDynamic session={session} />
				)}
			</div>
		</InstantSearch>
	);
}
