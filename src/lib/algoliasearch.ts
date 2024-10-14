import type { PublishedArticleWithAuthors } from "~/components/article/adapter";
import type { PublishedArticleHit } from "~/lib/validators";
import { convert_content_to_text } from "~/lib/content-to-text";

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
/* .slice(
      0,
      1000,
    ), */
