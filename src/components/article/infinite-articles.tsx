"use client";

import { useCallback, useEffect, useMemo } from "react";
import { api } from "~/trpc/react";
import { useIntersectionObserver } from "usehooks-ts";
import { article_grid_variants } from "~/lib/page-variants";
import { PublishedArticleDrizzleCard } from "./card-adapter";
import { InfoCard } from "../info-card";

export type IntersectionRef = ReturnType<typeof useIntersectionObserver>["ref"];
const ARTICLE_LOAD_MORE_OFFSET = 9;

export function InfiniteArticles() {
  const [{ pages }, article_api] =
    api.article.get_infinite_published.useSuspenseInfiniteQuery(
      {
        limit: 6 * 5,
      },
      {
        maxPages: 100,
        getNextPageParam: (lastPage) => lastPage.next_cursor,
        getPreviousPageParam: (firstPage) => firstPage.next_cursor,
      },
    );

  const { isIntersecting, ref } = useIntersectionObserver({
    threshold: 0,
  });

  const articles = useMemo(() => pages.flatMap((page) => page.data), [pages]);

  const load_more_ref = useCallback(
    (index: number) => {
      const ref_index = articles.length - 1 - ARTICLE_LOAD_MORE_OFFSET;
      return index === Math.max(ref_index, 0) ? ref : undefined;
    },
    [articles, ref],
  );

  useEffect(() => {
    if (isIntersecting) {
      void article_api.fetchNextPage();
    }
  }, [isIntersecting, article_api]);

  if (articles.length === 0) {
    return (
      <InfoCard
        title="Ni mogoče naložiti novičk."
        description="Preverite internetno povezavo."
      />
    );
  }

  return (
    /* prose-h3:my-0 prose-p:mt-0 lg:prose-xl prose-p:text-lg mx-auto   */
    <div className={article_grid_variants()}>
      {articles.map((article, index) => (
        <PublishedArticleDrizzleCard
          key={article.id}
          featured={index === 0}
          article={article}
          ref={load_more_ref(index)}
        />
      ))}
    </div>
  );
}
