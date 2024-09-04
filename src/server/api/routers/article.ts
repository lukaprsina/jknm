import { z } from "zod";
import { createTRPCRouter, protectedProcedure, publicProcedure } from "../trpc";
import {
  Author,
  CreateDraftArticleSchema,
  DraftArticle,
  DraftArticlesToAuthors,
  PublishedArticle,
  SaveDraftArticleSchema,
} from "~/server/db/schema";
import { generateCursor } from "drizzle-cursor";
import { eq } from "drizzle-orm";

const cursor_asc = generateCursor({
  cursors: [
    {
      order: "ASC",
      key: "created_at_asc",
      schema: PublishedArticle.created_at,
    },
  ],
  primaryCursor: { order: "ASC", key: "id_asc", schema: PublishedArticle.id },
});

const cursor_desc = generateCursor({
  cursors: [
    {
      order: "DESC",
      key: "created_at_desc",
      schema: PublishedArticle.created_at,
    },
  ],
  primaryCursor: { order: "DESC", key: "id_desc", schema: PublishedArticle.id },
});

export const article_router = createTRPCRouter({
  get_infinite_published: publicProcedure
    .input(
      z.object({
        limit: z.number().min(1).max(1000).default(50),
        cursor: z.string().nullable(),
        direction: z.enum(["forward", "backward"]).optional(),
      }),
    )
    .query(async ({ ctx, input }) => {
      if (input.direction === "backward") {
        console.error("backward is not supported");
      }

      const last_item = cursor_desc.parse(input.cursor);

      const data = await ctx.db
        .select()
        .from(PublishedArticle)
        .orderBy(...cursor_desc.orderBy)
        .where(cursor_desc.where(last_item))
        .limit(input.limit);

      const last_token = cursor_desc.serialize(data.at(-1));

      return {
        data,
        last_token,
      };

      // page.at(-1)
    }),
  /* get_infinite_published: publicProcedure
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
            where: eq(PublishedArticlesToAuthors.author_id, 1),
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

      const last = data.at(data.length - 1);
      // last?.published_articles_to_authors.at(0).

      return {
        data,
        nextCursor: last?.created_at,
      };
    }), */

  get_published_by_id: publicProcedure
    .input(z.number())
    .query(({ ctx, input }) => {
      // TODO: when url doesn't match, send me an email
      return ctx.db.query.PublishedArticle.findFirst({
        where: eq(PublishedArticle.id, input),
      });
    }),

  create_draft: protectedProcedure
    .input(CreateDraftArticleSchema)
    .mutation(({ ctx, input }) => {
      return ctx.db
        .insert(DraftArticle)
        .values({ updated_at: new Date(), created_at: new Date(), ...input })
        .returning();
    }),

  save_draft: protectedProcedure
    .input(SaveDraftArticleSchema)
    .mutation(({ ctx, input }) => {
      if (!input.id) throw new Error("No id provided");

      return ctx.db
        .update(DraftArticle)
        .set(input)
        .where(eq(DraftArticle.id, input.id))
        .returning();
    }),

  publish: protectedProcedure
    .input(
      z.object({
        draft_id: z.number(),
        created_at: z.date(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      // TODO
      const draft = await ctx.db
        .select()
        .from(DraftArticlesToAuthors)
        .leftJoin(
          DraftArticle,
          eq(DraftArticlesToAuthors.article_id, DraftArticle.id),
        )
        .leftJoin(Author, eq(DraftArticlesToAuthors.author_id, Author.id))
        .where(eq(DraftArticle.id, input.draft_id));

      console.log("DRAFT", { draft });
    }),

  delete_both: protectedProcedure
    .input(z.number())
    .mutation(async ({ ctx, input }) => {
      const published_article = ctx.db
        .delete(PublishedArticle)
        .where(eq(PublishedArticle.id, input))
        .returning();

      const draft_article = ctx.db
        .delete(DraftArticle)
        .where(eq(DraftArticle.published_id, input))
        .returning();

      await Promise.allSettled([published_article, draft_article]);
    }),
});
