import fs from "node:fs/promises";
import { parse } from "csv-parse/sync";
import { db } from "~/server/db";
import { Article } from "~/server/db/schema";

/**
 * One-off, experimental: legacy_id turns out to be unreliable for matching
 * (see scripts/check-legacy-articles.ts — 600/625 title mismatches, in a
 * pattern that looks like legacy_id was assigned by sequential position
 * among migrated articles rather than the legacy site's real row id, so
 * every deleted/hidden legacy row shifts everything after it).
 *
 * This instead zips the two lists by *publish order*: sort our articles by
 * published_at, sort the legacy CSV rows by their date column, and pair up
 * by index (no articles were ever inserted with a backdated published_at on
 * the new site, so publish order should track the legacy site's real
 * chronological order). Legacy CSV ids are NOT sequential — deleted
 * articles leave gaps — so id is not used at all here, only order.
 *
 * Usage: bun run scripts/check-legacy-articles-by-date.ts
 */

const CSV_PATH = "artifacts/Objave.txt";

interface LegacyRow {
	legacy_id: number;
	title: string;
	published_at: Date;
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

async function load_legacy_rows(): Promise<LegacyRow[]> {
	const text = await fs.readFile(CSV_PATH, "utf8");
	const records: string[][] = parse(text, {
		columns: false,
		relax_column_count: true,
	});

	const rows: LegacyRow[] = [];
	for (const record of records) {
		const legacy_id = Number(record[0]);
		if (!Number.isFinite(legacy_id)) continue;
		const published_at = parse_legacy_date((record[8] ?? "").trim());
		if (!published_at) continue; // 1 known unparseable row (legacy_id=2)
		rows.push({ legacy_id, title: (record[4] ?? "").trim(), published_at });
	}
	return rows;
}

function days_apart(a: Date, b: Date): number {
	return Math.abs(a.getTime() - b.getTime()) / (1000 * 60 * 60 * 24);
}

async function main() {
	const legacy_rows = await load_legacy_rows();
	legacy_rows.sort((a, b) => a.published_at.getTime() - b.published_at.getTime());
	console.log(`${legacy_rows.length} legacy row(s) loaded (date-parseable).`);

	const last_legacy_date = legacy_rows[legacy_rows.length - 1]?.published_at;
	if (!last_legacy_date) throw new Error("no legacy rows");

	// Only compare against articles published within the exported window —
	// the export is missing the ~70 most recent articles entirely, so pairing
	// those by index against nothing would just produce noise.
	const all_articles = await db.query.Article.findMany({
		columns: { id: true, legacy_id: true, title: true, published_at: true },
		orderBy: (article, { asc }) => asc(article.published_at),
	});
	const articles = all_articles.filter(
		(a) => a.published_at && a.published_at <= last_legacy_date,
	);
	console.log(
		`${articles.length} migrated article(s) published on/before the last exported legacy date (${last_legacy_date.toISOString()}).`,
	);

	if (articles.length !== legacy_rows.length) {
		console.log(
			`NOTE: count mismatch (${articles.length} articles vs ${legacy_rows.length} legacy rows) — zip will drift once counts diverge.\n`,
		);
	}

	let exact = 0;
	let close_date = 0;
	let mismatch = 0;

	const n = Math.min(articles.length, legacy_rows.length);
	for (let i = 0; i < n; i++) {
		const article = articles[i];
		const legacy = legacy_rows[i];
		if (!article || !legacy || !article.published_at) continue;

		const title_ok = article.title === legacy.title;
		const gap = days_apart(article.published_at, legacy.published_at);

		if (title_ok) {
			exact++;
			continue;
		}

		if (gap <= 3) {
			close_date++;
		} else {
			mismatch++;
		}

		console.log(
			`[${i}] legacy_id=${legacy.legacy_id} gap=${gap.toFixed(1)}d\n  legacy: "${legacy.title}" @ ${legacy.published_at.toISOString()}\n  ours:   "${article.title}" (legacy_id=${article.legacy_id}) @ ${article.published_at.toISOString()}`,
		);
	}

	console.log(
		`\nDone. exact_title_match=${exact} title_mismatch_close_date(<=3d)=${close_date} title_mismatch_far_date=${mismatch} paired=${n}`,
	);
}

main()
	.catch((error) => {
		console.error(error);
		process.exitCode = 1;
	})
	.finally(() => process.exit());
