import React, { useCallback } from "react";

import { article_variants } from "~/lib/page-variants";
import { cn } from "~/lib/utils";
import type { PublishedArticle } from "~/server/db/schema";
import { ErrorCard } from "../error-card";
import type { IntersectionRef } from "./infinite-articles";
import { ArticleDrizzleCard } from "./article-card-adapter";

const ARTICLE_LOAD_MORE_OFFSET = 9;
export const PublishedArticles = ({
  articles,
  featured,
  ref,
}: {
  articles?: (typeof PublishedArticle.$inferSelect)[];
  featured?: boolean;
  ref?: IntersectionRef;
}) => {
  const load_more_ref = useCallback(
    (index: number) => {
      if (!articles) return;

      const test = articles.length - 1 - ARTICLE_LOAD_MORE_OFFSET;
      return index === Math.max(test, 0) ? ref : undefined;
    },
    [articles, ref],
  );

  return (
    <>
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
              featured={index === 0 && featured}
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
};
