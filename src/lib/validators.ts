import { z } from "zod";

export const content_validator = z
  .object({
    time: z.number().optional(),
    blocks: z.array(
      z.object({
        id: z.string().optional(),
        type: z.string(),
        data: z.record(z.any()),
      }),
    ),
    version: z.string().optional(),
  })
  .nullable();

// if there is no thumbnail, set this to undefined
export const crop_validator = z
  .object({
    unit: z.enum(["%", "px"]),
    x: z.number(),
    y: z.number(),
    width: z.number(),
    height: z.number(),
  })
  .nullable();

export type CropType = z.infer<typeof crop_validator>;

export const published_article_hit_validator = z.object({
  published_id: z.number(),
  title: z.string(),
  url: z.string(),
  created_at: z.number(), // unix timestamp
  content_preview: z.string().max(1000), // maybe 600
  author_ids: z.array(z.number()),
  image: z.string().optional(),
  year: z.string(),
  has_thumbnail: z.boolean(),
});

export type PublishedArticleHit = z.infer<
  typeof published_article_hit_validator
>;

export const draft_article_hit_validator = z.object({
  draft_id: z.number(),
  title: z.string(),
  created_at: z.number(), // unix timestamp
  content_preview: z.string().max(1000), // maybe 600
  author_ids: z.array(z.number()),
  image: z.string().optional(),
  year: z.string(),
  has_thumbnail: z.boolean(),
});

export type DraftArticleHit = z.infer<typeof draft_article_hit_validator>;
