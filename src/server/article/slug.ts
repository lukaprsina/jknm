import { eq } from "drizzle-orm";
import type { DbTransaction } from "../db";
import { ArticleSlug } from "../db/schema";

const MAX_SLUG_SUFFIX = 99;

/**
 * Finds a slug based on `base` that doesn't collide with an existing
 * `article_slugs` row: `base`, then `base-2` .. `base-99`, then a
 * timestamp-suffixed fallback.
 */
export async function find_available_slug(tx: DbTransaction, base: string) {
	for (let suffix = 1; suffix <= MAX_SLUG_SUFFIX; suffix += 1) {
		const candidate = suffix === 1 ? base : `${base}-${suffix}`;
		const existing_slug = await tx.query.ArticleSlug.findFirst({
			where: eq(ArticleSlug.slug, candidate),
			columns: { id: true },
		});
		if (!existing_slug) return candidate;
	}

	return `${base}-${Date.now()}`;
}
