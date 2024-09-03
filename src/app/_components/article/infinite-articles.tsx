"use client";

import { useEffect } from "react";
import { api } from "~/trpc/react";
import { useIntersectionObserver } from "usehooks-ts";
import { PublishedArticles } from "./published";

export type IntersectionRef = ReturnType<typeof useIntersectionObserver>["ref"];

export function InfiniteArticles() {
  const [{ pages }, article_api] =
    api.article.get_infinite_published.useSuspenseInfiniteQuery(
      {
        limit: 6 * 5,
      },
      {
        // maxPages: 100,
        getNextPageParam: (lastPage) => lastPage.nextCursor,
        getPreviousPageParam: (firstPage) => firstPage.nextCursor,
      },
    );

  const { isIntersecting, ref } = useIntersectionObserver({
    threshold: 0,
  });

  useEffect(() => {
    if (isIntersecting) {
      void article_api.fetchNextPage();
    }
  }, [isIntersecting, article_api]);

  return (
    <PublishedArticles
      featured
      articles={pages.flatMap((page) => page.data)}
      ref={ref}
    />
  );
}
