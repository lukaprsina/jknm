import fs from "node:fs/promises";
import { parseArgs } from "node:util";
import { eq } from "drizzle-orm";
import { normalize_basename } from "~/lib/legacy-media-source";
import { find_stale_asset_urls, rewrite_urls } from "~/lib/stale-media-refs";
import { reconcile_media_to_articles } from "~/server/article/reconcile-media";
import { db } from "~/server/db";
import type { ArticleContentType } from "~/server/db/schema";
import { Article } from "~/server/db/schema";

/**
 * Fix for `artifacts/media-hash-diff/wrong_article.json`: a `Media` row
 * byte-matches a legacy PDF an article cites, but isn't attached.
 *
 * `media_to_articles` is *derived* from `content_json`
 * (`reconcile_media_to_articles`), so "not attached" doesn't mean a join row
 * is missing — it means `content_json` doesn't actually link that media's own
 * url. Inspecting the 10 findings by hand turned up two distinct reasons:
 *
 *  - Most still link a dead `jknm.s3.eu-central-1.amazonaws.com` url — the
 *    same "no unique filename match" entries `unrecovered-legacy-media.md`
 *    already documents. The bytes clearly did get ingested at some point
 *    (that's the `Media` row the hash matched), the article's link was just
 *    never repointed at it. This script fixes exactly that case: rewrite the
 *    stale url to the existing media's url, then reconcile.
 *  - A few already link a *working* `vsebina.jknm.org/media/...` url — the
 *    static dehotlinking bucket, a different pipeline from `ingest_media`'s
 *    `gradivo` bucket. The matched `Media` row there is a harmless orphaned
 *    duplicate from a separate ingest, not a broken link. Nothing to rewrite,
 *    so these are skipped and reported, not touched.
 *
 * Usage:
 *   bun run scripts/fix-wrong-article-media.ts             # dry run
 *   bun run scripts/fix-wrong-article-media.ts --execute
 */

const IN_PATH = "artifacts/media-hash-diff/wrong_article.json";

interface WrongArticleFinding {
	kind: "wrong_article";
	legacy_id: number;
	article_id: string;
	title: string;
	media_kind: "image" | "pdf";
	legacy_url: string;
	media_id: string;
}

async function main() {
	const { values } = parseArgs({ options: { execute: { type: "boolean" } } });
	const execute = values.execute ?? false;

	const findings = JSON.parse(
		await fs.readFile(IN_PATH, "utf8"),
	) as WrongArticleFinding[];

	let fixed = 0;
	let already_working = 0;
	let no_stale_match = 0;

	for (const finding of findings) {
		const article = await db.query.Article.findFirst({
			where: eq(Article.id, finding.article_id),
			columns: { id: true, content_json: true },
		});
		if (!article?.content_json) continue;

		const original = JSON.stringify(article.content_json);
		const stale_urls = find_stale_asset_urls(original);
		const target = normalize_basename(finding.legacy_url);
		const stale_match = stale_urls.find(
			(url) => normalize_basename(url) === target,
		);

		if (!stale_match) {
			already_working += 1;
			console.log(
				`[${finding.legacy_id}] ${finding.title} - no stale link found for ${finding.legacy_url} (already on a working host, likely a duplicate ingest) - skipping`,
			);
			continue;
		}

		const media = await db.query.Media.findFirst({
			where: (m, { eq: eq_ }) => eq_(m.id, finding.media_id),
			columns: { original: true },
		});
		if (!media) {
			no_stale_match += 1;
			console.log(
				`[${finding.legacy_id}] media ${finding.media_id} vanished - skipping`,
			);
			continue;
		}

		console.log(
			`[${finding.legacy_id}] ${finding.title}\n    ${stale_match}\n    -> ${media.original.url}`,
		);

		if (!execute) continue;

		const rewritten = rewrite_urls(
			original,
			new Map([[stale_match, media.original.url]]),
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

	console.log(
		`\n${fixed} rewritten, ${already_working} already on a working host (skipped), ${no_stale_match} unresolvable.`,
	);
	if (!execute) {
		console.log(
			"\nDry run only - re-run with --execute to rewrite + reconcile.",
		);
	}
}

main()
	.catch((error) => {
		console.error(error);
		process.exitCode = 1;
	})
	.finally(() => process.exit());
