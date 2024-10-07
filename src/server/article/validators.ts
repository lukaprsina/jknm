import { z } from "zod";
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
