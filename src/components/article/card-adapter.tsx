"use client";

import type { Hit as SearchHit } from "instantsearch.js";
import type { PublishedArticle } from "~/server/db/schema";
import type { ArticleHit } from "~/lib/validators";
import type { IntersectionRef } from "./infinite-articles";
import { content_to_text } from "~/lib/content-to-text";
import { ArticleCard } from "./card";

export const ArticleDrizzleCard = ({
  article,
  featured,
  ref,
}: {
  article: typeof PublishedArticle.$inferSelect;
  featured?: boolean;
  ref?: IntersectionRef;
}) => {
  return (
    <ArticleCard
      featured={featured}
      ref={ref}
      title={article.title}
      url={article.url}
      preview_image={article.preview_image ?? undefined}
      content_preview={content_to_text(article.content ?? undefined)}
      created_at={article.created_at}
      // TODO
      author_ids={[]}
    />
  );
};

export function ArticleAlgoliaCard({ hit }: { hit: SearchHit<ArticleHit> }) {
  return (
    <ArticleCard
      title={hit.title}
      url={hit.url}
      preview_image={hit.image ?? undefined}
      content_preview={hit.content_preview}
      created_at={new Date(hit.created_at)}
      author_ids={hit.author_ids}
    />
  );
}
