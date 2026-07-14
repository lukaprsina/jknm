import type { PublishedArticleWithAuthors } from "~/components/article/adapter";
import { convert_content_to_text } from "~/lib/content-to-text";
import type { PublishedArticleHit } from "~/lib/validators";
import type { ArticleContentType, Author } from "~/server/db/schema";

export const ALGOLIA_PUBLISHED_ARTICLE_INDEX = "published_article";

export function convert_article_to_algolia_object(
	article: PublishedArticleWithAuthors,
) {
	return {
		objectID: article.id.toString(),
		title: article.title,
		url: article.url,
		created_at: article.created_at.getTime(),
		updated_at: article.updated_at.getTime(),
		content_preview: convert_content_to_text(article.content?.blocks),
		year: article.created_at.getFullYear().toString(),
		author_ids: article.published_articles_to_authors.map((a) => a.author_id),
		first_author: article.published_articles_to_authors.at(0)?.author.name,
		has_thumbnail: Boolean(article.thumbnail_crop),
	} satisfies PublishedArticleHit;
}

/**
 * Algolia object for an article on the unified `articles` table (#20). Pushed
 * to the *same* index as legacy articles, so `objectID` here is the uuid
 * `articles.id` string (legacy articles use the numeric `.id.toString()`).
 */
export function convert_new_article_to_algolia_object({
	article,
	slug,
	authors,
}: {
	article: {
		id: string;
		title: string;
		content_json: ArticleContentType | null;
		created_at: Date;
		updated_at: Date;
		published_at: Date | null;
		thumbnail_media_id: string | null;
	};
	slug: string;
	authors: {
		author_id: number;
		author: typeof Author.$inferSelect;
	}[];
}) {
	const effective_date = article.published_at ?? article.created_at;

	return {
		objectID: article.id,
		title: article.title,
		url: slug,
		created_at: effective_date.getTime(),
		updated_at: article.updated_at.getTime(),
		content_preview: convert_content_to_text(article.content_json?.blocks),
		year: effective_date.getFullYear().toString(),
		author_ids: authors.map((a) => a.author_id),
		first_author: authors.at(0)?.author.name,
		// New articles share the `published_article` Algolia index with legacy
		// ones, but `ArticleAlgoliaCard` derives its thumbnail from the old
		// published S3 bucket path, which doesn't exist for decoupled new media.
		// Report no thumbnail for now (rather than a broken image) until the
		// search card is taught to read new-article media — separate follow-up.
		has_thumbnail: false,
	} satisfies PublishedArticleHit;
}
/* .slice(
      0,
      1000,
    ), */
