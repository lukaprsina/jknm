import React, { useCallback, useEffect } from "react";
import type { InfiniteHitsProps } from "react-instantsearch";
import { useInfiniteHits } from "react-instantsearch";
import type { PublishedArticleHit } from "~/lib/validators";
import { useIntersectionObserver } from "usehooks-ts";
import { ArticleAlgoliaCard } from "~/components/article/card-adapter";
import { cn } from "~/lib/utils";
import { article_grid_variants, article_variants } from "~/lib/page-variants";
import { useInfiniteAlgoliaArticles } from "~/hooks/use-infinite-algolia";

export function MyInfiniteHits(props: InfiniteHitsProps<PublishedArticleHit>) {
  const { load_more_ref, items } = useInfiniteAlgoliaArticles({ offset: 9, ...props });

  return (
    <div /* className="ais-InfiniteHits" */>
      {/* "ais-InfiniteHits-list" */}
      <ul
        className={cn(
          article_grid_variants(),
          article_variants({ variant: "card" }),
        )}
      >
        {items.map((hit, index) => (
          <ArticleAlgoliaCard
            hit={hit}
            key={hit.objectID}
            /* className="ais-InfiniteHits-item"*/
            ref={load_more_ref(index)}
          />
        ))}
      </ul>
    </div>
  );
}
