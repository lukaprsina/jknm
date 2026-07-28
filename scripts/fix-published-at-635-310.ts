import { parseArgs } from "node:util";
import { inArray } from "drizzle-orm";
import { db } from "~/server/db";
import { Article } from "~/server/db/schema";

/**
 * One-off: repairs `published_at` for the two articles known to have been
 * re-dated by the supersede-publish bug fixed in `decide_published_at`
 * (src/server/article/lifecycle-rules.ts) — a revise-via-pencil before that
 * fix landed fell through to `new Date()` instead of inheriting the
 * source's original date.
 *
 * legacy_id 310 "Tečaj v Sežani" and 635 "Čistilna akcija ... Radeščice" (the
 * two chains from scripts/fix-legacy-id-supersede-chains.ts) both show
 * published_at re-dated to the day of a recent unrelated content edit in
 * this session, while `created_at` still holds the true original date,
 * independently confirmed against artifacts/Objave.txt (310: 26/3/2013) and
 * the scraped artifacts/legacy-html/635.html (635: 31.1.2024) — both match
 * created_at exactly, including the UTC+1 offset. So the fix is simply
 * published_at := created_at for these two rows; nothing else touches them.
 *
 * Usage:
 *   bun run scripts/fix-published-at-635-310.ts            # dry run
 *   bun run scripts/fix-published-at-635-310.ts --execute
 */

async function main() {
	const { values } = parseArgs({ options: { execute: { type: "boolean" } } });
	const execute = values.execute ?? false;

	const rows = await db.query.Article.findMany({
		where: inArray(Article.legacy_id, [310, 635]),
		columns: {
			id: true,
			legacy_id: true,
			title: true,
			published_at: true,
			created_at: true,
		},
	});

	for (const row of rows) {
		console.log(
			`[${row.legacy_id}] ${row.title}\n  published_at: ${row.published_at?.toISOString()} -> ${row.created_at.toISOString()}`,
		);
		if (execute) {
			await db
				.update(Article)
				.set({ published_at: row.created_at })
				.where(inArray(Article.id, [row.id]));
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
