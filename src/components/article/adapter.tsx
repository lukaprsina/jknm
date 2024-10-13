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
import { convert_content_to_text } from "~/lib/content-to-text";
import {
  get_draft_article_link,
  get_published_article_link,
  get_s3_published_directory,
} from "~/lib/article-utils";

import { ArticleCard } from "./card";
import { get_s3_prefix } from "~/lib/s3-publish";
import { env } from "~/env";
import { cached_state_store } from "~/app/provider";
import type { IntersectionRef } from "~/app/infinite-no-trpc";
import type { ReactNode } from "react";

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

export function DraftArticleDrizzleCard({
  article,
  ref,
  description,
}: {
  article: DraftArticleWithAuthors;
  ref?: IntersectionRef;
  description: ReactNode;
}) {
  return (
    <ArticleCard
      ref={ref}
      title={article.title}
      url={get_draft_article_link(article.id)}
      content_preview={convert_content_to_text(
        article.content?.blocks,
        true,
      ).slice(0, 1000)}
      created_at={article.created_at}
      image_url={get_s3_prefix(
        `${article.id}/thumbnail.png`,
        env.NEXT_PUBLIC_AWS_DRAFT_BUCKET_NAME,
      )}
      has_thumbnail={Boolean(article.thumbnail_crop)}
      author_ids={article.draft_articles_to_authors.map((a) => a.author.id)}
      description={description}
    />
  );
}

export function PublishedArticleDrizzleCard({
  article,
  featured,
  ref,
  description,
  duplicate_urls,
}: {
  article: PublishedArticleWithAuthors;
  featured?: boolean;
  ref?: IntersectionRef;
  description: ReactNode;
  duplicate_urls?: string[];
}) {
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
      content_preview={convert_content_to_text(
        article.content?.blocks,
        true,
      ).slice(0, 1000)}
      created_at={article.created_at}
      has_thumbnail={Boolean(article.thumbnail_crop)}
      author_ids={article.published_articles_to_authors.map((a) => a.author.id)}
      description={description}
    />
  );
}

export function ArticleAlgoliaCard({
  hit,
  ref,
  description,
}: {
  hit: SearchHit<PublishedArticleHit>;
  ref?: IntersectionRef;
  description: ReactNode;
}) {
  const duplicate_urls = cached_state_store.get.duplicate_urls();

  return (
    <ArticleCard
      ref={ref}
      featured={false}
      title={hit.title}
      url={get_published_article_link(hit.url, hit.created_at, duplicate_urls)}
      content_preview={hit.content_preview?.slice(0, 1000)}
      created_at={new Date(hit.created_at)}
      has_thumbnail={hit.has_thumbnail}
      author_ids={hit.author_ids}
      image_url={get_s3_prefix(
        `${get_s3_published_directory(hit.url, hit.created_at)}/thumbnail.png`,
        env.NEXT_PUBLIC_AWS_PUBLISHED_BUCKET_NAME,
      )}
      description={description}
    />
  );
}
