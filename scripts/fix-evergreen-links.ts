import { parseArgs } from "node:util";
import { eq } from "drizzle-orm";
import { reconcile_media_to_articles } from "~/server/article/reconcile-media";
import { ingest_media_from_url } from "~/server/media/ingest";
import { db } from "~/server/db";
import type { ArticleContentType } from "~/server/db/schema";
import { Article } from "~/server/db/schema";

/**
 * Fixes findings #1 and #2 from `scripts/audit-evergreen-pages.ts`:
 *
 *  - Varstvo: 21 internal links hardcoded to the `jknm-si.vercel.app` preview
 *    domain instead of relative `/novica/<slug>` (slugs already verified to
 *    resolve via `article_slugs`).
 *  - Zgodovina: 1 PDF link on `vsebina.jknm.org` (untracked static bucket).
 *    Unlike the 659/663/664 fix, no matching `Media` row already exists for
 *    this file, so it's ingested fresh onto `gradivo.jknm.org` rather than
 *    just repointed.
 *
 * Usage:
 *   bun run scripts/fix-evergreen-links.ts             # dry run
 *   bun run scripts/fix-evergreen-links.ts --execute
 */

const VARSTVO_ARTICLE_ID = "9ddf9346-552a-42aa-bdae-fd1fae66844c";
const ZGODOVINA_ARTICLE_ID = "dace7fc1-8f42-4411-b2d3-44e353da32de";
const ZGODOVINA_PDF_URL =
	"https://vsebina.jknm.org/media/DK/DK8_12_Majhen_Velika_Majhovka.pdf";

async function fix_varstvo(execute: boolean) {
	const article = await db.query.Article.findFirst({
		where: eq(Article.id, VARSTVO_ARTICLE_ID),
		columns: { id: true, content_json: true },
	});
	if (!article?.content_json) {
		console.log("[skip] Varstvo - no content_json");
		return;
	}

	let raw = JSON.stringify(article.content_json);
	const re = /https?:\/\/[^\s"'<>)\\]*jknm-si\.vercel\.app(\/novica\/[^\s"'<>)\\]*)/gi;
	const replacements = new Set<string>();
	for (const m of raw.matchAll(re)) replacements.add(m[0]);

	console.log(`[Varstvo] ${replacements.size} distinct preview-domain url(s) found`);
	for (const url of replacements) {
		const relative = url.replace(/^https?:\/\/[^/]*jknm-si\.vercel\.app/i, "");
		console.log(`    ${url}\n    -> ${relative}`);
		raw = raw.split(url).join(relative);
	}

	if (!execute) return;

	const content = JSON.parse(raw) as ArticleContentType;
	await db.transaction(async (tx) => {
		await tx
			.update(Article)
			.set({ content_json: content })
			.where(eq(Article.id, article.id));
		await reconcile_media_to_articles(tx, article.id, content);
	});
	console.log("[Varstvo] rewritten.");
}

async function fix_zgodovina(execute: boolean) {
	const article = await db.query.Article.findFirst({
		where: eq(Article.id, ZGODOVINA_ARTICLE_ID),
		columns: { id: true, content_json: true },
	});
	if (!article?.content_json) {
		console.log("[skip] Zgodovina - no content_json");
		return;
	}

	const original = JSON.stringify(article.content_json);
	if (!original.includes(ZGODOVINA_PDF_URL)) {
		console.log(`[skip] Zgodovina - url not found: ${ZGODOVINA_PDF_URL}`);
		return;
	}

	if (!execute) {
		console.log(`[Zgodovina]\n    ${ZGODOVINA_PDF_URL}\n    -> (would ingest onto gradivo.jknm.org)`);
		return;
	}

	const media = await ingest_media_from_url(ZGODOVINA_PDF_URL);
	if (!media) {
		console.log(`[skip] Zgodovina - fetch failed for ${ZGODOVINA_PDF_URL}`);
		return;
	}

	console.log(`[Zgodovina]\n    ${ZGODOVINA_PDF_URL}\n    -> ${media.original.url}`);

	const rewritten = original.split(ZGODOVINA_PDF_URL).join(media.original.url);
	const content = JSON.parse(rewritten) as ArticleContentType;
	await db.transaction(async (tx) => {
		await tx
			.update(Article)
			.set({ content_json: content })
			.where(eq(Article.id, article.id));
		await reconcile_media_to_articles(tx, article.id, content);
	});
	console.log("[Zgodovina] rewritten.");
}

async function main() {
	const { values } = parseArgs({ options: { execute: { type: "boolean" } } });
	const execute = values.execute ?? false;

	await fix_varstvo(execute);
	console.log();
	await fix_zgodovina(execute);

	if (!execute) {
		console.log("\nDry run only - re-run with --execute to rewrite + reconcile.");
	}
}

main()
	.catch((error) => {
		console.error(error);
		process.exitCode = 1;
	})
	.finally(() => process.exit());
