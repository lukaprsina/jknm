import fs from "node:fs/promises";
import { parseArgs } from "node:util";
import { eq } from "drizzle-orm";
import { db } from "~/server/db";
import { Article } from "~/server/db/schema";

/**
 * Applies `artifacts/link-fix-proposals/unique_match.json`
 * (`propose-link-fixes.ts`): each finding names a block and an anchor text
 * confirmed to occur exactly once in that block's `content_json` text.
 *
 * Trusts that snapshot rather than re-verifying uniqueness against a fresh
 * fetch — the maintainer confirmed the DB is unchanged since the proposal
 * ran, except legacy_id 606's images (irrelevant here, text untouched). If
 * this script is ever re-run against a DB that might have drifted, re-add a
 * live re-count before trusting `String.prototype.replace`'s "first match"
 * behavior to mean "only match."
 *
 * Two cases per finding, detected from the block text itself:
 *  - anchor text already sits inside an `<a href="...">` (a stale link, e.g.
 *    the old `/novica?id=<n>` shape) -> rewrite that href in place, keep any
 *    other attributes (`target="_blank"` etc.) untouched.
 *  - anchor text is bare -> wrap it in a new `<a href="...">`.
 *
 * Usage:
 *   bun run scripts/apply-link-fixes.ts             # dry run
 *   bun run scripts/apply-link-fixes.ts --execute
 */

const IN_PATH = "artifacts/link-fix-proposals/unique_match.json";

interface UniqueMatchProposal {
	kind: "missing_article_link" | "missing_static_link";
	legacy_id: number;
	article_id: string;
	title: string;
	expected: string;
	anchor_text: string;
	block_index: number;
	block_id?: string;
	block_type: string;
}

function escape_regex(s: string): string {
	return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function apply_fix(
	text: string,
	anchor_text: string,
	expected: string,
):
	| { text: string; case: "rewrite"; old_href: string }
	| { text: string; case: "insert" }
	| null {
	const wrapped_re = new RegExp(
		`<a\\s+href="([^"]*)"([^>]*)>${escape_regex(anchor_text)}</a>`,
	);
	const wrapped_match = wrapped_re.exec(text);
	if (wrapped_match) {
		const old_href = wrapped_match[1] ?? "";
		const rest_of_attrs = wrapped_match[2] ?? "";
		const replacement = `<a href="${expected}"${rest_of_attrs}>${anchor_text}</a>`;
		return {
			text: text.replace(wrapped_match[0], replacement),
			case: "rewrite",
			old_href,
		};
	}

	if (!text.includes(anchor_text)) return null;
	return {
		text: text.replace(anchor_text, `<a href="${expected}">${anchor_text}</a>`),
		case: "insert",
	};
}

async function main() {
	const { values } = parseArgs({ options: { execute: { type: "boolean" } } });
	const execute = values.execute ?? false;

	const proposals = JSON.parse(
		await fs.readFile(IN_PATH, "utf8"),
	) as UniqueMatchProposal[];

	const by_article = new Map<string, UniqueMatchProposal[]>();
	for (const p of proposals) {
		by_article.set(p.article_id, [...(by_article.get(p.article_id) ?? []), p]);
	}

	let fixed = 0;
	let rewritten = 0;
	let inserted = 0;
	let missing = 0;

	for (const [article_id, article_proposals] of by_article) {
		const article = await db.query.Article.findFirst({
			where: eq(Article.id, article_id),
			columns: { id: true, title: true, content_json: true },
		});
		if (!article?.content_json) {
			console.warn(`[${article_id}] article/content_json vanished — skipping`);
			continue;
		}

		const blocks = article.content_json.blocks;
		let changed = false;

		for (const proposal of article_proposals) {
			const block = proposal.block_id
				? blocks.find((b) => b.id === proposal.block_id)
				: blocks[proposal.block_index];
			const data = block?.data as { text?: unknown } | undefined;
			if (!block || typeof data?.text !== "string") {
				console.warn(
					`[${proposal.legacy_id}] ${proposal.title} - block ${proposal.block_id ?? proposal.block_index} not found — skipping`,
				);
				missing += 1;
				continue;
			}

			const result = apply_fix(
				data.text,
				proposal.anchor_text,
				proposal.expected,
			);
			if (!result) {
				console.warn(
					`[${proposal.legacy_id}] ${proposal.title} - anchor text "${proposal.anchor_text}" no longer found in block ${block.id ?? proposal.block_index} — skipping`,
				);
				missing += 1;
				continue;
			}

			const target_desc =
				result.case === "rewrite"
					? `${result.old_href} -> ${proposal.expected}`
					: `(new) -> ${proposal.expected}`;
			console.log(
				`[${proposal.legacy_id}] ${proposal.title} (${result.case}) "${proposal.anchor_text}": ${target_desc}`,
			);
			data.text = result.text;
			changed = true;
			fixed += 1;
			if (result.case === "rewrite") rewritten += 1;
			else inserted += 1;
		}

		if (changed && execute) {
			await db
				.update(Article)
				.set({ content_json: article.content_json })
				.where(eq(Article.id, article_id));
		}
	}

	console.log(
		`\n${fixed} fixed (${rewritten} href rewrites, ${inserted} new links), ${missing} skipped.`,
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
