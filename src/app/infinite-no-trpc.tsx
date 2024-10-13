"use client";

import { cn } from "~/lib/utils";
import { article_grid_variants, article_variants } from "~/lib/page-variants";
import type { PublishedArticleWithAuthors } from "~/components/article/adapter";
import { PublishedArticleDrizzleCard } from "~/components/article/adapter";
import { get_infinite_published2 } from "./infinite-server";
// import type { QueryFunctionContext } from "@tanstack/react-query";
import { useInfiniteQuery } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { Fragment, useEffect } from "react";
import { useIntersectionObserver } from "usehooks-ts";

export type IntersectionRef = ReturnType<typeof useIntersectionObserver>["ref"];
export function InfiniteArticles({
  description,
  duplicate_urls,
}: {
  description: (article: PublishedArticleWithAuthors) => ReactNode;
  duplicate_urls?: string[];
}) {
  /* const test = async ({
    pageParam,
  }: QueryFunctionContext<string[], Date | undefined>) => {
    return get_infinite_published2({ pageParam, limit: 60 });
  }; */

  const infinite_published = useInfiniteQuery({
    queryKey: ["infinite_published"],
    // queryFn: test,
    queryFn: ({ pageParam }) =>
      get_infinite_published2({ pageParam, limit: 60 }),
    initialPageParam: undefined as Date | undefined,
    getNextPageParam: (lastPage) => lastPage.next_cursor,
    // getPreviousPageParam: (firstPage) => firstPage.prev_cursor,
    // maxPages: 2,
  });

  /* const [first_observer_ref, is_first_intersecting] = useIntersectionObserver({
    threshold: 0,
  }); */

  const [last_observer_ref, is_last_intersecting] = useIntersectionObserver({
    threshold: 0,
  });

  useEffect(() => {
    /* if (is_first_intersecting && infinite_published.hasPreviousPage)
      void infinite_published.fetchPreviousPage(); */

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
        <Fragment key={group_index}>
          {group.data.map((article, index) => {
            let ref = undefined;
            /* if (group_index === 0 && index === 0) {
              ref = first_observer_ref;
            } else  */
            if (
              group_index === infinite_published.data.pages.length - 1 &&
              index === group.data.length - 10
            ) {
              ref = last_observer_ref;
            }

            return (
              <PublishedArticleDrizzleCard
                key={article.id}
                featured={group_index === 0 && index === 0}
                article={article}
                ref={ref}
                // description={<p>test</p>}
                description={description(article)}
                duplicate_urls={duplicate_urls}
              />
            );
          })}
        </Fragment>
      ))}
    </div>
  );
}
