import type { Metadata } from "next";
import { notFound, permanentRedirect } from "next/navigation";
import sanitizeHtml from "sanitize-html";
import type { NewArticleWithRelations } from "~/components/article/new-adapter";
import {
	map_new_article_to_published_view,
	resolve_canonical_article_path,
} from "~/components/article/new-adapter";
import { PublishedContent } from "~/components/content";
import { ImageGallery } from "~/components/image-gallery";
import { Shell } from "~/components/shell";
import ScrollToTop from "~/components/shell/scroll-to-top";
import { ScrollProvider } from "~/contexts/scroll-context";
import { SITE_ORIGIN } from "~/lib/site-config";
import { get_new_article_by_slug } from "~/server/article/get-article";
import { resolve_slug_request } from "~/server/article/lifecycle-rules";
import { getServerAuthSession } from "~/server/auth";

interface NovicaProps {
	params: Promise<{
		published_url: string;
	}>;
}

/**
 * Next has already decoded the route param, so this second decode is a no-op
 * for every slug `convert_title_to_url` can mint (`[a-z0-9-_]` only). It exists
 * for the malformed-URL case: a bare `%` would make `decodeURIComponent` throw
 * `URIError`, and an uncaught throw here is a **500**. A 500 is worse than a 404
 * for a URL that was never real — Google retries 5xx and it burns crawl budget,
 * whereas a 4xx is a clean "this doesn't exist". Fall through to the raw param
 * and let the lookup miss produce the 404.
 */
function decode_slug(published_url: string) {
	try {
		return decodeURIComponent(published_url);
	} catch {
		return published_url;
	}
}

/**
 * Resolve one `/novica/<slug>` request, or leave via `notFound()` /
 * `permanentRedirect()` — both of which return `never`.
 *
 * What makes the redirect a real 308 is that the **page body** calls this at
 * top level, before anything has flushed: a `permanentRedirect()` reached after
 * the shell has flushed degrades to HTTP 200 + `<meta http-equiv="refresh">`,
 * which Google ranks below a server-side redirect (measured on 16.2.10 — see
 * `docs/research/legacy-id-redirects-and-seo-metadata.md` §3.5).
 *
 * `generateMetadata` calls it too, so it can title the page without repeating
 * the visibility rule. That costs no extra work: both `get_new_article_by_slug`
 * and `getServerAuthSession` are React-`cache`d, so the lookup and the session
 * read are deduped across the two call sites within one request.
 */
async function resolve_article(published_url: string) {
	const requested_slug = decode_slug(published_url);

	const article = await get_new_article_by_slug(requested_slug);
	const session = await getServerAuthSession();

	const resolution = resolve_slug_request({
		requested_slug,
		article,
		is_admin: Boolean(session),
	});

	// The `!article` half is redundant with the rule (it returns `not_found` for
	// a missing article) and is here purely to narrow the type without a `!`.
	if (!article || resolution.outcome === "not_found") {
		notFound();
	}

	// A renamed article keeps its old slugs resolvable, but only one of them is
	// canonical; serving both at 200 was duplicate content.
	if (resolution.outcome === "redirect_to_primary") {
		permanentRedirect(`/novica/${encodeURIComponent(resolution.slug)}`);
	}

	return { article, requested_slug };
}

export async function generateMetadata(props: NovicaProps): Promise<Metadata> {
	const { published_url } = await props.params;
	// `requested_slug` is safe to use directly as the canonical here: by the
	// time this returns, `resolve_article` has already redirected away from
	// any non-primary slug, so whatever's left is the canonical one.
	const { article, requested_slug } = await resolve_article(published_url);
	const title = sanitizeHtml(article.title, { allowedTags: [] });

	return {
		title,
		alternates: {
			canonical: resolve_canonical_article_path(article, requested_slug),
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
		datePublished: article.created_at.toISOString(),
		dateModified: article.updated_at.toISOString(),
		url: `${SITE_ORIGIN}${resolve_canonical_article_path(article, slug)}`,
		author: article.articles_to_authors.map((rel) => ({
			"@type": "Person",
			name: rel.author.name,
		})),
		...(article.thumbnail_media
			? { image: [article.thumbnail_media.original.url] }
			: {}),
	};

	return JSON.stringify(json_ld).replace(/</g, "\\u003c");
}

export default async function NovicaPage(props: NovicaProps) {
	const { published_url } = await props.params;
	const { article, requested_slug } = await resolve_article(published_url);

	const new_view = map_new_article_to_published_view(article, requested_slug);

	return (
		<Shell published_article={new_view}>
			<ScrollProvider>
				<script
					type="application/ld+json"
					// biome-ignore lint/security/noDangerouslySetInnerHtml: JSON-LD has no other way to embed — content is sanitized/escaped in build_article_json_ld.
					dangerouslySetInnerHTML={{
						__html: build_article_json_ld(article, requested_slug),
					}}
				/>
				<PublishedContent article={new_view} />
				<ImageGallery />
				<ScrollToTop />
			</ScrollProvider>
		</Shell>
	);
}
