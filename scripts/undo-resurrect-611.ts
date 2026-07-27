import { eq } from "drizzle-orm";
import { db } from "~/server/db";
import { Article, ArticleSlug } from "~/server/db/schema";

/**
 * One-off: undoes `scripts/resurrect-article.ts 611`, which wrongly
 * resurrected a legitimately-superseded article (soft-deleted + de-slugged by
 * the normal edit/revise flow, not an accidental delete). Re-deletes the
 * resurrected row, removes the slug it minted, and moves legacy_id=611 onto
 * the article that actually superseded it.
 */
async function main() {
	const OLD_ID = "e6fa3ab9-3282-4765-8b87-1ce6a5c386ca"; // wrongly resurrected
	const NEW_ID = "70e10dff-4f7f-4731-96a6-b591b3f7bc77"; // supersedes OLD_ID

	await db.transaction(async (tx) => {
		const old_article = await tx.query.Article.findFirst({
			where: eq(Article.id, OLD_ID),
			with: { article_slugs: true },
		});
		if (!old_article) throw new Error(`Article ${OLD_ID} not found`);
		if (old_article.legacy_id !== 611) {
			throw new Error(
				`Expected ${OLD_ID} to have legacy_id=611, got ${old_article.legacy_id}`,
			);
		}

		const new_article = await tx.query.Article.findFirst({
			where: eq(Article.id, NEW_ID),
		});
		if (!new_article) throw new Error(`Article ${NEW_ID} not found`);
		if (new_article.supersedes_id !== OLD_ID) {
			throw new Error(
				`Expected ${NEW_ID}.supersedes_id to be ${OLD_ID}, got ${new_article.supersedes_id}`,
			);
		}

		await tx.delete(ArticleSlug).where(eq(ArticleSlug.article_id, OLD_ID));

		// Vacate legacy_id=611 first — the unique constraint would otherwise
		// reject setting it on NEW_ID while OLD_ID still holds it.
		await tx
			.update(Article)
			.set({ status: "deleted", deleted_at: new Date(), legacy_id: null })
			.where(eq(Article.id, OLD_ID));

		await tx
			.update(Article)
			.set({ legacy_id: 611 })
			.where(eq(Article.id, NEW_ID));

		console.log(
			`Re-deleted ${OLD_ID}, removed its slug(s): ${old_article.article_slugs.map((s) => s.slug).join(", ")}`,
		);
		console.log(`Moved legacy_id=611 onto ${NEW_ID}`);
	});
}

main()
	.catch((error) => {
		console.error(error);
		process.exitCode = 1;
	})
	.finally(() => process.exit());
