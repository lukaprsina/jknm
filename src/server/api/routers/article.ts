import { z } from "zod";
import { createTRPCRouter, protectedProcedure, publicProcedure } from "../trpc";
import {
  CreateDraftArticleSchema,
  DraftArticle,
  PublishedArticle,
  PublishedArticlesToAuthors,
  SaveDraftArticleSchema,
} from "~/server/db/schema";
import { eq, and, gte, lt } from "drizzle-orm";
import { named_promise_all_settled } from "~/lib/named-promise";
import { assert_at_most_one, assert_one } from "~/lib/assert-length";
import { withCursorPagination } from "drizzle-pagination";
import { convert_title_to_url } from "~/components/editor/editor-utils";
import { format_date_for_url, read_date_from_url } from "~/lib/format-date";

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

  get_published_by_id: publicProcedure
    .input(z.number())
    .query(async ({ ctx, input }) => {
      // TODO: when url doesn't match, send me an email
      return await ctx.db.query.PublishedArticle.findFirst({
        where: eq(PublishedArticle.id, input),
      });
    }),

  get_published_by_url_and_date: publicProcedure
    .input(z.string())
    .query(async ({ ctx, input }) => {
      const url_parts = decodeURIComponent(input).split("-");
      const article_url = url_parts.slice(0, -3).join("-");
      const article_date_string = url_parts.slice(-3).join("-");

      if (!article_url || !article_date_string) {
        throw new Error(`Can't create URL from ${input}`);
      }

      const url_date = read_date_from_url(article_date_string);
      const next_day = new Date(url_date);
      next_day.setDate(next_day.getDate() + 1);

      const article = await ctx.db.query.PublishedArticle.findMany({
        where: and(
          eq(PublishedArticle.url, input),
          and(
            gte(PublishedArticle.created_at, url_date),
            lt(PublishedArticle.created_at, next_day),
          ),
        ),
      });

      assert_at_most_one(article);

      return article[0];
    }),

  create_draft: protectedProcedure
    .input(CreateDraftArticleSchema)
    .mutation(async ({ ctx, input }) => {
      const draft = await ctx.db
        .insert(DraftArticle)
        .values({ updated_at: new Date(), created_at: new Date(), ...input })
        .returning();

      assert_one(draft);

      return draft[0];
    }),

  save_draft: protectedProcedure
    .input(SaveDraftArticleSchema)
    .mutation(async ({ ctx, input }) => {
      if (!input.id) throw new Error("No id provided");

      return await ctx.db
        .update(DraftArticle)
        .set(input)
        .where(eq(DraftArticle.id, input.id))
        .returning();
    }),

  publish: protectedProcedure
    .input(z.number())
    .mutation(async ({ ctx, input }) => {
      return await ctx.db.transaction(async (tx) => {
        const draft = await tx.query.DraftArticle.findFirst({
          where: eq(DraftArticle.id, input),
          with: {
            draft_articles_to_authors: {
              with: {
                author: true,
              },
            },
          },
        });

        if (!draft) throw new Error("Draft not found");
        const url_with_date = convert_title_to_url(
          draft.title,
          draft.created_at,
        );

        await tx
          .insert(PublishedArticle)
          .values([
            {
              content: draft.content,
              title: draft.title,
              preview_image: draft.preview_image,
              created_at: draft.created_at,
              url: url_with_date,
            },
          ])
          .returning();

        for (const author of draft.draft_articles_to_authors) {
          await tx.insert(PublishedArticlesToAuthors).values([
            {
              author_id: author.author_id,
              article_id: draft.id,
            },
          ]);
        }

        await tx.delete(DraftArticle).where(eq(DraftArticle.id, input));

        return tx.query.PublishedArticle.findFirst({
          where: eq(PublishedArticle.url, url_with_date),
          with: {
            published_articles_to_authors: {
              with: { author: true },
            },
          },
        });
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

        /* await tx
          .delete(DraftArticlesToAuthors)
          .where(eq(DraftArticlesToAuthors.article_id, input)); */

        if (!draft.published_id) return { draft };

        const published = await tx.query.PublishedArticle.findFirst({
          where: eq(PublishedArticle.id, draft.published_id),
        });

        return { draft, url: published?.url };
      });
    }),

  // TODO: warn user that draft will be ovewrriten
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
        const draft = all_drafts.at(0);

        const draft_fields = {
          content: published.content,
          title: published.title,
          created_at: published.created_at,
          preview_image: published.preview_image,
        } satisfies typeof DraftArticle.$inferInsert;

        await tx.delete(PublishedArticle).where(eq(PublishedArticle.id, input));
        /* await tx
          .delete(PublishedArticlesToAuthors)
          .where(eq(PublishedArticlesToAuthors.article_id, input)); */

        const draft_return = draft
          ? await tx
              .update(DraftArticle)
              .set(draft_fields)
              .where(eq(DraftArticle.published_id, input))
              .returning()
          : await tx.insert(DraftArticle).values(draft_fields);
        return draft_return;
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

/* get_infinite_published: publicProcedure
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
    }), */

/* 
// TODO
// eslint-disable-next-line @typescript-eslint/no-unused-vars
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
}); */
