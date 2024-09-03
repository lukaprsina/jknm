"use client";

import type { Hit as SearchHit } from "instantsearch.js";
import type { PublishedArticle } from "~/server/db/schema";
import type { ArticleHit } from "~/server/validators";
import { api } from "~/trpc/react";
import type { IntersectionRef } from "./infinite-articles";
import { content_to_text } from "~/lib/content-to-text";

export const ArticleDrizzleCard = ({
  article,
  featured,
  ref,
}: {
  article: typeof PublishedArticle.$inferSelect;
  featured?: boolean;
  ref?: IntersectionRef;
}) => {
  // const all_authors = api.google.users.useQuery();

  return (
    <ArticleCard
      featured={featured}
      ref={ref}
      title={article.title}
      url={article.url}
      // TODO:
      has_draft={false}
      preview_image={article.preview_image ?? undefined}
      content_preview={content_to_text(article.content ?? undefined)}
      created_at={article.created_at}
      author_names={get_author_names(article, all_authors.data)}
    />
  );
};

export function ArticleAlgoliaCard({ hit }: { hit: SearchHit<ArticleHit> }) {
  return (
    <ArticleCard
      title={hit.title}
      url={generate_encoded_url({ id: parseInt(hit.objectID), url: hit.url })}
      published
      preview_image={hit.image ?? undefined}
      content_preview={hit.content_preview}
      created_at={new Date(hit.created_at)}
      author_names={hit.author_names}
    />
  );
}
