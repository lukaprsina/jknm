import { parseArgs } from "node:util";
import { eq } from "drizzle-orm";
import { reconcile_media_to_articles } from "~/server/article/reconcile-media";
import { db } from "~/server/db";
import type { ArticleContentType } from "~/server/db/schema";
import { Article, Media } from "~/server/db/schema";
import { rewrite_urls } from "~/lib/stale-media-refs";

/**
 * One-off fix for `artifacts/media-hash-diff/wrong_article.json`'s 4
 * remaining findings (legacy_id 659/663/664): these 3 articles link their DK
 * journal PDFs from `vsebina.jknm.org` (the static-page dehotlinking bucket,
 * no `Media` row), while a byte-identical `Media` row for each already exists
 * on `gradivo.jknm.org` from a separate ingest. Unlike
 * `fix-wrong-article-media.ts` (dead-host recovery), `vsebina.jknm.org` is
 * alive, so that script's stale-host check correctly leaves these alone — but
 * per the maintainer, these 3 articles specifically should be on the tracked
 * `Media`/`gradivo` pipeline instead, not the untracked static bucket.
 *
 * Usage:
 *   bun run scripts/fix-vsebina-to-gradivo-media.ts             # dry run
 *   bun run scripts/fix-vsebina-to-gradivo-media.ts --execute
 */

const FIXES = [
	{
		article_id: "7320c9b7-8776-4605-bc7d-796a7c286c45",
		title: "Jame v Novem mestu",
		old_url:
			"https://vsebina.jknm.org/media/DK/DK2_08_Ladisic_Jame_v_Novem_mestu.pdf",
		media_id: "cda86090-54f8-4e92-bba1-6347366ecde2",
	},
	{
		article_id: "df49fb11-70ea-4b43-b2b4-d08469f6e3b7",
		title: "Po vseh luknjah pod mestom",
		old_url:
			"https://vsebina.jknm.org/media/DK/DK2_08_Ladisic_Jame_v_Novem_mestu.pdf",
		media_id: "cda86090-54f8-4e92-bba1-6347366ecde2",
	},
	{
		article_id: "df49fb11-70ea-4b43-b2b4-d08469f6e3b7",
		title: "Po vseh luknjah pod mestom",
		old_url:
			"https://vsebina.jknm.org/media/DK/DK5_21_Prsina_Rovi_pod_mestnim_jedrom_Novo_mesto.pdf",
		media_id: "0d62da37-8c7d-4891-92d8-796840b4de21",
	},
	{
		article_id: "83eb0190-6eef-4b94-bdbf-e4fbecb7810c",
		title: "Ajdovska jama - video snemanje v kaminu",
		old_url:
			"https://vsebina.jknm.org/media/DK/DK3_11_Mravlja_Ajdovska_jama_pri_Nemski_vasi.pdf",
		media_id: "4172bbf7-578c-4edb-ad75-b09baf8892d8",
	},
];

async function main() {
	const { values } = parseArgs({ options: { execute: { type: "boolean" } } });
	const execute = values.execute ?? false;

	let fixed = 0;

	for (const fix of FIXES) {
		const article = await db.query.Article.findFirst({
			where: eq(Article.id, fix.article_id),
			columns: { id: true, content_json: true },
		});
		if (!article?.content_json) {
			console.log(`[skip] ${fix.title} - no content_json`);
			continue;
		}

		const media = await db.query.Media.findFirst({
			where: eq(Media.id, fix.media_id),
			columns: { original: true },
		});
		if (!media) {
			console.log(`[skip] ${fix.title} - media ${fix.media_id} vanished`);
			continue;
		}

		const original = JSON.stringify(article.content_json);
		if (!original.includes(fix.old_url)) {
			console.log(`[skip] ${fix.title} - old url not found: ${fix.old_url}`);
			continue;
		}

		console.log(`[${fix.title}]\n    ${fix.old_url}\n    -> ${media.original.url}`);

		if (!execute) continue;

		const rewritten = rewrite_urls(
			original,
			new Map([[fix.old_url, media.original.url]]),
		);
		const content = JSON.parse(rewritten) as ArticleContentType;
		await db.transaction(async (tx) => {
			await tx
				.update(Article)
				.set({ content_json: content })
				.where(eq(Article.id, article.id));
			await reconcile_media_to_articles(tx, article.id, content);
		});
		fixed += 1;
	}

	console.log(`\n${fixed} rewritten.`);
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
