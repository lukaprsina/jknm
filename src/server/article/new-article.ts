"use server";

import { algoliasearch as searchClient } from "algoliasearch";
import { and, eq, sql } from "drizzle-orm";
import { revalidatePath, revalidateTag } from "next/cache";
import type { z } from "zod";
import { env } from "~/env";
import {
	ALGOLIA_PUBLISHED_ARTICLE_INDEX,
	convert_new_article_to_algolia_object,
} from "~/lib/algoliasearch";
import { convert_title_to_url } from "~/lib/article-utils";
import { assert_one } from "~/lib/assert-length";
import type { ThumbnailType } from "~/lib/validators";
import { getServerAuthSession } from "../auth";
import { type DbTransaction, db } from "../db";
import {
	Article,
	ArticleSlug,
	ArticlesToAuthors,
	Media,
	PublishedArticle,
} from "../db/schema";
import { find_article_with_relations } from "./article-queries";
import { remove_from_algolia, soft_delete_article } from "./lifecycle";
import {
	assert_can_supersede,
	decide_slug_transition,
} from "./lifecycle-rules";
import { reconcile_media_to_articles } from "./reconcile-media";
import {
	create_article_validator,
	publish_article_validator,
	save_article_validator,
} from "./validators";

const MAX_SLUG_SUFFIX = 99;

/**
 * Generate a slug that doesn't collide with an existing `article_slugs` row
 * *or* a legacy `published_article.url` (the two live on the same
 * `/novica/<slug>` route, and the legacy table is checked first there — see
 * `page.tsx` — so a new slug that shadows a legacy url would be permanently
 * unreachable): `base`, then `base-2` .. `base-99`, then a timestamp-suffixed
 * fallback. Runs inside the publish transaction to avoid a race.
 */
async function generate_unique_article_slug(tx: DbTransaction, title: string) {
	const base = convert_title_to_url(title);

	for (let suffix = 1; suffix <= MAX_SLUG_SUFFIX; suffix += 1) {
		const candidate = suffix === 1 ? base : `${base}-${suffix}`;
		const [existing_slug, existing_legacy_url] = await Promise.all([
			tx.query.ArticleSlug.findFirst({
				where: eq(ArticleSlug.slug, candidate),
				columns: { id: true },
			}),
			tx.query.PublishedArticle.findFirst({
				where: eq(PublishedArticle.url, candidate),
				columns: { id: true },
			}),
		]);
		if (!existing_slug && !existing_legacy_url) return candidate;
	}

	return `${base}-${Date.now()}`;
}

async function resolve_first_publish_slug(
	tx: DbTransaction,
	article_id: string,
	title: string,
) {
	const existing_primary = await tx.query.ArticleSlug.findFirst({
		where: and(
			eq(ArticleSlug.article_id, article_id),
			eq(ArticleSlug.is_primary, true),
		),
	});
	if (existing_primary) return existing_primary;

	const slug = await generate_unique_article_slug(tx, title);
	const inserted = await tx
		.insert(ArticleSlug)
		.values({ slug, article_id, is_primary: true })
		.returning();
	assert_one(inserted);
	return inserted[0];
}

/**
 * Supersede-publish's slug rule (#21): if the superseded article's title is
 * unchanged, its primary slug is inherited (re-pointed to the newly
 * published row, same slug text). If retitled, a new primary slug is minted
 * for the new row and the old one is demoted to non-primary — kept,
 * resolvable, not deleted. Also retires the superseded row via the shared
 * `soft_delete_article`.
 */
async function resolve_supersede_publish_slug(
	tx: DbTransaction,
	article_id: string,
	supersedes_id: string,
	new_title: string,
) {
	// Lock the superseded row so two concurrent supersede-publishes of the
	// same source (e.g. two superseding drafts opened from the same archived
	// article in separate tabs) serialize instead of racing on its primary
	// slug: the second transaction blocks here until the first commits, then
	// sees `status: "deleted"` and fails `assert_can_supersede` cleanly
	// instead of overwriting the winner's slug re-point.
	const superseded_rows = await tx
		.select({ id: Article.id, title: Article.title, status: Article.status })
		.from(Article)
		.where(eq(Article.id, supersedes_id))
		.for("update");
	const superseded = superseded_rows[0];
	if (!superseded) throw new Error("Superseded article not found");
	assert_can_supersede(superseded.status);

	const old_primary_slug =
		(await tx.query.ArticleSlug.findFirst({
			where: and(
				eq(ArticleSlug.article_id, supersedes_id),
				eq(ArticleSlug.is_primary, true),
			),
		})) ?? null;

	const decision = decide_slug_transition({
		old_title: superseded.title,
		new_title,
		old_primary_slug,
	});

	let primary: typeof ArticleSlug.$inferSelect;

	if (decision.action === "reuse") {
		const updated = await tx
			.update(ArticleSlug)
			.set({ article_id })
			.where(eq(ArticleSlug.id, decision.slug_id))
			.returning();
		assert_one(updated);
		primary = updated[0];
	} else {
		if (decision.action === "mint_new_and_demote") {
			// Re-point to the new (now-published) article, same as `reuse` —
			// the superseded row is about to be soft-deleted (invisible to
			// everyone), so the demoted slug must follow the content to stay
			// "resolvable, not 404ing" as required by #21.
			await tx
				.update(ArticleSlug)
				.set({ is_primary: false, article_id })
				.where(eq(ArticleSlug.id, decision.demote_slug_id));
		}

		const slug = await generate_unique_article_slug(tx, new_title);
		const inserted = await tx
			.insert(ArticleSlug)
			.values({ slug, article_id, is_primary: true })
			.returning();
		assert_one(inserted);
		primary = inserted[0];
	}

	if (superseded.status === "published") {
		await remove_from_algolia(superseded.id);
	}

	await soft_delete_article(tx, supersedes_id);

	return primary;
}

/**
 * Resolve a thumbnail crop (which references a media URL) into the new
 * schema's `thumbnail_media_id` + percentage columns. Media that isn't found
 * (e.g. an external URL) clears the thumbnail.
 */
async function resolve_thumbnail(
	tx: DbTransaction,
	thumbnail_crop: ThumbnailType | undefined,
) {
	const cleared = {
		thumbnail_media_id: null,
		thumbnail_x: null,
		thumbnail_y: null,
		thumbnail_width: null,
		thumbnail_height: null,
	};

	if (!thumbnail_crop) return cleared;

	const media = await tx
		.select({ id: Media.id })
		.from(Media)
		.where(sql`${Media.original}->>'url' = ${thumbnail_crop.image_url}`)
		.limit(1);

	const media_id = media.at(0)?.id;
	if (!media_id) return cleared;

	return {
		thumbnail_media_id: media_id,
		thumbnail_x: thumbnail_crop.x,
		thumbnail_y: thumbnail_crop.y,
		thumbnail_width: thumbnail_crop.width,
		thumbnail_height: thumbnail_crop.height,
	};
}

async function replace_article_authors(
	tx: DbTransaction,
	article_id: string,
	author_ids: number[],
) {
	await tx
		.delete(ArticlesToAuthors)
		.where(eq(ArticlesToAuthors.article_id, article_id));

	if (author_ids.length !== 0) {
		await tx.insert(ArticlesToAuthors).values(
			author_ids.map((author_id, index) => ({
				article_id,
				author_id,
				order: index,
			})),
		);
	}
}

/**
 * Create a fresh draft on the unified `articles` table. This is the new-table
 * equivalent of `create_draft`'s title-only branch — no S3 involvement, media
 * is uploaded separately (#18).
 */
export async function create_article(
	input: z.infer<typeof create_article_validator>,
) {
	const session = await getServerAuthSession();
	if (!session) throw new Error("Unauthorized");

	const validated_input = create_article_validator.safeParse(input);
	if (!validated_input.success) {
		throw new Error(validated_input.error.message);
	}

	const created_articles = await db
		.insert(Article)
		.values({
			title: input.title,
			status: "draft",
			content_json: {
				blocks: [
					{
						id: "sheNwCUP5A",
						type: "header",
						data: {
							text: input.title,
							level: 1,
						},
					},
				],
			},
			created_by: session.user.id,
		})
		.returning();

	assert_one(created_articles);
	const created_article = created_articles[0];

	revalidateTag("drafts", "max");
	revalidatePath("/");
	return created_article;
}

/**
 * Save a draft on the unified `articles` table: update the row, replace its
 * authors, and reconcile `media_to_articles` from the content (#19).
 */
export async function save_article(
	input: z.infer<typeof save_article_validator>,
) {
	const session = await getServerAuthSession();
	if (!session) throw new Error("Unauthorized");

	const validated_input = save_article_validator.safeParse(input);
	if (!validated_input.success) {
		throw new Error(validated_input.error.message);
	}

	const transaction = await db.transaction(async (tx) => {
		const thumbnail = await resolve_thumbnail(tx, input.article.thumbnail_crop);

		const updated = await tx
			.update(Article)
			.set({
				title: input.article.title,
				content_json: input.article.content ?? undefined,
				...(input.article.created_at
					? { created_at: input.article.created_at }
					: {}),
				...thumbnail,
			})
			.where(eq(Article.id, input.article_id))
			.returning();

		assert_one(updated);

		await replace_article_authors(tx, input.article_id, input.author_ids);
		// Reconcile against the *persisted* content, not the input: the update
		// above preserves the stored content when `input.article.content` is
		// omitted, so keying reconcile off the input would wipe every media link
		// on a content-less save.
		await reconcile_media_to_articles(
			tx,
			input.article_id,
			updated[0].content_json,
		);

		return find_article_with_relations(tx, eq(Article.id, input.article_id));
	});

	revalidateTag("drafts", "max");
	revalidatePath("/");
	return transaction;
}

/**
 * Publish a draft on the unified `articles` table: flip status to
 * `published`, assign a primary slug, reconcile media/authors, and push to
 * Algolia. Handles both first-publish (#20, no `supersedes_id`) and
 * supersede-publish (#21, `supersedes_id` set): the latter also retires the
 * superseded row and applies the slug-inherit-or-demote rule — see
 * `resolve_supersede_publish_slug`.
 */
export async function publish_article(
	input: z.infer<typeof publish_article_validator>,
) {
	const session = await getServerAuthSession();
	if (!session) throw new Error("Unauthorized");

	const validated_input = publish_article_validator.safeParse(input);
	if (!validated_input.success) {
		throw new Error(validated_input.error.message);
	}

	const transaction = await db.transaction(async (tx) => {
		const existing = await tx.query.Article.findFirst({
			where: eq(Article.id, input.article_id),
			columns: { id: true, published_at: true, supersedes_id: true },
		});
		if (!existing) throw new Error("Article not found");

		const thumbnail = await resolve_thumbnail(tx, input.article.thumbnail_crop);

		const updated = await tx
			.update(Article)
			.set({
				title: input.article.title,
				content_json: input.article.content ?? undefined,
				status: "published",
				published_at: existing.published_at ?? new Date(),
				...(input.article.created_at
					? { created_at: input.article.created_at }
					: {}),
				...thumbnail,
			})
			.where(eq(Article.id, input.article_id))
			.returning();

		assert_one(updated);

		await replace_article_authors(tx, input.article_id, input.author_ids);
		// Reconcile against the *persisted* content (see `save_article`) so a
		// publish that omits `content` doesn't wipe existing media links.
		await reconcile_media_to_articles(
			tx,
			input.article_id,
			updated[0].content_json,
		);

		const primary = existing.supersedes_id
			? await resolve_supersede_publish_slug(
					tx,
					input.article_id,
					existing.supersedes_id,
					input.article.title,
				)
			: await resolve_first_publish_slug(
					tx,
					input.article_id,
					input.article.title,
				);

		const article = await find_article_with_relations(
			tx,
			eq(Article.id, input.article_id),
		);
		if (!article) throw new Error("Published article not found");

		const algolia = searchClient(
			env.NEXT_PUBLIC_ALGOLIA_ID,
			env.ALGOLIA_ADMIN_KEY,
		);

		await algolia.addOrUpdateObject({
			indexName: ALGOLIA_PUBLISHED_ARTICLE_INDEX,
			objectID: article.id,
			body: convert_new_article_to_algolia_object({
				article,
				slug: primary.slug,
				authors: article.articles_to_authors,
			}),
		});

		return { article, slug: primary.slug };
	});

	revalidateTag("drafts", "max");
	revalidateTag("archive", "max");
	revalidatePath("/");
	return transaction;
}
