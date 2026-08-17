import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { parse as parse_csv } from "csv-parse/sync";
import mime from "mime/lite";
import { is_waived, load_waivers } from "~/lib/legacy-diff-waivers";
import { extract_legacy_media_paths } from "~/lib/legacy-media-source";
import { resolve_pdf_bytes } from "~/lib/resolve-static-pdf";
import { db } from "~/server/db";

/**
 * Report-only diff between the media a legacy article actually carried
 * (scraped `www.jknm.si` content, ids 1-691) and what's byte-identical and
 * attached in the current `media`/`media_to_articles` tables — the media
 * counterpart to `scripts/legacy-link-diff.ts`'s hyperlink comparison, kept
 * as a separate script per that decision (different comparison unit: file
 * bytes vs link targets).
 *
 * Articles only — the 5 evergreen pages were rebuilt from scratch rather than
 * migrated from legacy media, so there's nothing to diff (confirmed with the
 * user, matching the same call already made for `legacy-link-diff.ts`).
 *
 * Legacy media refs come from the same two body sources as the link-diff
 * script (`Objave.txt` col 7 / `artifacts/legacy-html/<id>.html`), extracted
 * two ways:
 *  - images: `extract_legacy_media_paths` (`/media/img/novice/...`, the
 *    scheme used repo-wide for legacy images).
 *  - PDFs: pathname-agnostic — per the map's decision, legacy PDFs aren't
 *    confined to a fixed prefix, so every `href` ending in `.pdf` is scanned
 *    regardless of path shape.
 *
 * Bytes are resolved served-mirror-first, live-fetch-fallback
 * (`resolve_pdf_bytes` for PDFs; the same pattern inlined for images, since
 * there's no image equivalent of that helper yet), then sha256'd and looked
 * up against `Media.hash` — content-addressing means a byte-identical match
 * is a hash match, nothing fuzzier is needed once bytes are in hand.
 *
 * Output is one JSON file per finding kind under artifacts/media-hash-diff/,
 * same split-by-kind convention as audit-all-discrepancies.ts — minus
 * whatever artifacts/media-hash-diff-waivers.jsonc has marked as
 * deliberately ignored (see src/lib/legacy-diff-waivers.ts).
 *
 * Usage: bun run scripts/legacy-media-hash-diff.ts
 */

const CSV_PATH = "artifacts/Objave.txt";
const HTML_DIR = "artifacts/legacy-html";
const SERVED_ROOT = "D:\\Luka\\JKNM\\served";
const OUT_DIR = "artifacts/media-hash-diff";
const WAIVERS_PATH = "artifacts/media-hash-diff-waivers.jsonc";
const LAST_REAL_LEGACY_ID = 691;

const PDF_HREF_RE = /href="([^"]+\.pdf)"/gi;

interface LegacyBody {
	legacy_id: number;
	body_html: string;
}

async function load_csv_bodies(): Promise<Map<number, LegacyBody>> {
	const text = await fs.readFile(CSV_PATH, "utf8");
	const records: string[][] = parse_csv(text, {
		columns: false,
		relax_column_count: true,
	});

	const bodies = new Map<number, LegacyBody>();
	for (const record of records) {
		const legacy_id = Number(record[0]);
		if (!Number.isFinite(legacy_id)) continue;
		const body_html = (record[6] ?? "").trim();
		if (!body_html) continue;
		bodies.set(legacy_id, { legacy_id, body_html });
	}
	return bodies;
}

async function load_html_bodies(): Promise<Map<number, LegacyBody>> {
	const bodies = new Map<number, LegacyBody>();
	const files = await fs.readdir(HTML_DIR).catch(() => [] as string[]);

	for (const file of files) {
		const legacy_id = Number(file.replace(/\.html$/, ""));
		if (!Number.isFinite(legacy_id)) continue;
		const body_html = await fs.readFile(path.join(HTML_DIR, file), "utf8");
		bodies.set(legacy_id, { legacy_id, body_html });
	}
	return bodies;
}

function extract_legacy_pdf_refs(body_html: string): string[] {
	return [
		...new Set([...body_html.matchAll(PDF_HREF_RE)].map((m) => m[1] as string)),
	];
}

type Kind = "image" | "pdf";

interface MediaRef {
	kind: Kind;
	/** Absolute url the ref resolves to on the legacy site. */
	url: string;
	/** Site-root-relative key, used for both the served-mirror path and the b2-style key. */
	key: string;
}

function to_media_ref(kind: Kind, raw: string): MediaRef | null {
	let url: URL;
	try {
		url = new URL(raw, "https://www.jknm.si");
	} catch {
		return null;
	}
	if (!/jknm\.si$/i.test(url.hostname)) return null; // legitimately external, out of scope
	return { kind, url: url.toString(), key: url.pathname.replace(/^\/+/, "") };
}

async function read_served_image(key: string) {
	const bytes = await fs
		.readFile(path.join(SERVED_ROOT, key))
		.catch(() => null);
	if (!bytes) return null;
	const extension = path.extname(key).slice(1).toLowerCase();
	return {
		bytes,
		content_type: mime.getType(extension) ?? "application/octet-stream",
	};
}

async function fetch_live_image(url: string) {
	const response = await fetch(url);
	if (!response.ok) return null;
	return {
		bytes: Buffer.from(await response.arrayBuffer()),
		content_type:
			response.headers.get("content-type") ?? "application/octet-stream",
	};
}

async function resolve_media_bytes(ref: MediaRef) {
	if (ref.kind === "pdf") {
		try {
			const { bytes, source } = await resolve_pdf_bytes(
				ref.url,
				ref.key,
				SERVED_ROOT,
			);
			return { bytes, source };
		} catch {
			return null;
		}
	}

	const served = await read_served_image(ref.key);
	if (served) return { bytes: served.bytes, source: "served" as const };

	const live = await fetch_live_image(ref.url);
	if (live) return { bytes: live.bytes, source: "live" as const };

	return null;
}

function hash_bytes(bytes: Buffer): string {
	return crypto.createHash("sha256").update(bytes).digest("hex");
}

interface UnresolvedFinding {
	kind: "unresolved";
	legacy_id: number;
	article_id: string;
	title: string;
	media_kind: Kind;
	legacy_url: string;
}

interface MissingHashFinding {
	kind: "missing_hash";
	legacy_id: number;
	article_id: string;
	title: string;
	media_kind: Kind;
	legacy_url: string;
	resolved_from: "served" | "live";
}

interface WrongArticleFinding {
	kind: "wrong_article";
	legacy_id: number;
	article_id: string;
	title: string;
	media_kind: Kind;
	legacy_url: string;
	media_id: string;
}

type Finding = UnresolvedFinding | MissingHashFinding | WrongArticleFinding;

async function main() {
	const waivers = await load_waivers(WAIVERS_PATH);

	const csv_bodies = await load_csv_bodies();
	const html_bodies = await load_html_bodies();
	const legacy_bodies = new Map<number, LegacyBody>(csv_bodies);
	for (const [id, body] of html_bodies) {
		if (!legacy_bodies.has(id)) legacy_bodies.set(id, body);
	}
	console.log(
		`Loaded ${csv_bodies.size} CSV body(s) + ${html_bodies.size} HTML body(s) (${legacy_bodies.size} distinct legacy ids).`,
	);

	const articles = await db.query.Article.findMany({
		columns: { id: true, legacy_id: true, title: true },
		with: {
			media_to_articles: {
				columns: {},
				with: { media: { columns: { hash: true } } },
			},
		},
	});

	const findings: Finding[] = [];
	let checked = 0;
	let refs_seen = 0;

	for (const article of articles) {
		if (article.legacy_id === null) continue;
		if (article.legacy_id > LAST_REAL_LEGACY_ID) continue;
		const legacy = legacy_bodies.get(article.legacy_id);
		if (!legacy) continue;

		checked += 1;
		const attached_hashes = new Set(
			article.media_to_articles.map((m) => m.media.hash),
		);

		const image_refs = extract_legacy_media_paths(legacy.body_html)
			.map((p) => to_media_ref("image", p))
			.filter((r): r is MediaRef => r !== null);
		const pdf_refs = extract_legacy_pdf_refs(legacy.body_html)
			.map((p) => to_media_ref("pdf", p))
			.filter((r): r is MediaRef => r !== null);

		console.log(
			`\n[${article.legacy_id}] ${article.title} - ${image_refs.length} image(s), ${pdf_refs.length} pdf(s)`,
		);

		for (const ref of [...image_refs, ...pdf_refs]) {
			refs_seen += 1;
			const resolved = await resolve_media_bytes(ref);
			if (!resolved) {
				findings.push({
					kind: "unresolved",
					legacy_id: article.legacy_id,
					article_id: article.id,
					title: article.title,
					media_kind: ref.kind,
					legacy_url: ref.url,
				});
				console.log(`    ? unresolved: ${ref.url}`);
				continue;
			}

			const hash = hash_bytes(resolved.bytes);
			const media = await db.query.Media.findFirst({
				where: (m, { eq }) => eq(m.hash, hash),
				columns: { id: true },
			});

			if (!media) {
				findings.push({
					kind: "missing_hash",
					legacy_id: article.legacy_id,
					article_id: article.id,
					title: article.title,
					media_kind: ref.kind,
					legacy_url: ref.url,
					resolved_from: resolved.source,
				});
				console.log(`    - missing_hash: ${ref.url}`);
				continue;
			}

			if (!attached_hashes.has(hash)) {
				findings.push({
					kind: "wrong_article",
					legacy_id: article.legacy_id,
					article_id: article.id,
					title: article.title,
					media_kind: ref.kind,
					legacy_url: ref.url,
					media_id: media.id,
				});
				console.log(`    - wrong_article: ${ref.url} -> media ${media.id}`);
			}
		}
	}

	const kept = findings.filter(
		(f) =>
			!is_waived(waivers, {
				legacy_id: f.legacy_id,
				kind: f.kind,
				legacy_url: f.legacy_url,
			}),
	);
	const waived_count = findings.length - kept.length;

	const by_kind = new Map<string, number>();
	for (const f of kept) by_kind.set(f.kind, (by_kind.get(f.kind) ?? 0) + 1);

	console.log(
		`\nChecked ${checked} article(s), ${refs_seen} legacy media ref(s) seen.`,
	);
	console.log("Finding counts:");
	for (const [kind, count] of [...by_kind].sort()) {
		console.log(`  ${kind}: ${count}`);
	}
	console.log(`\nTotal: ${kept.length} (${waived_count} waived)`);

	await fs.rm(OUT_DIR, { recursive: true, force: true });
	await fs.mkdir(OUT_DIR, { recursive: true });
	const by_kind_rows = new Map<string, Finding[]>();
	for (const f of kept) {
		by_kind_rows.set(f.kind, [...(by_kind_rows.get(f.kind) ?? []), f]);
	}
	for (const [kind, rows] of by_kind_rows) {
		const out_path = path.join(OUT_DIR, `${kind}.json`);
		await fs.writeFile(out_path, JSON.stringify(rows, null, 2), "utf8");
	}
	console.log(`\nWritten ${by_kind_rows.size} file(s) to ${OUT_DIR}/`);
}

main()
	.catch((error) => {
		console.error(error);
		process.exitCode = 1;
	})
	.finally(() => process.exit());
