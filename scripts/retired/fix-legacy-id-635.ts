import { eq } from "drizzle-orm";
import { db } from "~/server/db";
import { Article } from "~/server/db/schema";

/**
 * One-off: corrects the legacy_id set by scripts/retired/undo-resurrect-611.ts —
 * turns out 611 was never this article's old-site id; 635 is (per the
 * `?id=635&l=2024` links in varstvo/content.mdx). 611 belongs to a
 * different, already-fine article and is left alone here.
 */
async function main() {
	const ARTICLE_ID = "70e10dff-4f7f-4731-96a6-b591b3f7bc77";

	await db.transaction(async (tx) => {
		const article = await tx.query.Article.findFirst({
			where: eq(Article.id, ARTICLE_ID),
		});
		if (!article) throw new Error(`Article ${ARTICLE_ID} not found`);
		if (article.legacy_id !== 611) {
			throw new Error(
				`Expected ${ARTICLE_ID} to have legacy_id=611, got ${article.legacy_id}`,
			);
		}

		await tx
			.update(Article)
			.set({ legacy_id: 635 })
			.where(eq(Article.id, ARTICLE_ID));

		console.log(`Moved legacy_id 611 -> 635 on ${ARTICLE_ID}`);
	});
}

main()
	.catch((error) => {
		console.error(error);
		process.exitCode = 1;
	})
	.finally(() => process.exit());
