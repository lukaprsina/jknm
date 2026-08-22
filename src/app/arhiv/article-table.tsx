"use client";

import type { Hit as SearchHit } from "instantsearch.js";
import { ChevronDownIcon, ChevronUpIcon } from "lucide-react";
import Link from "next/link";
import type { UseInfiniteHitsProps } from "react-instantsearch";
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
	TITLE_ASC,
	TITLE_DESC,
	useSearchState,
} from "./components";

export function ArticleTable({
	session,
	...props
}: { session: Session | null } & UseInfiniteHitsProps<PublishedArticleHit>) {
	const { sort, setSort } = useSearchState();

	const { load_more_ref, items } = useInfiniteAlgoliaArticles({
		// Must stay well under Algolia's hitsPerPage (default 20): an offset
		// that reaches or exceeds the page size clamps the sentinel to row 0
		// on the first page instead of a row near the bottom.
		offset: 5,
		...props,
	});

	return (
		<div>
			<MyStats loaded_count={items.length} />
			<Table className="w-full min-w-lg table-fixed">
				<TableHeader>
					<TableRow>
						<TableHead variant="dense">
							<Button
								variant="ghost"
								size="sm"
								className="-mx-3 h-7"
								onClick={() => {
									setSort(sort === TITLE_ASC ? TITLE_DESC : TITLE_ASC);
								}}
							>
								Naslov
								{sort === TITLE_DESC && <ChevronDownIcon />}
								{sort === TITLE_ASC && <ChevronUpIcon />}
							</Button>
						</TableHead>
						<TableHead variant="dense" className="w-40 sm:w-56">
							<Button
								variant="ghost"
								size="sm"
								className="-mx-3 h-7"
								onClick={() => {
									setSort(sort === AUTHOR_ASC ? AUTHOR_DESC : AUTHOR_ASC);
								}}
							>
								Avtorji
								{sort === AUTHOR_DESC && <ChevronDownIcon />}
								{sort === AUTHOR_ASC && <ChevronUpIcon />}
							</Button>
						</TableHead>
						<TableHead variant="dense" className="w-28 text-right sm:w-40">
							<Button
								variant="ghost"
								size="sm"
								className="-mr-3 ml-auto h-7"
								onClick={() => {
									setSort(
										sort === PUBLISHED_AT_ASC
											? PUBLISHED_AT_DESC
											: PUBLISHED_AT_ASC,
									);
								}}
							>
								Objavljeno
								{sort === PUBLISHED_AT_DESC && <ChevronDownIcon />}
								{sort === PUBLISHED_AT_ASC && <ChevronUpIcon />}
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
			<TableCell variant="dense" className="max-w-0 truncate font-medium">
				<Button variant="link" size="sm" asChild className="h-auto p-0">
					<Link href={get_published_article_link(hit.url)} className="truncate">
						{hit.title}
					</Link>
				</Button>
			</TableCell>
			<TableCell variant="dense" className="truncate">
				<Authors author_ids={hit.author_ids} format={format_author_sort_name} />
			</TableCell>
			<TableCell
				variant="dense"
				className="whitespace-nowrap text-right text-muted-foreground"
			>
				{format_date_for_human(new Date(hit.published_at))}
			</TableCell>
		</TableRow>
	);
}
