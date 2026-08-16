"use client";

import type { RefinementListItem } from "instantsearch.js/es/connectors/refinement-list/connectRefinementList";
import { XIcon } from "lucide-react";
import {
	parseAsArrayOf,
	parseAsString,
	parseAsStringLiteral,
	useQueryState,
} from "nuqs";
import type React from "react";
import { createContext, use, useCallback, useEffect, useState } from "react";
import type { UseRefinementListProps } from "react-instantsearch";
import {
	useClearRefinements,
	useRefinementList,
	useSearchBox,
	useSortBy,
	useStats,
} from "react-instantsearch";
import { AllAuthorsContext } from "~/app/provider";
import type { AuthorOption } from "~/components/author-command-popover";
import { AuthorCommandPopover } from "~/components/author-command-popover";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "~/components/ui/select";
import { ALGOLIA_PUBLISHED_ARTICLE_INDEX } from "~/lib/algoliasearch";
import { format_author_name, format_author_sort_name } from "~/lib/author-name";
import { cn } from "~/lib/utils";

// Replica index names follow `${base}_<criterion>` (see Algolia dashboard) —
// derived from the env-configured base index, not hardcoded to prod's
// `published_article`, so `dev:staging` (base `published_article_staging`)
// actually queries staging's replicas instead of silently falling back to
// prod's.
function replica(suffix: string) {
	return `${ALGOLIA_PUBLISHED_ARTICLE_INDEX}_${suffix}`;
}

export const PUBLISHED_AT_DESC = replica("published_at_desc");
export const PUBLISHED_AT_ASC = replica("published_at_asc");
export const TITLE_ASC = replica("title_asc");
export const TITLE_DESC = replica("title_desc");
export const AUTHOR_ASC = replica("author_asc");
export const AUTHOR_DESC = replica("author_desc");

export const DEFAULT_REFINEMENT = PUBLISHED_AT_DESC;
// The base index itself: no customRanking configured, so it's pure text
// relevance with no date component — a real "search relevance" sort, not
// just an alias for the default.
export const RELEVANCE_REFINEMENT = ALGOLIA_PUBLISHED_ARTICLE_INDEX;

export const SORT_BY_ITEMS = [
	{ value: RELEVANCE_REFINEMENT, label: "Ustreznost" },
	{ value: PUBLISHED_AT_DESC, label: "Najnovejše" },
	{ value: PUBLISHED_AT_ASC, label: "Najstarejše" },
	{ value: TITLE_ASC, label: "Ime naraščajoče" },
	{ value: TITLE_DESC, label: "Ime padajoče" },
	{ value: AUTHOR_ASC, label: "Avtor naraščajoče" },
	{ value: AUTHOR_DESC, label: "Avtor padajoče" },
];

const SORT_VALUES = SORT_BY_ITEMS.map((item) => item.value);

interface SearchState {
	query: string;
	search_refine: (query: string) => void;
	clear_search: () => void;
	sort: string;
	setSort: (value: string) => void;
	sort_options: { value: string; label: string }[];
}

const SearchStateContext = createContext<SearchState | null>(null);

// The single, persistently-mounted owner of Algolia's search-box and sort-by
// connectors. Both react-instantsearch connectors reset shared state in
// their `dispose()` on unmount — connectSearchBox unconditionally clears the
// query (node_modules/instantsearch.js/es/connectors/search-box/
// connectSearchBox.js:43), connectSortBy resets the index back to whatever
// it was when that particular widget instance first mounted
// (.../sort-by/connectSortBy.js:86-88). `ArticleTable` and
// `ResetFiltersButton` live inside the card/table tab-swapped branches, so a
// second, independent instance of either connector mounted there would
// dispose (and corrupt shared state) on every tab switch. Routing used to
// mask this by re-deriving ui-state from the URL on every write; without it,
// every consumer must share these two connector instances instead of
// creating their own.
export function SearchStateProvider({
	children,
}: {
	children: React.ReactNode;
}) {
	const { query, refine: search_refine, clear: clear_search } = useSearchBox();
	const [urlQuery] = useQueryState("q", parseAsString.withDefault(""));
	const [sort, setUrlSort] = useQueryState(
		"sort",
		parseAsStringLiteral(SORT_VALUES).withDefault(DEFAULT_REFINEMENT),
	);
	const {
		refine: sort_refine,
		currentRefinement,
		options: sort_options,
	} = useSortBy({ items: SORT_BY_ITEMS });

	// Hydrates Algolia's query/sort from the URL once on mount — InstantSearch
	// no longer owns any part of the URL, so nothing else does this.
	// biome-ignore lint/correctness/useExhaustiveDependencies: mount-only hydration
	useEffect(() => {
		if (urlQuery !== "") search_refine(urlQuery);
	}, []);

	useEffect(() => {
		if (currentRefinement !== sort) sort_refine(sort);
	}, [sort, currentRefinement, sort_refine]);

	const setSort = useCallback(
		(value: string) => {
			void setUrlSort(value);
		},
		[setUrlSort],
	);

	return (
		<SearchStateContext.Provider
			value={{
				query,
				search_refine,
				clear_search,
				sort,
				setSort,
				sort_options,
			}}
		>
			{children}
		</SearchStateContext.Provider>
	);
}

function useSearchState(): SearchState {
	const context = use(SearchStateContext);
	if (!context) {
		throw new Error("useSearchState must be used within SearchStateProvider");
	}
	return context;
}

export function MySortBy() {
	const { sort, setSort, sort_options } = useSearchState();

	return (
		<Select onValueChange={(value) => void setSort(value)} value={sort}>
			<SelectTrigger className="flex-1 min-[500px]:w-40 min-[500px]:flex-none">
				<SelectValue placeholder="Razvrsti po ..." />
			</SelectTrigger>
			<SelectContent>
				{sort_options.map((option) => (
					<SelectItem key={option.value} value={option.value}>
						{option.label}
					</SelectItem>
				))}
			</SelectContent>
		</Select>
	);
}

export function MySearchBox2() {
	const { query, search_refine, sort, setSort } = useSearchState();
	const [inputValue, setInputValue] = useState(query);
	const [, setUrlQuery] = useQueryState("q", parseAsString.withDefault(""));

	// Keeps the input in sync with `query` changes this component didn't
	// cause itself — e.g. the reset-filters button, which calls
	// `clear_search()` from outside this component. InstantSearch debounces
	// `query`, so the input can't just bind to it directly; instead it
	// mirrors it via render-time state adjustment.
	const [prevQuery, setPrevQuery] = useState(query);
	if (prevQuery !== query) {
		setPrevQuery(query);
		setInputValue(query);
	}

	const setQuery = useCallback(
		(new_query: string) => {
			const was_empty = inputValue.trim() === "";
			const is_empty = new_query.trim() === "";
			// Only flip the sort at the empty/non-empty boundary, and only
			// away from/back to the untouched default — a sort the user
			// picked by hand (e.g. "Ime naraščajoče") is left alone. Base
			// index has no customRanking, so it's pure text relevance with no
			// date component (confirmed via `algolia settings get
			// published_article` — no meaning without a query, per Algolia's
			// own relevant-sort docs).
			if (was_empty && !is_empty && sort === DEFAULT_REFINEMENT) {
				void setSort(RELEVANCE_REFINEMENT);
			} else if (!was_empty && is_empty && sort === RELEVANCE_REFINEMENT) {
				void setSort(DEFAULT_REFINEMENT);
			}
			setInputValue(new_query);
			search_refine(new_query);
			void setUrlQuery(new_query);
		},
		[search_refine, sort, setSort, inputValue, setUrlQuery],
	);

	return (
		<div className="relative min-w-0 flex-1">
			<Input
				className="pr-8"
				placeholder="Iskanje"
				value={inputValue}
				onChange={(e) => setQuery(e.target.value)}
				autoComplete="off"
				autoCorrect="off"
				autoCapitalize="off"
				spellCheck={false}
				maxLength={512}
			/>
			{inputValue !== "" && (
				<button
					type="button"
					aria-label="Počisti iskanje"
					className="-translate-y-1/2 absolute top-1/2 right-2 text-muted-foreground hover:text-foreground"
					onClick={() => setQuery("")}
				>
					<XIcon className="size-4" />
				</button>
			)}
		</div>
	);
}

export function MyStats({ loaded_count }: { loaded_count: number }) {
	const stats = useStats();

	return (
		<div className="flex items-center justify-between">
			<p className="text-sm text-muted-foreground">
				Prikazanih {loaded_count} od {stats.nbHits} novic
			</p>
			<ResetFiltersButton />
		</div>
	);
}

export function AuthorRefinement(
	props: Omit<UseRefinementListProps, "attribute">,
) {
	const refinement_list = useRefinementList({
		attribute: "author_ids",
		limit: 100,
		...props,
	});
	const clear_author_refinements = useClearRefinements({
		includedAttributes: ["author_ids"],
	});
	const all_authors = use(AllAuthorsContext);
	const [urlAuthors, setUrlAuthors] = useQueryState(
		"authors",
		parseAsArrayOf(parseAsString).withDefault([]),
	);

	// Hydrates Algolia's author refinement from the URL once on mount.
	// biome-ignore lint/correctness/useExhaustiveDependencies: mount-only hydration
	useEffect(() => {
		for (const value of urlAuthors) refinement_list.refine(value);
	}, []);

	const options: AuthorOption[] = refinement_list.items
		.map((item) => {
			const author =
				all_authors.find((author) => author.id === Number(item.value)) ?? null;
			return {
				value: item.value,
				author,
				label: `${author ? format_author_name(author) : item.value} (${item.count})`,
				sort_label: author ? format_author_sort_name(author) : item.value,
			};
		})
		.sort((a, b) => a.sort_label.localeCompare(b.sort_label, "sl"))
		.map(({ sort_label: _sort_label, ...option }) => option);

	const selected_values = refinement_list.items
		.filter((item) => item.isRefined)
		.map((item) => item.value);

	const onToggle = useCallback(
		(value: string) => {
			refinement_list.refine(value);
			void setUrlAuthors((previous) =>
				previous.includes(value)
					? previous.filter((v) => v !== value)
					: [...previous, value],
			);
		},
		[refinement_list.refine, setUrlAuthors],
	);

	const onClear = useCallback(() => {
		clear_author_refinements.refine();
		void setUrlAuthors(null);
	}, [clear_author_refinements.refine, setUrlAuthors]);

	return (
		<AuthorCommandPopover
			className="min-w-40 flex-1 lg:w-55 lg:flex-none"
			options={options}
			selectedValues={selected_values}
			onToggle={onToggle}
			onClear={clear_author_refinements.canRefine ? onClear : undefined}
			placeholder="Vsi avtorji"
		/>
	);
}

export function TimelineRefinement(
	props: Omit<UseRefinementListProps, "attribute">,
) {
	const refinement_list = useRefinementList({
		attribute: "year",
		sortBy: ["name:asc"],
		limit: 100,
		...props,
	});
	const clear_refinements = useClearRefinements({
		includedAttributes: ["year"],
	});
	const [urlYear, setUrlYear] = useQueryState("year", parseAsString);

	// Hydrates Algolia's year refinement from the URL once on mount.
	// biome-ignore lint/correctness/useExhaustiveDependencies: mount-only hydration
	useEffect(() => {
		if (urlYear) refinement_list.refine(urlYear);
	}, []);

	const max_count = Math.max(
		1,
		...refinement_list.items.map((item) => item.count),
	);

	return (
		<ol className="scroll-fade-x flex flex-1 items-end gap-x-2 gap-y-2 overflow-x-auto pb-2">
			{refinement_list.items.map((item) => (
				<TimelineItem
					onClick={() => {
						clear_refinements.refine();
						if (item.isRefined) {
							void setUrlYear(null);
						} else {
							refinement_list.refine(item.value);
							void setUrlYear(item.value);
						}
					}}
					key={item.value}
					item={item}
					max_count={max_count}
				/>
			))}
		</ol>
	);
}

const MAX_BAR_HEIGHT_PX = 64;
const MIN_BAR_HEIGHT_PX = 6;

export function TimelineItem({
	item,
	max_count,
	...props
}: { item: RefinementListItem; max_count: number } & React.ComponentProps<
	typeof Button
>) {
	const bar_height = Math.max(
		MIN_BAR_HEIGHT_PX,
		Math.round((item.count / max_count) * MAX_BAR_HEIGHT_PX),
	);

	return (
		<li className="flex shrink-0 flex-col items-center">
			<button
				type="button"
				title={`${item.value}: ${item.count} novic`}
				className={cn(
					"w-3 rounded-t-sm bg-blue-800/40 transition-colors hover:bg-blue-800/70",
					item.isRefined && "bg-primary hover:bg-primary",
				)}
				style={{ height: bar_height }}
				{...props}
			/>
			<span
				className={cn(
					"mt-1 rotate-45 text-xs text-muted-foreground sm:rotate-0",
					item.isRefined && "font-bold text-foreground",
				)}
			>
				{item.value}
			</span>
		</li>
	);
}

export function ResetFiltersButton() {
	const { query, clear_search, sort, setSort } = useSearchState();
	const clear_refinements = useClearRefinements();
	const [, setUrlQuery] = useQueryState("q", parseAsString.withDefault(""));
	const [, setUrlAuthors] = useQueryState(
		"authors",
		parseAsArrayOf(parseAsString).withDefault([]),
	);
	const [, setUrlYear] = useQueryState("year", parseAsString);

	const has_active_filters =
		query.trim() !== "" ||
		clear_refinements.canRefine ||
		sort !== DEFAULT_REFINEMENT;

	if (!has_active_filters) return null;

	return (
		<Button
			type="button"
			variant="ghost"
			size="sm"
			className="gap-1 text-muted-foreground"
			onClick={() => {
				clear_refinements.refine();
				clear_search();
				void setSort(DEFAULT_REFINEMENT);
				void setUrlQuery(null);
				void setUrlAuthors(null);
				void setUrlYear(null);
			}}
		>
			<XIcon className="size-3.5" />
			Ponastavi filtre
		</Button>
	);
}

export { useSearchState };
