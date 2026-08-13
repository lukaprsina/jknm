import fs from "node:fs/promises";
import { parseArgs } from "node:util";
import { eq, isNotNull } from "drizzle-orm";
import { db } from "~/server/db";
import { Article } from "~/server/db/schema";

/**
 * Backfills `Article.uploaded_custom_thumbnail` for legacy-imported articles
 * from the real historical flag in scripts/articles.json (keyed by `old_id`,
 * which is what today's `legacy_id` was reconciled to point at — see
 * fix-legacy-ids-final-reconcile.ts). Not a heuristic: the old db had this
 * field before the rewrite dropped it, and recomputing it from EditorJS
 * content + the Media table doesn't work post-migration — the same photo's
 * thumbnail crop and its content-block copy landed on two different `Media`
 * rows during rehosting, so id/url equality between them is meaningless (see
 * scripts/audit-custom-thumbnail-heuristic.ts and the investigation that
 * produced it). New-site-only articles (no legacy_id) aren't touched here —
 * there's no historical ground truth for them; they keep the column's `null`
 * ("unknown") until next resaved, at which point the live save path starts
 * setting it correctly (separate change, not part of this script).
 *
 * Only ever narrows: an article is skipped if its current
 * `uploaded_custom_thumbnail` is already non-null (already resaved since the
 * rewrite, or already backfilled) — this script must never clobber a value
 * the live app has since written for real.
 *
 * Usage:
 *   bun run scripts/backfill-uploaded-custom-thumbnail.ts            # dry run
 *   bun run scripts/backfill-uploaded-custom-thumbnail.ts --execute
 */

const LEGACY_JSON_PATH = "scripts/articles.json";
const OUT_PATH = "artifacts/backfill-uploaded-custom-thumbnail-plan.json";

interface LegacyArticle {
	old_id: number | null;
	title: string;
	thumbnail_crop?: {
		uploaded_custom_thumbnail: boolean;
	} | null;
}

interface PlannedUpdate {
	article_id: string;
	legacy_id: number;
	title: string;
	set_uploaded_custom_thumbnail: boolean;
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

async function main() {
	const { values } = parseArgs({ options: { execute: { type: "boolean" } } });
	const execute = values.execute ?? false;

	const ground_truth = await load_legacy_ground_truth();
	console.log(
		`Loaded ${ground_truth.size} legacy thumbnail_crop row(s) with a known old_id.`,
	);

	const articles = await db.query.Article.findMany({
		where: isNotNull(Article.legacy_id),
		columns: {
			id: true,
			legacy_id: true,
			title: true,
			uploaded_custom_thumbnail: true,
		},
	});
	console.log(`Loaded ${articles.length} article(s) with a legacy_id.\n`);

	const planned: PlannedUpdate[] = [];
	let already_set = 0;
	let no_ground_truth = 0;

	for (const article of articles) {
		if (article.legacy_id === null) continue; // narrows the type; filtered by query already

		if (article.uploaded_custom_thumbnail !== null) {
			already_set++;
			continue;
		}

		const truth = ground_truth.get(article.legacy_id);
		if (truth === undefined) {
			no_ground_truth++;
			continue;
		}

		planned.push({
			article_id: article.id,
			legacy_id: article.legacy_id,
			title: article.title,
			set_uploaded_custom_thumbnail: truth,
		});
	}

	console.log(`Already set (skipped, not clobbered): ${already_set}`);
	console.log(`No legacy ground truth (skipped): ${no_ground_truth}`);
	console.log(`Planned updates: ${planned.length}`);

	await fs.writeFile(OUT_PATH, JSON.stringify(planned, null, 2), "utf8");
	console.log(`\nPlan written to ${OUT_PATH}`);

	if (!execute) {
		console.log("\nDry run only — pass --execute to apply.");
		return;
	}

	for (const update of planned) {
		await db
			.update(Article)
			.set({ uploaded_custom_thumbnail: update.set_uploaded_custom_thumbnail })
			.where(eq(Article.id, update.article_id));
	}
	console.log(`\nApplied ${planned.length} update(s).`);
}

main()
	.catch((error) => {
		console.error(error);
		process.exitCode = 1;
	})
	.finally(() => process.exit());
