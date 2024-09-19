import { klona } from "klona";
import { z } from "zod";
import { algoliasearch as searchClient } from "algoliasearch";
import { createTRPCRouter, protectedProcedure, publicProcedure } from "../trpc";
import {
  CreateDraftArticleSchema,
  DraftArticle,
  DraftArticlesToAuthors,
  DuplicatedArticleUrls,
  PublishArticleSchema,
  PublishedArticle,
  PublishedArticlesToAuthors,
  SaveDraftArticleSchema,
} from "~/server/db/schema";
import { and, between, eq } from "drizzle-orm";
import { assert_at_most_one, assert_one } from "~/lib/assert-length";
import { withCursorPagination } from "drizzle-pagination";
import {
  convert_title_to_url,
  get_s3_draft_directory,
  get_s3_published_directory,
} from "~/lib/article-utils";
import type { PublishedArticleWithAuthors } from "~/components/article/card-adapter";
import {
  delete_s3_directory,
  rename_s3_files_and_content,
} from "~/server/s3-utils";
import { env } from "~/env";
import type { S3CopySourceInfo } from "~/lib/s3-publish";
import { s3_copy, s3_copy_file } from "~/lib/s3-publish";
import { convert_article_to_algolia_object } from "~/lib/algoliasearch";

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
    return ctx.db.query.DraftArticle.findMany({
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
      return ctx.db.query.PublishedArticle.findFirst({
        where: eq(PublishedArticle.id, input),
        with: {
          published_articles_to_authors: {
            with: { author: true },
          },
        },
      });
    }),

  get_article_by_published_id: publicProcedure
    .input(z.number().optional())
    .query(async ({ ctx, input }) => {
      if (!input) return { published: undefined };

      const published = await ctx.db.query.PublishedArticle.findFirst({
        where: eq(PublishedArticle.id, input),
        with: {
          published_articles_to_authors: {
            with: { author: true },
          },
        },
      });

      if (!published) return { published };

      if (ctx.session) {
        const draft = await ctx.db.query.DraftArticle.findFirst({
          where: eq(DraftArticle.published_id, input),
          with: {
            draft_articles_to_authors: {
              with: { author: true },
            },
          },
        });

        return { published, draft };
      }

      return { published };
    }),

  // get published and if logged in, also draft
  get_article_by_published_url: publicProcedure
    .input(z.object({ url: z.string(), created_at: z.date().optional() }))
    .query(async ({ ctx, input }) => {
      // console.log("get_article_by_published_url input", input);
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

      /* console.log("get_article_by_published_url published", {
        published,
        conditions,
      }); */
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

  // don't need to change s3 urls, because id is the same
  save_draft: protectedProcedure
    .input(
      z.object({
        article: SaveDraftArticleSchema,
        author_ids: z.array(z.number()),
        draft_id: z.number(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const transaction = await ctx.db.transaction(async (tx) => {
        // console.log("saving draft input", input);

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

        return tx.query.DraftArticle.findFirst({
          where: eq(DraftArticle.id, input.draft_id),
          with: {
            draft_articles_to_authors: {
              with: { author: true },
            },
          },
        });
      });

      return transaction;
    }),

  /* if published_id is provided, clone published draft_article to draft
    if draft_article is provided, create draft draft_article
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
      // console.log("get_or_create_draft input", input);

      try {
        const transaction = await ctx.db.transaction(async (tx) => {
          if (!input.published_id && !input.article) {
            throw new Error("Either published_id or draft_article must be provided");
          }

          let published: PublishedArticleWithAuthors | undefined;

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

            if (!published) throw new Error("Published draft_article not found");

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

          // if draft_article is provided, create draft
          let values: typeof DraftArticle.$inferInsert | undefined = undefined;
          if (input.article) {
            values = input.article;
          } else if (published) {
            values = {
              title: published.title,
              content: published.content,
              created_at: published.created_at,
              published_id: published.id,
              thumbnail_crop: published.thumbnail_crop,
            };
          } else {
            throw new Error("Can't create draft");
          }

          const created_drafts = await tx
            .insert(DraftArticle)
            .values(values)
            .returning();

          assert_one(created_drafts);
          const created_draft = created_drafts[0];

          const renamed = created_draft.content
            ? await rename_s3_files_and_content(
                created_draft.content,
                created_draft.thumbnail_crop,
                created_draft.id.toString(),
                true,
              )
            : undefined;

          // update content with renamed urls
          if (renamed) {
            await tx
              .update(DraftArticle)
              .set({
                content: renamed.new_content,
                thumbnail_crop: renamed.new_thumbnail,
              })
              .where(eq(DraftArticle.id, created_draft.id));
          }

          // copy thumbnails from published to draft
          if (published?.id) {
            const s3_url = get_s3_draft_directory(created_draft.id);
            const names = ["thumbnail.png", "thumbnail-uploaded.png"];
            const thumbnail_sources = names.map(
              (name) =>
                ({
                  file_name: name,
                  source_bucket: env.NEXT_PUBLIC_AWS_PUBLISHED_BUCKET_NAME,
                  source_path: get_s3_published_directory(
                    published.url,
                    published.created_at,
                  ),
                  destination_url: `${s3_url}/thumbnail.png`,
                }) satisfies S3CopySourceInfo,
            );

            for (const source of thumbnail_sources) {
              await s3_copy_file(
                source,
                env.NEXT_PUBLIC_AWS_DRAFT_BUCKET_NAME,
                s3_url,
              );
            }
          }

          if (published && published.published_articles_to_authors.length > 0) {
            // I don't think this is necessary, because we are creating a new draft
            /* await tx
            .delete(DraftArticlesToAuthors)
            .where(eq(DraftArticlesToAuthors.draft_id, draft_id)); */

            await tx.insert(DraftArticlesToAuthors).values(
              published.published_articles_to_authors.map((author) => ({
                author_id: author.author_id,
                draft_id: created_draft.id,
              })),
            );
          }

          const draft_returning = await tx.query.DraftArticle.findFirst({
            where: eq(DraftArticle.id, created_draft.id),
            with: {
              draft_articles_to_authors: {
                with: {
                  author: true,
                },
              },
            },
          });

          // console.log("created draft", draft_returning);

          if (!draft_returning) throw new Error("Created draft not found");
          return draft_returning;
        });

        // console.log("get_or_create_draft transaction", transaction);

        return transaction;
      } catch (error) {
        console.error("draft error", error);
        throw error;
      }
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
      // console.log("publish input", input);

      // console.log("publish transaction", transaction);

      return await ctx.db.transaction(async (tx) => {
        let draft_article: typeof DraftArticle.$inferSelect | undefined;
        let published_article: typeof PublishedArticle.$inferSelect | undefined;
        // check if draft exists
        if (input.draft_id) {
          draft_article = await tx.query.DraftArticle.findFirst({
            where: eq(DraftArticle.id, input.draft_id),
          });

          // console.log("publishing draft_article has draft_id", { draft });
          if (!draft_article) throw new Error("Draft not found");

          if (draft_article.published_id) {
            published_article = await tx.query.PublishedArticle.findFirst({
              where: eq(PublishedArticle.id, draft_article.published_id),
            });

            if (!published_article)
              throw new Error("Published draft_article not found");
          }
        }

        if (published_article) {
          // delete old content
          await delete_s3_directory(
            env.NEXT_PUBLIC_AWS_PUBLISHED_BUCKET_NAME,
            get_s3_published_directory(
              published_article.url,
              published_article.created_at,
            ),
          );
        }

        const value = klona(input.article);
        if (!value.created_at) throw new Error("created_at is required");

        const renamed_url = convert_title_to_url(value.title);

        const s3_url = get_s3_published_directory(
          renamed_url,
          value.created_at,
        );

        // rename urls and content
        const renamed = value.content
          ? await rename_s3_files_and_content(
              value.content,
              value.thumbnail_crop,
              s3_url,
              false,
            )
          : undefined;

        if (draft_article?.id) {
          const names = ["thumbnail.png", "thumbnail-uploaded.png"];
          const thumbnail_sources = names.map(
            (name) =>
              ({
                file_name: name,
                source_bucket: env.NEXT_PUBLIC_AWS_DRAFT_BUCKET_NAME,
                source_path: get_s3_draft_directory(draft_article.id),
                destination_url: `${s3_url}/thumbnail.png`,
              }) satisfies S3CopySourceInfo,
          );

          for (const source of thumbnail_sources) {
            await s3_copy_file(
              source,
              env.NEXT_PUBLIC_AWS_PUBLISHED_BUCKET_NAME,
              s3_url,
            );
          }
        }

        value.url = renamed_url;
        value.content = renamed?.new_content;
        value.thumbnail_crop = renamed?.new_thumbnail;

        if (published_article?.id) {
          // update if draft had published_id
          const published_articles = await tx
            .update(PublishedArticle)
            .set(value)
            .where(eq(PublishedArticle.id, published_article.id))
            .returning();

          assert_one(published_articles);
          published_article = published_articles[0];
        } else {
          // insert new published draft_article
          const published_articles = await tx
            .insert(PublishedArticle)
            .values(value)
            .returning();

          assert_one(published_articles);
          published_article = published_articles[0];
        }

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

        // if draft exists, delete it
        if (draft_article?.id) {
          await tx
            .delete(DraftArticle)
            .where(eq(DraftArticle.id, draft_article.id));
          await delete_s3_directory(
            env.NEXT_PUBLIC_AWS_DRAFT_BUCKET_NAME,
            draft_article.id.toString(),
          );
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
          throw new Error("Published draft_article not found");

        const algolia = searchClient(
          env.NEXT_PUBLIC_ALGOLIA_ID,
          env.ALGOLIA_ADMIN_KEY,
        );

        await algolia.addOrUpdateObject({
          indexName: "published_article_created_at_desc",
          objectID: published_article_with_authors.id.toString(),
          body: convert_article_to_algolia_object(
            published_article_with_authors,
          ),
        });

        return published_article_with_authors;
      });
    }),

  sync_duplicate_urls: protectedProcedure.mutation(async ({ ctx }) => {
    return await ctx.db.transaction(async (tx) => {
      // update duplicated_urls
      // TODO: iterate over all duplicated_urls, check them also
      await tx.delete(DuplicatedArticleUrls);
      const all_urls = await tx.query.PublishedArticle.findMany({
        columns: {
          url: true,
        },
      });

      const url_set = new Map<string, number>();
      for (const article_url of all_urls) {
        const count = url_set.get(article_url.url) ?? 0;
        url_set.set(article_url.url, count + 1);
      }

      const duplicate_urls = Array.from(url_set.entries()).reduce<
        (typeof DuplicatedArticleUrls.$inferInsert)[]
      >((acc, [url, count]) => {
        if (count > 1) acc.push({ url });
        return acc;
      }, []);

      // console.log("duplicated_urls", duplicated_urls);

      if (duplicate_urls.length > 0) {
        await tx.insert(DuplicatedArticleUrls).values(duplicate_urls);
      }

      return duplicate_urls;
    });
  }),

  // input is draft_id
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

        await delete_s3_directory(
          env.NEXT_PUBLIC_AWS_DRAFT_BUCKET_NAME,
          draft.id.toString(),
        );

        if (!draft.published_id) return { draft };

        const published = await tx.query.PublishedArticle.findFirst({
          where: eq(PublishedArticle.id, draft.published_id),
        });

        if (!published) throw new Error("Published draft_article not found");

        return { draft, url: published.url };
      });
    }),

  // TODO: warn user that the draft will be ovewritten
  // input is published_id
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

        try {
          const algolia = searchClient(
            env.NEXT_PUBLIC_ALGOLIA_ID,
            env.ALGOLIA_ADMIN_KEY,
          );

          await algolia.deleteObject({
            indexName: "published_article_created_at_desc",
            objectID: published.id.toString(),
          });
        } catch (error) {
          console.error("algolia error", error);
        }

        const all_drafts = await tx.query.DraftArticle.findMany({
          where: eq(DraftArticle.published_id, input),
        });

        assert_at_most_one(all_drafts);
        const draft = all_drafts[0];

        if (draft) {
          await delete_s3_directory(
            env.NEXT_PUBLIC_AWS_DRAFT_BUCKET_NAME,
            draft.id.toString(),
          );
        }

        const s3_url = get_s3_published_directory(
          published.url,
          published.created_at,
        );

        const draft_fields = {
          published_id: null,
          content: published.content,
          title: published.title,
          created_at: published.created_at,
          thumbnail_crop: published.thumbnail_crop,
        } satisfies typeof DraftArticle.$inferInsert;

        const draft_return = draft
          ? await tx
              .update(DraftArticle)
              .set(draft_fields)
              .where(eq(DraftArticle.published_id, input))
              .returning()
          : await tx.insert(DraftArticle).values(draft_fields);

        await tx.delete(PublishedArticle).where(eq(PublishedArticle.id, input));

        assert_one(draft_return);
        const updated_or_created_draft = draft_return[0];

        await s3_copy({
          source_bucket: env.NEXT_PUBLIC_AWS_PUBLISHED_BUCKET_NAME,
          source_url: s3_url,
          destination_bucket: env.NEXT_PUBLIC_AWS_DRAFT_BUCKET_NAME,
          destination_url: get_s3_draft_directory(updated_or_created_draft.id),
        });

        await delete_s3_directory(
          env.NEXT_PUBLIC_AWS_PUBLISHED_BUCKET_NAME,
          s3_url,
        );

        return updated_or_created_draft;
      });
    }),

  delete_both: protectedProcedure
    .input(z.object({ draft_id: z.number() }))
    .mutation(async ({ ctx, input }) => {
      return await ctx.db.transaction(async (tx) => {
        const draft_article = await tx
          .delete(DraftArticle)
          .where(eq(DraftArticle.id, input.draft_id))
          .returning();

        assert_one(draft_article);

        const draft = draft_article[0];

        await delete_s3_directory(
          env.NEXT_PUBLIC_AWS_DRAFT_BUCKET_NAME,
          draft.id.toString(),
        );

        if (draft.published_id) {
          const published_article = await tx
            .delete(PublishedArticle)
            .where(eq(PublishedArticle.id, draft.published_id))
            .returning();

          assert_one(published_article);
          const published = published_article[0];

          await delete_s3_directory(
            env.NEXT_PUBLIC_AWS_PUBLISHED_BUCKET_NAME,
            get_s3_published_directory(published.url, published.created_at),
          );

          try {
            const algolia = searchClient(
              env.NEXT_PUBLIC_ALGOLIA_ID,
              env.ALGOLIA_ADMIN_KEY,
            );

            await algolia.deleteObject({
              indexName: "published_article_created_at_desc",
              objectID: published.id.toString(),
            });
          } catch (error) {
            console.error("algolia error", error);
          }

          return { draft, published };
        }

        return { draft };
      });
    }),
});
