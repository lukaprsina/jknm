"use client";

import type { RefinementListItem } from "instantsearch.js/es/connectors/refinement-list/connectRefinementList";
import { XIcon } from "lucide-react";
import type React from "react";
import { use, useCallback, useEffect, useState } from "react";
import type {
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
import { MultiSelect } from "~/components/multi-select";
import { Badge } from "~/components/ui/badge";
import type { Button } from "~/components/ui/button";
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

export function MySortBy() {
	const { currentRefinement, options, refine } = useSortBy({
		items: SORT_BY_ITEMS,
	});

	return (
		<Select onValueChange={(value) => refine(value)} value={currentRefinement}>
			<SelectTrigger className="w-auto">
				<SelectValue placeholder="Razvrsti po ..." />
			</SelectTrigger>
			<SelectContent>
				{options.map((option) => (
					<SelectItem key={option.value} value={option.value}>
						{option.label}
					</SelectItem>
				))}
			</SelectContent>
		</Select>
	);
}

export function MySearchBox2(props: UseSearchBoxProps) {
	const { query, refine: search_refine } = useSearchBox(props);
	const [inputValue, setInputValue] = useState(query);
	const { refine: sort_refine } = useSortBy({ items: SORT_BY_ITEMS });

	// Keeps the input in sync with `query` changes this component didn't
	// cause itself — e.g. the active-filter chip's "clear search" button,
	// which calls useSearchBox().clear() from outside this component.
	useEffect(() => {
		setInputValue(query);
	}, [query]);

	const setQuery = useCallback(
		(new_query: string) => {
			sort_refine(
				new_query.trim() === ""
					? DEFAULT_REFINEMENT
					: ALGOLIA_PUBLISHED_ARTICLE_INDEX,
			);
			setInputValue(new_query);
			search_refine(new_query);
		},
		[search_refine, sort_refine],
	);

	return (
		<Input
			className="w-full sm:flex-1"
			placeholder="Iskanje"
			value={inputValue}
			onChange={(e) => setQuery(e.target.value)}
			autoComplete="off"
			autoCorrect="off"
			autoCapitalize="off"
			spellCheck={false}
			maxLength={512}
		/>
	);
}

export function MyStats({ loaded_count }: { loaded_count: number }) {
	const stats = useStats();

	return (
		<p className="text-sm text-muted-foreground">
			Prikazanih {loaded_count} od {stats.nbHits} novic
		</p>
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
	const all_authors = use(AllAuthorsContext);

	const options = refinement_list.items
		.map((item) => ({
			value: item.value,
			label: `${
				all_authors.find((author) => author.id === Number(item.value))?.name ??
				item.value
			} (${item.count})`,
		}))
		.sort((a, b) => a.label.localeCompare(b.label, "sl"));

	const selected_values = refinement_list.items
		.filter((item) => item.isRefined)
		.map((item) => item.value);

	return (
		<MultiSelect
			className="w-55"
			hideClearButton
			options={options}
			defaultValue={selected_values}
			placeholder="Vsi avtorji"
			onValueChange={(new_values) => {
				const toggled_values = selected_values
					.filter((value) => !new_values.includes(value))
					.concat(
						new_values.filter((value) => !selected_values.includes(value)),
					);

				for (const value of toggled_values) refinement_list.refine(value);
			}}
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

export function ActiveFilterChips() {
	const { query, clear: clear_search } = useSearchBox();
	const author_refinement = useRefinementList({
		attribute: "author_ids",
		limit: 100,
	});
	const clear_refinements = useClearRefinements();
	const { refine: sort_refine } = useSortBy({ items: SORT_BY_ITEMS });
	const all_authors = use(AllAuthorsContext);

	const has_query = query.trim() !== "";
	const selected_authors = author_refinement.items.filter(
		(item) => item.isRefined,
	);

	if (!has_query && !clear_refinements.canRefine) return null;

	return (
		<div className="flex flex-wrap items-center gap-2">
			{has_query && (
				<Badge
					variant="secondary"
					className="cursor-pointer gap-1 text-sm"
					onClick={() => clear_search()}
				>
					{query}
					<XIcon className="size-3.5" />
				</Badge>
			)}
			{selected_authors.map((item) => (
				<Badge
					key={item.value}
					variant="secondary"
					className="cursor-pointer gap-1 text-sm"
					onClick={() => author_refinement.refine(item.value)}
				>
					{all_authors.find((author) => author.id === Number(item.value))
						?.name ?? item.value}
					<XIcon className="size-3.5" />
				</Badge>
			))}
			<Badge
				variant="outline"
				className="cursor-pointer gap-1 text-sm"
				onClick={() => {
					clear_refinements.refine();
					clear_search();
					sort_refine(DEFAULT_REFINEMENT);
				}}
			>
				Počisti vse
				<XIcon className="size-3.5" />
			</Badge>
		</div>
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
