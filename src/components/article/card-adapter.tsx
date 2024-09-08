"use client";

import type { Hit as SearchHit } from "instantsearch.js";
import type {
  Author,
  DraftArticle,
  PublishedArticle,
  PublishedArticlesToAuthors,
} from "~/server/db/schema";
import type { ArticleHit } from "~/lib/validators";
import type { IntersectionRef } from "./infinite-articles";
import { content_to_text } from "~/lib/content-to-text";
import { ArticleCard } from "./card";
import {
  get_draft_article_link,
  get_published_article_link,
} from "~/lib/article-utils";
import { useDuplicatedUrls } from "~/hooks/use-duplicated-urls";

type SelectPublishedArticlesToAuthors =
  typeof PublishedArticlesToAuthors.$inferSelect & {
    author: typeof Author.$inferSelect;
  };

export type PublishedArticleWithAuthors =
  typeof PublishedArticle.$inferSelect & {
    published_articles_to_authors: SelectPublishedArticlesToAuthors[];
  };

export type DraftArticleWithAuthors = typeof DraftArticle.$inferSelect & {
  draft_articles_to_authors: SelectPublishedArticlesToAuthors[];
};

export const DraftArticleDrizzleCard = ({
  article,
  ref,
}: {
  article: DraftArticleWithAuthors;
  ref?: IntersectionRef;
}) => {
  return (
    <ArticleCard
      ref={ref}
      title={article.title}
      url={get_draft_article_link(article.id)}
      preview_image={article.preview_image ?? undefined}
      content_preview={content_to_text(article.content?.blocks ?? undefined)}
      created_at={article.created_at}
      author_ids={article.draft_articles_to_authors.map((a) => a.author.id)}
    />
  );
};

export const PublishedArticleDrizzleCard = ({
  article,
  featured,
  ref,
}: {
  article: PublishedArticleWithAuthors;
  featured?: boolean;
  ref?: IntersectionRef;
}) => {
  const duplicate_urls = useDuplicatedUrls();

  return (
    <ArticleCard
      featured={featured}
      ref={ref}
      title={article.title}
      url={get_published_article_link(
        article.url,
        article.created_at,
        duplicate_urls,
      )}
      preview_image={article.preview_image ?? undefined}
      content_preview={content_to_text(article.content?.blocks ?? undefined)}
      created_at={article.created_at}
      author_ids={article.published_articles_to_authors.map((a) => a.author.id)}
    />
  );
};

export function ArticleAlgoliaCard({ hit }: { hit: SearchHit<ArticleHit> }) {
  const duplicate_urls = useDuplicatedUrls();

  return (
    <ArticleCard
      title={hit.title}
      url={get_published_article_link(hit.url, hit.created_at, duplicate_urls)}
      preview_image={hit.image ?? undefined}
      content_preview={hit.content_preview}
      created_at={new Date(hit.created_at)}
      author_ids={hit.author_ids}
    />
  );
}
