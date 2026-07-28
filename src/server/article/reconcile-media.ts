import { and, eq, inArray, sql } from "drizzle-orm";
import {
	extract_inline_media_urls,
	extract_media_refs_from_content,
} from "~/lib/editor-utils";
import type { DbTransaction } from "~/server/db";
import type { ArticleContentType } from "~/server/db/schema";
import { Media, MediaToArticles } from "~/server/db/schema";

/**
 * Reconcile `media_to_articles` rows so they mirror the media blocks
 * (image/attaches) currently referenced by an article's `content_json`.
 *
 * EditorJS blocks only carry the media's absolute URL (`data.file.url`), not
 * the `media.id` — so we resolve each URL back to a `media` row via
 * `original->>'url'`. External images that were never uploaded through
 * `/api/media` have no `media` row and are simply skipped.
 *
 * Media linked from *inline HTML* (a PDF behind an `<a href>` in a paragraph)
 * counts too, and is appended after the block-carried urls — it's referenced,
 * so it must not look orphaned to the sweep, but it has no block position, so
 * it doesn't get to disturb the gallery `order` of the real media blocks.
 *
 * The diff is minimal: only missing links are inserted, only unreferenced
 * links are deleted, and `order` is only rewritten where it actually changed.
 * Re-saving unchanged content performs no writes.
 */
export async function reconcile_media_to_articles(
	tx: DbTransaction,
	article_id: string,
	content: ArticleContentType | null | undefined,
) {
	// Ordered, de-duplicated list of media URLs referenced by the content.
	const ordered_urls: string[] = [];
	if (content) {
		const refs = extract_media_refs_from_content(content);
		for (const ref of refs) {
			const url = ref.data.file.url;
			if (url && !ordered_urls.includes(url)) {
				ordered_urls.push(url);
			}
		}
		for (const url of extract_inline_media_urls(content)) {
			if (!ordered_urls.includes(url)) ordered_urls.push(url);
		}
	}

	// Resolve URLs -> media ids.
	const url_to_media_id = new Map<string, string>();
	if (ordered_urls.length > 0) {
		const media_rows = await tx
			.select({
				id: Media.id,
				url: sql<string>`${Media.original}->>'url'`,
			})
			.from(Media)
			.where(inArray(sql`${Media.original}->>'url'`, ordered_urls));

		for (const row of media_rows) {
			if (row.url) url_to_media_id.set(row.url, row.id);
		}
	}

	// Desired links, in block order (skipping URLs with no media row).
	const desired = new Map<string, number>(); // media_id -> order
	let order = 0;
	for (const url of ordered_urls) {
		const media_id = url_to_media_id.get(url);
		if (media_id && !desired.has(media_id)) {
			desired.set(media_id, order);
			order += 1;
		}
	}

	// Current links.
	const current_rows = await tx
		.select({
			media_id: MediaToArticles.media_id,
			order: MediaToArticles.order,
		})
		.from(MediaToArticles)
		.where(eq(MediaToArticles.article_id, article_id));
	const current = new Map(current_rows.map((r) => [r.media_id, r.order]));

	// Diff.
	const to_insert: { media_id: string; order: number }[] = [];
	const to_update: { media_id: string; order: number }[] = [];
	for (const [media_id, desired_order] of desired) {
		if (!current.has(media_id)) {
			to_insert.push({ media_id, order: desired_order });
		} else if (current.get(media_id) !== desired_order) {
			to_update.push({ media_id, order: desired_order });
		}
	}

	const to_delete: string[] = [];
	for (const media_id of current.keys()) {
		if (!desired.has(media_id)) to_delete.push(media_id);
	}

	if (to_insert.length > 0) {
		await tx.insert(MediaToArticles).values(
			to_insert.map((link) => ({
				article_id,
				media_id: link.media_id,
				order: link.order,
			})),
		);
	}

	for (const link of to_update) {
		await tx
			.update(MediaToArticles)
			.set({ order: link.order })
			.where(
				and(
					eq(MediaToArticles.article_id, article_id),
					eq(MediaToArticles.media_id, link.media_id),
				),
			);
	}

	if (to_delete.length > 0) {
		await tx
			.delete(MediaToArticles)
			.where(
				and(
					eq(MediaToArticles.article_id, article_id),
					inArray(MediaToArticles.media_id, to_delete),
				),
			);
	}
}
