"use server";

import type { SQL } from "drizzle-orm";
import { and, asc, between, eq } from "drizzle-orm";
import type { z } from "zod";
import { getServerAuthSession } from "../auth";
import { db } from "../db";
import {
	Article,
	ArticleSlug,
	ArticlesToAuthors,
	DraftArticle,
	PublishedArticle,
	PublishedArticlesToAuthors,
} from "../db/schema";
import {
	get_article_by_draft_id_validator,
	get_article_by_new_id_validator,
	get_article_by_published_id_validator,
	get_article_by_published_url_validator,
} from "./validators";

export async function get_article_by_published_id(
	input: z.infer<typeof get_article_by_published_id_validator>,
) {
	const validated_input =
		get_article_by_published_id_validator.safeParse(input);
	if (!validated_input.success) {
		throw new Error(validated_input.error.message);
	}

	const published = await db.query.PublishedArticle.findFirst({
		where: eq(PublishedArticle.id, input.published_id),
		with: {
			published_articles_to_authors: {
				with: { author: true },
				orderBy: asc(PublishedArticlesToAuthors.order),
			},
		},
	});

	if (!published) return { published };

	const session = await getServerAuthSession();
	if (session) {
		const draft = await db.query.DraftArticle.findFirst({
			where: eq(DraftArticle.published_id, input.published_id),
			with: {
				draft_articles_to_authors: {
					with: { author: true },
					orderBy: asc(PublishedArticlesToAuthors.order),
				},
			},
		});

		return { published, draft };
	}

	return { published };
}

export async function get_article_by_published_url(
	input: z.infer<typeof get_article_by_published_url_validator>,
) {
	const validated_input =
		get_article_by_published_url_validator.safeParse(input);
	if (!validated_input.success) {
		throw new Error(validated_input.error.message);
	}

	const conditions = [eq(PublishedArticle.url, input.url)];

	if (input.created_at) {
		const beggining_of_day = new Date(input.created_at);
		beggining_of_day.setHours(0, 0, 0, 0);
		const end_of_day = new Date(input.created_at);
		end_of_day.setHours(23, 59, 59, 999);

		conditions.push(
			between(PublishedArticle.created_at, beggining_of_day, end_of_day),
		);
	}

	const published = await db.query.PublishedArticle.findFirst({
		where: and(...conditions),
		with: {
			published_articles_to_authors: {
				with: { author: true },
				orderBy: asc(PublishedArticlesToAuthors.order),
			},
		},
	});

	// only send draft when logged in
	const session = await getServerAuthSession();
	if (session && published?.id) {
		const draft = await db.query.DraftArticle.findFirst({
			where: eq(DraftArticle.published_id, published.id),
			with: {
				draft_articles_to_authors: {
					with: {
						author: true,
					},
					orderBy: asc(PublishedArticlesToAuthors.order),
				},
			},
		});

		return { published, draft };
	}

	return { published };
}

export async function get_article_by_draft_id(
	input: z.infer<typeof get_article_by_draft_id_validator>,
) {
	const validated_input = get_article_by_draft_id_validator.safeParse(input);
	if (!validated_input.success) {
		throw new Error(validated_input.error.message);
	}
	const draft = await db.query.DraftArticle.findFirst({
		where: eq(DraftArticle.id, input.draft_id),
		with: {
			draft_articles_to_authors: {
				with: {
					author: true,
				},
				orderBy: asc(PublishedArticlesToAuthors.order),
			},
		},
	});

	if (draft?.published_id) {
		const published = await db.query.PublishedArticle.findFirst({
			where: eq(PublishedArticle.id, draft.published_id),
			with: {
				published_articles_to_authors: {
					with: {
						author: true,
					},
					orderBy: asc(PublishedArticlesToAuthors.order),
				},
			},
		});

		return { draft, published };
	}

	return { draft };
}

// --- Unified `articles` table (#20) ---

function new_article_query(where: SQL) {
	return db.query.Article.findFirst({
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

export async function get_article_by_new_id(
	input: z.infer<typeof get_article_by_new_id_validator>,
) {
	const validated_input = get_article_by_new_id_validator.safeParse(input);
	if (!validated_input.success) {
		throw new Error(validated_input.error.message);
	}

	return new_article_query(eq(Article.id, input.id));
}

export async function get_new_article_by_slug(slug: string) {
	const slug_row = await db.query.ArticleSlug.findFirst({
		where: eq(ArticleSlug.slug, slug),
		columns: { article_id: true },
	});

	if (!slug_row) return undefined;

	return new_article_query(eq(Article.id, slug_row.article_id));
}
