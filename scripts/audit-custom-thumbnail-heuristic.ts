import fs from "node:fs/promises";
import { db } from "~/server/db";

/**
 * Read-only dry run for the planned `uploaded_custom_thumbnail` backfill.
 *
 * The pre-rewrite db had this flag; the rewrite dropped it, and
 * `reconstruct_thumbnail_crop` (src/components/article/new-adapter.ts) has no
 * way to tell "thumbnail picked from an image already in the article body"
 * apart from "thumbnail uploaded standalone" for any article whose settings
 * dialog hasn't been resaved since. scripts/articles.json is the old export
 * and still carries the real flag per article (keyed by `old_id`, not `id` —
 * see fix-legacy-ids-final-reconcile.ts for why `id` is the wrong key). This
 * script re-derives the flag with the same heuristic the backfill would use
 * (is the thumbnail's media url referenced by one of the article's own
 * `image` blocks?) against the *current* DB content, and reports every
 * article where that heuristic disagrees with the old ground truth — so the
 * backfill decision is made from evidence, not from guessing the heuristic's
 * error rate.
 *
 * Writes nothing to the db. Usage: bun run scripts/audit-custom-thumbnail-heuristic.ts
 */

const LEGACY_JSON_PATH = "scripts/articles.json";
const OUT_PATH = "artifacts/custom-thumbnail-heuristic-audit.json";

interface LegacyArticle {
	old_id: number | null;
	title: string;
	thumbnail_crop?: {
		image_url: string;
		uploaded_custom_thumbnail: boolean;
	} | null;
}

interface ArticleBlock {
	id?: string;
	type: string;
	data: { file?: { url?: string } };
}

interface Mismatch {
	legacy_id: number;
	article_id: string;
	title: string;
	thumbnail_url: string;
	ground_truth_custom: boolean;
	heuristic_custom: boolean;
}

async function load_legacy_ground_truth(): Promise<Map<number, boolean>> {
	const text = await fs.readFile(LEGACY_JSON_PATH, "utf8");
	const rows = JSON.parse(text) as LegacyArticle[];

	const ground_truth = new Map<number, boolean>();
	for (const row of rows) {
		if (row.old_id === null || !row.thumbnail_crop) continue;
		ground_truth.set(row.old_id, row.thumbnail_crop.uploaded_custom_thumbnail);
	}
	return ground_truth;
}

function content_has_image_url(
	content_json: { blocks: ArticleBlock[] } | null,
	url: string,
): boolean {
	if (!content_json) return false;
	return content_json.blocks.some(
		(block) => block.type === "image" && block.data.file?.url === url,
	);
}

async function main() {
	const ground_truth = await load_legacy_ground_truth();
	console.log(
		`Loaded ${ground_truth.size} legacy thumbnail_crop row(s) with a known old_id.`,
	);

	const articles = await db.query.Article.findMany({
		columns: { id: true, legacy_id: true, title: true, content_json: true },
		with: { thumbnail_media: { columns: { original: true } } },
	});
	console.log(`Loaded ${articles.length} article(s).\n`);

	let with_thumbnail = 0;
	let with_ground_truth = 0;
	let agree = 0;
	const mismatches: Mismatch[] = [];

	for (const article of articles) {
		if (article.legacy_id === null || !article.thumbnail_media) continue;
		with_thumbnail++;

		const truth = ground_truth.get(article.legacy_id);
		if (truth === undefined) continue;
		with_ground_truth++;

		const thumbnail_url = article.thumbnail_media.original.url;
		const heuristic_custom = !content_has_image_url(
			article.content_json,
			thumbnail_url,
		);

		if (heuristic_custom === truth) {
			agree++;
			continue;
		}

		mismatches.push({
			legacy_id: article.legacy_id,
			article_id: article.id,
			title: article.title,
			thumbnail_url,
			ground_truth_custom: truth,
			heuristic_custom,
		});
	}

	console.log(`Articles with a thumbnail today: ${with_thumbnail}`);
	console.log(`  ...with a known legacy ground truth: ${with_ground_truth}`);
	console.log(`  ...heuristic agrees: ${agree}`);
	console.log(`  ...heuristic disagrees: ${mismatches.length}`);

	await fs.writeFile(OUT_PATH, JSON.stringify(mismatches, null, 2), "utf8");
	console.log(`\nMismatches written to ${OUT_PATH}`);
}

main()
	.catch((error) => {
		console.error(error);
		process.exitCode = 1;
	})
	.finally(() => process.exit());
