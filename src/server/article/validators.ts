import { z } from "zod";
import { content_validator, thumbnail_validator } from "~/lib/validators";

// --- Unified `articles` table (#20/#19) ---
// uuid-keyed validators for the create -> save -> publish flow.

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
