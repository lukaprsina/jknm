import { eq } from "drizzle-orm";
import { assert_one } from "~/lib/assert-length";
import type { DbTransaction } from "../db";
import { ArticleSlug } from "../db/schema";

const MAX_SLUG_SUFFIX = 99;

/**
 * Claims `base` (or the first `base-2`, `base-3`, ... that's free) as
 * `article_id`'s primary slug, writing the result and returning the winning
 * row. Titles are effectively unique in practice, so a numeric suffix should
 * only ever come from the timestamp fallback below — not from the collision
 * loop, which exists for the two cases that aren't real collisions:
 *
 * - The candidate already belongs to `article_id` itself (a demoted slug
 *   from an earlier retitle that this save is reverting back to) — promote
 *   that row instead of minting a new one, so retitle-then-revert doesn't
 *   permanently burn a suffix against the article's own history.
 * - The candidate belongs to a *different* article that's `deleted` — a
 *   deleted article 404s unconditionally (`is_visible_to`), so its slug is
 *   an unreachable dead end. Reassigning it forward is strictly better than
 *   leaving a live article stuck with a `-2` suffix over a URL nobody can
 *   otherwise reach.
 *
 * A real collision (the candidate belongs to a different, live article)
 * falls through to the next suffix, same as before.
 */
export async function assign_primary_slug(
	tx: DbTransaction,
	article_id: string,
	base: string,
) {
	for (let suffix = 1; suffix <= MAX_SLUG_SUFFIX; suffix += 1) {
		const candidate = suffix === 1 ? base : `${base}-${suffix}`;
		const existing = await tx.query.ArticleSlug.findFirst({
			where: eq(ArticleSlug.slug, candidate),
			with: { article: { columns: { status: true } } },
		});

		if (!existing) {
			const inserted = await tx
				.insert(ArticleSlug)
				.values({ slug: candidate, article_id, is_primary: true })
				.returning();
			assert_one(inserted);
			return inserted[0];
		}

		if (
			existing.article_id !== article_id &&
			existing.article.status !== "deleted"
		) {
			continue; // real collision — try the next suffix
		}

		const updated = await tx
			.update(ArticleSlug)
			.set({ article_id, is_primary: true })
			.where(eq(ArticleSlug.id, existing.id))
			.returning();
		assert_one(updated);
		return updated[0];
	}

	const fallback_slug = `${base}-${Date.now()}`;
	const inserted = await tx
		.insert(ArticleSlug)
		.values({ slug: fallback_slug, article_id, is_primary: true })
		.returning();
	assert_one(inserted);
	return inserted[0];
}
