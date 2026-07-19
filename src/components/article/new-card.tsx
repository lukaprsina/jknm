"use client";

import type { IntersectionRef } from "~/app/infinite-no-trpc";
import { get_draft_article_link } from "~/lib/article-utils";
import { convert_content_to_text } from "~/lib/content-to-text";
import { ArticleCard } from "./card";
import { get_primary_slug, type NewArticleWithRelations } from "./new-adapter";

/**
 * Homepage-feed card for a `published`-status `articles` row. Renders through
 * the same `ArticleCard` presentation as the legacy `PublishedArticleDrizzleCard`,
 * sourcing its thumbnail from the new `media` table (`thumbnail_media.original.url`)
 * instead of the legacy S3 `thumbnail.png` convention.
 */
export function NewPublishedArticleCard({
	article,
	featured,
	ref,
}: {
	article: NewArticleWithRelations;
	featured?: boolean;
	ref?: IntersectionRef;
}) {
	const slug = get_primary_slug(article);

	return (
		<ArticleCard
			featured={featured}
			ref={ref}
			title={article.title}
			url={slug ? `/novica/${encodeURIComponent(slug)}` : "#"}
			content_preview={convert_content_to_text(
				article.content_json?.blocks,
				true,
			).slice(0, 1000)}
			created_at={article.published_at ?? article.created_at}
			has_thumbnail={Boolean(article.thumbnail_media)}
			image_url={article.thumbnail_media?.original.url}
			author_ids={article.articles_to_authors.map((rel) => rel.author_id)}
		/>
	);
}

/** Drafts-accordion card for a `draft`-status `articles` row — links to the editor, not `/novica`. */
export function NewDraftArticleCard({
	article,
	ref,
}: {
	article: NewArticleWithRelations;
	ref?: IntersectionRef;
}) {
	return (
		<ArticleCard
			ref={ref}
			title={article.title}
			url={get_draft_article_link(article.id)}
			content_preview={convert_content_to_text(
				article.content_json?.blocks,
				true,
			).slice(0, 1000)}
			created_at={article.created_at}
			has_thumbnail={Boolean(article.thumbnail_media)}
			image_url={article.thumbnail_media?.original.url}
			author_ids={article.articles_to_authors.map((rel) => rel.author_id)}
		/>
	);
}
