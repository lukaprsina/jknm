/**
 * Pure diff between Algolia's published-article index and the DB's current
 * `published` (new-model, uuid-id) articles. No I/O — `sync-algolia.ts`
 * supplies both sides so this stays trivially testable.
 *
 * Legacy articles (numeric `objectID`, migrated from the old table) share the
 * same Algolia index but have no counterpart in this diff — callers must
 * filter Algolia hits to uuid `objectID`s before calling this, and this diff
 * never reports or touches anything else.
 */

export interface AlgoliaArticleHit {
	objectID: string;
	title: string;
	url: string;
	// Undefined for any hit pushed before #37 added the field — those existing
	// news records predate the article/content split and need to be picked up
	// as "stale" below so a resync backfills them, or they'd silently fail the
	// article_kind:article facet filter once faceting is enabled (ADR-0009).
	article_kind: string | undefined;
	updated_at: number;
	has_thumbnail: boolean;
	image: string | undefined;
	author_ids: number[];
}

export interface DbArticleSummary {
	id: string;
	title: string;
	url: string;
	article_kind: string;
	updated_at: number;
	has_thumbnail: boolean;
	image: string | undefined;
	author_ids: number[];
}

export interface ArticleFieldDiff {
	field:
		| "title"
		| "url"
		| "article_kind"
		| "updated_at"
		| "has_thumbnail"
		| "image"
		| "author_ids";
	before: string | null;
	after: string | null;
}

export type AlgoliaSyncChange =
	| { kind: "missing"; article: DbArticleSummary }
	| {
			kind: "stale";
			article: DbArticleSummary;
			before: AlgoliaArticleHit;
			diffs: ArticleFieldDiff[];
	  }
	| { kind: "orphaned"; before: AlgoliaArticleHit };

function to_diff_string(
	value: string | number | boolean | undefined,
): string | null {
	if (value === undefined) return null;
	return String(value);
}

function diff_fields(
	before: AlgoliaArticleHit,
	after: DbArticleSummary,
): ArticleFieldDiff[] {
	const diffs: ArticleFieldDiff[] = [];

	if (before.title !== after.title) {
		diffs.push({ field: "title", before: before.title, after: after.title });
	}
	if (before.url !== after.url) {
		diffs.push({ field: "url", before: before.url, after: after.url });
	}
	if (before.article_kind !== after.article_kind) {
		diffs.push({
			field: "article_kind",
			before: before.article_kind ?? null,
			after: after.article_kind,
		});
	}
	if (before.updated_at !== after.updated_at) {
		diffs.push({
			field: "updated_at",
			before: to_diff_string(before.updated_at),
			after: to_diff_string(after.updated_at),
		});
	}
	if (before.has_thumbnail !== after.has_thumbnail) {
		diffs.push({
			field: "has_thumbnail",
			before: to_diff_string(before.has_thumbnail),
			after: to_diff_string(after.has_thumbnail),
		});
	}
	if (before.image !== after.image) {
		diffs.push({
			field: "image",
			before: to_diff_string(before.image),
			after: to_diff_string(after.image),
		});
	}
	// Order-sensitive: `convert_new_article_to_algolia_object` derives
	// `first_author` from this same array's first element, so a reorder is a
	// real diff, not just a cosmetic one.
	if (before.author_ids.join(",") !== after.author_ids.join(",")) {
		diffs.push({
			field: "author_ids",
			before: before.author_ids.join(", ") || null,
			after: after.author_ids.join(", ") || null,
		});
	}

	return diffs;
}

export function compute_algolia_sync_diff(
	algolia_hits: AlgoliaArticleHit[],
	db_articles: DbArticleSummary[],
): AlgoliaSyncChange[] {
	const algolia_by_id = new Map(algolia_hits.map((hit) => [hit.objectID, hit]));
	const db_ids = new Set(db_articles.map((article) => article.id));
	const changes: AlgoliaSyncChange[] = [];

	for (const article of db_articles) {
		const existing = algolia_by_id.get(article.id);
		if (!existing) {
			changes.push({ kind: "missing", article });
			continue;
		}

		const diffs = diff_fields(existing, article);
		if (diffs.length > 0) {
			changes.push({ kind: "stale", article, before: existing, diffs });
		}
	}

	for (const hit of algolia_hits) {
		if (!db_ids.has(hit.objectID)) {
			changes.push({ kind: "orphaned", before: hit });
		}
	}

	return changes;
}
