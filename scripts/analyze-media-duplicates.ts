import crypto from "node:crypto";
import fs from "node:fs";
import fsp from "node:fs/promises";
import path from "node:path";
import { parseArgs } from "node:util";
import { eq, sql } from "drizzle-orm";
import { db } from "~/server/db";
import { Article, Media, MediaToArticles } from "~/server/db/schema";

/**
 * Finds byte-identical `Media` rows (the "thumbnail crop and its embedded
 * copy landed on two different rows during rehosting" bug documented in
 * HANDOFF.md) by hashing the *actual files*, not comparing ids/urls — those
 * are exactly what's unreliable here.
 *
 * Does not touch B2 or the live app. Reads a local mirror of the media
 * bucket (pull one first, see the `b2 sync` command in HANDOFF.md /
 * TODO.md) and cross-references it against the DB. Two outputs:
 *
 *   - `artifacts/media-dedupe-plan.json`: duplicate groups, the canonical
 *     row per group (oldest = first upload wins), every url that needs
 *     remapping, and every article that references a duplicate — input to
 *     `scripts/dedupe-media.ts`.
 *   - with `--execute`, backfills `Media.hash` for every row matched in the
 *     mirror (not just the duplicates) — a side effect worth keeping since
 *     the hashing work is already done, and a future upload-time dedup
 *     check will want this column populated.
 *
 * Usage:
 *   bun run scripts/analyze-media-duplicates.ts --mirror-dir ./b2-mirror/gradivo
 *   bun run scripts/analyze-media-duplicates.ts --mirror-dir ./b2-mirror/gradivo --execute
 */

const OUT_PATH = "artifacts/media-dedupe-plan.json";

interface MirrorEntry {
	media_id: string;
	original_path: string;
	hash: string;
}

interface UrlRemapEntry {
	from: string;
	to: string;
}

interface DuplicateGroup {
	hash: string;
	canonical_id: string;
	canonical_url: string;
	canonical_created_at: string;
	duplicates: {
		id: string;
		url: string;
		created_at: string;
		filename: string;
	}[];
	url_remap: UrlRemapEntry[];
	unmatched_variants: UrlRemapEntry[]; // dup variant urls with no counterpart on canonical
	affected_articles: {
		id: string;
		title: string;
		via: ("thumbnail" | "media_to_articles" | "content_reference")[];
	}[];
}

async function hash_file(file_path: string): Promise<string> {
	const hash = crypto.createHash("sha256");
	await new Promise<void>((resolve, reject) => {
		const stream = fs.createReadStream(file_path);
		stream.on("data", (chunk) => hash.update(chunk));
		stream.on("end", () => resolve());
		stream.on("error", reject);
	});
	return hash.digest("hex");
}

/** Walks `<mirror_dir>/<media_id>/original.*`, hashing each one found. */
async function scan_mirror(mirror_dir: string): Promise<MirrorEntry[]> {
	const entries = await fsp.readdir(mirror_dir, { withFileTypes: true });
	const uuid_dirs = entries.filter((entry) => entry.isDirectory());

	const results: MirrorEntry[] = [];
	let processed = 0;
	for (const dir of uuid_dirs) {
		const dir_path = path.join(mirror_dir, dir.name);
		const files = await fsp.readdir(dir_path);
		const original_name = files.find((f) => f.startsWith("original."));
		if (!original_name) {
			console.warn(`  ${dir.name}: no original.* file found, skipping`);
			continue;
		}

		const original_path = path.join(dir_path, original_name);
		const hash = await hash_file(original_path);
		results.push({ media_id: dir.name, original_path, hash });

		processed++;
		if (processed % 200 === 0) {
			console.log(`  hashed ${processed}/${uuid_dirs.length}`);
		}
	}
	return results;
}

async function main() {
	const { values } = parseArgs({
		options: {
			"mirror-dir": { type: "string" },
			execute: { type: "boolean" },
		},
	});
	const mirror_dir = values["mirror-dir"];
	const execute = values.execute ?? false;

	if (!mirror_dir) {
		console.error("Usage: --mirror-dir <path to local B2 bucket mirror>");
		process.exitCode = 1;
		return;
	}

	console.log(`Scanning ${mirror_dir} ...`);
	const mirror_entries = await scan_mirror(mirror_dir);
	console.log(`Hashed ${mirror_entries.length} file(s) from the mirror.\n`);

	const media_rows = await db.query.Media.findMany({
		columns: {
			id: true,
			filename: true,
			original: true,
			variants: true,
			created_at: true,
		},
	});
	const media_by_id = new Map(media_rows.map((m) => [m.id, m]));

	const hash_by_media_id = new Map(
		mirror_entries.map((e) => [e.media_id, e.hash]),
	);

	const missing_from_db = mirror_entries.filter(
		(e) => !media_by_id.has(e.media_id),
	);
	const missing_from_mirror = media_rows.filter(
		(m) => !hash_by_media_id.has(m.id),
	);
	if (missing_from_db.length > 0) {
		console.warn(
			`${missing_from_db.length} mirror dir(s) have no matching Media row (ignored).`,
		);
	}
	if (missing_from_mirror.length > 0) {
		console.warn(
			`${missing_from_mirror.length} Media row(s) have no file in the mirror ` +
				`— re-sync the bucket before trusting this analysis as complete.`,
		);
	}

	// Group matched media rows by hash.
	const groups_by_hash = new Map<string, (typeof media_rows)[number][]>();
	for (const media of media_rows) {
		const hash = hash_by_media_id.get(media.id);
		if (!hash) continue;
		const group = groups_by_hash.get(hash) ?? [];
		group.push(media);
		groups_by_hash.set(hash, group);
	}

	const duplicate_groups: DuplicateGroup[] = [];
	for (const [hash, rows] of groups_by_hash) {
		if (rows.length < 2) continue;

		const sorted = [...rows].sort(
			(a, b) => a.created_at.getTime() - b.created_at.getTime(),
		);
		const canonical = sorted[0]!;
		const duplicate_rows = sorted.slice(1);

		const canonical_keyed = new Map<string, string>(); // "original" | "widthxformat" -> url
		canonical_keyed.set("original", canonical.original.url);
		for (const v of canonical.variants) {
			canonical_keyed.set(`${v.width}x${v.format}`, v.url);
		}

		const url_remap: UrlRemapEntry[] = [];
		const unmatched_variants: UrlRemapEntry[] = [];
		const affected_articles_map = new Map<
			string,
			{ title: string; via: Set<string> }
		>();

		const duplicates: DuplicateGroup["duplicates"] = [];

		for (const dup of duplicate_rows) {
			duplicates.push({
				id: dup.id,
				url: dup.original.url,
				created_at: dup.created_at.toISOString(),
				filename: dup.filename,
			});

			url_remap.push({ from: dup.original.url, to: canonical.original.url });
			for (const v of dup.variants) {
				const key = `${v.width}x${v.format}`;
				const canonical_url = canonical_keyed.get(key);
				if (canonical_url) {
					url_remap.push({ from: v.url, to: canonical_url });
				} else {
					unmatched_variants.push({ from: v.url, to: canonical.original.url });
				}
			}

			// References: thumbnail, media_to_articles, and raw content_json text
			// (covers image/attaches blocks *and* inline-HTML PDF links — same
			// reasoning as reconcile-media.ts's extract_inline_media_urls).
			const as_thumbnail = await db.query.Article.findMany({
				where: eq(Article.thumbnail_media_id, dup.id),
				columns: { id: true, title: true },
			});
			for (const a of as_thumbnail) {
				const entry = affected_articles_map.get(a.id) ?? {
					title: a.title,
					via: new Set(),
				};
				entry.via.add("thumbnail");
				affected_articles_map.set(a.id, entry);
			}

			const linked = await db.query.MediaToArticles.findMany({
				where: eq(MediaToArticles.media_id, dup.id),
				with: { article: { columns: { id: true, title: true } } },
			});
			for (const link of linked) {
				const entry = affected_articles_map.get(link.article.id) ?? {
					title: link.article.title,
					via: new Set(),
				};
				entry.via.add("media_to_articles");
				affected_articles_map.set(link.article.id, entry);
			}

			const content_referencing = await db
				.select({ id: Article.id, title: Article.title })
				.from(Article)
				.where(
					sql`${Article.content_json}::text LIKE ${`%${dup.original.url}%`}`,
				);
			for (const a of content_referencing) {
				const entry = affected_articles_map.get(a.id) ?? {
					title: a.title,
					via: new Set(),
				};
				entry.via.add("content_reference");
				affected_articles_map.set(a.id, entry);
			}
		}

		duplicate_groups.push({
			hash,
			canonical_id: canonical.id,
			canonical_url: canonical.original.url,
			canonical_created_at: canonical.created_at.toISOString(),
			duplicates,
			url_remap,
			unmatched_variants,
			affected_articles: [...affected_articles_map.entries()].map(
				([id, { title, via }]) => ({
					id,
					title,
					via: [...via] as DuplicateGroup["affected_articles"][number]["via"],
				}),
			),
		});
	}

	console.log(`\nFound ${duplicate_groups.length} duplicate group(s).`);
	const total_dupe_rows = duplicate_groups.reduce(
		(sum, g) => sum + g.duplicates.length,
		0,
	);
	console.log(`${total_dupe_rows} duplicate Media row(s) to retire.`);
	const unmatched_total = duplicate_groups.reduce(
		(sum, g) => sum + g.unmatched_variants.length,
		0,
	);
	if (unmatched_total > 0) {
		console.warn(
			`${unmatched_total} variant url(s) had no canonical counterpart — ` +
				`review "unmatched_variants" in the plan before running the dedupe script.`,
		);
	}

	await fsp.mkdir("artifacts", { recursive: true });
	await fsp.writeFile(
		OUT_PATH,
		JSON.stringify(
			{ generated_at: new Date().toISOString(), duplicate_groups },
			null,
			2,
		),
		"utf8",
	);
	console.log(`\nPlan written to ${OUT_PATH}`);

	if (!execute) {
		console.log(
			"\nDry run only — pass --execute to backfill Media.hash for all matched rows.",
		);
		return;
	}

	// Only backfill mirror entries that actually matched a Media row — the
	// mirror also contains B2 objects with no row at all (see the
	// missing_from_db warning above), and their key isn't even guaranteed to
	// be a uuid (e.g. some other key scheme entirely), so blindly updating by
	// mirror dir name throws a uuid-cast error partway through the loop.
	const to_backfill = [...hash_by_media_id].filter(([media_id]) =>
		media_by_id.has(media_id),
	);

	// Batched as one UPDATE ... FROM (VALUES ...) per chunk instead of one
	// round trip per row — sequential awaits over a pooled connection took
	// long enough on a full run to be worth avoiding.
	const CHUNK_SIZE = 500;
	let updated = 0;
	for (let i = 0; i < to_backfill.length; i += CHUNK_SIZE) {
		const chunk = to_backfill.slice(i, i + CHUNK_SIZE);
		const values = sql.join(
			chunk.map(([media_id, hash]) => sql`(${media_id}::uuid, ${hash})`),
			sql`, `,
		);
		await db.execute(sql`
			update ${Media}
			set hash = v.hash
			from (values ${values}) as v(id, hash)
			where ${Media.id} = v.id
		`);
		updated += chunk.length;
		console.log(`  backfilled ${updated}/${to_backfill.length}`);
	}
	console.log(`\nBackfilled Media.hash for ${updated} row(s).`);
}

main()
	.catch((error) => {
		console.error(error);
		process.exitCode = 1;
	})
	.finally(() => process.exit());
