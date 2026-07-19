import { env } from "~/env";
import { convert_content_to_text } from "~/lib/content-to-text";
import type { PublishedArticleHit } from "~/lib/validators";
import type { ArticleContentType, Author, Media } from "~/server/db/schema";

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
	thumbnail_media: typeof Media.$inferSelect | null;
}) {
	return {
		objectID: article.id,
		title: article.title,
		url: slug,
		created_at: article.created_at.getTime(),
		updated_at: article.updated_at.getTime(),
		content_preview: convert_content_to_text(article.content_json?.blocks),
		year: article.created_at.getFullYear().toString(),
		author_ids: authors.map((a) => a.author_id),
		first_author: authors.at(0)?.author.name,
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
