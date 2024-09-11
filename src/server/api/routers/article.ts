import { z } from "zod";
import { createTRPCRouter, protectedProcedure, publicProcedure } from "../trpc";
import {
  CreateDraftArticleSchema,
  DraftArticle,
  DraftArticlesToAuthors,
  PublishArticleSchema,
  PublishedArticle,
  PublishedArticlesToAuthors,
  SaveDraftArticleSchema,
} from "~/server/db/schema";
import { and, between, eq } from "drizzle-orm";
import { named_promise_all_settled } from "~/lib/named-promise";
import { assert_at_most_one, assert_one } from "~/lib/assert-length";
import { withCursorPagination } from "drizzle-pagination";
import { convert_title_to_url } from "~/lib/article-utils";
import type { PublishedArticleWithAuthors } from "~/components/article/card-adapter";
import { rename_content } from "~/server/s3-utils";

export const article_router = createTRPCRouter({
  get_infinite_published: publicProcedure
    .input(
      z.object({
        limit: z.number().min(1).max(1000).default(50),
        cursor: z.date().optional(),
        direction: z.enum(["forward", "backward"]).optional(),
      }),
    )
    .query(async ({ ctx, input }) => {
      const direction = input.direction === "backward" ? "asc" : "desc";

      const data = await ctx.db.query.PublishedArticle.findMany({
        with: {
          published_articles_to_authors: {
            with: {
              author: true,
            },
          },
        },
        ...withCursorPagination({
          limit: input.limit,
          cursors: [[PublishedArticle.created_at, direction, input.cursor]],
        }),
      });

      const last = data.at(-1);

      return {
        data,
        next_cursor: last?.created_at,
      };
    }),

  get_all_drafts: publicProcedure.query(async ({ ctx }) => {
    return await ctx.db.query.DraftArticle.findMany({
      with: {
        draft_articles_to_authors: {
          with: {
            author: true,
          },
        },
      },
    });
  }),

  get_duplicate_urls: publicProcedure.query(async ({ ctx }) => {
    const urls = await ctx.db.query.DuplicatedArticleUrls.findMany();
    return urls.map((data) => data.url);
  }),

  get_published_by_id: publicProcedure
    .input(z.number())
    .query(async ({ ctx, input }) => {
      // TODO: when url doesn't match, send me an email
      return await ctx.db.query.PublishedArticle.findFirst({
        where: eq(PublishedArticle.id, input),
        with: {
          published_articles_to_authors: {
            with: { author: true },
          },
        },
      });
    }),

  // get published and if logged in, also draft
  get_article_by_published_url: publicProcedure
    .input(z.object({ url: z.string(), created_at: z.date().optional() }))
    .query(async ({ ctx, input }) => {
      const conditions = [eq(PublishedArticle.url, input.url)];

      if (input.created_at) {
        const beggining_of_day = new Date(input.created_at);
        beggining_of_day.setHours(0, 0, 0, 0);
        const end_of_day = new Date(input.created_at);
        end_of_day.setHours(23, 59, 59, 999);

        conditions.push(
          between(PublishedArticle.created_at, beggining_of_day, end_of_day),
        );
      }

      const published = await ctx.db.query.PublishedArticle.findFirst({
        where: and(...conditions),
        with: {
          published_articles_to_authors: {
            with: { author: true },
          },
        },
      });

      // only send draft when logged in
      if (ctx.session && published?.id) {
        const draft = await ctx.db.query.DraftArticle.findFirst({
          where: eq(DraftArticle.published_id, published.id),
          with: {
            draft_articles_to_authors: {
              with: {
                author: true,
              },
            },
          },
        });

        return { published, draft };
      }

      return { published };
    }),

  // if logged in, get published and draft
  get_article_by_draft_id: protectedProcedure
    .input(z.number())
    .query(async ({ ctx, input }) => {
      const draft = await ctx.db.query.DraftArticle.findFirst({
        where: eq(DraftArticle.id, input),
        with: {
          draft_articles_to_authors: {
            with: {
              author: true,
            },
          },
        },
      });

      if (draft?.published_id) {
        const published = await ctx.db.query.PublishedArticle.findFirst({
          where: eq(PublishedArticle.id, draft.published_id),
          with: {
            published_articles_to_authors: {
              with: {
                author: true,
              },
            },
          },
        });

        return { draft, published };
      }

      return { draft };
    }),

  /* if published_id is provided, clone published article to draft
    if article is provided, create draft article
    else throw error */
  get_or_create_draft: protectedProcedure
    .input(
      z.object({
        published_id: z.number().optional(),
        article: CreateDraftArticleSchema.optional(),
        images: z.array(z.string()).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const transaction = await ctx.db.transaction(async (tx) => {
        if (!input.published_id && !input.article) {
          throw new Error("Either published_id or article must be provided");
        }

        let published: PublishedArticleWithAuthors | undefined;
        console.log("get_or_create_draft input", input);

        if (input.published_id) {
          published = await tx.query.PublishedArticle.findFirst({
            where: eq(PublishedArticle.id, input.published_id),
            with: {
              published_articles_to_authors: {
                with: {
                  author: true,
                },
              },
            },
          });

          if (!published) throw new Error("Published article not found");

          const draft = await tx.query.DraftArticle.findFirst({
            where: eq(DraftArticle.published_id, input.published_id),
            with: {
              draft_articles_to_authors: {
                with: {
                  author: true,
                },
              },
            },
          });

          if (draft) return draft;
        }

        let values: typeof DraftArticle.$inferInsert | undefined = undefined;
        if (input.article) {
          const renamed_content = rename_content(input.article.content ?? null);
          values = { ...input.article, content: renamed_content };
        } else if (published) {
          const renamed_content = rename_content(published.content);
          values = {
            title: published.title,
            content: renamed_content,
            created_at: published.created_at,
            published_id: published.id,
          };
        } else {
          throw new Error("Can't create draft");
        }

        const created_draft = await tx
          .insert(DraftArticle)
          .values(values)
          .returning();

        assert_one(created_draft);
        const draft_id = created_draft[0].id;

        if (published) {
          // I don't think this is necessary
          /* await tx
            .delete(DraftArticlesToAuthors)
            .where(eq(DraftArticlesToAuthors.draft_id, draft_id)); */

          await tx.insert(DraftArticlesToAuthors).values(
            published.published_articles_to_authors.map((author) => ({
              author_id: author.author_id,
              draft_id: draft_id,
            })),
          );
        }

        const draft_returning = await tx.query.DraftArticle.findFirst({
          where: eq(DraftArticle.id, draft_id),
          with: {
            draft_articles_to_authors: {
              with: {
                author: true,
              },
            },
          },
        });

        console.log("created draft", draft_returning);

        if (!draft_returning) throw new Error("Created draft not found");
        return draft_returning;
      });

      return transaction;
    }),

  save_draft: protectedProcedure
    .input(
      z.object({
        article: SaveDraftArticleSchema,
        author_ids: z.array(z.number()),
        draft_id: z.number(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      return await ctx.db.transaction(async (tx) => {
        console.log("saving draft input", input);

        const updated_draft = await tx
          .update(DraftArticle)
          .set(input.article)
          .where(eq(DraftArticle.id, input.draft_id))
          .returning();

        if (updated_draft.length !== 1) throw new Error("Draft not found");

        await tx
          .delete(DraftArticlesToAuthors)
          .where(eq(DraftArticlesToAuthors.draft_id, input.draft_id));

        if (input.author_ids.length !== 0) {
          await tx.insert(DraftArticlesToAuthors).values(
            input.author_ids.map((author_id) => ({
              author_id,
              draft_id: input.draft_id,
            })),
          );
        }

        return await tx.query.DraftArticle.findFirst({
          where: eq(DraftArticle.id, input.draft_id),
          with: {
            draft_articles_to_authors: {
              with: { author: true },
            },
          },
        });
      });
    }),

  publish: protectedProcedure
    .input(
      z.object({
        article: PublishArticleSchema,
        author_ids: z.array(z.number()),
        draft_id: z.number().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      return await ctx.db.transaction(async (tx) => {
        const value = { ...input.article };
        if (value.title) value.url = convert_title_to_url(value.title);

        console.log("publishing article", { value, input });

        let draft: typeof DraftArticle.$inferInsert | undefined;
        if (input.draft_id) {
          draft = await tx.query.DraftArticle.findFirst({
            where: eq(DraftArticle.id, input.draft_id),
            with: {
              draft_articles_to_authors: {
                with: {
                  author: true,
                },
              },
            },
          });

          console.log("publishing article has draft_id", { draft });
          if (!draft) throw new Error("Draft not found");
        }

        const inserted_published_articles = await tx
          .insert(PublishedArticle)
          .values(value)
          .returning();

        assert_one(inserted_published_articles);
        const published_article = inserted_published_articles[0];

        await tx
          .delete(PublishedArticlesToAuthors)
          .where(
            eq(PublishedArticlesToAuthors.published_id, published_article.id),
          );

        if (input.author_ids.length !== 0) {
          await tx.insert(PublishedArticlesToAuthors).values(
            input.author_ids.map((author_id) => ({
              author_id,
              published_id: published_article.id,
            })),
          );
        }

        // TODO
        // update algolia published article in published index
        // invalidate trpc

        if (draft?.id) {
          await tx.delete(DraftArticle).where(eq(DraftArticle.id, draft.id));
          // delete algolia draft article in draft index
        }

        const published_article_with_authors =
          await tx.query.PublishedArticle.findFirst({
            where: eq(PublishedArticle.id, published_article.id),
            with: {
              published_articles_to_authors: {
                with: { author: true },
              },
            },
          });

        if (!published_article_with_authors)
          throw new Error("Published article not found");

        return published_article_with_authors;
      });
    }),

  delete_draft: protectedProcedure
    .input(z.number())
    .mutation(async ({ ctx, input }) => {
      return await ctx.db.transaction(async (tx) => {
        const draft_result = await tx
          .delete(DraftArticle)
          .where(eq(DraftArticle.id, input))
          .returning();

        assert_one(draft_result);
        const draft = draft_result[0];

        if (!draft.published_id) return { draft };

        const published = await tx.query.PublishedArticle.findFirst({
          where: eq(PublishedArticle.id, draft.published_id),
        });

        if (!published) throw new Error("Published article not found");

        return { draft, url: published.url };
      });
    }),

  // TODO: warn user that the draft will be ovewritten
  unpublish: protectedProcedure
    .input(z.number())
    .mutation(async ({ ctx, input }) => {
      return await ctx.db.transaction(async (tx) => {
        const all_published = await tx.query.PublishedArticle.findMany({
          where: eq(PublishedArticle.id, input),
          with: {
            published_articles_to_authors: {
              with: { author: true },
            },
          },
        });

        assert_one(all_published);
        const published = all_published[0];

        const all_drafts = await tx.query.DraftArticle.findMany({
          where: eq(DraftArticle.published_id, input),
        });

        assert_at_most_one(all_drafts);
        const draft = all_drafts[0];

        const draft_fields = {
          content: published.content,
          title: published.title,
          created_at: published.created_at,
          thumbnail_crop: published.thumbnail_crop,
        } satisfies typeof DraftArticle.$inferInsert;

        await tx.delete(PublishedArticle).where(eq(PublishedArticle.id, input));

        const draft_return = draft
          ? await tx
              .update(DraftArticle)
              .set(draft_fields)
              .where(eq(DraftArticle.published_id, input))
              .returning()
          : await tx.insert(DraftArticle).values(draft_fields);

        assert_one(draft_return);
        const updated_or_created_draft = draft_return[0];

        return updated_or_created_draft;
      });
    }),

  delete_both: protectedProcedure
    .input(z.number())
    .mutation(async ({ ctx, input }) => {
      return await ctx.db.transaction(async (tx) => {
        const published_article = tx
          .delete(PublishedArticle)
          .where(eq(PublishedArticle.id, input))
          .returning();

        const draft_article = tx
          .delete(DraftArticle)
          .where(eq(DraftArticle.published_id, input))
          .returning();

        return await named_promise_all_settled({
          published_article,
          draft_article,
        });
      });
    }),
});
