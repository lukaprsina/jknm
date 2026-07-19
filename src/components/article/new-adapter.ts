import type { ThumbnailType } from "~/lib/validators";
import type {
	Article,
	ArticleContentType,
	ArticleSlug,
	ArticlesToAuthors,
	Author,
	Media,
} from "~/server/db/schema";

/**
 * Shape returned by `get_article_by_new_id` / `get_new_article_by_slug` — the
 * unified `articles` row plus the relations the read path loads. Kept here
 * (client-safe) rather than in the `"use server"` `get-article.ts`, which may
 * only export async functions.
 */
export type NewArticleWithRelations = typeof Article.$inferSelect & {
	articles_to_authors: (typeof ArticlesToAuthors.$inferSelect & {
		author: typeof Author.$inferSelect;
	})[];
	article_slugs: (typeof ArticleSlug.$inferSelect)[];
	thumbnail_media: typeof Media.$inferSelect | null;
};

/** Draft shape the editor tree reads from — a plain uuid-keyed `Article` row. */
export interface EditorDraftArticle {
	id: string;
	title: string;
	created_at: Date;
	updated_at: Date;
	content: ArticleContentType | null;
	content_preview: string;
	thumbnail_crop: ThumbnailType | null;
	draft_articles_to_authors: {
		author_id: number;
		order: number;
		author: typeof Author.$inferSelect;
	}[];
}

/** Published-view shape for the public article page — same fields as `EditorDraftArticle`, plus its slug. */
export interface PublishedArticleView {
	id: string;
	title: string;
	url: string;
	created_at: Date;
	updated_at: Date;
	content: ArticleContentType | null;
	content_preview: string;
	thumbnail_crop: ThumbnailType | null;
	published_articles_to_authors: {
		author_id: number;
		order: number;
		author: typeof Author.$inferSelect;
	}[];
}

/** Minimal shape the edit-pencil (`EditingButtons`/`EditButton`) needs. */
export type EditableArticleRef = { id: string };

/** The article's primary slug, falling back to any slug if none is flagged primary. */
export function get_primary_slug(article: NewArticleWithRelations) {
	return (
		article.article_slugs.find((slug) => slug.is_primary) ??
		article.article_slugs[0]
	)?.slug;
}

function reconstruct_thumbnail_crop(
	article: NewArticleWithRelations,
): ThumbnailType | null {
	if (
		!article.thumbnail_media ||
		article.thumbnail_x === null ||
		article.thumbnail_y === null ||
		article.thumbnail_width === null ||
		article.thumbnail_height === null
	) {
		return null;
	}

	return {
		image_url: article.thumbnail_media.original.url,
		unit: "%",
		x: article.thumbnail_x,
		y: article.thumbnail_y,
		width: article.thumbnail_width,
		height: article.thumbnail_height,
	};
}

/** Map a new `articles` row into the editor tree's draft shape. */
export function map_new_article_to_editor_draft(
	article: NewArticleWithRelations,
): EditorDraftArticle {
	return {
		id: article.id,
		title: article.title,
		created_at: article.created_at,
		updated_at: article.updated_at,
		content: article.content_json,
		content_preview: article.excerpt ?? "",
		thumbnail_crop: reconstruct_thumbnail_crop(article),
		draft_articles_to_authors: article.articles_to_authors.map((rel) => ({
			author_id: rel.author_id,
			order: rel.order,
			author: rel.author,
		})),
	};
}

/** Map a new `articles` row into a published-view object for the public page. */
export function map_new_article_to_published_view(
	article: NewArticleWithRelations,
	slug: string,
): PublishedArticleView {
	return {
		id: article.id,
		title: article.title,
		url: slug,
		created_at: article.created_at,
		updated_at: article.updated_at,
		content: article.content_json,
		content_preview: article.excerpt ?? "",
		thumbnail_crop: reconstruct_thumbnail_crop(article),
		published_articles_to_authors: article.articles_to_authors.map((rel) => ({
			author_id: rel.author_id,
			order: rel.order,
			author: rel.author,
		})),
	};
}
