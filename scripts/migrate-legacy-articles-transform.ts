import { klona } from "klona";
import { extract_media_refs_from_content } from "~/lib/editor-utils";
import type { ThumbnailType } from "~/lib/validators";
import type { Article, ArticleContentType } from "~/server/db/schema";

/**
 * `articles.legacy_id` is a single unique integer column, but
 * `published_article.id` and `draft_article.id` are independent serial
 * sequences that can collide. Draft-sourced rows are negated so they can
 * never collide with a published id (always >= 1).
 */
export function legacy_id_for_published(published_id: number) {
	return published_id;
}

export function legacy_id_for_draft(draft_id: number) {
	return -draft_id;
}

/**
 * Rewrites every image/attaches block's `data.file.url` in `content` using
 * `url_map` (old url -> new url), leaving unmapped urls untouched (e.g. an
 * external image that failed to migrate). Returns a clone; `content` is not
 * mutated.
 */
export function rewrite_media_urls_in_content(
	content: ArticleContentType | null | undefined,
	url_map: Map<string, string>,
): ArticleContentType | null {
	if (!content) return null;

	const cloned = klona(content);
	for (const ref of extract_media_refs_from_content(cloned)) {
		const old_url = ref.data.file.url;
		const new_url = old_url ? url_map.get(old_url) : undefined;
		if (new_url) ref.data.file.url = new_url;
	}

	return cloned;
}

/**
 * Some legacy articles' `thumbnail_crop.image_url` still points at the draft
 * bucket (`jknm-osnutki`) URL the image was uploaded under while drafting,
 * rather than the published-bucket URL the same image was copied to on
 * publish — the crop metadata was apparently never rewritten. That draft
 * object is frequently gone (404) by the time of migration, even though the
 * identical image is present (and already migrated) among the published
 * content's own images, under the same filename. Match on basename among
 * this article's already-migrated content media as a fallback before giving
 * up on the thumbnail entirely.
 */
function find_thumbnail_by_basename(
	thumbnail_url: string,
	url_to_media_id: Map<string, string>,
) {
	const basename = thumbnail_url.split("/").pop();
	if (!basename) return undefined;

	for (const [old_url, media_id] of url_to_media_id) {
		if (old_url.split("/").pop() === basename) return media_id;
	}
	return undefined;
}

/**
 * Resolves a legacy percentage-based `thumbnail_crop` into the new schema's
 * `thumbnail_media_id` + percentage columns, using `url_map` (old url -> new
 * media id) instead of a DB lookup so it can run against media inserted
 * earlier in the same migration transaction. Unresolvable urls (thumbnail
 * image failed to migrate outright, or none set) clear the thumbnail.
 */
export function resolve_legacy_thumbnail(
	thumbnail_crop: ThumbnailType | null | undefined,
	url_to_media_id: Map<string, string>,
) {
	const cleared = {
		thumbnail_media_id: null,
		thumbnail_x: null,
		thumbnail_y: null,
		thumbnail_width: null,
		thumbnail_height: null,
	};

	if (!thumbnail_crop) return cleared;

	const media_id =
		url_to_media_id.get(thumbnail_crop.image_url) ??
		find_thumbnail_by_basename(thumbnail_crop.image_url, url_to_media_id);
	if (!media_id) return cleared;

	return {
		thumbnail_media_id: media_id,
		thumbnail_x: thumbnail_crop.x,
		thumbnail_y: thumbnail_crop.y,
		thumbnail_width: thumbnail_crop.width,
		thumbnail_height: thumbnail_crop.height,
	};
}

export interface LegacyPublishedInput {
	legacy_id: number;
	title: string;
	content_preview: string | null;
	content: ArticleContentType | null;
	created_at: Date;
	updated_at: Date;
}

/**
 * Builds the `articles` insert values for a migrated published-article row.
 * Status-preserving: always `"published"`, never promoted/demoted by the
 * migration itself. `content`/thumbnail fields are expected to already be
 * rewritten against the new media (see `rewrite_media_urls_in_content` /
 * `resolve_legacy_thumbnail`) before being passed in here.
 */
export function build_published_article_values(
	legacy: LegacyPublishedInput,
	rewritten_content: ArticleContentType | null,
	thumbnail: ReturnType<typeof resolve_legacy_thumbnail>,
): typeof Article.$inferInsert {
	return {
		legacy_id: legacy_id_for_published(legacy.legacy_id),
		status: "published",
		title: legacy.title,
		excerpt: legacy.content_preview ?? "",
		content_json: rewritten_content,
		created_at: legacy.created_at,
		updated_at: legacy.updated_at,
		published_at: legacy.created_at,
		created_by: null,
		...thumbnail,
	};
}

export interface LegacyDraftInput {
	legacy_id: number;
	title: string;
	content_preview: string | null;
	content: ArticleContentType | null;
	created_at: Date;
	updated_at: Date;
}

/**
 * Builds the `articles` insert values for a migrated draft-article row
 * (either a standalone draft, or one in progress against a published
 * article, in which case `supersedes_id` is the new uuid of that published
 * row's migrated `articles` row).
 */
export function build_draft_article_values(
	legacy: LegacyDraftInput,
	rewritten_content: ArticleContentType | null,
	thumbnail: ReturnType<typeof resolve_legacy_thumbnail>,
	supersedes_id: string | null,
): typeof Article.$inferInsert {
	return {
		legacy_id: legacy_id_for_draft(legacy.legacy_id),
		status: "draft",
		title: legacy.title,
		excerpt: legacy.content_preview ?? "",
		content_json: rewritten_content,
		created_at: legacy.created_at,
		updated_at: legacy.updated_at,
		supersedes_id,
		created_by: null,
		...thumbnail,
	};
}
