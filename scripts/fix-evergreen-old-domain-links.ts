import { parseArgs } from "node:util";
import { eq } from "drizzle-orm";
import { reconcile_media_to_articles } from "~/server/article/reconcile-media";
import { db } from "~/server/db";
import type { ArticleContentType } from "~/server/db/schema";
import { Article } from "~/server/db/schema";

/**
 * Fixes the last `old_domain_link` findings from `scripts/audit-evergreen-pages.ts`:
 * absolute `jknm.si` links in the 2 evergreen pages that still had them, now
 * that the editorjs bare-`/` link bug is patched (see
 * `patches/@editorjs%2Feditorjs@2.31.6.patch`) so relative links are safe.
 *
 *  - Klub: its own self-link -> `/`.
 *  - Zgodovina: `kodeks`/`interes` links repointed to the sections that
 *    absorbed that content in `/klub` (per `docs/research/legacy-migration-notes.md`);
 *    the 2008-launch mention's href -> `/`, its link *text* stays as the
 *    historical `http://www.jknm.si` string (it's quoting the old url, not
 *    pointing "here").
 *
 * Usage:
 *   bun run scripts/fix-evergreen-old-domain-links.ts             # dry run
 *   bun run scripts/fix-evergreen-old-domain-links.ts --execute
 */

const KLUB_ARTICLE_ID = "14093a20-801a-4475-9c7f-cb151c5020c0";
const ZGODOVINA_ARTICLE_ID = "dace7fc1-8f42-4411-b2d3-44e353da32de";

const KLUB_REPLACEMENTS: [string, string][] = [
	['href=\\"https://www.jknm.si\\"', 'href=\\"/\\"'],
];

const ZGODOVINA_REPLACEMENTS: [string, string][] = [
	[
		'href=\\"https://www.jknm.si/si/izobrazevanje/kodeks/\\"',
		'href=\\"/klub#eticni-kodeks\\"',
	],
	[
		'href=\\"https://www.jknm.si/si/klub/interes/\\"',
		'href=\\"/klub#drustvo-v-javnem-interesu\\"',
	],
	['href=\\"http://www.jknm.si\\"', 'href=\\"/\\"'],
];

async function apply_fixes(
	article_id: string,
	label: string,
	replacements: [string, string][],
	execute: boolean,
) {
	const article = await db.query.Article.findFirst({
		where: eq(Article.id, article_id),
		columns: { id: true, content_json: true },
	});
	if (!article?.content_json) {
		console.log(`[skip] ${label} - no content_json`);
		return;
	}

	let raw = JSON.stringify(article.content_json);
	let changed = 0;
	for (const [from, to] of replacements) {
		if (!raw.includes(from)) {
			console.log(`[skip] ${label} - not found: ${from}`);
			continue;
		}
		console.log(`[${label}]\n    ${from}\n    -> ${to}`);
		raw = raw.split(from).join(to);
		changed += 1;
	}

	if (!execute || changed === 0) return;

	const content = JSON.parse(raw) as ArticleContentType;
	await db.transaction(async (tx) => {
		await tx
			.update(Article)
			.set({ content_json: content })
			.where(eq(Article.id, article.id));
		await reconcile_media_to_articles(tx, article.id, content);
	});
	console.log(`[${label}] rewritten.`);
}

async function main() {
	const { values } = parseArgs({ options: { execute: { type: "boolean" } } });
	const execute = values.execute ?? false;

	await apply_fixes(KLUB_ARTICLE_ID, "Klub", KLUB_REPLACEMENTS, execute);
	console.log();
	await apply_fixes(
		ZGODOVINA_ARTICLE_ID,
		"Zgodovina",
		ZGODOVINA_REPLACEMENTS,
		execute,
	);

	if (!execute) {
		console.log(
			"\nDry run only - re-run with --execute to rewrite + reconcile.",
		);
	}
}

main()
	.catch((error) => {
		console.error(error);
		process.exitCode = 1;
	})
	.finally(() => process.exit());
