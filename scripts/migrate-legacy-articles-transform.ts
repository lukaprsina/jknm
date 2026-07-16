import { klona } from "klona";
import { env } from "~/env";
import {
	get_s3_draft_directory,
	get_s3_published_directory,
} from "~/lib/article-utils";
import { extract_media_refs_from_content } from "~/lib/editor-utils";
import { get_s3_prefix } from "~/lib/s3-publish";
import type { Article, ArticleContentType } from "~/server/db/schema";

/**
 * The live, actually-displayed thumbnail for a published article — a fixed
 * `<slug>-<date>/thumbnail.png` convention in the published bucket, the same
 * one `PublishedArticleDrizzleCard` renders directly (see `~/components/article/adapter.tsx`).
 */
export function resolve_published_thumbnail_url(
	article_url: string,
	created_at: Date,
) {
	return get_s3_prefix(
		`${get_s3_published_directory(article_url, created_at)}/thumbnail.png`,
		env.NEXT_PUBLIC_AWS_PUBLISHED_BUCKET_NAME,
	);
}

/**
 * The live, actually-displayed thumbnail for a draft (standalone or an
 * in-progress edit of a published article) — a fixed `<draft_id>/thumbnail.png`
 * convention in the draft bucket, the same one `DraftArticleDrizzleCard`
 * renders directly.
 */
export function resolve_draft_thumbnail_url(draft_id: number) {
	return get_s3_prefix(
		`${get_s3_draft_directory(draft_id)}/thumbnail.png`,
		env.NEXT_PUBLIC_AWS_DRAFT_BUCKET_NAME,
	);
}

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

const CLEARED_THUMBNAIL = {
	thumbnail_media_id: null,
	thumbnail_x: null,
	thumbnail_y: null,
	thumbnail_width: null,
	thumbnail_height: null,
};

// `thumbnail.png` is already the final, live-displayed crop (rendered
// directly with no further cropping) — migrated thumbnails always get this
// "full image, no crop" window rather than reusing the old (untrustworthy)
// crop percentages.
const FULL_IMAGE_CROP = {
	thumbnail_x: 0,
	thumbnail_y: 0,
	thumbnail_width: 100,
	thumbnail_height: 100,
};

/**
 * Resolves an article's thumbnail from its *live* `thumbnail.png` convention
 * URL (see `resolve_published_thumbnail_url`/`resolve_draft_thumbnail_url`),
 * not `thumbnail_crop.image_url` — that field is stale editor metadata
 * (crop-source reference), not what's actually displayed, and is frequently
 * wrong or dead (points at an unrelated article's id, or a since-deleted
 * draft object) even for articles whose real thumbnail is live and working.
 * `thumbnail_url` is `undefined` when the article has no thumbnail set at
 * all; unresolvable/missing convention images also clear the thumbnail
 * rather than fail the whole article.
 */
export function resolve_convention_thumbnail(
	thumbnail_url: string | undefined,
	url_to_media_id: Map<string, string>,
) {
	const media_id = thumbnail_url
		? url_to_media_id.get(thumbnail_url)
		: undefined;
	if (!media_id) return CLEARED_THUMBNAIL;

	return { thumbnail_media_id: media_id, ...FULL_IMAGE_CROP };
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
 * `resolve_convention_thumbnail`) before being passed in here.
 */
export function build_published_article_values(
	legacy: LegacyPublishedInput,
	rewritten_content: ArticleContentType | null,
	thumbnail: ReturnType<typeof resolve_convention_thumbnail>,
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
	thumbnail: ReturnType<typeof resolve_convention_thumbnail>,
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
