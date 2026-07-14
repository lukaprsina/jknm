import { asc, type SQL } from "drizzle-orm";
import type { DbTransaction, db } from "../db";
import { ArticlesToAuthors } from "../db/schema";

/**
 * Fetch a unified `articles` row with the relations the editor and read paths
 * need: authors (ordered), slugs, and thumbnail media. Works against either the
 * `db` handle or an open transaction.
 */
export function find_article_with_relations(
	executor: typeof db | DbTransaction,
	where: SQL,
) {
	return executor.query.Article.findFirst({
		where,
		with: {
			articles_to_authors: {
				with: { author: true },
				orderBy: asc(ArticlesToAuthors.order),
			},
			article_slugs: true,
			thumbnail_media: true,
		},
	});
}
