import fs from "node:fs/promises";
import { parseArgs } from "node:util";
import { is_waived, load_waivers } from "~/lib/legacy-diff-waivers";

/**
 * Step 3/3 of the perceptual-match pipeline: reviews
 * `artifacts/media-hash-diff/perceptual-match.json` (written by
 * `tools/perceptual-match/match.py`) and, with `--apply`, appends its "same"
 * bucket into `artifacts/media-hash-diff-waivers.jsonc` — never silently;
 * this script only ever prints the "maybe" bucket, it doesn't waive it. Look
 * those over by hand and either fix the underlying finding or add them to
 * the waiver file yourself with a note on why.
 *
 * Usage:
 *   bun run scripts/review-perceptual-matches.ts            # print only
 *   bun run scripts/review-perceptual-matches.ts --apply     # + waive "same"
 */

const RESULTS_PATH = "artifacts/media-hash-diff/perceptual-match.json";
const WAIVERS_PATH = "artifacts/media-hash-diff-waivers.jsonc";

interface MatchResult {
	legacy_id: number;
	article_id: string;
	title: string;
	legacy_url: string;
	best_media_id: string | null;
	similarity: number | null;
	bucket: "same" | "maybe" | "no_match";
	reason?: string;
}

async function append_waivers(
	path: string,
	entries: { legacy_id: number; legacy_url: string; comment: string }[],
) {
	const text = await fs.readFile(path, "utf8");
	const close_idx = text.lastIndexOf("]");
	let before = text.slice(0, close_idx).replace(/\s+$/, "");
	const is_empty = before.endsWith("[");
	if (!is_empty && !before.endsWith(",")) before += ",";

	const block = entries
		.map(
			(e) =>
				`\t// ${e.comment}\n\t{ "legacy_id": ${e.legacy_id}, "kind": "missing_hash", "legacy_url": ${JSON.stringify(e.legacy_url)} },`,
		)
		.join("\n");

	const new_text = `${before}\n${block}\n${text.slice(close_idx)}`;
	await fs.writeFile(path, new_text, "utf8");
}

async function main() {
	const { values } = parseArgs({ options: { apply: { type: "boolean" } } });
	const apply = values.apply ?? false;

	const raw = await fs.readFile(RESULTS_PATH, "utf8").catch(() => null);
	if (!raw) {
		console.error(
			`${RESULTS_PATH} not found - run \`cd tools/perceptual-match && uv run match.py\` first.`,
		);
		process.exitCode = 1;
		return;
	}
	const results = JSON.parse(raw) as MatchResult[];

	const by_bucket = new Map<string, MatchResult[]>();
	for (const r of results) {
		by_bucket.set(r.bucket, [...(by_bucket.get(r.bucket) ?? []), r]);
	}
	console.log("Bucket counts:");
	for (const [bucket, rows] of [...by_bucket].sort()) {
		console.log(`  ${bucket}: ${rows.length}`);
	}

	const maybe = by_bucket.get("maybe") ?? [];
	if (maybe.length > 0) {
		console.log(`\n"maybe" bucket - review by hand (${maybe.length}):`);
		for (const r of maybe) {
			console.log(
				`  [${r.legacy_id}] ${r.title}\n    ${r.legacy_url}\n    -> media ${r.best_media_id} (similarity ${r.similarity})`,
			);
		}
	}

	const same = by_bucket.get("same") ?? [];
	if (same.length === 0) {
		console.log('\nNo "same" bucket entries to waive.');
		return;
	}

	const waivers = await load_waivers(WAIVERS_PATH);
	const to_waive = same.filter(
		(r) =>
			!is_waived(waivers, {
				legacy_id: r.legacy_id,
				kind: "missing_hash",
				legacy_url: r.legacy_url,
			}),
	);

	console.log(`\n"same" bucket (${same.length}, ${to_waive.length} new):`);
	for (const r of to_waive) {
		console.log(
			`  [${r.legacy_id}] ${r.title}\n    ${r.legacy_url}\n    -> media ${r.best_media_id} (similarity ${r.similarity})`,
		);
	}

	if (!apply) {
		console.log(
			`\nDry run only - re-run with --apply to write ${to_waive.length} entrie(s) into ${WAIVERS_PATH}.`,
		);
		return;
	}
	if (to_waive.length === 0) {
		console.log("\nNothing new to write.");
		return;
	}

	await append_waivers(
		WAIVERS_PATH,
		to_waive.map((r) => ({
			legacy_id: r.legacy_id,
			legacy_url: r.legacy_url,
			comment: `DINOv2 match, similarity ${r.similarity} (media ${r.best_media_id}) - re-supplied original, see docs/research/legacy-migration-notes.md`,
		})),
	);
	console.log(`\nWrote ${to_waive.length} entrie(s) to ${WAIVERS_PATH}.`);
}

main()
	.catch((error) => {
		console.error(error);
		process.exitCode = 1;
	})
	.finally(() => process.exit());
