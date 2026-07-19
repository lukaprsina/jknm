"use client";

import type { Hit as SearchHit } from "instantsearch.js";
import { ChevronDownIcon, ChevronUpIcon } from "lucide-react";
import Link from "next/link";
import type { Session } from "next-auth";
import type { UseInfiniteHitsProps } from "react-instantsearch";
import { useSortBy } from "react-instantsearch";
import { Authors } from "~/components/authors";
import { Button } from "~/components/ui/button";
import {
	Table,
	TableBody,
	TableCell,
	TableFooter,
	TableHead,
	TableHeader,
	TableRow,
} from "~/components/ui/table";
import { useInfiniteAlgoliaArticles } from "~/hooks/use-infinite-algolia";
import { get_published_article_link } from "~/lib/article-utils";
import { format_date_for_human } from "~/lib/format-date";
import type { PublishedArticleHit } from "~/lib/validators";
import type { IntersectionRef } from "../infinite-no-trpc";
import { MyStats, SORT_BY_ITEMS } from "./components";

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
		<Table>
			{/* <TableCaption>Novice.</TableCaption> */}
			<TableHeader>
				<TableRow>
					<TableHead>ID</TableHead>
					<TableHead>
						<Button
							variant="ghost"
							onClick={() => {
								sort_api.refine(
									sort_api.currentRefinement === "published_article_title_desc"
										? "published_article_title_asc"
										: "published_article_title_desc",
								);
							}}
						>
							Naslov
							{sort_api.currentRefinement ===
								"published_article_title_desc" && <ChevronDownIcon />}
							{sort_api.currentRefinement === "published_article_title_asc" && (
								<ChevronUpIcon />
							)}
						</Button>
					</TableHead>
					<TableHead>
						<Button
							variant="ghost"
							onClick={() => {
								sort_api.refine(
									sort_api.currentRefinement === "published_article_author_desc"
										? "published_article_author_asc"
										: "published_article_author_desc",
								);
							}}
						>
							Avtorji
							{sort_api.currentRefinement ===
								"published_article_author_desc" && <ChevronDownIcon />}
							{sort_api.currentRefinement ===
								"published_article_author_asc" && <ChevronUpIcon />}
						</Button>
					</TableHead>
					<TableHead>
						<Button
							variant="ghost"
							onClick={() => {
								sort_api.refine(
									sort_api.currentRefinement ===
										"published_article_created_at_desc"
										? "published_article_created_at_asc"
										: "published_article_created_at_desc",
								);
							}}
						>
							Datum nastanka
							{sort_api.currentRefinement ===
								"published_article_created_at_desc" && <ChevronDownIcon />}
							{sort_api.currentRefinement ===
								"published_article_created_at_asc" && <ChevronUpIcon />}
						</Button>
					</TableHead>
					<TableHead>
						<Button
							variant="ghost"
							onClick={() => {
								sort_api.refine(
									sort_api.currentRefinement ===
										"published_article_updated_at_desc"
										? "published_article_updated_at_asc"
										: "published_article_updated_at_desc",
								);
							}}
						>
							Zadnje posodobljeno
							{sort_api.currentRefinement ===
								"published_article_updated_at_desc" && <ChevronDownIcon />}
							{sort_api.currentRefinement ===
								"published_article_updated_at_asc" && <ChevronUpIcon />}
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
			<TableFooter>
				<TableRow>
					<TableCell colSpan={4}></TableCell>
					<TableCell className="text-right">
						<MyStats />
					</TableCell>
				</TableRow>
			</TableFooter>
		</Table>
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
			<TableCell>{hit.objectID}</TableCell>
			<TableCell className="font-medium">
				<Button variant="link" asChild>
					<Link href={get_published_article_link(hit.url)}>{hit.title}</Link>
				</Button>
			</TableCell>
			<TableCell>
				<Authors author_ids={hit.author_ids} />
			</TableCell>
			<TableCell>{format_date_for_human(new Date(hit.created_at))}</TableCell>
			<TableCell>{format_date_for_human(new Date(hit.updated_at))}</TableCell>
		</TableRow>
	);
}
