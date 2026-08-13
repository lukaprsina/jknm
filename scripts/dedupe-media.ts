import fsp from "node:fs/promises";
import { parseArgs } from "node:util";
import { eq, inArray } from "drizzle-orm";
import { reconcile_media_to_articles } from "~/server/article/reconcile-media";
import { db } from "~/server/db";
import type { ArticleContentType } from "~/server/db/schema";
import { Article } from "~/server/db/schema";

/**
 * Applies the plan from `scripts/analyze-media-duplicates.ts`
 * (`artifacts/media-dedupe-plan.json`): rewrites every reference to a
 * duplicate `Media` row so it points at that group's canonical row instead.
 *
 * Deliberately does NOT delete the duplicate `Media` rows or their B2
 * objects. Once every reference is gone, `scripts/sweep-stale-content.ts`
 * finds them as orphaned media on its own (no `media_to_articles` link, not
 * a thumbnail) and removes both the row and the B2 objects after its normal
 * 48h grace window — reusing already-working deletion code instead of
 * duplicating it here, and keeping this script read/rewrite-only.
 *
 * What gets touched per affected article:
 *   - `thumbnail_media_id`, if it pointed at a duplicate. Crop coordinates
 *     (`thumbnail_x/y/width/height`) are left as-is: canonical and duplicate
 *     are byte-identical by construction, so dimensions match.
 *   - `content_json`: every duplicate url (original *and* each variant) is
 *     string-replaced with the canonical row's corresponding url, anywhere
 *     it appears — inside an image/attaches block's `data.file.url` or
 *     inside inline HTML (a PDF link in a paragraph). Matches how
 *     `reconcile-media.ts` finds references in the first place: url text,
 *     not structure.
 *   - `media_to_articles`: not written directly. After `content_json` is
 *     saved, `reconcile_media_to_articles` re-derives the links from the new
 *     content — this is what correctly collapses the case the whole bug is
 *     about (an article whose thumbnail crop *and* an embedded content image
 *     were the same photo on two different rows: after the rewrite both
 *     point at the canonical row, and reconcile links it once instead of
 *     twice).
 *
 * Each article is a separate transaction, so one bad article can't roll back
 * everything already applied — a partially-applied run is safe to re-run,
 * since already-canonical urls simply have nothing left to replace.
 *
 * Usage:
 *   bun run scripts/dedupe-media.ts                      # dry run
 *   bun run scripts/dedupe-media.ts --execute
 *   bun run scripts/dedupe-media.ts --plan path/to/plan.json --execute
 */

const DEFAULT_PLAN_PATH = "artifacts/media-dedupe-plan.json";

interface UrlRemapEntry {
	from: string;
	to: string;
}

interface DuplicateGroup {
	hash: string;
	canonical_id: string;
	canonical_url: string;
	duplicates: { id: string; url: string }[];
	url_remap: UrlRemapEntry[];
	unmatched_variants: UrlRemapEntry[];
	affected_articles: { id: string; title: string; via: string[] }[];
}

interface Plan {
	generated_at: string;
	duplicate_groups: DuplicateGroup[];
}

/** Replaces every occurrence of every `from` url with its `to` url. Exact
 * substring replacement is safe here: urls are full `https://.../<uuid>/...`
 * paths, so there's no risk of one url being a substring of an unrelated
 * one. */
function apply_url_remap(text: string, remap: Map<string, string>): string {
	let result = text;
	for (const [from, to] of remap) {
		if (!result.includes(from)) continue;
		result = result.split(from).join(to);
	}
	return result;
}

async function main() {
	const { values } = parseArgs({
		options: {
			plan: { type: "string" },
			execute: { type: "boolean" },
		},
	});
	const plan_path = values.plan ?? DEFAULT_PLAN_PATH;
	const execute = values.execute ?? false;

	const plan = JSON.parse(await fsp.readFile(plan_path, "utf8")) as Plan;
	console.log(
		`Loaded plan from ${plan_path} (generated ${plan.generated_at}): ` +
			`${plan.duplicate_groups.length} duplicate group(s).`,
	);

	if (plan.duplicate_groups.some((g) => g.unmatched_variants.length > 0)) {
		console.warn(
			"Plan has unmatched_variants entries — those fall back to the " +
				"canonical row's original url. Review the plan before --execute if that's unexpected.\n",
		);
	}

	// media_id -> canonical media_id, across all groups.
	const canonical_by_dup_id = new Map<string, string>();
	// url -> canonical url, across all groups (originals + variants).
	const url_remap = new Map<string, string>();
	// article_id -> { title, group_hashes touched }
	const affected_articles = new Map<string, string>();

	for (const group of plan.duplicate_groups) {
		for (const dup of group.duplicates) {
			canonical_by_dup_id.set(dup.id, group.canonical_id);
		}
		for (const entry of [...group.url_remap, ...group.unmatched_variants]) {
			url_remap.set(entry.from, entry.to);
		}
		for (const a of group.affected_articles) {
			affected_articles.set(a.id, a.title);
		}
	}

	console.log(
		`${canonical_by_dup_id.size} duplicate media row(s), ` +
			`${url_remap.size} url(s) to remap, ` +
			`${affected_articles.size} article(s) affected.\n`,
	);

	let changed_count = 0;
	let unchanged_count = 0;

	for (const [article_id, title] of affected_articles) {
		const article = await db.query.Article.findFirst({
			where: eq(Article.id, article_id),
			columns: {
				id: true,
				title: true,
				thumbnail_media_id: true,
				content_json: true,
			},
		});
		if (!article) {
			console.warn(`  ${article_id} "${title}": not found (skipping)`);
			continue;
		}

		const new_thumbnail_media_id = article.thumbnail_media_id
			? (canonical_by_dup_id.get(article.thumbnail_media_id) ??
				article.thumbnail_media_id)
			: article.thumbnail_media_id;

		let new_content_json: ArticleContentType | null | undefined =
			article.content_json;
		let content_changed = false;
		if (article.content_json) {
			const original_text = JSON.stringify(article.content_json);
			const rewritten_text = apply_url_remap(original_text, url_remap);
			content_changed = rewritten_text !== original_text;
			if (content_changed) {
				new_content_json = JSON.parse(rewritten_text) as ArticleContentType;
			}
		}

		const thumbnail_changed =
			new_thumbnail_media_id !== article.thumbnail_media_id;

		if (!content_changed && !thumbnail_changed) {
			unchanged_count++;
			continue;
		}

		changed_count++;
		console.log(
			`  ${article_id} "${title}": ` +
				`${thumbnail_changed ? "thumbnail remapped, " : ""}` +
				`${content_changed ? "content_json rewritten" : ""}`,
		);

		if (!execute) continue;

		await db.transaction(async (tx) => {
			await tx
				.update(Article)
				.set({
					thumbnail_media_id: new_thumbnail_media_id,
					...(content_changed ? { content_json: new_content_json } : {}),
				})
				.where(eq(Article.id, article_id));

			await reconcile_media_to_articles(tx, article_id, new_content_json);
		});
	}

	console.log(
		`\n${changed_count} article(s) ${execute ? "updated" : "would be updated"}, ` +
			`${unchanged_count} already clean (no matching url/thumbnail found — ` +
			`likely edited since the plan was generated).`,
	);

	if (!execute) {
		console.log("\nDry run only — pass --execute to apply.");
		return;
	}

	// Sanity check: nothing should still reference a duplicate id/url.
	const dup_ids = [...canonical_by_dup_id.keys()];
	const still_thumbnail = await db.query.Article.findMany({
		where: inArray(Article.thumbnail_media_id, dup_ids),
		columns: { id: true, title: true },
	});
	if (still_thumbnail.length > 0) {
		console.warn(
			`\n${still_thumbnail.length} article(s) STILL have a duplicate as thumbnail_media_id ` +
				`(edited concurrently with this run?): ${still_thumbnail.map((a) => a.id).join(", ")}`,
		);
	} else {
		console.log(
			`\nVerified: no article references a duplicate media row anymore. ` +
				`${dup_ids.length} duplicate row(s) are now orphaned — ` +
				`sweep-stale-content.ts will remove them (and their B2 objects) after its 48h grace window.`,
		);
	}
}

main()
	.catch((error) => {
		console.error(error);
		process.exitCode = 1;
	})
	.finally(() => process.exit());
