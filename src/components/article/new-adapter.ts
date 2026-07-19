import type { ThumbnailType } from "~/lib/validators";
import type {
	Article,
	ArticleSlug,
	ArticlesToAuthors,
	Author,
	Media,
} from "~/server/db/schema";
import type {
	DraftArticleWithAuthors,
	PublishedArticleWithAuthors,
} from "./adapter";

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

/**
 * Editor draft shape, widened so `id` can be the new uuid string as well as
 * the legacy numeric id. The rest of the editor tree reads
 * `title`/`content`/`created_at`/`draft_articles_to_authors`/`thumbnail_crop`
 * unchanged.
 */
export type EditorDraftArticle = Omit<DraftArticleWithAuthors, "id"> & {
	id: number | string;
};

export type PublishedArticleView = Omit<PublishedArticleWithAuthors, "id"> & {
	id: number | string;
};

/**
 * Minimal shape the edit-pencil (`EditingButtons`/`EditButton`) needs — just
 * enough to tell a legacy `PublishedArticle` (numeric id, spawns a legacy
 * draft via `create_draft`) from a new-table `Article` (uuid id, spawns a
 * superseding draft via `create_superseding_draft`).
 */
export type EditableArticleRef = { id: number | string };

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

/**
 * Map a new `articles` row into a `DraftArticleWithAuthors`-shaped object (with
 * a widened uuid `id`) so the existing editor tree renders it unchanged.
 */
export function map_new_article_to_editor_draft(
	article: NewArticleWithRelations,
): EditorDraftArticle {
	return {
		id: article.id,
		published_id: null,
		title: article.title,
		created_at: article.created_at,
		updated_at: article.updated_at,
		content: article.content_json,
		content_preview: article.excerpt ?? "",
		thumbnail_crop: reconstruct_thumbnail_crop(article),
		draft_articles_to_authors: article.articles_to_authors.map((rel) => ({
			draft_id: 0,
			author_id: rel.author_id,
			order: rel.order,
			author: rel.author,
		})),
	};
}

/**
 * Map a new `articles` row into a published-view object for the public page.
 * `EditorToReact` treats it as a draft (no `old_id`), which is fine — it only
 * reads content/authors/created_at.
 */
export function map_new_article_to_published_view(
	article: NewArticleWithRelations,
	slug: string,
): PublishedArticleView {
	return {
		id: article.id,
		old_id: null,
		title: article.title,
		url: slug,
		created_at: article.published_at ?? article.created_at,
		updated_at: article.updated_at,
		content: article.content_json,
		content_preview: article.excerpt ?? "",
		thumbnail_crop: reconstruct_thumbnail_crop(article),
		published_articles_to_authors: article.articles_to_authors.map((rel) => ({
			published_id: 0,
			author_id: rel.author_id,
			order: rel.order,
			author: rel.author,
		})),
	};
}
