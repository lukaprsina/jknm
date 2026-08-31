"use client";

import { useInfiniteQuery } from "@tanstack/react-query";
import { Fragment, useEffect } from "react";
import { useIntersectionObserver } from "usehooks-ts";
import { NewPublishedArticleCard } from "~/components/article/new-card";
import { Sponsors } from "~/components/shell/sponsors";
import { article_grid_variants, article_variants } from "~/lib/page-variants";
import { cn } from "~/lib/utils";
import { publishedFeedQueryOptions } from "./published-feed-query";

export type IntersectionRef = ReturnType<typeof useIntersectionObserver>["ref"];
export function InfiniteArticles() {
	const infinite_published = useInfiniteQuery(publishedFeedQueryOptions());

	const [last_observer_ref, is_last_intersecting] = useIntersectionObserver({
		threshold: 0,
	});

	useEffect(() => {
		if (is_last_intersecting && infinite_published.hasNextPage)
			void infinite_published.fetchNextPage();
	}, [infinite_published, is_last_intersecting]);

	return (
		<div
			className={cn(
				article_grid_variants(),
				article_variants({ variant: "card" }),
			)}
		>
			{infinite_published.data?.pages.map((group, group_index) => (
				// biome-ignore lint/suspicious/noArrayIndexKey: pages are append-only, never reordered
				<Fragment key={group_index}>
					{group.data.map((article, index) => {
						let ref: IntersectionRef | undefined;
						if (
							group_index === infinite_published.data.pages.length - 1 &&
							index === group.data.length - 10
						) {
							ref = last_observer_ref;
						}

						return (
							<Fragment key={article.id}>
								<NewPublishedArticleCard
									featured={group_index === 0 && index === 0}
									article={article}
									ref={ref}
								/>
								{group_index === 0 && index === 0 && (
									<div className="hidden md:block md:col-span-full">
										<Sponsors />
									</div>
								)}
							</Fragment>
						);
					})}
				</Fragment>
			))}
		</div>
	);
}
