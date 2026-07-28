import { parseArgs } from "node:util";
import { eq, isNotNull } from "drizzle-orm";
import { db } from "~/server/db";
import { Article } from "~/server/db/schema";

/**
 * One-off: moves `legacy_id` from a soft-deleted superseded row forward onto
 * the live row that replaced it.
 *
 * Cause (still present in the app, see the note below): the supersede flow
 * moves the *slug* forward to the newly published row
 * (`resolve_supersede_publish_slug`, src/server/article/new-article.ts) and
 * soft-deletes the source, but never moves `legacy_id`. So revising a
 * migrated legacy article via the pencil strands its `legacy_id` on a
 * `deleted` row that has no slugs at all, while the live row gets none —
 * which breaks `/si/?id=N` resolution (`resolve_legacy_article_link`, used by
 * scripts/dehotlink-static-pages.ts), since that looks up `Article.legacy_id`
 * and would land on the invisible row.
 *
 * `legacy_id` is the same kind of fact as the slug — "how an old inbound link
 * finds this article today" — so it belongs on the live end of the chain, not
 * pinned to whichever edit happened to be live back in 2013/2024. Date-based
 * *matching* still uses the original row's `published_at`
 * (scripts/fix-legacy-ids-by-date.ts); only the storage location moves.
 *
 * Two known chains at time of writing:
 *   309 "Tečaj v Sežani"                  (live row also holds a junk -588)
 *   635 "Čistilna akcija ... Radeščice"   (live row holds null)
 *
 * Usage:
 *   bun run scripts/fix-legacy-id-supersede-chains.ts            # dry run
 *   bun run scripts/fix-legacy-id-supersede-chains.ts --execute
 */

async function main() {
	const { values } = parseArgs({ options: { execute: { type: "boolean" } } });
	const execute = values.execute ?? false;

	const all = await db.query.Article.findMany({
		columns: {
			id: true,
			legacy_id: true,
			title: true,
			status: true,
			supersedes_id: true,
		},
		with: { article_slugs: { columns: { slug: true } } },
	});
	const by_id = new Map(all.map((a) => [a.id, a]));

	const moves: {
		source_id: string;
		live_id: string;
		title: string;
		legacy_id: number;
		displaced: number | null;
	}[] = [];

	for (const live of all) {
		if (!live.supersedes_id) continue;
		const source = by_id.get(live.supersedes_id);
		if (!source || source.legacy_id === null) continue;

		// Only chains whose source is retired (the live row is genuinely the
		// current article). An open draft against a still-live source must not
		// steal its legacy_id — the source is still the published one.
		if (source.status !== "deleted") {
			console.log(
				`  skipping "${live.title}": source status=${source.status}, not retired`,
			);
			continue;
		}

		moves.push({
			source_id: source.id,
			live_id: live.id,
			title: live.title,
			legacy_id: source.legacy_id,
			displaced: live.legacy_id,
		});
	}

	console.log(`${moves.length} supersede chain(s) with a stranded legacy_id:\n`);
	for (const move of moves) {
		const displaced =
			move.displaced === null
				? ""
				: ` (overwriting ${move.displaced} on the live row)`;
		console.log(
			`  legacy_id=${move.legacy_id}  "${move.title}"\n    from deleted ${move.source_id}\n    to   live    ${move.live_id}${displaced}`,
		);
	}

	if (!execute) {
		console.log("\nDry run only — re-run with --execute to write changes.");
		return;
	}

	await db.transaction(async (tx) => {
		// legacy_id is UNIQUE, so the source has to release the value before the
		// live row can take it.
		for (const move of moves) {
			await tx
				.update(Article)
				.set({ legacy_id: null })
				.where(eq(Article.id, move.source_id));
		}
		for (const move of moves) {
			await tx
				.update(Article)
				.set({ legacy_id: move.legacy_id })
				.where(eq(Article.id, move.live_id));
		}

		// Every moved id must now resolve to exactly one row, and that row must
		// be the live one with a slug — the whole point of the move.
		for (const move of moves) {
			const holders = await tx.query.Article.findMany({
				where: eq(Article.legacy_id, move.legacy_id),
				columns: { id: true, status: true },
				with: { article_slugs: { columns: { slug: true } } },
			});
			const holder = holders[0];
			if (holders.length !== 1 || holder?.id !== move.live_id) {
				throw new Error(
					`legacy_id=${move.legacy_id} resolves to ${holders.length} row(s), expected only ${move.live_id}`,
				);
			}
			if (holder.article_slugs.length === 0) {
				throw new Error(
					`legacy_id=${move.legacy_id} landed on ${holder.id}, which has no slugs`,
				);
			}
		}
	});

	console.log(`\nMoved ${moves.length} legacy_id(s) onto the live rows.`);
}

main()
	.catch((error) => {
		console.error(error);
		process.exitCode = 1;
	})
	.finally(() => process.exit());
