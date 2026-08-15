import { parseArgs } from "node:util";
import { inArray } from "drizzle-orm";
import { db } from "~/server/db";
import { Article } from "~/server/db/schema";

/**
 * One-off: repairs `published_at` for the five articles flagged by
 * scripts/audit-all-discrepancies.ts (date_mismatch) whose date differs from
 * the legacy source. Four of them are the decide_published_at bug signature
 * (a revise-via-pencil before the fix landed fell through to `new Date()`
 * instead of inheriting the source's original date); the fifth (240) is a
 * supersede-published row whose own created_at was reset, so the target date
 * comes from the superseded source row, independently confirmed against
 * artifacts/Objave.txt.
 *
 * Targets (legacy source is authoritative):
 *   240  -> 2011-10-25  (Objave.txt 25/10/2011, matches deleted source's created_at)
 *   358  -> 2014-04-18  (Objave.txt 18/4/2014)
 *   657  -> 2024-09-01  (legacy-html/657.html: 1.9.2024)
 *   675  -> 2025-02-02  (legacy-html/675.html: 2.2.2025)
 *   685  -> 2025-08-26  (legacy-html/685.html: 26.8.2025)
 *
 * Usage:
 *   bun run scripts/fix-published-at-date-mismatches.ts            # dry run
 *   bun run scripts/fix-published-at-date-mismatches.ts --execute
 */

const TARGETS: Record<number, string> = {
	240: "2011-10-25T00:00:00.000Z",
	358: "2014-04-18T00:00:00.000Z",
	657: "2024-09-01T00:00:00.000Z",
	675: "2025-02-02T00:00:00.000Z",
	685: "2025-08-26T00:00:00.000Z",
};

async function main() {
	const { values } = parseArgs({ options: { execute: { type: "boolean" } } });
	const execute = values.execute ?? false;

	const rows = await db.query.Article.findMany({
		where: inArray(Article.legacy_id, Object.keys(TARGETS).map(Number)),
		columns: {
			id: true,
			legacy_id: true,
			title: true,
			status: true,
			published_at: true,
			created_at: true,
		},
	});

	for (const row of rows) {
		const legacy_id = row.legacy_id;
		if (legacy_id === null) continue;
		const target_date = TARGETS[legacy_id];
		if (target_date === undefined) {
			console.warn(`[${legacy_id}] no target date in TARGETS; skipping`);
			continue;
		}
		const target = new Date(target_date);

		console.log(
			`[${legacy_id}] ${row.title} (${row.status})\n  published_at: ${row.published_at?.toISOString() ?? "null"} -> ${target.toISOString()}`,
		);
		if (execute) {
			await db
				.update(Article)
				.set({ published_at: target })
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