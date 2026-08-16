"use client";

import { liteClient as algolia_search } from "algoliasearch/lite";
import dynamic from "next/dynamic";
import { parseAsStringLiteral, useQueryState } from "nuqs";
import { useEffect } from "react";
import {
	Configure,
	InstantSearch,
	useInstantSearch,
} from "react-instantsearch";
import { Skeleton } from "~/components/ui/skeleton";
import { env } from "~/env";
import { article_grid_variants } from "~/lib/page-variants";
import { cn } from "~/lib/utils";
import type { Session } from "~/server/auth";
import { DEFAULT_REFINEMENT, SearchStateProvider } from "./components";

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

// Card and table share one infinite-hits widget, so switching tabs doesn't
// naturally reset scroll position: the tab mounting fresh would otherwise
// inherit whatever `page` the other tab had scrolled to and start fetching
// from there, skipping earlier pages entirely. Keyed by `activeTab` in the
// caller so it fully remounts (and thus resets exactly once) per tab switch,
// rather than depending on an effect that only cares about the transition.
// `page` itself is never URL-worthy (infinite-scroll position, not a
// link-worthy param), so it lives only in InstantSearch's in-memory
// ui-state — nuqs never sees it.
function ResetPageOnTabChange() {
	const { setIndexUiState } = useInstantSearch();

	useEffect(() => {
		setIndexUiState((prev) => ({ ...prev, page: undefined }));
	}, [setIndexUiState]);

	return null;
}

export function Search({ session }: { session: Session | null }) {
	const [activeTab, setActiveTab] = useQueryState(
		"view",
		parseAsStringLiteral(["card", "table"] as const).withDefault("card"),
	);

	return (
		<InstantSearch indexName={DEFAULT_REFINEMENT} searchClient={searchClient}>
			<SearchStateProvider>
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
			</SearchStateProvider>
		</InstantSearch>
	);
}
