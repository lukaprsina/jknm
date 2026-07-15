import { z } from "zod";
import { content_validator, thumbnail_validator } from "~/lib/validators";
import { PublishArticleSchema, SaveDraftArticleSchema } from "../db/schema";

export const create_draft_validator = z.object({
	published_id: z.number().optional(),
	title: z.string().optional(),
});

export const delete_draft_validator = z.object({
	draft_id: z.number(),
});

export const delete_both_validator = z.object({
	draft_id: z.number(),
});

export const delete_custom_thumbnail_validator = z.object({
	draft_id: z.number(),
});

export const publish_validator = z.object({
	article: PublishArticleSchema,
	author_ids: z.array(z.number()),
	draft_id: z.number().optional(),
});

export const save_draft_validator = z.object({
	article: SaveDraftArticleSchema,
	author_ids: z.array(z.number()),
	draft_id: z.number(),
});

export const unpublish_validator = z.object({
	published_id: z.number(),
});

export const get_article_by_published_id_validator = z.object({
	published_id: z.number(),
});

export const get_article_by_published_url_validator = z.object({
	url: z.string(),
	created_at: z.date().optional(),
});

export const get_article_by_draft_id_validator = z.object({
	draft_id: z.number(),
});

// --- Unified `articles` table (#20/#19) ---
// uuid-keyed validators for the new create -> save -> publish flow. The
// number-keyed validators above stay in use by the legacy draft/published
// server actions.

export const create_article_validator = z.object({
	title: z.string(),
});

const new_article_payload_validator = z.object({
	title: z.string(),
	content: content_validator.optional(),
	thumbnail_crop: thumbnail_validator.optional(),
	created_at: z.date().optional(),
});

export const save_article_validator = z.object({
	article_id: z.string().uuid(),
	article: new_article_payload_validator,
	author_ids: z.array(z.number()),
});

export const publish_article_validator = z.object({
	article_id: z.string().uuid(),
	article: new_article_payload_validator,
	author_ids: z.array(z.number()),
});

export const get_article_by_new_id_validator = z.object({
	id: z.string().uuid(),
});

// --- Status lifecycle: archive / delete / unarchive / supersede-publish (#21) ---

export const archive_article_validator = z.object({
	article_id: z.string().uuid(),
});

export const delete_article_validator = z.object({
	article_id: z.string().uuid(),
});

export const create_superseding_draft_validator = z.object({
	article_id: z.string().uuid(),
});
