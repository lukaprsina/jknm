/**
 * One-off migration of legacy `published_article`/`draft_article` rows into
 * the unified `articles` table + immutable `media` model + `article_slugs`
 * (issue #22). Per-article, own transaction, resumable via the
 * `articles.legacy_id` unique constraint — safe to re-run (full or
 * `--article-id`) after a partial run.
 *
 * Usage:
 *   bun run scripts/migrate-legacy-articles.ts
 *   bun run scripts/migrate-legacy-articles.ts --article-id=123
 *
 * `--article-id` takes a `published_article.id` (an integer — the new
 * `articles.id` uuid doesn't exist until after migration).
 */
import { algoliasearch as searchClient } from "algoliasearch";
import { asc, eq, isNull } from "drizzle-orm";
import fs from "node:fs/promises";
import path from "node:path";
import { parseArgs } from "node:util";
import { env } from "~/env";
import {
	ALGOLIA_PUBLISHED_ARTICLE_INDEX,
	convert_new_article_to_algolia_object,
} from "~/lib/algoliasearch";
import { assert_one } from "~/lib/assert-length";
import { find_article_with_relations } from "~/server/article/article-queries";
import { reconcile_media_to_articles } from "~/server/article/reconcile-media";
import { type DbTransaction, db } from "~/server/db";
import {
	Article,
	ArticlesToAuthors,
	DraftArticle,
	type Media,
	PublishedArticle,
	PublishedArticlesToAuthors,
} from "~/server/db/schema";
import {
	build_draft_article_values,
	build_published_article_values,
	legacy_id_for_draft,
	legacy_id_for_published,
	resolve_legacy_thumbnail,
	rewrite_media_urls_in_content,
} from "./migrate-legacy-articles-transform";
import { collect_legacy_media_urls, migrate_legacy_media } from "./migrate-legacy-media";
import { ensure_legacy_slug_available, insert_primary_slug } from "./migrate-legacy-slug";

const FAILURES_LOG_PATH = path.join(
	import.meta.dirname,
	"migrate-legacy-articles-failures.json",
);

interface Failure {
	legacy_id: number;
	kind: "published" | "draft";
	error: string;
}

async function already_migrated(legacy_id: number) {
	const existing = await db.query.Article.findFirst({
		where: eq(Article.legacy_id, legacy_id),
		columns: { id: true },
	});
	return Boolean(existing);
}

/** Old-url -> new-url / new-media-id maps derived from a media migration pass. */
function build_url_maps(url_to_media: Map<string, typeof Media.$inferSelect>) {
	const url_to_new_url = new Map<string, string>();
	const url_to_media_id = new Map<string, string>();
	for (const [old_url, media] of url_to_media) {
		url_to_new_url.set(old_url, media.original.url);
		url_to_media_id.set(old_url, media.id);
	}
	return { url_to_new_url, url_to_media_id };
}

/**
 * Insert-only author links for a freshly-migrated article (unlike the
 * editor's `replace_article_authors` in `new-article.ts`, there's nothing to
 * delete — this row was just created).
 */
async function insert_article_authors(
	tx: DbTransaction,
	article_id: string,
	author_ids: number[],
) {
	if (author_ids.length === 0) return;
	await tx.insert(ArticlesToAuthors).values(
		author_ids.map((author_id, index) => ({ article_id, author_id, order: index })),
	);
}

async function push_to_algolia(tx: DbTransaction, article_id: string) {
	const article = await find_article_with_relations(tx, eq(Article.id, article_id));
	if (!article) throw new Error(`Migrated article ${article_id} not found after insert`);
	const primary_slug = article.article_slugs.find((s) => s.is_primary);
	if (!primary_slug) throw new Error(`Migrated article ${article_id} has no primary slug`);

	const algolia = searchClient(env.NEXT_PUBLIC_ALGOLIA_ID, env.ALGOLIA_ADMIN_KEY);
	await algolia.addOrUpdateObject({
		indexName: ALGOLIA_PUBLISHED_ARTICLE_INDEX,
		objectID: article.id,
		body: convert_new_article_to_algolia_object({
			article,
			slug: primary_slug.slug,
			authors: article.articles_to_authors,
			thumbnail_media: article.thumbnail_media,
		}),
	});

	// `legacy_id` is the old `published_article.id` for published-derived rows
	// (negative for draft-derived rows, which never had an Algolia entry in
	// the first place). Retire the old numeric-objectID entry so the article
	// isn't duplicated in search under both ids (#23) — a no-op if it's
	// already gone (fresh run after a full-index wipe, or a re-run).
	if (article.legacy_id !== null && article.legacy_id > 0) {
		await algolia.deleteObject({
			indexName: ALGOLIA_PUBLISHED_ARTICLE_INDEX,
			objectID: String(article.legacy_id),
		});
	}
}

/**
 * Migrates one `published_article` row (and its in-progress `draft_article`,
 * if any) inside a single transaction. Media referenced by either the
 * published content or the draft content/thumbnail is migrated once and
 * shared between them.
 *
 * `reindex_existing` re-pushes an already-migrated published row to Algolia
 * instead of skipping it outright — needed on a full run, which wipes the
 * index up front (see `main`): without this, resuming a full run after a
 * partial one would permanently drop the already-migrated articles from
 * search, since they'd be skipped here (already migrated in the DB) but were
 * just wiped from the index.
 */
async function migrate_published_article(
	published_id: number,
	reindex_existing: boolean,
) {
	const legacy_id = legacy_id_for_published(published_id);
	const existing = await db.query.Article.findFirst({
		where: eq(Article.legacy_id, legacy_id),
		columns: { id: true, status: true },
	});
	if (existing) {
		if (reindex_existing && existing.status === "published") {
			await db.transaction((tx) => push_to_algolia(tx, existing.id));
		}
		return;
	}

	await db.transaction(async (tx) => {
		const published = await tx.query.PublishedArticle.findFirst({
			where: eq(PublishedArticle.id, published_id),
			with: {
				published_articles_to_authors: {
					orderBy: asc(PublishedArticlesToAuthors.order),
				},
			},
		});
		if (!published) throw new Error(`published_article ${published_id} not found`);

		const draft = await tx.query.DraftArticle.findFirst({
			where: eq(DraftArticle.published_id, published_id),
			with: { draft_articles_to_authors: true },
		});

		const legacy_urls = collect_legacy_media_urls(
			[published.content, draft?.content],
			[published.thumbnail_crop, draft?.thumbnail_crop],
		);
		const url_to_media = await migrate_legacy_media(tx, legacy_urls);
		const { url_to_new_url, url_to_media_id } = build_url_maps(url_to_media);

		const rewritten_published_content = rewrite_media_urls_in_content(
			published.content,
			url_to_new_url,
		);
		const published_values = build_published_article_values(
			{
				legacy_id: published.id,
				title: published.title,
				content_preview: published.content_preview,
				content: published.content,
				created_at: published.created_at,
				updated_at: published.updated_at,
			},
			rewritten_published_content,
			resolve_legacy_thumbnail(published.thumbnail_crop, url_to_media_id),
		);

		const inserted_published = await tx.insert(Article).values(published_values).returning();
		assert_one(inserted_published);
		const published_row = inserted_published[0];

		await insert_article_authors(
			tx,
			published_row.id,
			published.published_articles_to_authors.map((a) => a.author_id),
		);
		await reconcile_media_to_articles(tx, published_row.id, rewritten_published_content);

		const slug = await ensure_legacy_slug_available(tx, published.url, published.id);
		await insert_primary_slug(tx, published_row.id, slug);

		await push_to_algolia(tx, published_row.id);

		if (draft) {
			const rewritten_draft_content = rewrite_media_urls_in_content(
				draft.content,
				url_to_new_url,
			);
			const draft_values = build_draft_article_values(
				{
					legacy_id: draft.id,
					title: draft.title,
					content_preview: draft.content_preview,
					content: draft.content,
					created_at: draft.created_at,
					updated_at: draft.updated_at,
				},
				rewritten_draft_content,
				resolve_legacy_thumbnail(draft.thumbnail_crop, url_to_media_id),
				published_row.id,
			);

			const inserted_draft = await tx.insert(Article).values(draft_values).returning();
			assert_one(inserted_draft);
			const draft_row = inserted_draft[0];

			await insert_article_authors(
				tx,
				draft_row.id,
				draft.draft_articles_to_authors.map((a) => a.author_id),
			);
			await reconcile_media_to_articles(tx, draft_row.id, rewritten_draft_content);
		}
	});
}

/** Migrates one standalone draft (`draft_article.published_id IS NULL`). */
async function migrate_standalone_draft(draft_id: number) {
	if (await already_migrated(legacy_id_for_draft(draft_id))) return;

	await db.transaction(async (tx) => {
		const draft = await tx.query.DraftArticle.findFirst({
			where: eq(DraftArticle.id, draft_id),
			with: { draft_articles_to_authors: true },
		});
		if (!draft) throw new Error(`draft_article ${draft_id} not found`);

		const legacy_urls = collect_legacy_media_urls([draft.content], [draft.thumbnail_crop]);
		const url_to_media = await migrate_legacy_media(tx, legacy_urls);
		const { url_to_new_url, url_to_media_id } = build_url_maps(url_to_media);

		const rewritten_content = rewrite_media_urls_in_content(draft.content, url_to_new_url);
		const draft_values = build_draft_article_values(
			{
				legacy_id: draft.id,
				title: draft.title,
				content_preview: draft.content_preview,
				content: draft.content,
				created_at: draft.created_at,
				updated_at: draft.updated_at,
			},
			rewritten_content,
			resolve_legacy_thumbnail(draft.thumbnail_crop, url_to_media_id),
			null,
		);

		const inserted_draft = await tx.insert(Article).values(draft_values).returning();
		assert_one(inserted_draft);
		const draft_row = inserted_draft[0];

		await insert_article_authors(
			tx,
			draft_row.id,
			draft.draft_articles_to_authors.map((a) => a.author_id),
		);
		await reconcile_media_to_articles(tx, draft_row.id, rewritten_content);
	});
}

async function try_migrate(
	failures: Failure[],
	kind: Failure["kind"],
	legacy_id: number,
	run: () => Promise<void>,
) {
	try {
		await run();
	} catch (error) {
		console.error(`Failed to migrate ${kind} legacy id ${legacy_id}`, error);
		failures.push({
			legacy_id,
			kind,
			error: error instanceof Error ? error.message : String(error),
		});
	}
}

async function main() {
	const { values } = parseArgs({
		options: { "article-id": { type: "string" } },
	});
	const article_id_filter = values["article-id"]
		? Number.parseInt(values["article-id"], 10)
		: undefined;
	const full_run = article_id_filter === undefined;

	const failures: Failure[] = [];
	let processed = 0;

	if (full_run) {
		// Full run: wipe the index once, then re-push every migrated published
		// article, per #22 ("wipe rather than delete objects one by one").
		const algolia = searchClient(env.NEXT_PUBLIC_ALGOLIA_ID, env.ALGOLIA_ADMIN_KEY);
		await algolia.clearObjects({ indexName: ALGOLIA_PUBLISHED_ARTICLE_INDEX });

		const published_ids = (
			await db.query.PublishedArticle.findMany({ columns: { id: true } })
		).map((row) => row.id);
		for (const id of published_ids) {
			await try_migrate(failures, "published", id, () =>
				migrate_published_article(id, true),
			);
			processed += 1;
		}

		const standalone_drafts = await db.query.DraftArticle.findMany({
			where: isNull(DraftArticle.published_id),
			columns: { id: true },
		});
		for (const draft of standalone_drafts) {
			await try_migrate(failures, "draft", draft.id, () =>
				migrate_standalone_draft(draft.id),
			);
			processed += 1;
		}
	} else {
		// `--article-id` targets one legacy article, which may be a
		// published_article or a standalone draft_article — try both, since
		// the two id spaces are independent serial sequences.
		const article_id = article_id_filter;
		const published = await db.query.PublishedArticle.findFirst({
			where: eq(PublishedArticle.id, article_id),
			columns: { id: true },
		});

		if (published) {
			await try_migrate(failures, "published", article_id, () =>
				migrate_published_article(article_id, false),
			);
		} else {
			const draft = await db.query.DraftArticle.findFirst({
				where: eq(DraftArticle.id, article_id),
				columns: { id: true, published_id: true },
			});
			if (!draft) throw new Error(`No legacy article found with id ${article_id}`);
			if (draft.published_id !== null) {
				throw new Error(
					`draft_article ${article_id} is an in-progress draft of published_article ${draft.published_id} — migrate via that id instead`,
				);
			}
			await try_migrate(failures, "draft", article_id, () =>
				migrate_standalone_draft(article_id),
			);
		}
		processed += 1;
	}

	if (failures.length > 0) {
		await fs.writeFile(FAILURES_LOG_PATH, JSON.stringify(failures, null, 2));
		console.error(`${failures.length} failure(s) logged to ${FAILURES_LOG_PATH}`);
	}

	console.log(`Done. ${processed} legacy article(s) processed.`);
}

main()
	.catch((error) => {
		console.error(error);
		process.exitCode = 1;
	})
	.finally(() => process.exit());
