import { CONTENT_PAGE_SLUGS } from "~/lib/content-pages";
import { extract_headings_from_content } from "~/lib/editor-utils";
import { get_new_article_by_slug } from "~/server/article/get-article";
import type { ArticleContentType } from "~/server/db/schema";

export interface NavSection {
	section: string;
	title: string;
	headings: { id: string; title: string }[];
}

// Not a static page (no article row) -- an archive listing route -- so it
// never has headings, only a link.
const ARHIV_SECTION: NavSection = {
	section: "arhiv",
	title: "Arhiv novic",
	headings: [],
};

/**
 * Builds one navbar dropdown entry from a content-kind row — pure so it's
 * testable without a DB. `null` when the row isn't there yet (not migrated/
 * published) or has no content, so the caller can drop it from the menu
 * instead of showing a broken dropdown.
 */
export function to_nav_section(
	slug: string,
	article: { title: string; content_json: ArticleContentType | null } | undefined,
): NavSection | null {
	if (!article?.content_json) return null;

	return {
		section: slug,
		title: article.title,
		headings: extract_headings_from_content(article.content_json, [2]).map(
			(heading) => ({ id: heading.id, title: heading.title }),
		),
	};
}

/**
 * Navbar dropdown data, request/build-time-computed from each of the 5
 * content-kind rows' live `content_json` (real slugged h2 ids) -- so a navbar
 * link can never point at an anchor id its target page doesn't actually
 * have. Replaces the old static `content.mdx` `tableOfContents` imports (#38,
 * `docs/research/article-kind-call-site-audit.md` finding #5), which have no
 * post-migration equivalent. `get_new_article_by_slug` is already cached
 * (`get-article.ts`, tag `"article"`, 1h revalidate) and React-`cache`d per
 * request, so this costs no extra DB round-trips beyond what each fixed
 * route's own page already pays.
 */
export async function get_static_nav_sections(): Promise<NavSection[]> {
	const articles = await Promise.all(
		CONTENT_PAGE_SLUGS.map((slug) => get_new_article_by_slug(slug)),
	);

	const sections = CONTENT_PAGE_SLUGS.map((slug, index) =>
		to_nav_section(slug, articles[index]),
	).filter((section) => section !== null);

	return [...sections, ARHIV_SECTION];
}
