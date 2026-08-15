import { eq } from "drizzle-orm";
import { convert_title_to_url } from "~/lib/article-utils";
import { assign_primary_slug } from "~/server/article/slug";
import { db } from "~/server/db";
import { Article } from "~/server/db/schema";

/**
 * One-off: undoes an accidental soft-delete of a legacy-migrated article that
 * has zero slugs (so it was deleted before ever being reachable again after
 * migration, or its slug row was otherwise lost) — sets it back to published
 * and mints a fresh primary slug via the same path `publish_article` uses
 * for a first publish.
 *
 * Usage: bun run scripts/resurrect-article.ts <legacy_id>
 */
async function main() {
	const legacy_id = Number(process.argv[2]);
	if (!Number.isInteger(legacy_id)) {
		throw new Error("Usage: bun run scripts/resurrect-article.ts <legacy_id>");
	}

	await db.transaction(async (tx) => {
		const article = await tx.query.Article.findFirst({
			where: eq(Article.legacy_id, legacy_id),
			with: { article_slugs: true },
		});
		if (!article) throw new Error(`No article with legacy_id=${legacy_id}`);
		if (article.article_slugs.length > 0) {
			throw new Error(
				`Article ${article.id} already has slug(s): ${article.article_slugs.map((s) => s.slug).join(", ")} — refusing to touch it`,
			);
		}

		await tx
			.update(Article)
			.set({
				status: "published",
				deleted_at: null,
				published_at: article.published_at ?? new Date(),
			})
			.where(eq(Article.id, article.id));

		const primary = await assign_primary_slug(
			tx,
			article.id,
			convert_title_to_url(article.title),
		);

		console.log(
			`Restored article ${article.id} "${article.title}" -> /novica/${primary.slug}`,
		);
	});
}

main()
	.catch((error) => {
		console.error(error);
		process.exitCode = 1;
	})
	.finally(() => process.exit());
