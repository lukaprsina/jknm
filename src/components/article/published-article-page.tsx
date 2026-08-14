import type { Metadata } from "next";
import { notFound } from "next/navigation";
import sanitizeHtml from "sanitize-html";
import { PublishedContent } from "~/components/content";
import { ImageGallery } from "~/components/image-gallery";
import { Shell } from "~/components/shell";
import ScrollToTop from "~/components/shell/scroll-to-top";
import { ScrollProvider } from "~/contexts/scroll-context";
import { format_author_name } from "~/lib/author-name";
import type { ContentPageSlug } from "~/lib/content-pages";
import { SITE_ORIGIN } from "~/lib/site-config";
import { get_new_article_by_slug } from "~/server/article/get-article";
import { is_visible_to } from "~/server/article/lifecycle-rules";
import { getServerAuthSession } from "~/server/auth";
import type { NewArticleWithRelations } from "./new-adapter";
import {
	map_new_article_to_published_view,
	resolve_canonical_article_path,
} from "./new-adapter";

/**
 * Resolve one of the 5 fixed content-kind routes' article row by its known,
 * remint-gated slug (#35 keeps it stable), or leave via `notFound()`. Also
 * guards on `article_kind` defensively, in case a coincidental news-article
 * title ever mints one of these 5 reserved slugs first.
 */
export async function resolve_content_page_article(
	slug: string,
): Promise<NewArticleWithRelations> {
	const article = await get_new_article_by_slug(slug);
	if (article?.article_kind !== "content") notFound();

	const session = await getServerAuthSession();
	if (!is_visible_to(article.status, Boolean(session))) notFound();

	return article;
}

/**
 * Shared by `/novica/[slug]` and the 5 fixed content-kind routes (#38) — the
 * only difference between the two is which slug resolved the row and
 * whether that slug is itself the canonical route (see
 * `resolve_canonical_article_path`).
 */
export function build_published_article_metadata(
	article: NewArticleWithRelations,
	slug: string,
): Metadata {
	const title = sanitizeHtml(article.title, { allowedTags: [] });

	return {
		title,
		alternates: {
			canonical: resolve_canonical_article_path(article, slug),
		},
		// Only set when a thumbnail exists — an unset `openGraph` here leaves
		// the root `opengraph-image.png` file convention as the fallback
		// (setting it always, even to an empty/absent `images`, would shallow-
		// replace that fallback per Next's segment-metadata merge rules).
		...(article.thumbnail_media
			? {
					openGraph: {
						title,
						images: [
							{
								url: article.thumbnail_media.original.url,
								width: article.thumbnail_media.original.width,
								height: article.thumbnail_media.original.height,
								alt: title,
							},
						],
					},
				}
			: {}),
	};
}

/**
 * `Article` (not `NewsArticle`): a caving club isn't a news publisher, and
 * `NewsArticle` unlocks nothing here (Google's "Top stories" needs no
 * markup at all). This earns no rich result either way — the value is
 * unambiguous machine-readable author/date, and increasingly, LLM ingestion.
 *
 * `</` is escaped inside the JSON so a title/excerpt containing a literal
 * `</script>` can't prematurely close the tag.
 */
function build_article_json_ld(article: NewArticleWithRelations, slug: string) {
	const json_ld = {
		"@context": "https://schema.org",
		"@type": "Article",
		headline: sanitizeHtml(article.title, { allowedTags: [] }),
		datePublished: (article.published_at ?? article.created_at).toISOString(),
		dateModified: article.updated_at.toISOString(),
		url: `${SITE_ORIGIN}${resolve_canonical_article_path(article, slug)}`,
		author: article.articles_to_authors.map((rel) => ({
			"@type": "Person",
			name: format_author_name(rel.author),
		})),
		...(article.thumbnail_media
			? { image: [article.thumbnail_media.original.url] }
			: {}),
	};

	return JSON.stringify(json_ld).replace(/</g, "\\u003c");
}

/** Full public article body — JSON-LD, the editor-rendered content, gallery, and shell chrome. */
export function PublishedArticlePage({
	article,
	slug,
}: {
	article: NewArticleWithRelations;
	slug: string;
}) {
	const new_view = map_new_article_to_published_view(article, slug);

	return (
		<Shell published_article={new_view}>
			<ScrollProvider>
				<script
					type="application/ld+json"
					// biome-ignore lint/security/noDangerouslySetInnerHtml: JSON-LD has no other way to embed — content is sanitized/escaped in build_article_json_ld.
					dangerouslySetInnerHTML={{
						__html: build_article_json_ld(article, slug),
					}}
				/>
				<PublishedContent article={new_view} />
				<ImageGallery />
				<ScrollToTop />
			</ScrollProvider>
		</Shell>
	);
}

/**
 * One of the 5 fixed content-kind routes' `page.tsx` is just this, called
 * with its own slug — typed against `ContentPageSlug` so a typo or a slug
 * dropped from `CONTENT_PAGE_SLUGS` fails typecheck instead of silently
 * desyncing route and navbar (#38 code review).
 */
export function create_content_page(slug: ContentPageSlug) {
	async function generateMetadata(): Promise<Metadata> {
		const article = await resolve_content_page_article(slug);
		return build_published_article_metadata(article, slug);
	}

	async function Page() {
		const article = await resolve_content_page_article(slug);
		return <PublishedArticlePage article={article} slug={slug} />;
	}

	return { generateMetadata, Page };
}
