"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { api } from "~/trpc/react";
import { useIntersectionObserver } from "usehooks-ts";
import { article_grid_variants, article_variants } from "~/lib/page-variants";
import { PublishedArticleDrizzleCard } from "./card-adapter";
import { InfoCard } from "../info-card";
import { cn } from "~/lib/utils";

export type IntersectionRef = ReturnType<typeof useIntersectionObserver>["ref"];
const ARTICLE_LOAD_MORE_OFFSET = 9;

export function InfiniteArticles() {
  const [firstLoad, setFirstLoad] = useState(true);
  const [test, article_api] =
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

  const pages = test.pages;

  const articles = useMemo(() => {
    return firstLoad
      ? (pages.at(0)?.data ?? [])
      : pages.flatMap((page) => page.data);
  }, [firstLoad, pages]);

  useEffect(() => {
    if (!firstLoad) return;

    // hydration error fix
    setTimeout(() => {
      // console.log("first load false", firstLoad);
      setFirstLoad(false);
    }, 0);
  }, [firstLoad]);

  const load_more_ref = useCallback(
    (index: number) => {
      const ref_index = articles.length - 1 - ARTICLE_LOAD_MORE_OFFSET;
      const is_sentinel = index === Math.max(ref_index, 0);
      // console.log("load more ref", ref_index);
      return is_sentinel ? ref : undefined;
    },
    [articles, ref],
  );

  useEffect(() => {
    if (isIntersecting && !firstLoad && !article_api.isFetching) {
      void article_api.fetchNextPage();
    }
  }, [isIntersecting, article_api, firstLoad]);

  /* useEffect(() => {
    console.log("infinite articles", { articles, test, article_api });
  }, [article_api, articles, test]); */

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
    <div
      className={cn(
        article_grid_variants(),
        article_variants({ variant: "card" }),
      )}
    >
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
