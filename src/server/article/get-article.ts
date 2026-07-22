"use server";

import { eq } from "drizzle-orm";
import { unstable_cache } from "next/cache";
import { cache } from "react";
import type { z } from "zod";
import type { CacheTag } from "~/lib/cache-policy";
import { revive_cache_dates } from "~/lib/revive-cache-dates";
import { db } from "../db";
import { Article, ArticleSlug } from "../db/schema";
import { find_article_with_relations } from "./article-queries";
import { get_article_by_new_id_validator } from "./validators";

// --- Unified `articles` table (#20) ---

export async function get_article_by_new_id(
	input: z.infer<typeof get_article_by_new_id_validator>,
) {
	const validated_input = get_article_by_new_id_validator.safeParse(input);
	if (!validated_input.success) {
		throw new Error(validated_input.error.message);
	}

	return find_article_with_relations(db, eq(Article.id, input.id));
}

/**
 * `/novica/[published_url]` calls the slug lookup twice per request —
 * `generateMetadata` and the page body both need it, and Next runs them in
 * the same request but as separate function invocations (#31 step 3's
 * ISR follow-up). `cache` dedupes that within the request; `unstable_cache`
 * gives it the same cross-request Data Cache the other five sites have, so a
 * publish/archive/unarchive/delete doesn't mean every subsequent reader hits
 * the DB. Not exported directly: `get_new_article_by_slug` below is the
 * public shape, kept undefined-returning and Date-revived like before.
 */
const cachedArticleBySlug = cache(
	unstable_cache(
		async (slug: string) => {
			const slug_row = await db.query.ArticleSlug.findFirst({
				where: eq(ArticleSlug.slug, slug),
				columns: { article_id: true },
			});

			if (!slug_row) return null;

			const article = await find_article_with_relations(
				db,
				eq(Article.id, slug_row.article_id),
			);

			return article ?? null;
		},
		["article-by-slug"],
		{
			tags: ["article"] satisfies CacheTag[],
			// Public read, same reasoning as homepage-feed/authors: the cache
			// earns its keep here, so the window is long and is a safety net
			// rather than the refresh mechanism.
			revalidate: 3600,
		},
	),
);

export async function get_new_article_by_slug(slug: string) {
	const article = await cachedArticleBySlug(slug);
	return article ? revive_cache_dates(article) : undefined;
}
