import { eq } from "drizzle-orm";
import type { DbTransaction } from "../db";
import { ArticleSlug, PublishedArticle } from "../db/schema";

const MAX_SLUG_SUFFIX = 99;

/**
 * Finds a slug based on `base` that doesn't collide with an existing
 * `article_slugs` row *or* a legacy `published_article.url` (the two live on
 * the same `/novica/<slug>` route, and the legacy table is checked first
 * there — see `page.tsx` — so a new slug that shadows a legacy url would be
 * permanently unreachable): `base`, then `base-2` .. `base-99`, then a
 * timestamp-suffixed fallback.
 *
 * `exclude_legacy_published_id` skips a legacy-url match against that row's
 * own id — needed by the #22 legacy migration, which mints a slug for the
 * very `published_article` row it's migrating and must not treat that row's
 * own url as a collision with itself.
 *
 * NOTE for the eventual `published_article`/`draft_article` schema drop
 * (ADR-0003 appendix, §8 item 7): this function is a live reader of
 * `PublishedArticle`, not just a stale reference — dropping that table
 * without removing this check first will break slug generation outright.
 */
export async function find_available_slug(
	tx: DbTransaction,
	base: string,
	exclude_legacy_published_id?: number,
) {
	for (let suffix = 1; suffix <= MAX_SLUG_SUFFIX; suffix += 1) {
		const candidate = suffix === 1 ? base : `${base}-${suffix}`;
		const [existing_slug, existing_legacy_url] = await Promise.all([
			tx.query.ArticleSlug.findFirst({
				where: eq(ArticleSlug.slug, candidate),
				columns: { id: true },
			}),
			tx.query.PublishedArticle.findFirst({
				where: eq(PublishedArticle.url, candidate),
				columns: { id: true },
			}),
		]);
		const legacy_collision =
			existing_legacy_url && existing_legacy_url.id !== exclude_legacy_published_id;
		if (!existing_slug && !legacy_collision) return candidate;
	}

	return `${base}-${Date.now()}`;
}
