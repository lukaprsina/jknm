import { algoliasearch as searchClient } from "algoliasearch";
import { eq } from "drizzle-orm";
import { env } from "~/env";
import {
	ALGOLIA_PUBLISHED_ARTICLE_INDEX,
	convert_new_article_to_algolia_object,
} from "~/lib/algoliasearch";
import { db } from "../db";
import { Article } from "../db/schema";
import { find_article_with_relations } from "./article-queries";
import { add_or_update_algolia, remove_from_algolia } from "./lifecycle";
import { find_primary_slug_or_first } from "./lifecycle-rules";
import {
	type AlgoliaArticleHit,
	type AlgoliaSyncChange,
	compute_algolia_sync_diff,
	type DbArticleSummary,
} from "./sync-algolia-diff";

// Legacy (pre-unification) articles share this index under a numeric
// `objectID` (`legacy_id.toString()`) — this diff only ever concerns the
// unified `articles` table's uuid rows, so anything else is filtered out
// before it ever reaches `compute_algolia_sync_diff`.
const UUID_RE =
	/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function resolve_primary_slug(slugs: { slug: string; is_primary: boolean }[]) {
	// Falls back to any slug: an Algolia record needs *a* URL, and having one
	// that resolves beats having none.
	return find_primary_slug_or_first(slugs);
}

interface AlgoliaHitRecord {
	objectID: string;
	title?: string;
	url?: string;
	updated_at?: number;
	has_thumbnail?: boolean;
	image?: string;
	author_ids?: number[];
}

async function fetch_algolia_published_hits(): Promise<AlgoliaArticleHit[]> {
	const algolia = searchClient(
		env.NEXT_PUBLIC_ALGOLIA_ID,
		env.ALGOLIA_ADMIN_KEY,
	);

	const hits: AlgoliaArticleHit[] = [];
	await algolia.browseObjects({
		indexName: ALGOLIA_PUBLISHED_ARTICLE_INDEX,
		aggregator: (response) => {
			for (const hit of response.hits as AlgoliaHitRecord[]) {
				if (!UUID_RE.test(hit.objectID)) continue;
				hits.push({
					objectID: hit.objectID,
					title: hit.title ?? "",
					url: hit.url ?? "",
					updated_at: hit.updated_at ?? 0,
					has_thumbnail: hit.has_thumbnail ?? false,
					image: hit.image,
					author_ids: hit.author_ids ?? [],
				});
			}
		},
	});

	return hits;
}

async function fetch_db_published_articles(): Promise<DbArticleSummary[]> {
	const articles = await db.query.Article.findMany({
		where: eq(Article.status, "published"),
		with: {
			article_slugs: true,
			thumbnail_media: true,
			articles_to_authors: {
				orderBy: (relation, { asc: order_asc }) => order_asc(relation.order),
			},
		},
	});

	return articles.map((article) => ({
		id: article.id,
		title: article.title,
		url: resolve_primary_slug(article.article_slugs)?.slug ?? "",
		updated_at: article.updated_at.getTime(),
		has_thumbnail: Boolean(article.thumbnail_media),
		image: article.thumbnail_media?.original.url,
		author_ids: article.articles_to_authors.map((rel) => rel.author_id),
	}));
}

/**
 * Read-only: fetches the current Algolia index and the DB's published
 * articles and diffs them, for the admin dialog's sanity-check view. Never
 * writes.
 */
export async function preview_algolia_sync(): Promise<AlgoliaSyncChange[]> {
	const [algolia_hits, db_articles] = await Promise.all([
		fetch_algolia_published_hits(),
		fetch_db_published_articles(),
	]);

	return compute_algolia_sync_diff(algolia_hits, db_articles);
}

/**
 * Re-fetches both sides itself rather than trusting a client-supplied
 * preview (same rationale as `sync_members`), then repairs every reported
 * change: `missing`/`stale` articles are pushed via `add_or_update_algolia`,
 * `orphaned` Algolia hits are removed via `remove_from_algolia`. Both are the
 * same best-effort helpers `publish_article`/`lifecycle.ts` already use, so a
 * single push failing here logs and moves on rather than aborting the batch.
 */
export async function sync_algolia(): Promise<AlgoliaSyncChange[]> {
	const changes = await preview_algolia_sync();

	for (const change of changes) {
		if (change.kind === "orphaned") {
			await remove_from_algolia(change.before.objectID);
			continue;
		}

		const article = await find_article_with_relations(
			db,
			eq(Article.id, change.article.id),
		);
		if (!article) continue;

		const primary_slug = resolve_primary_slug(article.article_slugs);
		if (!primary_slug) continue;

		await add_or_update_algolia(
			convert_new_article_to_algolia_object({
				article,
				slug: primary_slug.slug,
				authors: article.articles_to_authors,
				thumbnail_media: article.thumbnail_media,
			}),
		);
	}

	return changes;
}
