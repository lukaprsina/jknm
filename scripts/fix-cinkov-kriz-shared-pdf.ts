import fs from "node:fs/promises";
import { eq, inArray } from "drizzle-orm";
import { rewrite_urls } from "~/lib/stale-media-refs";
import { reconcile_media_to_articles } from "~/server/article/reconcile-media";
import { db } from "~/server/db";
import type { ArticleContentType } from "~/server/db/schema";
import { Article } from "~/server/db/schema";
import { authorize_b2, ingest_media } from "~/server/media/ingest";

/**
 * legacy_id 78, 79 and 82 ("Iz klubskega arhiva: Brezno Cinkov križ [1/2/3]")
 * all link the same file, `3631_cinkov_kriz.pdf`, still pointing at the dead
 * `jknm.s3.eu-central-1.amazonaws.com` bucket. The per-article fuzzy match in
 * `recover-legacy-media-from-served-mirror.ts` couldn't resolve any of the
 * three (79 has no legacy source at all; 78 and 82's legacy content list 2
 * candidate paths where the filename didn't match either uniquely) - see
 * artifacts/unrecovered-legacy-media.md.
 *
 * The file itself isn't missing though: it's `served/media/pdf/3631_Cinkov_kriz.pdf`,
 * still linked live today from the static pages (zgodovina, raziskovanje) via
 * the vsebina bucket. This ingests it once into gradivo and repoints all
 * three articles at the same new url, rather than another mirror lookup.
 */

const PDF_PATH = "D:\\Luka\\JKNM\\served\\media\\pdf\\3631_Cinkov_kriz.pdf";
const STALE_URL_PREFIXES = [
	"https://jknm.s3.eu-central-1.amazonaws.com/iz-klubskega-arhiva-brezno-cinkov-kriz-1-18-06-2009/3631_cinkov_kriz.pdf",
	"https://jknm.s3.eu-central-1.amazonaws.com/iz-klubskega-arhiva-brezno-cinkov-kriz-2-19-06-2009/3631_cinkov_kriz.pdf",
	"https://jknm.s3.eu-central-1.amazonaws.com/iz-klubskega-arhiva-brezno-cinkov-kriz-3-20-06-2009/3631_cinkov_kriz.pdf",
];

async function main() {
	const b2 = await authorize_b2();
	const bytes = await fs.readFile(PDF_PATH);
	const media = await ingest_media(
		{ bytes, filename: "3631_Cinkov_kriz.pdf", content_type: "application/pdf" },
		{ b2 },
	);
	console.log(`ingested -> ${media.original.url}`);

	const articles = await db.query.Article.findMany({
		where: inArray(Article.legacy_id, [78, 79, 82]),
		columns: { id: true, legacy_id: true, title: true, content_json: true },
	});

	for (const article of articles) {
		if (!article.content_json) continue;
		const original = JSON.stringify(article.content_json);
		const stale_url = STALE_URL_PREFIXES.find((url) => original.includes(url));
		if (!stale_url) {
			console.log(`[${article.legacy_id}] no matching stale url found, skipping`);
			continue;
		}

		const rewritten = rewrite_urls(
			original,
			new Map([[stale_url, media.original.url]]),
		);
		const content = JSON.parse(rewritten) as ArticleContentType;

		await db.transaction(async (tx) => {
			await tx
				.update(Article)
				.set({ content_json: content })
				.where(eq(Article.id, article.id));
			await reconcile_media_to_articles(tx, article.id, content);
		});
		console.log(`[${article.legacy_id}] ${article.title} - rewritten`);
	}
}

main()
	.catch((error) => {
		console.error(error);
		process.exitCode = 1;
	})
	.finally(() => process.exit());
