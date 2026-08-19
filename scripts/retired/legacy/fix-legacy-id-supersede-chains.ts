import { parseArgs } from "node:util";
import { eq } from "drizzle-orm";
import { db } from "~/server/db";
import { Article } from "~/server/db/schema";

/**
 * One-off (v2): moves `legacy_id` from a soft-deleted superseded row all the
 * way forward to the live end of its supersede chain, walking every hop
 * rather than just one.
 *
 * v1 of this script (committed alongside `inherit_identity_from_source` in
 * 2ee65fc) only ever followed the *immediate* child of a stranded row. That's
 * correct for an article revised once, but one revised twice (unarchive ->
 * edit -> publish -> revise again -> publish again) ends up multiple hops
 * away from where its `legacy_id` is parked — v1 would only advance it one
 * hop per run, needing a re-run per additional hop, and evidently wasn't:
 * legacy_id 358 and 240 were still stranded on their *original* rows, not
 * even the immediate child, when this was investigated on 2026-07-28 (traced
 * to `discard_draft` previously double-deleting an unarchived source before
 * it could ever be republished — fixed separately, see lifecycle.ts).
 *
 * This version walks the whole chain in one pass: build a reverse
 * `supersedes_id` index (source id -> the row that superseded it), then for
 * every row still holding a `legacy_id` while itself `deleted`, follow that
 * index to the end. Skips a chain whose live end is a `draft` — an
 * in-progress edit hasn't published yet, so the id would be moving to a row
 * that isn't actually live; `inherit_identity_from_source` (new-article.ts)
 * moves it the rest of the way itself once that draft publishes.
 *
 * Usage:
 *   bun run scripts/fix-legacy-id-supersede-chains.ts            # dry run
 *   bun run scripts/fix-legacy-id-supersede-chains.ts --execute
 */

interface Row {
	id: string;
	legacy_id: number | null;
	title: string;
	status: "draft" | "published" | "archived" | "deleted";
	supersedes_id: string | null;
}

async function main() {
	const { values } = parseArgs({ options: { execute: { type: "boolean" } } });
	const execute = values.execute ?? false;

	const all: Row[] = await db.query.Article.findMany({
		columns: {
			id: true,
			legacy_id: true,
			title: true,
			status: true,
			supersedes_id: true,
		},
	});

	// Reverse index: source id -> every row that claims to supersede it.
	// Normally at most one (create_superseding_draft reuses an already-open
	// draft rather than minting a second one against the same source), but
	// stray dev/test rows can violate that without ever holding a legacy_id —
	// harmless noise we only need to notice if a real chain actually forks
	// through one, so ambiguity is checked lazily during the walk below
	// instead of rejected here.
	const superseded_by = new Map<string, Row[]>();
	for (const row of all) {
		if (!row.supersedes_id) continue;
		const siblings = superseded_by.get(row.supersedes_id) ?? [];
		siblings.push(row);
		superseded_by.set(row.supersedes_id, siblings);
	}

	const moves: {
		source_id: string;
		live_id: string;
		title: string;
		legacy_id: number;
		hops: number;
		displaced: number | null;
	}[] = [];

	for (const row of all) {
		if (row.legacy_id === null || row.status !== "deleted") continue;

		let hops = 0;
		let current = row;
		while (true) {
			const children = superseded_by.get(current.id);
			if (!children || children.length === 0) break;
			if (children.length > 1) {
				throw new Error(
					`legacy_id=${row.legacy_id} "${row.title}": chain forks at ${current.id} — ${children
						.map((c) => c.id)
						.join(
							", ",
						)} all claim to supersede it, refusing to guess which is the real chain`,
				);
			}
			const next = children[0];
			if (!next) break;
			current = next;
			hops += 1;
			if (hops > 50) {
				throw new Error(
					`chain from ${row.id} didn't terminate after 50 hops — possible cycle`,
				);
			}
		}

		if (current.id === row.id) continue; // nothing supersedes it, nothing to move

		if (current.status !== "published" && current.status !== "archived") {
			console.log(
				`  skipping legacy_id=${row.legacy_id} "${row.title}": chain's live end (${current.id}) is ${current.status}, not published/archived`,
			);
			continue;
		}

		moves.push({
			source_id: row.id,
			live_id: current.id,
			title: current.title,
			legacy_id: row.legacy_id,
			hops,
			displaced: current.legacy_id,
		});
	}

	// Two different stranded ids converging on the same live row would silently
	// drop one of them (last write wins) — refuse rather than guess.
	const live_id_counts = new Map<string, number>();
	for (const move of moves) {
		live_id_counts.set(
			move.live_id,
			(live_id_counts.get(move.live_id) ?? 0) + 1,
		);
	}
	for (const [live_id, count] of live_id_counts) {
		if (count > 1) {
			throw new Error(
				`${count} different stranded legacy_ids all resolve to the same live row ${live_id} — refusing to guess which is correct`,
			);
		}
	}

	console.log(`${moves.length} stranded legacy_id(s) to move:\n`);
	for (const move of moves) {
		const displaced =
			move.displaced === null
				? ""
				: ` (overwriting ${move.displaced} on the live row)`;
		console.log(
			`  legacy_id=${move.legacy_id}  "${move.title}"  (${move.hops} hop${move.hops === 1 ? "" : "s"})\n    from deleted ${move.source_id}\n    to   live    ${move.live_id}${displaced}`,
		);
	}

	if (!execute) {
		console.log("\nDry run only — re-run with --execute to write changes.");
		return;
	}

	await db.transaction(async (tx) => {
		// legacy_id is UNIQUE, so each source has to release its value before the
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
			if (holder.status !== "published" && holder.status !== "archived") {
				throw new Error(
					`legacy_id=${move.legacy_id} landed on ${holder.id}, which is ${holder.status}`,
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
