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
  get_s3_draft_directory,
  get_s3_published_directory,
} from "~/lib/article-utils";

import { ArticleCard } from "./card";
import type { IntersectionRef } from "~/app/infinite-no-trpc";
import { use } from "react";
import { DuplicateURLsContext } from "~/app/provider";
import { env } from "~/env";
import { get_s3_prefix } from "~/lib/s3-publish";

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
  if (typeof article.created_at.toLocaleDateString !== "function") {
    console.warn("DraftArticleDrizzleCard", {
      article,
      // eslint-disable-next-line @typescript-eslint/unbound-method
      created_at_to_locale_date_string: article.created_at.toLocaleDateString,
      created_at_to_locale_date_string_type:
        typeof article.created_at.toLocaleDateString,
      created_at_type: typeof article.created_at,
      created_at: article.created_at,
    });
    article.created_at = new Date(article.created_at);
  }

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
      // image_url={`https://cdn-drafts.${env.NEXT_PUBLIC_SITE_DOMAIN}/${get_s3_draft_directory(article.id)}/thumbnail.png`}
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
  const duplicate_urls = use(DuplicateURLsContext);

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
      id={article.id}
      image_url={get_s3_prefix(
        `${get_s3_published_directory(article.url, article.created_at)}/thumbnail.png`,
        env.NEXT_PUBLIC_AWS_PUBLISHED_BUCKET_NAME,
      )}
      // image_url={`https://cdn.${env.NEXT_PUBLIC_SITE_DOMAIN}/${get_s3_published_directory(article.url, article.created_at)}/thumbnail.png`}
      content_preview={convert_content_to_text(
        article.content?.blocks,
        true,
      ).slice(0, 1000)}
      created_at={article.created_at}
      has_thumbnail={Boolean(article.thumbnail_crop)}
      author_ids={article.published_articles_to_authors.map((a) => a.author.id)}
    />
  );
};

export function ArticleAlgoliaCard({
  hit,
  ref,
}: {
  hit: SearchHit<PublishedArticleHit>;
  ref?: IntersectionRef;
}) {
  const duplicate_urls = use(DuplicateURLsContext);

  return (
    <ArticleCard
      ref={ref}
      featured={false}
      title={hit.title}
      url={get_published_article_link(hit.url, hit.created_at, duplicate_urls)}
      id={parseInt(hit.objectID)}
      content_preview={hit.content_preview?.slice(0, 1000)}
      created_at={new Date(hit.created_at)}
      has_thumbnail={hit.has_thumbnail}
      author_ids={hit.author_ids}
      image_url={get_s3_prefix(
        `${get_s3_published_directory(hit.url, hit.created_at)}/thumbnail.png`,
        env.NEXT_PUBLIC_AWS_PUBLISHED_BUCKET_NAME,
      )}
      // image_url={`https://cdn.${env.NEXT_PUBLIC_SITE_DOMAIN}/${get_s3_published_directory(hit.url, hit.created_at)}/thumbnail.png`}
    />
  );
}
