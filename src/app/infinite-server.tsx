"use server";

import { unstable_cache } from "next/cache";
import type { CacheTag } from "~/lib/cache-policy";
import { revive_cache_dates } from "~/lib/revive-cache-dates";
import { find_published_articles_page } from "~/server/article/article-queries";
import { db } from "~/server/db";

const cachedPublishedPage = unstable_cache(
	async ({
		pageParam,
		limit,
	}: {
		pageParam: Date | undefined;
		limit: number;
	}) => {
		return find_published_articles_page(db, { limit, cursor: pageParam });
	},
	["homepage-feed"],
	{ tags: ["homepage-feed"] satisfies CacheTag[], revalidate: false },
);

export async function get_infinite_published2({
	pageParam,
	limit,
}: {
	pageParam: Date | undefined;
	limit: number;
}) {
	const data = revive_cache_dates(
		await cachedPublishedPage({ pageParam, limit }),
	);

	return {
		data,
		next_cursor: data.at(-1)?.created_at,
	};
}
