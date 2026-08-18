import fs from "node:fs/promises";
import path from "node:path";
import mime from "mime/lite";
import { resolve_legacy_image_bytes } from "~/lib/legacy-media-bytes";
import { db } from "~/server/db";

/**
 * Step 1/3 of the perceptual-match pipeline for
 * `artifacts/media-hash-diff/missing_hash.json`'s image findings (see
 * `docs/research/legacy-migration-notes.md`'s "2024-2025 missing media red
 * herring": most of these are re-supplied originals, not lost photos).
 *
 * Downloads both sides of every candidate comparison to local disk — the
 * legacy image the finding points at, and every image currently attached to
 * that same article (the only candidates worth comparing against; a photo
 * that moved to a *different* article isn't this pipeline's problem) — and
 * writes a manifest `tools/perceptual-match/match.py` reads.
 *
 * Deliberately doesn't touch PDFs (`media_kind: "pdf"`) — DINOv2 embeddings
 * are for photos, not document layout.
 *
 * Usage:
 *   bun run scripts/prepare-perceptual-match.ts
 *   cd tools/perceptual-match && uv run match.py   # step 2
 *   bun run scripts/review-perceptual-matches.ts   # step 3
 */

const SERVED_ROOT = "D:\\Luka\\JKNM\\served";
const FINDINGS_PATH = "artifacts/media-hash-diff/missing_hash.json";
const CACHE_DIR = "artifacts/perceptual-cache";
const MANIFEST_PATH = "artifacts/media-hash-diff/perceptual-input.json";

interface MissingHashFinding {
	kind: "missing_hash";
	legacy_id: number;
	article_id: string;
	title: string;
	media_kind: "image" | "pdf";
	legacy_url: string;
	resolved_from: "served" | "live";
}

interface CandidateImage {
	media_id: string;
	path: string;
}

interface ManifestEntry {
	legacy_id: number;
	article_id: string;
	title: string;
	legacy_url: string;
	legacy_path: string;
	candidates: CandidateImage[];
}

async function cache_legacy_image(
	finding: MissingHashFinding,
): Promise<string | null> {
	const key = new URL(finding.legacy_url).pathname.replace(/^\/+/, "");
	const resolved = await resolve_legacy_image_bytes(
		SERVED_ROOT,
		finding.legacy_url,
		key,
	);
	if (!resolved) return null;

	const dir = path.join(CACHE_DIR, "legacy");
	await fs.mkdir(dir, { recursive: true });
	const out_path = path.join(dir, `${finding.legacy_id}_${path.basename(key)}`);
	await fs.writeFile(out_path, resolved.bytes);
	return out_path;
}

async function cache_candidate(
	media_id: string,
	url: string,
	existing_files: Set<string>,
): Promise<string | null> {
	const found = [...existing_files].find((f) => f.startsWith(`${media_id}.`));
	if (found) return path.join(CACHE_DIR, "candidates", found);

	let bytes: Buffer | undefined;
	let content_type = "";
	for (let attempt = 0; attempt < 2 && !bytes; attempt++) {
		try {
			const response = await fetch(url);
			if (!response.ok) return null;
			bytes = Buffer.from(await response.arrayBuffer());
			content_type = response.headers.get("content-type") ?? "";
		} catch (error) {
			if (attempt === 1) {
				console.log(`  ! could not fetch candidate ${media_id}: ${error}`);
				return null;
			}
		}
	}
	if (!bytes) return null;
	const extension = mime.getExtension(content_type) ?? "bin";

	const dir = path.join(CACHE_DIR, "candidates");
	await fs.mkdir(dir, { recursive: true });
	const out_path = path.join(dir, `${media_id}.${extension}`);
	await fs.writeFile(out_path, bytes);
	existing_files.add(path.basename(out_path));
	return out_path;
}

async function main() {
	const raw = await fs.readFile(FINDINGS_PATH, "utf8").catch(() => null);
	if (!raw) {
		console.error(
			`${FINDINGS_PATH} not found - run scripts/legacy-media-hash-diff.ts first.`,
		);
		process.exitCode = 1;
		return;
	}

	const findings = (JSON.parse(raw) as MissingHashFinding[]).filter(
		(f) => f.media_kind === "image",
	);
	console.log(`${findings.length} missing_hash image finding(s) to prepare.`);

	const article_ids = [...new Set(findings.map((f) => f.article_id))];
	const candidates_by_article = new Map<
		string,
		{ media_id: string; url: string }[]
	>();
	for (const article_id of article_ids) {
		const article = await db.query.Article.findFirst({
			where: (a, { eq }) => eq(a.id, article_id),
			columns: {},
			with: {
				media_to_articles: {
					columns: {},
					with: { media: { columns: { id: true, original: true } } },
				},
			},
		});
		candidates_by_article.set(
			article_id,
			(article?.media_to_articles ?? []).map((m) => ({
				media_id: m.media.id,
				url: m.media.original.url,
			})),
		);
	}

	const existing_candidate_files = new Set(
		await fs
			.readdir(path.join(CACHE_DIR, "candidates"))
			.catch(() => [] as string[]),
	);

	const manifest: ManifestEntry[] = [];
	let unresolvable = 0;

	for (const finding of findings) {
		const legacy_path = await cache_legacy_image(finding);
		if (!legacy_path) {
			unresolvable += 1;
			console.log(`  ! could not fetch legacy bytes: ${finding.legacy_url}`);
			continue;
		}

		const article_candidates =
			candidates_by_article.get(finding.article_id) ?? [];
		const candidates: CandidateImage[] = [];
		for (const candidate of article_candidates) {
			const cached_path = await cache_candidate(
				candidate.media_id,
				candidate.url,
				existing_candidate_files,
			);
			if (cached_path) {
				candidates.push({ media_id: candidate.media_id, path: cached_path });
			}
		}

		manifest.push({
			legacy_id: finding.legacy_id,
			article_id: finding.article_id,
			title: finding.title,
			legacy_url: finding.legacy_url,
			legacy_path,
			candidates,
		});
	}

	await fs.mkdir(path.dirname(MANIFEST_PATH), { recursive: true });
	await fs.writeFile(MANIFEST_PATH, JSON.stringify(manifest, null, 2), "utf8");

	console.log(
		`\nWrote ${manifest.length} manifest entrie(s) (${unresolvable} unresolvable, skipped) to ${MANIFEST_PATH}`,
	);
	console.log(`Image cache: ${CACHE_DIR}/`);
	console.log("Next: cd tools/perceptual-match && uv run match.py");
}

main()
	.catch((error) => {
		console.error(error);
		process.exitCode = 1;
	})
	.finally(() => process.exit());
