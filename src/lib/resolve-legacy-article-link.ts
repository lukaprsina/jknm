import { find_primary_slug } from "~/server/article/lifecycle-rules";

export interface LegacyArticleLookup {
	article_slugs: { slug: string; is_primary: boolean }[];
}

/**
 * Resolves an old-site `/si/?id=<legacy_id>` link to its current `/novica/<slug>`
 * URL. Every 2008-site article was manually verified to have a migrated
 * counterpart (Article.legacy_id), so a miss here is a data problem worth
 * crashing loudly for rather than silently skipping — see the dehotlink
 * script this feeds, which runs once against a fixed, already-audited set of
 * links.
 */
export async function resolve_legacy_article_link(
	legacy_id: number,
	find_by_legacy_id: (
		legacy_id: number,
	) => Promise<LegacyArticleLookup | undefined>,
): Promise<string> {
	const article = await find_by_legacy_id(legacy_id);
	if (!article) {
		throw new Error(`No article found with legacy_id=${legacy_id}`);
	}

	const primary = find_primary_slug(article.article_slugs);
	if (!primary) {
		throw new Error(`Article with legacy_id=${legacy_id} has no primary slug`);
	}

	return `/novica/${primary.slug}`;
}
