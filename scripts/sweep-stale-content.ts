/**
 * Periodic sweep for two kinds of accumulating cruft that nothing else
 * cleans up (see the codebase-health audit in `docs/research/`):
 *
 * 1. Terminal `articles` rows (`status = "deleted"`) past a grace window —
 *    kept around soft-deleted so an admin can still reach support about a
 *    mistaken delete, but there's no restore UI and no reason to keep them
 *    forever. Hard-deleted here, which cascades to `media_to_articles` via
 *    its `onDelete: "cascade"` FK.
 * 2. `media` rows with no `media_to_articles` link and not in use as any
 *    article's `thumbnail_media_id` — uploads never carry an `article_id`
 *    (see CONTEXT.md's Reconciliation entry), so an upload that never made
 *    it into saved content (abandoned edit, crashed upload) has nothing
 *    pointing at it and lingers in both Postgres and B2 forever.
 *
 * Both use the same 48h grace window (matching the "orphaned media (no
 * links, 48h old)" convention already named in CONTEXT.md) so an
 * in-progress edit or an upload not yet wired into content isn't swept out
 * from under an admin mid-session.
 *
 * `supersedes_id` is nulled out on swept articles immediately before
 * deleting them, since it's a same-table FK with no `onDelete` — deleting a
 * source and its already-cascade-soft-deleted draft in the same statement
 * would otherwise risk a FK violation depending on row order.
 *
 * Usage:
 *   bun run scripts/sweep-stale-content.ts            # dry run
 *   bun run scripts/sweep-stale-content.ts --execute   # apply
 */

import { parseArgs } from "node:util";
import { and, eq, inArray, isNotNull, lt, notInArray, sql } from "drizzle-orm";
import { env } from "~/env";
import { delete_objects, list_objects } from "~/lib/s3-utils";
import { db } from "~/server/db";
import { Article, Media, MediaToArticles } from "~/server/db/schema";

const GRACE_PERIOD_MS = 48 * 60 * 60 * 1000;

async function sweep_deleted_articles(cutoff: Date, execute: boolean) {
	const candidates = await db.query.Article.findMany({
		where: and(eq(Article.status, "deleted"), lt(Article.deleted_at, cutoff)),
		columns: { id: true, title: true, deleted_at: true },
	});

	console.log(`${candidates.length} deleted article(s) past the grace window.`);
	for (const article of candidates) {
		console.log(
			`  ${article.id} "${article.title}" (deleted_at ${article.deleted_at?.toISOString()})`,
		);
	}

	if (!execute || candidates.length === 0) return;

	const ids = candidates.map((a) => a.id);
	await db.transaction(async (tx) => {
		await tx
			.update(Article)
			.set({ supersedes_id: null })
			.where(inArray(Article.supersedes_id, ids));
		await tx.delete(Article).where(inArray(Article.id, ids));
	});
	console.log(`Hard-deleted ${ids.length} article row(s).`);
}

async function sweep_orphaned_media(cutoff: Date, execute: boolean) {
	const linked = await db
		.selectDistinct({ id: MediaToArticles.media_id })
		.from(MediaToArticles);
	const thumbnails = await db
		.selectDistinct({ id: Article.thumbnail_media_id })
		.from(Article)
		.where(isNotNull(Article.thumbnail_media_id));
	const excluded_ids = [
		...new Set(
			[...linked, ...thumbnails].map((row) => row.id).filter((id) => id),
		),
	] as string[];

	const candidates = await db.query.Media.findMany({
		where:
			excluded_ids.length > 0
				? and(notInArray(Media.id, excluded_ids), lt(Media.created_at, cutoff))
				: lt(Media.created_at, cutoff),
		columns: { id: true, filename: true, created_at: true, original: true },
	});

	console.log(
		`${candidates.length} orphaned media row(s) past the grace window.`,
	);
	for (const media of candidates) {
		// Diagnostic only: uploads never carry an article_id (see CONTEXT.md's
		// Reconciliation entry) and `media_to_articles` is exactly what we
		// already excluded candidates by, so this is a *content_json* text
		// search across every status (including deleted/archived) to help a
		// human eyeball where a media row used to be referenced, not a
		// reliable "current owner" — it can be empty for uploads that were
		// never saved into any article's content at all.
		const referencing = await db
			.select({ id: Article.id, title: Article.title, status: Article.status })
			.from(Article)
			.where(
				sql`${Article.content_json}::text LIKE ${`%${media.original.url}%`}`,
			);

		const origin =
			referencing.length > 0
				? referencing
						.map((a) => `${a.id} "${a.title}" (${a.status})`)
						.join(", ")
				: "no referencing article found (never saved into content, or content_json since edited)";

		console.log(
			`  ${media.id} "${media.filename}" (created_at ${media.created_at.toISOString()})\n    from: ${origin}`,
		);
	}

	if (!execute) return;

	for (const media of candidates) {
		try {
			const objects = await list_objects(
				env.NEXT_PUBLIC_AWS_MEDIA_BUCKET_NAME,
				`${media.id}/`,
			);
			const keys = (objects ?? [])
				.map((object) => object.Key)
				.filter((key): key is string => !!key);
			if (keys.length > 0) {
				await delete_objects(env.NEXT_PUBLIC_AWS_MEDIA_BUCKET_NAME, keys);
			}
			await db.delete(Media).where(eq(Media.id, media.id));
			console.log(`Deleted media ${media.id} (${keys.length} B2 object(s)).`);
		} catch (error) {
			console.error(`Failed to sweep media ${media.id}`, error);
		}
	}
}

async function main() {
	const { values } = parseArgs({ options: { execute: { type: "boolean" } } });
	const execute = values.execute ?? false;
	const cutoff = new Date(Date.now() - GRACE_PERIOD_MS);

	await sweep_deleted_articles(cutoff, execute);
	await sweep_orphaned_media(cutoff, execute);

	if (!execute) {
		console.log("Dry run only — re-run with --execute to apply.");
	}
}

main()
	.catch((error) => {
		console.error(error);
		process.exitCode = 1;
	})
	.finally(() => process.exit());
