import { extract_media_refs_from_content } from "~/lib/editor-utils";
import type { DbTransaction } from "~/server/db";
import type { ArticleContentType, Media } from "~/server/db/schema";
import { authorize_b2, ingest_media_from_url } from "~/server/media/ingest";

/**
 * Collects the distinct legacy media urls referenced by a legacy article's
 * content(s), across the published row and its in-progress draft (if any).
 * Thumbnails are migrated separately from their live `thumbnail.png`
 * convention URL (see `resolve_published_thumbnail_url`/
 * `resolve_draft_thumbnail_url`) rather than `thumbnail_crop.image_url`,
 * which is stale editor metadata, not what's actually displayed.
 */
export function collect_legacy_media_urls(
	contents: (ArticleContentType | null | undefined)[],
) {
	const urls = new Set<string>();

	for (const content of contents) {
		if (!content) continue;
		for (const ref of extract_media_refs_from_content(content)) {
			if (ref.data.file.url) urls.add(ref.data.file.url);
		}
	}

	return [...urls];
}

/**
 * Fetches a legacy media url into the new `jknm-gradivo` bucket and inserts
 * the `media` row. Returns null (logging a warning) rather than throwing on a
 * single unreachable url, so one broken legacy image doesn't fail the whole
 * article's migration.
 *
 * Format sniffing, variant/srcset/blur generation and the key layout all live
 * in `ingest_media` now. This used to be a degraded copy of that logic —
 * original-only, `upload_status: "pending"`, awaiting an async pipeline that
 * was never built — which is why legacy images rendered without srcsets while
 * editor uploads got the full set.
 */
export async function migrate_one_media_object(
	tx: DbTransaction,
	b2: Awaited<ReturnType<typeof authorize_b2>>,
	old_url: string,
	log_label: string,
) {
	console.log(`${log_label} ingesting ${old_url}`);
	return ingest_media_from_url(old_url, { tx, b2 });
}

/**
 * Migrates every distinct legacy media url into the new `media` table,
 * returning an old-url -> new-media-row map for content rewriting and
 * thumbnail resolution.
 */
export async function migrate_legacy_media(
	tx: DbTransaction,
	old_urls: string[],
	log_label: string,
) {
	const url_to_media = new Map<string, typeof Media.$inferSelect>();
	if (old_urls.length === 0) return url_to_media;

	const b2 = await authorize_b2();

	for (const old_url of old_urls) {
		const media = await migrate_one_media_object(tx, b2, old_url, log_label);
		if (media) url_to_media.set(old_url, media);
	}

	return url_to_media;
}
