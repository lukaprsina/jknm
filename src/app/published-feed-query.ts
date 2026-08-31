import { infiniteQueryOptions } from "@tanstack/react-query";
import { PUBLISHED_FEED_QUERY_KEY } from "~/lib/cache-policy";
import { get_infinite_published2 } from "./infinite-server";

// +1 over a multiple of 3: the first item renders full-width (`featured`),
// so the remaining count must land on a clean row boundary at the 3-col
// breakpoint.
const PUBLISHED_FEED_LIMIT = 61;

export function publishedFeedQueryOptions() {
	return infiniteQueryOptions({
		queryKey: PUBLISHED_FEED_QUERY_KEY,
		queryFn: ({ pageParam }: { pageParam: Date | undefined }) =>
			get_infinite_published2({ pageParam, limit: PUBLISHED_FEED_LIMIT }),
		initialPageParam: undefined as Date | undefined,
		getNextPageParam: (lastPage) => lastPage.next_cursor,
	});
}
