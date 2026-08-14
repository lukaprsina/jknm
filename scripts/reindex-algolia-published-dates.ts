import { parseArgs } from "node:util";
import { eq } from "drizzle-orm";
import { get_primary_slug } from "~/components/article/new-adapter";
import { convert_new_article_to_algolia_object } from "~/lib/algoliasearch";
import { find_article_with_relations } from "~/server/article/article-queries";
import { add_or_update_algolia } from "~/server/article/lifecycle";
import { db } from "~/server/db";
import { Article } from "~/server/db/schema";

/**
 * One-off: `published_at` was just added to the Algolia hit shape
 * (`convert_new_article_to_algolia_object`) alongside a fix that stopped the
 * whole site — homepage feed order, `/arhiv` sort/year-facet, article cards,
 * the public article page, JSON-LD — from displaying `created_at` (row
 * creation time) where it meant to show the admin-picked publish date.
 *
 * Every already-published article's existing Algolia record predates that
 * field: it won't have `published_at` (or a correct `year`) until it's
 * re-pushed. This walks every `published`-status row and re-pushes it, same
 * shape `publish_article` produces, so the index catches up without waiting
 * for each article to be individually re-saved.
 *
 * Usage:
 *   bun run scripts/reindex-algolia-published-dates.ts            # dry run
 *   bun run scripts/reindex-algolia-published-dates.ts --execute
 */
async function main() {
	const { values } = parseArgs({ options: { execute: { type: "boolean" } } });
	const execute = values.execute ?? false;

	const rows = await db.query.Article.findMany({
		where: eq(Article.status, "published"),
		columns: { id: true, title: true },
	});

	console.log(`${rows.length} published article(s) to reindex.`);

	for (const row of rows) {
		const article = await find_article_with_relations(
			db,
			eq(Article.id, row.id),
		);
		if (!article) continue; // raced with a concurrent delete; skip

		const slug = get_primary_slug(article);
		if (!slug) {
			console.warn(
				`  [skip] ${article.id} "${article.title}" — no primary slug`,
			);
			continue;
		}

		console.log(
			`  ${execute ? "reindexing" : "would reindex"} ${article.id} "${article.title}"`,
		);
		if (execute) {
			await add_or_update_algolia(
				convert_new_article_to_algolia_object({
					article,
					slug,
					authors: article.articles_to_authors,
					thumbnail_media: article.thumbnail_media,
				}),
			);
		}
	}

	if (!execute) {
		console.log("\nDry run only — re-run with --execute to write.");
	}
}

main()
	.catch((error) => {
		console.error(error);
		process.exitCode = 1;
	})
	.finally(() => process.exit());
