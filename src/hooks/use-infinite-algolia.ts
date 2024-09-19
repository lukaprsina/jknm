import { useIntersectionObserver } from "usehooks-ts";
import { useCallback, useEffect } from "react";
import { type InfiniteHitsProps, useInfiniteHits } from "react-instantsearch";
import type { PublishedArticleHit } from "~/lib/validators";

export function useInfiniteAlgoliaArticles({
  offset,
  ...props
}: {
  offset?: number;
} & InfiniteHitsProps<PublishedArticleHit>) {
  const { items, isLastPage, showMore } = useInfiniteHits(props);
  const { isIntersecting, ref } = useIntersectionObserver({
    threshold: 0,
  });

  const load_more_ref = useCallback(
    (index: number) => {
      const offset_not_null = offset ?? 0;
      const ref_index = items.length - 1 - offset_not_null;
      return index === Math.max(ref_index, 0) ? ref : undefined;
    },
    [items, ref],
  );

  useEffect(() => {
    if (isIntersecting && !isLastPage) {
      showMore();
    }
  }, [isIntersecting, isLastPage, showMore]);

  return { load_more_ref, items };
}
