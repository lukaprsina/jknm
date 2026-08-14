import {
	and,
	asc,
	desc,
	eq,
	max,
	min,
	ne,
	notInArray,
	type SQL,
	sql,
} from "drizzle-orm";
import { withCursorPagination } from "~/lib/drizzle-pagination";
import type { DbTransaction, db } from "../db";
import { Article, ArticlesToAuthors } from "../db/schema";

/**
 * Shared predicate for the 3 EXCLUDE-shaped listing surfaces (ADR-0009):
 * content-kind rows (the 5 fixed club pages) have no natural place in a news
 * listing, a legacy-verification set, or the sitemap's /novica/<slug> loop.
 */
export const EXCLUDE_CONTENT_KIND = ne(Article.article_kind, "content");

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
 * relations the homepage feed card needs. Excludes content-kind rows — a
 * reverse-chronological "latest news" stream has no natural place for a
 * fixed page like "Zgodovina" (ADR-0009).
 */
export function find_published_articles_page(
	executor: typeof db | DbTransaction,
	{ limit, cursor }: { limit: number; cursor?: Date },
) {
	return executor.query.Article.findMany({
		with: ARTICLE_LIST_RELATIONS,
		...withCursorPagination({
			limit,
			where: and(eq(Article.status, "published"), EXCLUDE_CONTENT_KIND),
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
 * Year range of every published article, for the `/arhiv` header —
 * deliberately independent of any Algolia refinement, unlike the page's own
 * "Prikazanih X od Y" line, which does track the active filters.
 */
export async function find_published_articles_year_range(
	executor: typeof db | DbTransaction,
) {
	// A plain aggregate with no GROUP BY always returns exactly one row, even
	// over zero matching articles (NULL min/max).
	const [row] = await executor
		.select({
			min_year: sql<
				number | null
			>`extract(year from ${min(Article.created_at)})::int`,
			max_year: sql<
				number | null
			>`extract(year from ${max(Article.created_at)})::int`,
		})
		.from(Article)
		.where(and(eq(Article.status, "published"), EXCLUDE_CONTENT_KIND));

	// biome-ignore lint/style/noNonNullAssertion: guaranteed by the aggregate shape above
	return row!;
}

/**
 * `id`/`legacy_id` projection for the `/preveri` verification set — every
 * article that has (or could have) actually been public, excluding
 * still-in-progress drafts and deleted rows, mirroring the legacy
 * `published_article`-only set this replaces. Content-kind rows have no
 * legacy counterpart to reconcile against (ADR-0009), so they're excluded
 * too.
 */
export function find_articles_for_verification(
	executor: typeof db | DbTransaction,
) {
	return executor.query.Article.findMany({
		columns: { id: true, legacy_id: true },
		where: and(
			notInArray(Article.status, ["draft", "deleted"]),
			EXCLUDE_CONTENT_KIND,
		),
		orderBy: asc(Article.legacy_id),
	});
}
