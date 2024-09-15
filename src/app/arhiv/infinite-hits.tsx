import React, { useCallback, useEffect } from "react";
import type { InfiniteHitsProps } from "react-instantsearch";
import { Highlight, useInfiniteHits, Snippet } from "react-instantsearch";
import type { PublishedArticleHit } from "~/lib/validators";
import { useIntersectionObserver } from "usehooks-ts";
import { ArticleAlgoliaCard } from "~/components/article/card-adapter";
import { cn } from "~/lib/utils";
import { article_grid_variants, article_variants } from "~/lib/page-variants";

const ARTICLE_LOAD_MORE_OFFSET = 9;
export function MyInfiniteHits(props: InfiniteHitsProps<PublishedArticleHit>) {
  const { items, isLastPage, showMore, } = useInfiniteHits(props);
  const { isIntersecting, ref } = useIntersectionObserver({
    threshold: 0,
  });

  const load_more_ref = useCallback(
    (index: number) => {
      const ref_index = items.length - 1 - ARTICLE_LOAD_MORE_OFFSET;
      return index === Math.max(ref_index, 0) ? ref : undefined;
    },
    [items, ref],
  );

  useEffect(() => {
    if (isIntersecting && !isLastPage) {
      showMore()
    }
  }, [isIntersecting, isLastPage, showMore]);

  return (
    <div /* className="ais-InfiniteHits" */>
      {/* "ais-InfiniteHits-list" */}
      <ul className={cn(article_grid_variants(), article_variants({ variant: "card" }))}>
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