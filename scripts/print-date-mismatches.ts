import { inArray } from "drizzle-orm";
import { db } from "~/server/db";
import { Article } from "~/server/db/schema";

/**
 * One-off: prints created_at / published_at for the articles whose
 * published_at does not match the legacy source (date_mismatch from
 * scripts/audit-all-discrepancies.ts).
 *
 * Usage: bun run scripts/print-date-mismatches.ts
 */

const LEGACY_IDS = [240, 358, 657, 675, 685];

async function main() {
	const rows = await db.query.Article.findMany({
		where: inArray(Article.legacy_id, LEGACY_IDS),
		columns: {
			id: true,
			legacy_id: true,
			title: true,
			status: true,
			published_at: true,
			created_at: true,
			updated_at: true,
		},
	});

	for (const row of rows) {
		console.log(
			`[${row.legacy_id}] ${row.title} (${row.status})\n  created_at:   ${row.created_at?.toISOString() ?? "null"}\n  published_at: ${row.published_at?.toISOString() ?? "null"}\n  updated_at:   ${row.updated_at?.toISOString() ?? "null"}`,
		);
	}
}

main()
	.catch((error) => {
		console.error(error);
		process.exitCode = 1;
	})
	.finally(() => process.exit());