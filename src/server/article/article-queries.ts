import { asc, desc, eq, notInArray, type SQL } from "drizzle-orm";
import { withCursorPagination } from "~/lib/drizzle-pagination";
import type { DbTransaction, db } from "../db";
import { Article, ArticlesToAuthors } from "../db/schema";

/** Authors (ordered), slugs, and thumbnail media — the relations every article list/detail read path needs. */
const ARTICLE_LIST_RELATIONS = {
	articles_to_authors: {
		with: { author: true },
		orderBy: asc(ArticlesToAuthors.order),
	},
	article_slugs: true,
	thumbnail_media: true,
} as const;

/**
 * Fetch a unified `articles` row with the relations the editor and read paths
 * need. Works against either the `db` handle or an open transaction.
 */
export function find_article_with_relations(
	executor: typeof db | DbTransaction,
	where: SQL,
) {
	return executor.query.Article.findFirst({
		where,
		with: ARTICLE_LIST_RELATIONS,
	});
}

/**
 * One cursor-paginated page of published articles, newest first, with the
 * relations the homepage feed card needs.
 */
export function find_published_articles_page(
	executor: typeof db | DbTransaction,
	{ limit, cursor }: { limit: number; cursor?: Date },
) {
	return executor.query.Article.findMany({
		with: ARTICLE_LIST_RELATIONS,
		...withCursorPagination({
			limit,
			where: eq(Article.status, "published"),
			cursors: [[Article.created_at, "desc", cursor]],
		}),
	});
}

/** Every `draft`-status article, most recently updated first, for the homepage drafts accordion. */
export function find_draft_articles(executor: typeof db | DbTransaction) {
	return executor.query.Article.findMany({
		where: eq(Article.status, "draft"),
		with: ARTICLE_LIST_RELATIONS,
		orderBy: desc(Article.updated_at),
	});
}

/**
 * `id`/`legacy_id` projection for the `/preveri` verification set — every
 * article that has (or could have) actually been public, excluding
 * still-in-progress drafts and deleted rows, mirroring the legacy
 * `published_article`-only set this replaces.
 */
export function find_articles_for_verification(executor: typeof db | DbTransaction) {
	return executor.query.Article.findMany({
		columns: { id: true, legacy_id: true },
		where: notInArray(Article.status, ["draft", "deleted"]),
		orderBy: asc(Article.legacy_id),
	});
}
