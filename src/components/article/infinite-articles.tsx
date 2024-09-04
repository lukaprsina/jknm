"use client";

import { useCallback, useEffect, useMemo } from "react";
import { api } from "~/trpc/react";
import { useIntersectionObserver } from "usehooks-ts";
import { cn } from "~/lib/utils";
import { article_variants } from "~/lib/page-variants";
import { ArticleDrizzleCard } from "./article-card-adapter";
import { ErrorCard } from "../error-card";
import { Test } from "./test";

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
        getNextPageParam: (lastPage) => lastPage.last_token,
        getPreviousPageParam: (firstPage) => firstPage.last_token,
      },
    );

  const { isIntersecting, ref } = useIntersectionObserver({
    threshold: 0,
  });

  const articles = useMemo(() => pages.flatMap((page) => page.data), [pages]);

  const load_more_ref = useCallback(
    (index: number) => {
      if (!articles) return;

      const test = articles.length - 1 - ARTICLE_LOAD_MORE_OFFSET;
      return index === Math.max(test, 0) ? ref : undefined;
    },
    [articles, ref],
  );

  useEffect(() => {
    if (isIntersecting) {
      void article_api.fetchNextPage();
    }
  }, [isIntersecting, article_api]);

  return (
    <>
      <Test />
      {articles && articles.length !== 0 ? (
        /* prose-h3:my-0 prose-p:mt-0 lg:prose-xl prose-p:text-lg mx-auto   */
        <div
          className={cn(
            article_variants({ variant: "card" }),
            "container grid w-full grid-cols-1 gap-6 px-4 py-8 md:grid-cols-2 md:px-6 lg:grid-cols-3 lg:px-8",
          )}
        >
          {articles.map((article, index) => (
            <ArticleDrizzleCard
              key={article.id}
              featured={index === 0}
              article={article}
              ref={load_more_ref(index)}
            />
          ))}
        </div>
      ) : (
        <ErrorCard
          title="Ni mogoče naložiti novičk."
          description="Preverite internetno povezavo."
        />
      )}
    </>
  );
}
