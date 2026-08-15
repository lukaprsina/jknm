import { env } from "~/env";
import { format_author_name, format_author_sort_name } from "~/lib/author-name";
import { convert_content_to_text } from "~/lib/content-to-text";
import type { PublicAuthor } from "~/server/author/public-shape";
import type { PublishedArticleHit } from "~/lib/validators";
import type {
	ArticleContentType,
	ArticleKind,
	Media,
} from "~/server/db/schema";

export const ALGOLIA_PUBLISHED_ARTICLE_INDEX =
	env.NEXT_PUBLIC_ALGOLIA_PUBLISHED_ARTICLE_INDEX;

/**
 * Algolia object for an article on the unified `articles` table (#20). Pushed
 * to the *same* index as legacy articles, so `objectID` here is the uuid
 * `articles.id` string (legacy articles use the numeric `.id.toString()`).
 */
export function convert_new_article_to_algolia_object({
	article,
	slug,
	authors,
	thumbnail_media,
}: {
	article: {
		id: string;
		title: string;
		article_kind: ArticleKind;
		content_json: ArticleContentType | null;
		created_at: Date;
		updated_at: Date;
		published_at: Date | null;
		thumbnail_media_id: string | null;
	};
	slug: string;
	authors: {
		author_id: number;
		author: PublicAuthor;
	}[];
	thumbnail_media: typeof Media.$inferSelect | null;
}) {
	// `publish_article` always writes `published_at` in the same transaction
	// that produces this object (`decide_published_at` never leaves it null
	// for a row that's actually being published) — null here would mean this
	// function was called on a row that was never published.
	if (!article.published_at) {
		throw new Error(
			`Cannot index article ${article.id} for search: missing published_at`,
		);
	}

	return {
		objectID: article.id,
		title: article.title,
		article_kind: article.article_kind,
		url: slug,
		created_at: article.created_at.getTime(),
		updated_at: article.updated_at.getTime(),
		published_at: article.published_at.getTime(),
		content_preview: convert_content_to_text(article.content_json?.blocks),
		year: article.published_at.getFullYear().toString(),
		author_ids: authors.map((a) => a.author_id),
		first_author: (() => {
			const author = authors.at(0)?.author;
			return author && format_author_name(author);
		})(),
		// Sort-only field for the `published_article_author_asc`/`_desc`
		// Algolia replicas' custom ranking attribute — "Priimek, Ime" sorts by
		// last name, unlike `first_author`'s display order.
		first_author_sort: (() => {
			const author = authors.at(0)?.author;
			return author && format_author_sort_name(author);
		})(),
		// New-model media lives at an absolute gradivo.jknm.org URL, unlike
		// legacy hits (which carry no `image` and are resolved via the S3
		// thumbnail.png path convention in `ArticleAlgoliaCard`).
		has_thumbnail: Boolean(thumbnail_media),
		image: thumbnail_media?.original.url,
	} satisfies PublishedArticleHit;
}
/* .slice(
      0,
      1000,
    ), */
