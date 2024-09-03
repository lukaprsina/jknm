import { z } from "zod";
import { createTRPCRouter, protectedProcedure, publicProcedure } from "../trpc";
import { withCursorPagination } from "drizzle-pagination";
import {
  Author,
  CreateDraftArticleSchema,
  DraftArticle,
  DraftArticlesToAuthors,
  PublishedArticle,
  SaveDraftArticleSchema,
} from "~/server/db/schema";
import { eq } from "drizzle-orm";

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

      const data = await ctx.db.query.PublishedArticle.findMany(
        withCursorPagination({
          limit: input.limit,
          cursors: [[PublishedArticle.created_at, direction, input.cursor]],
        }),
      );

      const last = data.at(data.length - 1);

      return {
        data,
        nextCursor: last?.created_at,
      };
    }),

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
      const draft = ctx.db
        .select()
        .from(DraftArticlesToAuthors)
        .leftJoin(
          DraftArticle,
          eq(DraftArticlesToAuthors.draft_article_id, DraftArticle.id),
        )
        .leftJoin(Author, eq(DraftArticlesToAuthors.author_id, Author.id))
        .where(eq(DraftArticle.id, input.draft_id));

      console.log("DRAFT", draft);
    }),
});
