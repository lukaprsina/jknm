"use server";

import { memoize } from "nextjs-better-unstable-cache";
import { find_published_articles_page } from "~/server/article/article-queries";
import { db } from "~/server/db";

const cachedPublishedPage = memoize(
	async ({ pageParam, limit }: { pageParam: Date | undefined; limit: number }) => {
		return find_published_articles_page(db, { limit, cursor: pageParam });
	},
	{
		revalidateTags: ["homepage-feed"],
		logid: "homepage-feed",
	},
);

export async function get_infinite_published2({
	pageParam,
	limit,
}: {
	pageParam: Date | undefined;
	limit: number;
}) {
	const data = await cachedPublishedPage({ pageParam, limit });

	return {
		data,
		next_cursor: data.at(-1)?.created_at,
	};
}
