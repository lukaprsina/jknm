import { useCallback, useEffect, useRef } from "react";
import type { InfiniteHitsProps } from "react-instantsearch";
import { useInfiniteHits } from "react-instantsearch";
import { useIntersectionObserver } from "usehooks-ts";
import type { PublishedArticleHit } from "~/lib/validators";

export function useInfiniteAlgoliaArticles({
	offset,
	...props
}: {
	offset?: number;
} & InfiniteHitsProps<PublishedArticleHit>) {
	const { items, isLastPage, showMore } = useInfiniteHits(props);

	// Kept fresh every render so `onChange` (invoked from the observer's own
	// async callback, not from React state) always sees the latest values
	// instead of whatever was current when the observer was set up.
	const latest = useRef({ isLastPage, showMore });
	useEffect(() => {
		latest.current = { isLastPage, showMore };
	}, [isLastPage, showMore]);

	// Driven directly off the observer's callback rather than off the
	// `isIntersecting` value the hook returns: when the sentinel ref moves
	// from one row to the next (on every page load), the old and new nodes'
	// ref-callback calls land in the same React commit and get batched, so
	// the hook's internal state never passes through an intermediate `null`
	// — its `isIntersecting` boolean can get stuck at `true` from the first
	// load and never "change" again even though a new node just started
	// intersecting. Reading the raw entry here sidesteps that state-diffing
	// bailout entirely.
	const { ref } = useIntersectionObserver({
		threshold: 0,
		// Fires well before the sentinel is on-screen so a fast scroll/fling
		// is less likely to skip past it between throttled observer callbacks.
		rootMargin: "500px 0px",
		onChange: (is_intersecting) => {
			if (is_intersecting && !latest.current.isLastPage) {
				latest.current.showMore();
			}
		},
	});

	const load_more_ref = useCallback(
		(index: number) => {
			const offset_not_null = offset ?? 0;
			const ref_index = items.length - 1 - offset_not_null;
			return index === Math.max(ref_index, 0) ? ref : undefined;
		},
		[items.length, offset, ref],
	);

	return { load_more_ref, items };
}
