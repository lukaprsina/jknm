import { parseArgs } from "node:util";
import { eq, gt } from "drizzle-orm";
import { db } from "~/server/db";
import { Article } from "~/server/db/schema";

/**
 * One-off, final pass over the legacy_id repair (after
 * scripts/fix-legacy-ids-by-date.ts and
 * scripts/fix-legacy-id-supersede-chains.ts). Two corrections:
 *
 * 1. Same-day ordering swaps. The date-based repair zips articles against the
 *    legacy export by publish order, which is ambiguous when two articles
 *    share a publish date — the tiebreak was arbitrary and landed backwards
 *    for two pairs. Both artifacts/Objave.txt (the old site's own DB export)
 *    and scripts/articles.json's `old_id` independently give the true ids:
 *      51 "Pregledali osem novih jam ..."   <-> 52 "Predstavljamo kratek film ..."
 *      309 "Brezno pri Vratnicah"           <-> 310 "Tečaj v Sežani"
 *
 * 2. legacy_ids above the end of the old site. jknm.si's last real article is
 *    692 (its "www.jknm.si se je odselil" closing notice, 1.1.2026); ids past
 *    it serve a generic fallback page with no <p class="datum">, confirmed by
 *    scripts/scrape-legacy-articles.ts. Anything holding a legacy_id > 692 is
 *    a new-site-only article that never had an old-site page, carrying a
 *    leftover from the original migration's bad numbering (see below) — it
 *    gets nulled.
 *
 * Root cause of that bad numbering, for the record: scripts/articles.json
 * carries both `old_id` (the real jknm.si id) and `id` (a re-sequenced 1..684
 * counter). The original migration populated `legacy_id` from `id`, so every
 * gap in the real ids shifted everything after it, and new-site-only rows got
 * a number they never had.
 *
 * Note `old_id: null` in articles.json does NOT mean "no old-site page" — the
 * admin posted to both sites during the transition, and the scrape found real
 * pages for many such rows. The scrape, not that field, is what decides here.
 *
 * Usage:
 *   bun run scripts/fix-legacy-ids-final-reconcile.ts            # dry run
 *   bun run scripts/fix-legacy-ids-final-reconcile.ts --execute
 */

const LAST_REAL_LEGACY_ID = 692;

/** Verified against both Objave.txt and articles.json's `old_id`. */
const SWAPS: { legacy_id: number; title_contains: string }[] = [
	{ legacy_id: 51, title_contains: "Pregledali osem novih jam" },
	{ legacy_id: 52, title_contains: "Predstavljamo kratek film" },
	{ legacy_id: 309, title_contains: "Brezno pri Vratnicah" },
	{ legacy_id: 310, title_contains: "Tečaj v Sežani" },
];

async function main() {
	const { values } = parseArgs({ options: { execute: { type: "boolean" } } });
	const execute = values.execute ?? false;

	const all = await db.query.Article.findMany({
		columns: {
			id: true,
			legacy_id: true,
			title: true,
			status: true,
			published_at: true,
		},
	});

	// --- 1. resolve the swaps by title ---
	const swap_targets: {
		article_id: string;
		title: string;
		from: number | null;
		to: number;
	}[] = [];

	for (const swap of SWAPS) {
		const matches = all.filter(
			(a) => a.title.includes(swap.title_contains) && a.status !== "deleted",
		);
		if (matches.length !== 1) {
			throw new Error(
				`expected exactly 1 live article containing "${swap.title_contains}", got ${matches.length}`,
			);
		}
		const article = matches[0];
		if (!article || article.legacy_id === swap.legacy_id) continue;
		swap_targets.push({
			article_id: article.id,
			title: article.title,
			from: article.legacy_id,
			to: swap.legacy_id,
		});
	}

	// --- 2. legacy_ids past the end of the old site ---
	const to_null = all
		.filter((a) => a.legacy_id !== null && a.legacy_id > LAST_REAL_LEGACY_ID)
		.sort((a, b) => (a.legacy_id as number) - (b.legacy_id as number));

	console.log(`${swap_targets.length} same-day ordering fix(es):\n`);
	for (const t of swap_targets) {
		console.log(`  ${t.from} -> ${t.to}  "${t.title}"`);
	}

	console.log(
		`\n${to_null.length} article(s) with legacy_id > ${LAST_REAL_LEGACY_ID} (new-site-only) -> null:\n`,
	);
	for (const a of to_null) {
		console.log(
			`  ${a.legacy_id} -> null  "${a.title}" @ ${a.published_at?.toISOString()}`,
		);
	}

	if (!execute) {
		console.log("\nDry run only — re-run with --execute to write changes.");
		return;
	}

	await db.transaction(async (tx) => {
		// legacy_id is UNIQUE and the swaps trade values with each other, so
		// every participant releases its value before any new one is written.
		for (const t of swap_targets) {
			await tx
				.update(Article)
				.set({ legacy_id: null })
				.where(eq(Article.id, t.article_id));
		}
		for (const a of to_null) {
			await tx
				.update(Article)
				.set({ legacy_id: null })
				.where(eq(Article.id, a.id));
		}
		for (const t of swap_targets) {
			await tx
				.update(Article)
				.set({ legacy_id: t.to })
				.where(eq(Article.id, t.article_id));
		}

		const leftover = await tx.query.Article.findMany({
			where: gt(Article.legacy_id, LAST_REAL_LEGACY_ID),
			columns: { id: true, legacy_id: true },
		});
		if (leftover.length > 0) {
			throw new Error(
				`still ${leftover.length} row(s) with legacy_id > ${LAST_REAL_LEGACY_ID}`,
			);
		}
	});

	console.log(
		`\nApplied ${swap_targets.length} swap(s) and nulled ${to_null.length} out-of-range legacy_id(s).`,
	);
}

main()
	.catch((error) => {
		console.error(error);
		process.exitCode = 1;
	})
	.finally(() => process.exit());
