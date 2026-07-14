"use server";

import { algoliasearch as searchClient } from "algoliasearch";
import { and, asc, eq, sql } from "drizzle-orm";
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
import { db } from "../db";
import {
	Article,
	ArticleSlug,
	ArticlesToAuthors,
	Media,
} from "../db/schema";
import { reconcile_media_to_articles } from "./reconcile-media";
import {
	create_article_validator,
	publish_article_validator,
	save_article_validator,
} from "./validators";

type DbTransaction = Parameters<Parameters<typeof db.transaction>[0]>[0];

const MAX_SLUG_SUFFIX = 99;

/**
 * Generate a slug that doesn't collide with an existing `article_slugs` row:
 * `base`, then `base-2` .. `base-99`, then a timestamp-suffixed fallback.
 * Runs inside the publish transaction to avoid a race.
 */
async function generate_unique_article_slug(tx: DbTransaction, title: string) {
	const base = convert_title_to_url(title);

	for (let suffix = 1; suffix <= MAX_SLUG_SUFFIX; suffix += 1) {
		const candidate = suffix === 1 ? base : `${base}-${suffix}`;
		const existing = await tx.query.ArticleSlug.findFirst({
			where: eq(ArticleSlug.slug, candidate),
			columns: { id: true },
		});
		if (!existing) return candidate;
	}

	return `${base}-${Date.now()}`;
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
		await reconcile_media_to_articles(
			tx,
			input.article_id,
			input.article.content,
		);

		return get_article_with_relations(tx, input.article_id);
	});

	revalidateTag("drafts", "max");
	revalidatePath("/");
	return transaction;
}

/**
 * First publish of a draft on the unified `articles` table (#20): flip status
 * to `published`, assign a primary slug, reconcile media/authors, and push to
 * Algolia. Supersede/republish is out of scope (#21).
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
			columns: { id: true, published_at: true },
		});
		if (!existing) throw new Error("Article not found");

		const thumbnail = await resolve_thumbnail(tx, input.article.thumbnail_crop);

		await tx
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
			.where(eq(Article.id, input.article_id));

		await replace_article_authors(tx, input.article_id, input.author_ids);
		await reconcile_media_to_articles(
			tx,
			input.article_id,
			input.article.content,
		);

		// Reuse an existing primary slug if present, otherwise mint one.
		let primary = await tx.query.ArticleSlug.findFirst({
			where: and(
				eq(ArticleSlug.article_id, input.article_id),
				eq(ArticleSlug.is_primary, true),
			),
		});

		if (!primary) {
			const slug = await generate_unique_article_slug(tx, input.article.title);
			const inserted = await tx
				.insert(ArticleSlug)
				.values({
					slug,
					article_id: input.article_id,
					is_primary: true,
				})
				.returning();
			assert_one(inserted);
			primary = inserted[0];
		}

		const article = await get_article_with_relations(tx, input.article_id);
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
	revalidatePath("/");
	return transaction;
}

function get_article_with_relations(tx: DbTransaction, article_id: string) {
	return tx.query.Article.findFirst({
		where: eq(Article.id, article_id),
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
