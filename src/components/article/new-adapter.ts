import type { ThumbnailType } from "~/lib/validators";
import { find_primary_slug_or_first } from "~/server/article/lifecycle-rules";
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
	published_at: Date | null;
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
	published_at: Date | null;
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
	return find_primary_slug_or_first(article.article_slugs)?.slug;
}

/**
 * The "Čas objave" date picker's default: the draft's own `published_at` if
 * it has one, else — mid-revision, before a superseding draft is published —
 * the source article it's revising, else (a fresh standalone draft, never
 * published) when the draft was created. Shared by `settings-form.tsx`'s
 * `defaultValues` and `use-editor-mutations.tsx`'s implicit-publish fallback
 * (e.g. the `Ctrl+Shift+S` shortcut) so a publish triggered without ever
 * opening the settings dialog sends the same date the dialog would have
 * shown, instead of two independently-maintained copies of this fallback
 * silently drifting apart.
 */
export function resolve_default_published_at(
	draft: Pick<EditorDraftArticle, "published_at" | "created_at">,
	source: Pick<PublishedArticleView, "published_at"> | undefined,
): Date {
	return draft.published_at ?? source?.published_at ?? draft.created_at;
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
		// `null` means "unknown" (see the schema comment) — never-backfilled
		// legacy rows with no match in the old export. `image-selector.tsx`
		// treats an absent flag as `false` ("not custom"), which would silently
		// hide an actually-custom thumbnail from the picker's already-selected
		// state — the exact bug this column exists to fix. Defaulting unknown to
		// `true` is the safe direction: worst case it's a harmless duplicate
		// entry in the picker's image list, not an invisible one.
		uploaded_custom_thumbnail: article.uploaded_custom_thumbnail ?? true,
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
		published_at: article.published_at,
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
		published_at: article.published_at,
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
