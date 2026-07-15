import { assert_one } from "~/lib/assert-length";
import type { DbTransaction } from "~/server/db";
import { ArticleSlug } from "~/server/db/schema";
import { find_available_slug } from "~/server/article/slug";

/**
 * Preserves a legacy article's existing `published_article.url` as its new
 * primary slug verbatim (existing public links keep working), suffixing only
 * on an actual collision via the shared `find_available_slug` — the same
 * collision-suffixing logic the editor's publish path uses (#9), reused
 * unconditionally per #22 rather than duplicated. `own_legacy_published_id`
 * excludes the row being migrated from counting as a collision with itself.
 */
export function ensure_legacy_slug_available(
	tx: DbTransaction,
	base: string,
	own_legacy_published_id: number,
) {
	return find_available_slug(tx, base, own_legacy_published_id);
}

export async function insert_primary_slug(
	tx: DbTransaction,
	article_id: string,
	slug: string,
) {
	const inserted = await tx
		.insert(ArticleSlug)
		.values({ slug, article_id, is_primary: true })
		.returning();
	assert_one(inserted);
	return inserted[0];
}
