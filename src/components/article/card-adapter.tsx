"use client";

import type { Hit as SearchHit } from "instantsearch.js";
import type {
  Author,
  DraftArticle,
  DraftArticlesToAuthors,
  PublishedArticle,
  PublishedArticlesToAuthors,
} from "~/server/db/schema";
import type { PublishedArticleHit } from "~/lib/validators";
import type { IntersectionRef } from "./infinite-articles";
import { content_to_text } from "~/lib/content-to-text";
import {
  get_draft_article_link,
  get_published_article_link,
  get_s3_published_directory,
} from "~/lib/article-utils";
import { useDuplicatedUrls } from "~/hooks/use-duplicated-urls";

import { ArticleCard } from "./card";
import { get_s3_prefix } from "~/lib/s3-publish";
import { env } from "~/env";
/* const ArticleCard = dynamic(
  () => import("./card").then((mod) => mod.ArticleCard),
  {
    ssr: false,
    loading: () => <Skeleton className="h-96 w-full" />,
  },
); */

type SelectPublishedArticlesToAuthors =
  typeof PublishedArticlesToAuthors.$inferSelect & {
    author: typeof Author.$inferSelect;
    published_id: number;
    author_id: number;
  };

export type PublishedArticleWithAuthors =
  typeof PublishedArticle.$inferSelect & {
    published_articles_to_authors: SelectPublishedArticlesToAuthors[];
  };

type SelectDraftArticlesToAuthors =
  typeof DraftArticlesToAuthors.$inferSelect & {
    author: typeof Author.$inferSelect;
    draft_id: number;
    author_id: number;
  };

export type DraftArticleWithAuthors = typeof DraftArticle.$inferSelect & {
  draft_articles_to_authors: SelectDraftArticlesToAuthors[];
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
      content_preview={content_to_text(article.content?.blocks ?? undefined)}
      created_at={article.created_at}
      image_url={get_s3_prefix(
        `${article.id}/thumbnail.png`,
        env.NEXT_PUBLIC_AWS_DRAFT_BUCKET_NAME,
      )}
      has_thumbnail={Boolean(article.thumbnail_crop)}
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
      image_url={get_s3_prefix(
        `${get_s3_published_directory(article.url, article.created_at)}/thumbnail.png`,
        env.NEXT_PUBLIC_AWS_PUBLISHED_BUCKET_NAME,
      )}
      content_preview={content_to_text(article.content?.blocks ?? undefined)}
      created_at={article.created_at}
      has_thumbnail={Boolean(article.thumbnail_crop)}
      author_ids={article.published_articles_to_authors.map((a) => a.author.id)}
    />
  );
};

export function ArticleAlgoliaCard({
  hit,
}: {
  hit: SearchHit<PublishedArticleHit>;
}) {
  const duplicate_urls = useDuplicatedUrls();

  return (
    <ArticleCard
      title={hit.title}
      url={get_published_article_link(hit.url, hit.created_at, duplicate_urls)}
      content_preview={hit.content_preview}
      created_at={new Date(hit.created_at)}
      has_thumbnail={hit.has_thumbnail}
      author_ids={hit.author_ids}
      image_url={get_s3_prefix(
        `${get_s3_published_directory(hit.url, hit.created_at)}/thumbnail.png`,
        env.NEXT_PUBLIC_AWS_PUBLISHED_BUCKET_NAME,
      )}
    />
  );
}
