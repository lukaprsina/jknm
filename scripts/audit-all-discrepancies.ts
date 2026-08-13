import fs from "node:fs/promises";
import path from "node:path";
import { parse } from "csv-parse/sync";
import { db } from "~/server/db";

/**
 * Read-only, full re-audit of the legacy-migration data set. Re-derives every
 * discrepancy this engagement has found scripts for so far — title/date
 * mismatches (check-legacy-articles.ts), out-of-range legacy_id
 * (fix-legacy-ids-final-reconcile.ts), stray www.jknm.si refs
 * (audit-article-hotlinks.ts), plus two checks that never had a standalone
 * script: orphaned non-primary slugs on deleted articles, and published_at
 * values that look re-dated by the bug fixed in decide_published_at.
 *
 * Deliberately trusts nothing written in prior reports/TODO.md/artifacts/*.md
 * — every check re-reads the live DB and the raw legacy sources fresh, so a
 * discrepancy that was supposedly fixed still shows up here if it isn't
 * actually fixed. Output is one JSON array of `Discrepancy` (discriminated
 * union, one variant per check) to artifacts/discrepancies.json.
 *
 * Usage: bun run scripts/audit-all-discrepancies.ts
 */

const CSV_PATH = "artifacts/Objave.txt";
const HTML_DIR = "artifacts/legacy-html";
const LAST_REAL_LEGACY_ID = 692;
const OUT_PATH = "artifacts/discrepancies.json";

// --- the union ---------------------------------------------------------

interface TitleMismatch {
	kind: "title_mismatch";
	legacy_id: number;
	article_id: string;
	legacy_title: string;
	our_title: string;
	source: "csv" | "html";
}

interface DateMismatch {
	kind: "date_mismatch";
	legacy_id: number;
	article_id: string;
	title: string;
	legacy_published_at: string;
	our_published_at: string | null;
	source: "csv" | "html";
}

interface MissingFromLegacySource {
	kind: "missing_from_legacy_source";
	legacy_id: number;
	article_id: string;
	title: string;
}

interface NoArticleForLegacyId {
	kind: "no_article_for_legacy_id";
	legacy_id: number;
	legacy_title: string;
	legacy_published_at: string;
	source: "csv" | "html";
}

interface LegacyIdOutOfRange {
	kind: "legacy_id_out_of_range";
	legacy_id: number;
	article_id: string;
	title: string;
	published_at: string | null;
}

interface DuplicateLegacyId {
	kind: "duplicate_legacy_id";
	legacy_id: number;
	article_ids: string[];
}

interface StrayHotlink {
	kind: "stray_hotlink";
	link_kind:
		| "article-link"
		| "media-file"
		| "static-page-link"
		| "malformed-concat"
		| "other";
	legacy_id: number | null;
	article_id: string;
	title: string;
	url: string;
	occurrences: number;
}

interface OrphanedSlug {
	kind: "orphaned_slug";
	slug: string;
	slug_id: number;
	article_id: string;
	article_status: string;
	is_primary: boolean;
}

interface SuspiciousPublishedAt {
	kind: "suspicious_published_at";
	article_id: string;
	legacy_id: number | null;
	title: string;
	published_at: string;
	created_at: string;
	gap_days: number;
}

type Discrepancy =
	| TitleMismatch
	| DateMismatch
	| MissingFromLegacySource
	| NoArticleForLegacyId
	| LegacyIdOutOfRange
	| DuplicateLegacyId
	| StrayHotlink
	| OrphanedSlug
	| SuspiciousPublishedAt;

// --- legacy source loading ----------------------------------------------

interface LegacyRow {
	legacy_id: number;
	title: string;
	published_at: Date;
	source: "csv" | "html";
}

function parse_csv_date(raw: string): Date | null {
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

function parse_html_date(raw: string): Date | null {
	const match = /^(\d{1,2})\.(\d{1,2})\.(\d{4})$/.exec(raw);
	if (!match) return null;
	const [, d, m, y] = match;
	return new Date(Date.UTC(Number(y), Number(m) - 1, Number(d)));
}

async function load_csv_rows(): Promise<Map<number, LegacyRow>> {
	const text = await fs.readFile(CSV_PATH, "utf8");
	const records: string[][] = parse(text, {
		columns: false,
		relax_column_count: true,
	});

	const rows = new Map<number, LegacyRow>();
	for (const record of records) {
		const legacy_id = Number(record[0]);
		if (!Number.isFinite(legacy_id)) continue;
		const published_at = parse_csv_date((record[8] ?? "").trim());
		if (!published_at) continue; // 1 known unparseable row (legacy_id=2)
		rows.set(legacy_id, {
			legacy_id,
			title: (record[4] ?? "").trim(),
			published_at,
			source: "csv",
		});
	}
	return rows;
}

async function load_html_rows(): Promise<Map<number, LegacyRow>> {
	const rows = new Map<number, LegacyRow>();
	let files: string[];
	try {
		files = await fs.readdir(HTML_DIR);
	} catch {
		return rows;
	}

	for (const file of files) {
		const legacy_id = Number(file.replace(/\.html$/, ""));
		if (!Number.isFinite(legacy_id)) continue;

		const html = await fs.readFile(path.join(HTML_DIR, file), "utf8");
		const title_match = /<h1>([^<]*)<\/h1>/.exec(html);
		const date_match = /<p class="datum">([^<]*)<\/p>/.exec(html);
		if (!title_match || !date_match) continue;

		const published_at = parse_html_date(date_match[1]?.trim() ?? "");
		if (!published_at) continue;

		rows.set(legacy_id, {
			legacy_id,
			title: (title_match[1] ?? "").trim(),
			published_at,
			source: "html",
		});
	}
	return rows;
}

function same_day(a: Date, b: Date): boolean {
	return (
		a.getUTCFullYear() === b.getUTCFullYear() &&
		a.getUTCMonth() === b.getUTCMonth() &&
		a.getUTCDate() === b.getUTCDate()
	);
}

// --- hotlink classification (mirrors audit-article-hotlinks.ts) ---------

const URL_RE = /https?:\/\/[^\s"'<>)\\]+/g;

function classify_hotlink(url: string): StrayHotlink["link_kind"] | null {
	if (!/jknm\.si/i.test(url)) return null;
	if (/jknm\.si(?:https?:)/i.test(url)) return "malformed-concat";
	if (/jknm\.si\/si\/\?id=/i.test(url)) return "article-link";
	if (/jknm\.si\/media\//i.test(url)) return "media-file";
	if (/jknm\.si\/si\//i.test(url)) return "static-page-link";
	return "other";
}

async function main() {
	const discrepancies: Discrepancy[] = [];

	// CSV is authoritative where it covers an id; HTML fills in the rest.
	const csv_rows = await load_csv_rows();
	const html_rows = await load_html_rows();
	const legacy_rows = new Map<number, LegacyRow>(csv_rows);
	for (const [id, row] of html_rows) {
		if (!legacy_rows.has(id)) legacy_rows.set(id, row);
	}
	console.log(
		`Loaded ${csv_rows.size} CSV row(s) + ${html_rows.size} HTML row(s) (${legacy_rows.size} distinct legacy ids).`,
	);

	const articles = await db.query.Article.findMany({
		columns: {
			id: true,
			legacy_id: true,
			title: true,
			status: true,
			published_at: true,
			created_at: true,
			content_json: true,
		},
	});
	console.log(`Loaded ${articles.length} article(s).\n`);

	// --- title/date mismatch + missing-from-source + out-of-range + dupes ---
	const legacy_id_counts = new Map<number, string[]>();

	for (const article of articles) {
		const legacy_id = article.legacy_id;
		if (legacy_id === null) continue;

		legacy_id_counts.set(legacy_id, [
			...(legacy_id_counts.get(legacy_id) ?? []),
			article.id,
		]);

		if (legacy_id > LAST_REAL_LEGACY_ID) {
			discrepancies.push({
				kind: "legacy_id_out_of_range",
				legacy_id,
				article_id: article.id,
				title: article.title,
				published_at: article.published_at?.toISOString() ?? null,
			});
			continue; // out-of-range ids were never real legacy rows; skip title/date checks
		}

		const legacy = legacy_rows.get(legacy_id);
		if (!legacy) {
			discrepancies.push({
				kind: "missing_from_legacy_source",
				legacy_id,
				article_id: article.id,
				title: article.title,
			});
			continue;
		}

		if (legacy.title !== article.title) {
			discrepancies.push({
				kind: "title_mismatch",
				legacy_id,
				article_id: article.id,
				legacy_title: legacy.title,
				our_title: article.title,
				source: legacy.source,
			});
		}

		if (
			!article.published_at ||
			!same_day(legacy.published_at, article.published_at)
		) {
			discrepancies.push({
				kind: "date_mismatch",
				legacy_id,
				article_id: article.id,
				title: article.title,
				legacy_published_at: legacy.published_at.toISOString(),
				our_published_at: article.published_at?.toISOString() ?? null,
				source: legacy.source,
			});
		}
	}

	for (const [legacy_id, article_ids] of legacy_id_counts) {
		if (article_ids.length > 1) {
			discrepancies.push({
				kind: "duplicate_legacy_id",
				legacy_id,
				article_ids,
			});
		}
	}

	const our_legacy_ids = new Set(legacy_id_counts.keys());
	for (const [legacy_id, legacy] of legacy_rows) {
		if (!our_legacy_ids.has(legacy_id)) {
			discrepancies.push({
				kind: "no_article_for_legacy_id",
				legacy_id,
				legacy_title: legacy.title,
				legacy_published_at: legacy.published_at.toISOString(),
				source: legacy.source,
			});
		}
	}

	// --- stray hotlinks -----------------------------------------------------
	for (const article of articles) {
		if (!article.content_json) continue;
		const raw = JSON.stringify(article.content_json);
		const counts = new Map<string, number>();
		for (const url of raw.match(URL_RE) ?? []) {
			counts.set(url, (counts.get(url) ?? 0) + 1);
		}
		for (const [url, occurrences] of counts) {
			const link_kind = classify_hotlink(url);
			if (!link_kind) continue;
			discrepancies.push({
				kind: "stray_hotlink",
				link_kind,
				legacy_id: article.legacy_id,
				article_id: article.id,
				title: article.title,
				url,
				occurrences,
			});
		}
	}

	// --- orphaned slugs: non-primary or primary slug stuck on a deleted row -
	const slugs = await db.query.ArticleSlug.findMany({
		columns: { id: true, slug: true, article_id: true, is_primary: true },
		with: { article: { columns: { status: true } } },
	});
	for (const slug of slugs) {
		if (slug.article.status === "deleted") {
			discrepancies.push({
				kind: "orphaned_slug",
				slug: slug.slug,
				slug_id: slug.id,
				article_id: slug.article_id,
				article_status: slug.article.status,
				is_primary: slug.is_primary,
			});
		}
	}

	// --- suspicious published_at: recently written but not a recent real edit
	// Heuristic: published_at falls within the last 14 days of "now" while the
	// article carries a legacy_id (i.e. it's a migrated old-site article, whose
	// true publish date should be years in the past) and differs from
	// created_at by more than a day — the exact re-dating signature the
	// decide_published_at bug produced for legacy_id 310/635. A flag here is
	// not proof of the bug (a genuinely-just-published legacy article would
	// also match) — it's a worklist for manual confirmation against
	// Objave.txt/legacy-html, same as those two were.
	const now = new Date();
	const RECENT_WINDOW_MS = 14 * 24 * 60 * 60 * 1000;
	for (const article of articles) {
		if (!article.published_at || article.legacy_id === null) continue;
		const age_ms = now.getTime() - article.published_at.getTime();
		if (age_ms < 0 || age_ms > RECENT_WINDOW_MS) continue;

		const gap_days =
			Math.abs(article.published_at.getTime() - article.created_at.getTime()) /
			(1000 * 60 * 60 * 24);
		if (gap_days < 1) continue;

		discrepancies.push({
			kind: "suspicious_published_at",
			article_id: article.id,
			legacy_id: article.legacy_id,
			title: article.title,
			published_at: article.published_at.toISOString(),
			created_at: article.created_at.toISOString(),
			gap_days: Math.round(gap_days * 10) / 10,
		});
	}

	// --- summarize + write ---------------------------------------------------
	const by_kind = new Map<string, number>();
	for (const d of discrepancies)
		by_kind.set(d.kind, (by_kind.get(d.kind) ?? 0) + 1);

	console.log("Discrepancy counts:");
	for (const [kind, count] of [...by_kind].sort()) {
		console.log(`  ${kind}: ${count}`);
	}
	console.log(`\nTotal: ${discrepancies.length}`);

	await fs.writeFile(OUT_PATH, JSON.stringify(discrepancies, null, 2), "utf8");
	console.log(`\nWritten to ${OUT_PATH}`);
}

main()
	.catch((error) => {
		console.error(error);
		process.exitCode = 1;
	})
	.finally(() => process.exit());
