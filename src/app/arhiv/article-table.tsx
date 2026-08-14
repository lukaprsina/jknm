"use client";

import type { Hit as SearchHit } from "instantsearch.js";
import { ChevronDownIcon, ChevronUpIcon } from "lucide-react";
import Link from "next/link";
import type { UseInfiniteHitsProps } from "react-instantsearch";
import { useSortBy } from "react-instantsearch";
import { Authors } from "~/components/authors";
import { Button } from "~/components/ui/button";
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "~/components/ui/table";
import { useInfiniteAlgoliaArticles } from "~/hooks/use-infinite-algolia";
import { get_published_article_link } from "~/lib/article-utils";
import { format_author_sort_name } from "~/lib/author-name";
import { format_date_for_human } from "~/lib/format-date";
import type { PublishedArticleHit } from "~/lib/validators";
import type { Session } from "~/server/auth";
import type { IntersectionRef } from "../infinite-articles";
import {
	AUTHOR_ASC,
	AUTHOR_DESC,
	MyStats,
	PUBLISHED_AT_ASC,
	PUBLISHED_AT_DESC,
	SORT_BY_ITEMS,
	TITLE_ASC,
	TITLE_DESC,
} from "./components";

export function ArticleTable({
	session,
	...props
}: { session: Session | null } & UseInfiniteHitsProps<PublishedArticleHit>) {
	const sort_api = useSortBy({
		items: SORT_BY_ITEMS,
	});

	const { load_more_ref, items } = useInfiniteAlgoliaArticles({
		offset: 20,
		...props,
	});

	return (
		<div>
			<MyStats loaded_count={items.length} />
			<Table className="w-full min-w-lg table-fixed">
				<TableHeader>
					<TableRow>
						<TableHead className="h-9 px-2">
							<Button
								variant="ghost"
								size="sm"
								className="-mx-2"
								onClick={() => {
									sort_api.refine(
										sort_api.currentRefinement === TITLE_ASC
											? TITLE_DESC
											: TITLE_ASC,
									);
								}}
							>
								Naslov
								{sort_api.currentRefinement === TITLE_DESC && (
									<ChevronDownIcon />
								)}
								{sort_api.currentRefinement === TITLE_ASC && <ChevronUpIcon />}
							</Button>
						</TableHead>
						<TableHead className="h-9 w-40 px-2 sm:w-56">
							<Button
								variant="ghost"
								size="sm"
								className="-mx-2"
								onClick={() => {
									sort_api.refine(
										sort_api.currentRefinement === AUTHOR_ASC
											? AUTHOR_DESC
											: AUTHOR_ASC,
									);
								}}
							>
								Avtorji
								{sort_api.currentRefinement === AUTHOR_DESC && (
									<ChevronDownIcon />
								)}
								{sort_api.currentRefinement === AUTHOR_ASC && <ChevronUpIcon />}
							</Button>
						</TableHead>
						<TableHead className="h-9 w-28 px-2 sm:w-40">
							<Button
								variant="ghost"
								size="sm"
								className="-mx-2"
								onClick={() => {
									sort_api.refine(
										sort_api.currentRefinement === PUBLISHED_AT_ASC
											? PUBLISHED_AT_DESC
											: PUBLISHED_AT_ASC,
									);
								}}
							>
								Objavljeno
								{sort_api.currentRefinement === PUBLISHED_AT_DESC && (
									<ChevronDownIcon />
								)}
								{sort_api.currentRefinement === PUBLISHED_AT_ASC && (
									<ChevronUpIcon />
								)}
							</Button>
						</TableHead>
					</TableRow>
				</TableHeader>
				<TableBody>
					{items.map((item, index) => (
						<ArticleTableRow
							hit={item}
							session={session}
							key={item.objectID}
							ref={load_more_ref(index)}
						/>
					))}
				</TableBody>
			</Table>
		</div>
	);
}

function ArticleTableRow({
	ref,
	hit,
	session: _,
}: {
	ref?: IntersectionRef;
	hit: SearchHit<PublishedArticleHit>;
	session: Session | null;
}) {
	return (
		<TableRow ref={ref} key={hit.objectID}>
			<TableCell className="max-w-0 truncate p-2 font-medium">
				<Button variant="link" size="sm" asChild className="h-auto p-0">
					<Link href={get_published_article_link(hit.url)} className="truncate">
						{hit.title}
					</Link>
				</Button>
			</TableCell>
			<TableCell className="truncate p-2">
				<Authors author_ids={hit.author_ids} format={format_author_sort_name} />
			</TableCell>
			<TableCell className="whitespace-nowrap p-2 text-muted-foreground">
				{format_date_for_human(new Date(hit.published_at))}
			</TableCell>
		</TableRow>
	);
}
