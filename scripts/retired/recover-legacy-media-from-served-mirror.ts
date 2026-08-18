import fs from "node:fs/promises";
import path from "node:path";
import { parseArgs } from "node:util";
import { parse } from "csv-parse/sync";
import { eq, ne } from "drizzle-orm";
import mime from "mime/lite";
import {
	extract_legacy_media_paths,
	find_legacy_media_match,
} from "~/lib/legacy-media-source";
import { find_stale_asset_urls, rewrite_urls } from "~/lib/stale-media-refs";
import { reconcile_media_to_articles } from "~/server/article/reconcile-media";
import { db } from "~/server/db";
import type { ArticleContentType } from "~/server/db/schema";
import { Article } from "~/server/db/schema";
import { authorize_b2, ingest_media } from "~/server/media/ingest";

/**
 * Follow-up to `scripts/rescue-stale-media.ts`: that script fetched stale
 * assets from their old buckets, but 61 references had already lost their
 * bytes there too (bucket 403/404). This resolves those against a static
 * mirror of the old site (`SERVED_ROOT`) instead.
 *
 * Why this couldn't just be `rescue-stale-media.ts` with another fallback
 * host: the mirror has no url to fetch, only a local directory tree keyed by
 * `media/img/novice/<year>/<mm>/<filename>` — and that filename was
 * re-sanitized at least once since (the B2 key has `radescica_02_13.jpg`
 * where the mirror has `radescica_02__13_.JPG`), so recovery means matching
 * fuzzy filenames scoped to one article's own legacy content, not swapping a
 * host in an otherwise-identical url. See `src/lib/legacy-media-source.ts`
 * for why that scoping is what makes the fuzzy match safe.
 *
 * Legacy content comes from two sources depending on the article's age:
 *  - `artifacts/Objave.txt`, the old admin's DB export, covers legacy_id <= 625.
 *  - `artifacts/legacy-html/<id>.html`, scraped from the live site afterward,
 *    covers up to whatever `scrape-legacy-articles.ts` has pulled (~700 as of
 *    this writing).
 * Articles published after both (2024 on) have no legacy source and the
 * mirror itself has nothing past 2023 — those stay reported as ungrounded,
 * not guessed at.
 *
 * Usage:
 *   bun run scripts/retired/recover-legacy-media-from-served-mirror.ts             # dry run
 *   bun run scripts/retired/recover-legacy-media-from-served-mirror.ts --execute
 */

const SERVED_ROOT = "D:\\Luka\\JKNM\\served";
const OBJAVE_CSV_PATH = "artifacts/Objave.txt";
const LEGACY_HTML_DIR = "artifacts/legacy-html";

async function load_legacy_media_by_id(): Promise<Map<number, string[]>> {
	const by_id = new Map<number, string[]>();

	const csv_text = await fs.readFile(OBJAVE_CSV_PATH, "utf8");
	const records: string[][] = parse(csv_text, {
		columns: false,
		relax_column_count: true,
	});
	for (const record of records) {
		const legacy_id = Number(record[0]);
		if (!Number.isFinite(legacy_id)) continue;
		const paths = extract_legacy_media_paths(record[6] ?? "");
		if (paths.length > 0) by_id.set(legacy_id, paths);
	}

	const html_files = await fs.readdir(LEGACY_HTML_DIR).catch(() => []);
	for (const filename of html_files) {
		const match = /^(\d+)\.html$/.exec(filename);
		if (!match) continue;
		const legacy_id = Number(match[1]);
		const html = await fs.readFile(
			path.join(LEGACY_HTML_DIR, filename),
			"utf8",
		);
		const paths = extract_legacy_media_paths(html);
		if (paths.length > 0) by_id.set(legacy_id, paths);
	}

	return by_id;
}

async function read_from_mirror(legacy_path: string) {
	// legacy_path is like "/media/img/novice/2024/07/x.jpg" - strip the
	// leading slash so path.join treats it as relative to SERVED_ROOT.
	const disk_path = path.join(SERVED_ROOT, legacy_path.replace(/^\//, ""));
	const bytes = await fs.readFile(disk_path).catch(() => null);
	if (!bytes) return null;

	const extension = path.extname(legacy_path).slice(1).toLowerCase();
	return {
		bytes,
		content_type: mime.getType(extension) ?? "application/octet-stream",
	};
}

async function main() {
	const { values } = parseArgs({
		options: { execute: { type: "boolean" }, limit: { type: "string" } },
	});
	const execute = values.execute ?? false;
	const limit = values.limit ? Number(values.limit) : undefined;

	const legacy_media_by_id = await load_legacy_media_by_id();

	const articles = await db.query.Article.findMany({
		where: ne(Article.status, "deleted"),
		columns: {
			id: true,
			legacy_id: true,
			status: true,
			title: true,
			content_json: true,
		},
	});

	const affected = articles.filter((article) => {
		if (!article.legacy_id || !article.content_json) return false;
		return (
			find_stale_asset_urls(JSON.stringify(article.content_json)).length > 0
		);
	});

	console.log(
		`${articles.length} live articles, ${affected.length} still referencing stale hosts with a legacy_id to check against the mirror.`,
	);

	const targets = limit ? affected.slice(0, limit) : affected;
	const b2 = execute ? await authorize_b2() : null;

	let recovered = 0;
	const ungrounded: string[] = []; // no legacy source or no candidate at all
	const unmatched: string[] = []; // legacy source exists, nothing normalized-matched
	const missing_on_disk: string[] = []; // matched a legacy path, but file isn't in the mirror

	for (const article of targets) {
		const legacy_id = article.legacy_id;
		if (!legacy_id) continue;

		const original = JSON.stringify(article.content_json);
		const stale_urls = find_stale_asset_urls(original);
		const candidates = legacy_media_by_id.get(legacy_id) ?? [];

		console.log(
			`\n[${legacy_id}] ${article.title} (${article.status}) - ${stale_urls.length} stale, ${candidates.length} legacy media path(s) known`,
		);

		const replacements = new Map<string, string>();
		for (const url of stale_urls) {
			if (candidates.length === 0) {
				ungrounded.push(url);
				console.log(`    ? no legacy source for this article: ${url}`);
				continue;
			}

			const match = find_legacy_media_match(url, candidates);
			if (!match) {
				unmatched.push(url);
				console.log(`    ? no unique filename match: ${url}`);
				continue;
			}

			if (!execute) {
				console.log(`    - ${url}\n      ~ ${match}`);
				continue;
			}

			const found = await read_from_mirror(match);
			if (!found) {
				missing_on_disk.push(url);
				console.log(`    ? matched but not on disk: ${match}`);
				continue;
			}

			const media = await ingest_media(
				{
					bytes: found.bytes,
					filename: path.basename(match),
					content_type: found.content_type,
				},
				{ b2: b2 ?? undefined },
			);

			recovered += 1;
			replacements.set(url, media.original.url);
			console.log(
				`    + ${url}\n      -> ${media.original.url} (${media.variants.length} variants)`,
			);
		}

		if (!execute || replacements.size === 0) continue;

		const rewritten = rewrite_urls(original, replacements);
		if (rewritten === original) continue;

		const content = JSON.parse(rewritten) as ArticleContentType;
		await db.transaction(async (tx) => {
			await tx
				.update(Article)
				.set({ content_json: content })
				.where(eq(Article.id, article.id));
			await reconcile_media_to_articles(tx, article.id, content);
		});
	}

	console.log(
		`\n${recovered} recovered, ${ungrounded.length} with no legacy source, ${unmatched.length} unmatched, ${missing_on_disk.length} matched but missing on disk.`,
	);

	if (!execute) {
		console.log(
			"\nDry run only - re-run with --execute to ingest and rewrite.",
		);
	}
}

main()
	.catch((error) => {
		console.error(error);
		process.exitCode = 1;
	})
	.finally(() => process.exit());
