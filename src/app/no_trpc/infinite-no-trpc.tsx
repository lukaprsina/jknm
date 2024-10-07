"use client";

import { cn } from "~/lib/utils";
import { article_grid_variants, article_variants } from "~/lib/page-variants";
import { useEffect, useState } from "react";
import { PublishedArticleDrizzleCard } from "~/components/article/adapter";
import type { PublishedArticleWithAuthors } from "~/components/article/adapter";
import { get_infinite_published } from "./infinite-server";

export function InfiniteArticles() {
  const [articles, setArticles] = useState<PublishedArticleWithAuthors[]>([]);

  useEffect(() => {
    const func = async () => {
      console.log("func");
      const pages = await get_infinite_published({
        limit: 6 * 5,
      });
      setArticles(pages.data);
    };

    void func();
  }, []);

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
        />
      ))}
    </div>
  );
}
