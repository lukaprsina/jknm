import fs from "node:fs/promises";
import { parseArgs } from "node:util";
import { eq } from "drizzle-orm";
import { db } from "~/server/db";
import { Article } from "~/server/db/schema";

/**
 * Applies the 19 `ambiguous.json` + `no_match.json` proposals
 * (`propose-link-fixes.ts`) that the maintainer manually verified via
 * `review-link-fixes.ts` (playwright review — every target confirmed
 * correct).
 *
 * These didn't fall into `unique_match` because `propose-link-fixes.ts`
 * matched on the *legacy* anchor text, and in every one of these 19 cases
 * that text has drifted slightly from what's actually in `content_json`
 * (line-break differences, a typo fix, or — for the Čaganka "[4]" case — the
 * anchor text itself got rewritten to the stale `/novica?id=<n>` shape during
 * migration). But the link itself already exists in the right spot in every
 * case: what's broken is only the href, still pointing at the dead
 * `/novica?id=<n>` scheme (or, for the "Publikacije Dolenjski kras" case, the
 * raw legacy URL used as its own link text) instead of the resolved path.
 *
 * So instead of hunting for an insertion point, this collects each article's
 * stale-legacy-shaped `<a href>` tags in document order and zips them
 * positionally against that article's findings (also in document/JSON
 * order) — verified 1:1 by hand for all 5 distinct articles behind these 19
 * findings before writing this script. Fails closed: skips (not partial-
 * writes) any article where the stale-link count doesn't match the finding
 * count.
 *
 * Usage:
 *   bun run scripts/fix-reviewed-link-proposals.ts             # dry run
 *   bun run scripts/fix-reviewed-link-proposals.ts --execute
 */

const PROPOSAL_DIR = "artifacts/link-fix-proposals";

interface Finding {
	kind: "missing_article_link" | "missing_static_link";
	legacy_id: number;
	article_id: string;
	title: string;
	legacy_href: string;
	expected: string;
}

const STALE_HREF_RE = /^(?:https?:\/\/[^/]*)?\/novica\?id=\d+$/;

function is_stale_href(href: string): boolean {
	if (STALE_HREF_RE.test(href)) return true;
	// "Publikacije Dolenjski kras": raw legacy URL used as its own href+text.
	return /^https?:\/\/(www\.)?jknm\.si\//i.test(href);
}

async function load_findings(): Promise<Finding[]> {
	const findings: Finding[] = [];
	for (const outcome of ["ambiguous", "no_match"] as const) {
		const rows = JSON.parse(
			await fs.readFile(`${PROPOSAL_DIR}/${outcome}.json`, "utf8"),
		) as Finding[];
		findings.push(...rows);
	}
	return findings;
}

async function main() {
	const { values } = parseArgs({ options: { execute: { type: "boolean" } } });
	const execute = values.execute ?? false;

	const findings = await load_findings();
	const by_article = new Map<string, Finding[]>();
	for (const f of findings) {
		by_article.set(f.article_id, [...(by_article.get(f.article_id) ?? []), f]);
	}

	let fixed = 0;
	let skipped_articles = 0;

	for (const [article_id, article_findings] of by_article) {
		const article = await db.query.Article.findFirst({
			where: eq(Article.id, article_id),
			columns: { id: true, title: true, content_json: true },
		});
		if (!article?.content_json) {
			console.warn(`[${article_id}] article/content_json vanished — skipping`);
			skipped_articles += 1;
			continue;
		}

		const blocks = article.content_json.blocks;
		type StaleMatch = { block_index: number; href: string; text: string };
		const stale_matches: StaleMatch[] = [];
		blocks.forEach((block, block_index) => {
			const data = block.data as { text?: unknown } | undefined;
			if (typeof data?.text !== "string") return;
			for (const m of data.text.matchAll(
				/<a\s+href="([^"]*)"[^>]*>([^<]*)<\/a>/g,
			)) {
				const href = m[1] ?? "";
				if (is_stale_href(href)) {
					stale_matches.push({ block_index, href, text: m[2] ?? "" });
				}
			}
		});

		if (stale_matches.length !== article_findings.length) {
			console.warn(
				`[${article.title}] ${stale_matches.length} stale link(s) found but ${article_findings.length} finding(s) expected — skipping article`,
			);
			skipped_articles += 1;
			continue;
		}

		console.log(`\n[${article.title}]`);
		let changed = false;
		for (let i = 0; i < article_findings.length; i++) {
			const finding = article_findings[i]!;
			const match = stale_matches[i]!;
			const block = blocks[match.block_index]!;
			const data = block.data as { text: string };
			console.log(
				`  block ${match.block_index} "${match.text}": ${match.href} -> ${finding.expected}`,
			);
			data.text = data.text.replace(
				`<a href="${match.href}"`,
				`<a href="${finding.expected}"`,
			);
			changed = true;
			fixed += 1;
		}

		if (changed && execute) {
			await db
				.update(Article)
				.set({ content_json: article.content_json })
				.where(eq(Article.id, article_id));
		}
	}

	console.log(
		`\n${fixed} link(s) fixed, ${skipped_articles} article(s) skipped.`,
	);
	if (!execute) {
		console.log("\nDry run only — re-run with --execute to write.");
	}
}

main()
	.catch((error) => {
		console.error(error);
		process.exitCode = 1;
	})
	.finally(() => process.exit());
