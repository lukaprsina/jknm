import fs from "node:fs/promises";
import { parse } from "csv-parse/sync";
import { lte } from "drizzle-orm";
import { db } from "~/server/db";
import { Article } from "~/server/db/schema";

/**
 * One-off: cross-checks our migrated Article rows against the legacy site's
 * own DB export (artifacts/Objave.txt, a "Objave" table CSV dump given by
 * the old admin) to spot-check that legacy_id was assigned correctly.
 *
 * The export is missing about 70 articles published after it was taken, so
 * this only covers legacy_id <= LAST_EXPORTED_ID — the rest need a different
 * source, later.
 *
 * Columns (no header row): 0 legacy id, 4 title, 8 published date
 * ("D/M/YYYY HH:mm:ss"). The rest (excerpt, html body, flags, modified date,
 * etc.) aren't needed for this check.
 *
 * Usage: bun run scripts/check-legacy-articles.ts
 */

const CSV_PATH = "artifacts/Objave.txt";
const LAST_EXPORTED_ID = 625;

interface LegacyRow {
	legacy_id: number;
	title: string;
	published_at: Date | null;
}

function parse_legacy_date(raw: string): Date | null {
	// "29/2/2008 00:00:00" -> D/M/YYYY H:mm:ss
	const match = /^(\d{1,2})\/(\d{1,2})\/(\d{4}) (\d{1,2}):(\d{2}):(\d{2})$/.exec(
		raw,
	);
	if (!match) return null;
	const [, d, m, y, h, min, s] = match;
	return new Date(
		Date.UTC(Number(y), Number(m) - 1, Number(d), Number(h), Number(min), Number(s)),
	);
}

async function load_legacy_rows(): Promise<Map<number, LegacyRow>> {
	const text = await fs.readFile(CSV_PATH, "utf8");
	const records: string[][] = parse(text, {
		columns: false,
		relax_column_count: true,
	});

	const rows = new Map<number, LegacyRow>();
	for (const record of records) {
		const legacy_id = Number(record[0]);
		if (!Number.isFinite(legacy_id)) continue;
		rows.set(legacy_id, {
			legacy_id,
			title: (record[4] ?? "").trim(),
			published_at: parse_legacy_date((record[8] ?? "").trim()),
		});
	}
	return rows;
}

function same_day(a: Date | null, b: Date | null): boolean {
	if (!a || !b) return false;
	return (
		a.getUTCFullYear() === b.getUTCFullYear() &&
		a.getUTCMonth() === b.getUTCMonth() &&
		a.getUTCDate() === b.getUTCDate()
	);
}

async function main() {
	const legacy_rows = await load_legacy_rows();
	console.log(`${legacy_rows.size} legacy row(s) loaded from ${CSV_PATH}.`);

	const articles = await db.query.Article.findMany({
		where: lte(Article.legacy_id, LAST_EXPORTED_ID),
		columns: { id: true, legacy_id: true, title: true, published_at: true },
	});
	console.log(
		`${articles.length} migrated article(s) with legacy_id <= ${LAST_EXPORTED_ID}.\n`,
	);

	let missing = 0;
	let title_mismatch = 0;
	let date_mismatch = 0;
	let ok = 0;

	const sorted = [...articles].sort(
		(a, b) => (a.legacy_id ?? 0) - (b.legacy_id ?? 0),
	);

	for (const article of sorted) {
		const legacy_id = article.legacy_id;
		if (legacy_id === null) continue;

		const legacy = legacy_rows.get(legacy_id);
		if (!legacy) {
			missing++;
			console.log(
				`[MISSING]  legacy_id=${legacy_id} not found in export — article ${article.id} "${article.title}"`,
			);
			continue;
		}

		const title_ok = legacy.title === article.title;
		const date_ok = same_day(legacy.published_at, article.published_at);

		if (title_ok && date_ok) {
			ok++;
			continue;
		}

		if (!title_ok) {
			title_mismatch++;
			console.log(
				`[TITLE]    legacy_id=${legacy_id}\n  legacy: "${legacy.title}"\n  ours:   "${article.title}"`,
			);
		}
		if (!date_ok) {
			date_mismatch++;
			console.log(
				`[DATE]     legacy_id=${legacy_id} "${article.title}"\n  legacy: ${legacy.published_at?.toISOString() ?? "unparseable"}\n  ours:   ${article.published_at?.toISOString() ?? "null"}`,
			);
		}
	}

	// legacy_ids in the export range that we have no migrated article for at all.
	const our_ids = new Set(sorted.map((a) => a.legacy_id));
	const unmatched_legacy: number[] = [];
	for (const legacy_id of legacy_rows.keys()) {
		if (legacy_id <= LAST_EXPORTED_ID && !our_ids.has(legacy_id)) {
			unmatched_legacy.push(legacy_id);
		}
	}
	if (unmatched_legacy.length > 0) {
		unmatched_legacy.sort((a, b) => a - b);
		console.log(
			`\n[NO ARTICLE] legacy_id(s) present in export but not migrated: ${unmatched_legacy.join(", ")}`,
		);
	}

	console.log(
		`\nDone. ok=${ok} title_mismatch=${title_mismatch} date_mismatch=${date_mismatch} missing_from_export=${missing} unmatched_legacy=${unmatched_legacy.length}`,
	);
}

main()
	.catch((error) => {
		console.error(error);
		process.exitCode = 1;
	})
	.finally(() => process.exit());
