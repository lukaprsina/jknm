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
  .optional();

export const article_hit_validator = z.object({
  objectID: z.string(),
  title: z.string(),
  url: z.string(),
  created_at: z.number(), // unix timestamp
  content_preview: z.string().max(1000), // maybe 600
  author_names: z.array(z.string()),
  image: z.string().optional(),
  published: z.boolean(),
  has_draft: z.boolean(),
  year: z.string(),
});

export type ArticleHit = z.infer<typeof article_hit_validator>;
