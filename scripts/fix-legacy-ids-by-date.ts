import fs from "node:fs/promises";
import path from "node:path";
import { parseArgs } from "node:util";
import { parse } from "csv-parse/sync";
import { eq, isNull } from "drizzle-orm";
import { db } from "~/server/db";
import { Article } from "~/server/db/schema";

/**
 * One-off: corrects Article.legacy_id using publish order instead of trusting
 * the existing column. See scripts/check-legacy-articles-by-date.ts — zipping
 * our articles (sorted by published_at) against the legacy DB export
 * (artifacts/Objave.txt, sorted by its date column) by index gives clean
 * gap=0.0d pairs, while the existing legacy_id is off by a growing amount
 * from ~index 420 onward (no articles were ever inserted with a backdated
 * published_at on the new site, so publish order tracks the legacy site's
 * real order).
 *
 * The CSV export only covers legacy_id <= 625 (taken before ~70 more
 * articles were published on the old site). For everything after that,
 * scripts/scrape-legacy-articles.ts downloads the live old-CMS pages
 * (https://www.jknm.si/si/?id=N) into artifacts/legacy-html/, and this
 * script reads title + date out of those too (id 692, "www.jknm.si se je
 * odselil", is the old site's own closing notice — the last real legacy
 * article; ids past it are a generic fallback page with no <p class="datum">
 * tag, filtered out here).
 *
 * This only ever touches legacy_id. It never renames article titles — some
 * of the title differences found by the by-date check are the admin's later
 * retitles, not migration errors, and telling those apart needs a human, not
 * a heuristic. Log them for manual review instead.
 *
 * Since legacy_id is unique, shifted values are applied in two passes inside
 * one transaction: null out every legacy_id being changed, then write the
 * corrected values, so the interim state never collides.
 *
 * Usage:
 *   bun run scripts/fix-legacy-ids-by-date.ts            # dry run
 *   bun run scripts/fix-legacy-ids-by-date.ts --execute   # write changes
 */

const CSV_PATH = "artifacts/Objave.txt";
const HTML_DIR = "artifacts/legacy-html";

interface LegacyRow {
	legacy_id: number;
	title: string;
	published_at: Date;
}

function parse_legacy_date(raw: string): Date | null {
	// CSV: "29/2/2008 00:00:00" -> D/M/YYYY H:mm:ss
	const match =
		/^(\d{1,2})\/(\d{1,2})\/(\d{4}) (\d{1,2}):(\d{2}):(\d{2})$/.exec(raw);
	if (!match) return null;
	const [, d, m, y, h, min, s] = match;
	return new Date(
		Date.UTC(
			Number(y),
			Number(m) - 1,
			Number(d),
			Number(h),
			Number(min),
			Number(s),
		),
	);
}

async function load_csv_rows(): Promise<LegacyRow[]> {
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

function parse_html_date(raw: string): Date | null {
	// scraped page: <p class="datum">11.3.2022</p> -> D.M.YYYY
	const match = /^(\d{1,2})\.(\d{1,2})\.(\d{4})$/.exec(raw);
	if (!match) return null;
	const [, d, m, y] = match;
	return new Date(Date.UTC(Number(y), Number(m) - 1, Number(d)));
}

async function load_html_rows(): Promise<LegacyRow[]> {
	let files: string[];
	try {
		files = await fs.readdir(HTML_DIR);
	} catch {
		return []; // nothing scraped yet
	}

	const rows: LegacyRow[] = [];
	for (const file of files) {
		const legacy_id = Number(file.replace(/\.html$/, ""));
		if (!Number.isFinite(legacy_id)) continue;

		const html = await fs.readFile(path.join(HTML_DIR, file), "utf8");
		const title_match = /<h1>([^<]*)<\/h1>/.exec(html);
		const date_match = /<p class="datum">([^<]*)<\/p>/.exec(html);
		if (!title_match || !date_match) continue; // fallback/error page, no real article

		const published_at = parse_html_date(date_match[1]?.trim() ?? "");
		if (!published_at) continue;

		rows.push({
			legacy_id,
			title: (title_match[1] ?? "").trim(),
			published_at,
		});
	}
	return rows;
}

async function load_legacy_rows(): Promise<LegacyRow[]> {
	const csv_rows = await load_csv_rows();
	const html_rows = await load_html_rows();

	// The CSV is authoritative where both exist (it's the DB export, HTML is
	// a scrape of the rendered page) — keep HTML rows only for ids the CSV
	// doesn't cover.
	const csv_ids = new Set(csv_rows.map((r) => r.legacy_id));
	const extra_html_rows = html_rows.filter((r) => !csv_ids.has(r.legacy_id));

	return [...csv_rows, ...extra_html_rows];
}

async function main() {
	const { values } = parseArgs({ options: { execute: { type: "boolean" } } });
	const execute = values.execute ?? false;

	const legacy_rows = await load_legacy_rows();
	legacy_rows.sort(
		(a, b) => a.published_at.getTime() - b.published_at.getTime(),
	);

	const last_legacy_date = legacy_rows[legacy_rows.length - 1]?.published_at;
	if (!last_legacy_date) throw new Error("no legacy rows");

	const all_articles = await db.query.Article.findMany({
		columns: { id: true, legacy_id: true, title: true, published_at: true },
		orderBy: (article, { asc }) => asc(article.published_at),
	});
	const articles = all_articles.filter(
		(a) => a.published_at && a.published_at <= last_legacy_date,
	);

	if (articles.length !== legacy_rows.length) {
		throw new Error(
			`count mismatch: ${articles.length} articles vs ${legacy_rows.length} legacy rows — ` +
				"pairing by index isn't safe until this is understood, refusing to proceed",
		);
	}

	const changes: {
		article_id: string;
		article_title: string;
		old_legacy_id: number | null;
		new_legacy_id: number;
		title_differs: boolean;
	}[] = [];

	for (let i = 0; i < articles.length; i++) {
		const article = articles[i];
		const legacy = legacy_rows[i];
		if (!article || !legacy) continue;

		if (article.legacy_id === legacy.legacy_id) continue;

		changes.push({
			article_id: article.id,
			article_title: article.title,
			old_legacy_id: article.legacy_id,
			new_legacy_id: legacy.legacy_id,
			title_differs: article.title !== legacy.title,
		});
	}

	// Articles published *after* the CSV's cutoff can still hold a legacy_id
	// in the export's range — leftovers from the same broken sequential
	// assignment we're fixing. The export proves every id <= max_legacy_id
	// belongs to an article published on/before last_legacy_date, so these
	// values are provably wrong and would collide with the corrected ones.
	// We don't know their real legacy_id (they're missing from the export
	// entirely), so null them out rather than guess.
	const max_legacy_id = legacy_rows[legacy_rows.length - 1]?.legacy_id ?? 0;
	const in_window_ids = new Set(articles.map((a) => a.id));
	const stale_outside_window = all_articles.filter(
		(a) =>
			!in_window_ids.has(a.id) &&
			a.legacy_id !== null &&
			a.legacy_id >= 1 &&
			a.legacy_id <= max_legacy_id,
	);

	console.log(
		`${articles.length} article(s) paired against ${legacy_rows.length} legacy row(s).`,
	);
	console.log(`${changes.length} legacy_id change(s) needed:\n`);

	for (const change of changes) {
		const flag = change.title_differs ? " [title differs, not touched]" : "";
		console.log(
			`  ${change.old_legacy_id ?? "null"} -> ${change.new_legacy_id}  "${change.article_title}"${flag}`,
		);
	}

	if (stale_outside_window.length > 0) {
		console.log(
			`\n${stale_outside_window.length} article(s) published after the export cutoff hold a stale in-range legacy_id — clearing to null:\n`,
		);
		for (const a of stale_outside_window) {
			console.log(
				`  ${a.legacy_id} -> null  "${a.title}" @ ${a.published_at?.toISOString()}`,
			);
		}
	}

	if (!execute) {
		console.log("\nDry run only — re-run with --execute to write changes.");
		return;
	}

	await db.transaction(async (tx) => {
		for (const change of changes) {
			await tx
				.update(Article)
				.set({ legacy_id: null })
				.where(eq(Article.id, change.article_id));
		}
		for (const stale of stale_outside_window) {
			await tx
				.update(Article)
				.set({ legacy_id: null })
				.where(eq(Article.id, stale.id));
		}
		for (const change of changes) {
			await tx
				.update(Article)
				.set({ legacy_id: change.new_legacy_id })
				.where(eq(Article.id, change.article_id));
		}

		const dangling = await tx.query.Article.findMany({
			where: isNull(Article.legacy_id),
			columns: { id: true, title: true },
		});
		const originally_null_ids = new Set(
			all_articles.filter((a) => a.legacy_id === null).map((a) => a.id),
		);
		const expected_null_ids = new Set([
			...stale_outside_window.map((a) => a.id),
			...originally_null_ids,
		]);
		const unexpected_nulls = dangling.filter(
			(a) => !expected_null_ids.has(a.id),
		);
		if (unexpected_nulls.length > 0) {
			throw new Error(
				`unexpected null legacy_id after update on: ${unexpected_nulls
					.map((a) => a.id)
					.join(", ")}`,
			);
		}
	});

	console.log(`\nApplied ${changes.length} legacy_id change(s).`);
}

main()
	.catch((error) => {
		console.error(error);
		process.exitCode = 1;
	})
	.finally(() => process.exit());
