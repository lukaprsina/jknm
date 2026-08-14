"use client";

import type { RefinementListItem } from "instantsearch.js/es/connectors/refinement-list/connectRefinementList";
import { XIcon } from "lucide-react";
import type React from "react";
import { use, useCallback, useState } from "react";
import type {
	ClearRefinementsProps,
	UseRefinementListProps,
	UseSearchBoxProps,
} from "react-instantsearch";
import {
	useClearRefinements,
	useRefinementList,
	useSearchBox,
	useSortBy,
	useStats,
} from "react-instantsearch";
import { AllAuthorsContext } from "~/app/provider";
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
import { cn } from "~/lib/utils";

export const DEFAULT_REFINEMENT = "published_article_created_at_desc";

/* 
TODO:
Warning: Can't perform a React state update on a component that hasn't mounted yet.
This indicates that you have a side-effect in your render function that asynchronously
later calls tries to update the component. Move this work to useEffect instead
 */
export function MySortBy() {
	const { currentRefinement, options, refine } = useSortBy({
		items: SORT_BY_ITEMS,
	});

	return (
		<div className="flex items-center justify-between gap-2">
			<p>Razvrsti po</p>
			<Select
				onValueChange={(value) => refine(value)}
				value={currentRefinement}
			>
				<SelectTrigger>
					<SelectValue placeholder="Sortiraj po ..." />
				</SelectTrigger>
				<SelectContent>
					{options.map((option) => (
						<SelectItem key={option.value} value={option.value}>
							{option.label}
						</SelectItem>
					))}
				</SelectContent>
			</Select>
		</div>
	);
}

/*
TODO:
Warning: Can't perform a React state update on a component that hasn't mounted yet.
This indicates that you have a side-effect in your render function that asynchronously
later calls tries to update the component. Move this work to useEffect instead
 */
export function MySearchBox2(props: UseSearchBoxProps) {
	const { query, refine: search_refine } = useSearchBox(props);
	const [inputValue, setInputValue] = useState(query);
	const { refine: sort_refine } = useSortBy({ items: SORT_BY_ITEMS });

	const setQuery = useCallback(
		(new_query: string) => {
			const trimmed = new_query.trim();

			if (trimmed === "") {
				sort_refine(DEFAULT_REFINEMENT);
			} else {
				sort_refine(ALGOLIA_PUBLISHED_ARTICLE_INDEX);
			}

			setInputValue(new_query);
			search_refine(new_query);
		},
		[search_refine, sort_refine],
	);

	return (
		<div className="flex w-full max-w-sm items-center space-x-2">
			<Input
				placeholder="Iskanje"
				value={inputValue}
				className="max-w-xl"
				onChange={(e) => {
					const text = e.target.value;

					setQuery(text);
				}}
				autoComplete="off"
				autoCorrect="off"
				autoCapitalize="off"
				spellCheck={false}
				maxLength={512}
			/>

			<Button
				variant="outline"
				size="icon"
				className="flex-shrink-0"
				onClick={() => {
					setQuery("");
				}}
			>
				<XIcon size={12} />
			</Button>
		</div>
	);
}

/* export function MySearchBox() {
  const search_api = useSearchBox({ queryHook });
  const { refine: sort_refine } = useSortBy({ items: SORT_BY_ITEMS });

  return (
    <div className="flex w-full max-w-sm items-center space-x-2">
      <Input
        placeholder="Išči po novicah …"
        value={search_api.query}
        className="max-w-xl"
        onChange={(e) => {
          const text = e.target.value;
          const trimmed = text.trim();

          search_api.refine(text);
          if (trimmed.length === 0) {
            sort_refine(DEFAULT_REFINEMENT);
          } else {
            sort_refine("published_article");
          }
        }}
      />

      <Button
        variant="outline"
        size="icon"
        onClick={() => {
          search_api.clear();
        }}
      >
        <XIcon size="12px" />
      </Button>
    </div>
  );
} */

export function MyStats({ loaded_count }: { loaded_count: number }) {
	const stats = useStats();

	return (
		<p>
			Prikazanih {loaded_count} od {stats.nbHits} novic
		</p>
	);
}

const ALL_AUTHORS_VALUE = "__all__";

export function AuthorRefinement(
	props: Omit<UseRefinementListProps, "attribute">,
) {
	const refinement_list = useRefinementList({
		attribute: "author_ids",
		limit: 100,
		...props,
	});
	const clear_refinements = useClearRefinements({
		includedAttributes: ["author_ids"],
	});
	const all_authors = use(AllAuthorsContext);

	const named_items = refinement_list.items
		.map((item) => ({
			item,
			name:
				all_authors.find((author) => author.id === Number(item.value))?.name ??
				item.value,
		}))
		.sort((a, b) => a.name.localeCompare(b.name, "sl"));

	const current_value =
		refinement_list.items.find((item) => item.isRefined)?.value ??
		ALL_AUTHORS_VALUE;

	return (
		<Select
			value={current_value}
			onValueChange={(value) => {
				clear_refinements.refine();
				if (value !== ALL_AUTHORS_VALUE) {
					refinement_list.refine(value);
				}
			}}
		>
			<SelectTrigger>
				<SelectValue placeholder="Vsi avtorji" />
			</SelectTrigger>
			<SelectContent>
				<SelectItem value={ALL_AUTHORS_VALUE}>Vsi avtorji</SelectItem>
				{named_items.map(({ item, name }) => (
					<SelectItem key={item.value} value={item.value}>
						{name} ({item.count})
					</SelectItem>
				))}
			</SelectContent>
		</Select>
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

	const max_count = Math.max(
		1,
		...refinement_list.items.map((item) => item.count),
	);

	return (
		<ol className="flex flex-1 flex-wrap items-end gap-x-1 gap-y-2 pb-2 pl-1">
			{refinement_list.items.map((item) => (
				<TimelineItem
					onClick={() => {
						if (item.isRefined) {
							clear_refinements.refine();
						} else {
							clear_refinements.refine();
							refinement_list.refine(item.value);
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
		<li className="flex flex-col items-center">
			<button
				type="button"
				title={`${item.value}: ${item.count} novic`}
				className={cn(
					"w-3 rounded-t-lg bg-muted-foreground/40 transition-colors hover:bg-muted-foreground/70",
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

export function CustomClearRefinements(props: ClearRefinementsProps) {
	const { refine: clear_refinements } = useClearRefinements(props);
	const { clear: clear_search } = useSearchBox();
	const { refine: sort_refine } = useSortBy({ items: SORT_BY_ITEMS });

	return (
		<Button
			variant="outline"
			onClick={() => {
				clear_refinements();
				clear_search();
				sort_refine(DEFAULT_REFINEMENT);
			}}
		>
			Počisti filtre
		</Button>
	);
}

export const SORT_BY_ITEMS = [
	{ value: "published_article_created_at_desc", label: "Najnovejše" },
	{ value: "published_article_created_at_asc", label: "Najstarejše" },
	{ value: "published_article_title_asc", label: "Ime naraščajoče" },
	{ value: "published_article_title_desc", label: "Ime padajoče" },
	{ value: "published_article_author_asc", label: "Avtor naraščajoče" },
	{ value: "published_article_author_desc", label: "Avtor padajoče" },
];
