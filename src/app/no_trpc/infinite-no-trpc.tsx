"use client";

import { cn } from "~/lib/utils";
import { article_grid_variants, article_variants } from "~/lib/page-variants";
import { PublishedArticleDrizzleCard } from "~/components/article/adapter";
import { get_infinite_published2 } from "./infinite-server";
import { useInfiniteQuery } from "@tanstack/react-query";
import { Fragment, useEffect } from "react";
import { Button } from "~/components/ui/button";

export function InfiniteArticles() {
  const infinite_published = useInfiniteQuery({
    queryKey: ["infinite_published"],
    queryFn: get_infinite_published2,
    initialPageParam: null as number | null,
    getNextPageParam: (lastPage) => {
      console.log("lastPage", lastPage);
      return lastPage.next_cursor?.getTime();
    },
  });

  useEffect(() => {
    console.log("infinite_published", infinite_published.data);
  }, [infinite_published]);

  return (
    /* prose-h3:my-0 prose-p:mt-0 lg:prose-xl prose-p:text-lg mx-auto   */
    <div
      className={cn(
        article_grid_variants(),
        article_variants({ variant: "card" }),
      )}
    >
      {infinite_published.data?.pages.map((group, group_index) => (
        <Fragment key={group_index}>
          {group.data.map((article, index) => (
            <PublishedArticleDrizzleCard
              key={article.id}
              featured={index === 0}
              article={article}
            />
          ))}
        </Fragment>
      ))}
      <Button
        onClick={async () => {
          const new_data = await infinite_published.fetchNextPage();
          console.log("loaded more", new_data);
        }}
      >
        Load more
      </Button>
    </div>
  );
}
