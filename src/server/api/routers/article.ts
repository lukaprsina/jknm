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
import { and, asc, between, eq } from "drizzle-orm";
import { assert_at_most_one, assert_one } from "~/lib/assert-length";
import { withCursorPagination } from "drizzle-pagination";
import {
  convert_title_to_url,
  get_s3_draft_directory,
  get_s3_published_directory,
} from "~/lib/article-utils";
import type { PublishedArticleWithAuthors } from "~/components/article/card-adapter";
import {
  delete_objects,
  delete_s3_directory,
  rename_s3_files_and_content,
  s3_copy_thumbnails,
} from "~/server/s3-utils";
import { env } from "~/env";
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
            orderBy: asc(PublishedArticlesToAuthors.order),
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
          orderBy: asc(PublishedArticlesToAuthors.order),
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
            orderBy: asc(PublishedArticlesToAuthors.order),
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
            orderBy: asc(PublishedArticlesToAuthors.order),
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
              orderBy: asc(PublishedArticlesToAuthors.order),
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
            orderBy: asc(PublishedArticlesToAuthors.order),
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
              orderBy: asc(PublishedArticlesToAuthors.order),
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
            orderBy: asc(PublishedArticlesToAuthors.order),
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
              orderBy: asc(PublishedArticlesToAuthors.order),
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
      return await ctx.db.transaction(async (tx) => {
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
          const values = input.author_ids.map((author_id, index) => ({
            author_id,
            draft_id: input.draft_id,
            order: index,
          }));

          console.log("save_draft values", values);
          await tx.insert(DraftArticlesToAuthors).values(values);
        }

        const first_draft = await tx.query.DraftArticle.findFirst({
          where: eq(DraftArticle.id, input.draft_id),
          with: {
            draft_articles_to_authors: {
              with: { author: true },
              orderBy: asc(PublishedArticlesToAuthors.order),
            },
          },
        });

        console.log("save_draft first_draft", first_draft);

        return first_draft;
      });
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
        // console.log("get_or_create_draft transaction", transaction);

        return await ctx.db.transaction(async (tx) => {
          if (!input.published_id && !input.article) {
            throw new Error(
              "Either published_id or draft_article must be provided",
            );
          }

          let published: PublishedArticleWithAuthors | undefined;

          /*
          if published_id is provided, check if it has draft
          if it has, return draft
          else, create draft from published
           */
          if (input.published_id) {
            published = await tx.query.PublishedArticle.findFirst({
              where: eq(PublishedArticle.id, input.published_id),
              with: {
                published_articles_to_authors: {
                  with: {
                    author: true,
                  },
                  orderBy: asc(PublishedArticlesToAuthors.order),
                },
              },
            });

            if (!published)
              throw new Error("Published draft_article not found");

            const draft = await tx.query.DraftArticle.findFirst({
              where: eq(DraftArticle.published_id, input.published_id),
              with: {
                draft_articles_to_authors: {
                  with: {
                    author: true,
                  },
                  orderBy: asc(PublishedArticlesToAuthors.order),
                },
              },
            });

            if (draft) return draft;
          }

          // values for draft
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

          // we update content with renamed urls
          const renamed_content = created_draft.content
            ? await rename_s3_files_and_content(
                created_draft.content,
                created_draft.id.toString(),
                true,
              )
            : undefined;

          if (renamed_content) {
            await tx
              .update(DraftArticle)
              .set({
                content: renamed_content,
              })
              .where(eq(DraftArticle.id, created_draft.id));
          }

          // copy thumbnails from published to draft
          if (published?.id) {
            await s3_copy_thumbnails({
              source_bucket: env.NEXT_PUBLIC_AWS_PUBLISHED_BUCKET_NAME,
              source_path: get_s3_published_directory(
                published.url,
                published.created_at,
              ),
              destination_bucket: env.NEXT_PUBLIC_AWS_DRAFT_BUCKET_NAME,
              destination_url: get_s3_draft_directory(created_draft.id),
              thumbnail_crop: values.thumbnail_crop ?? undefined,
            });
          }

          /* 
          add authors from old published article
          because we are creating a new draft,
            we don't need to delete old draft authors
          */
          if (published && published.published_articles_to_authors.length > 0) {
            await tx.insert(DraftArticlesToAuthors).values(
              published.published_articles_to_authors.map((author, index) => ({
                author_id: author.author_id,
                draft_id: created_draft.id,
                order: index,
              })),
            );
          }

          // return draft article with authors
          const draft_returning = await tx.query.DraftArticle.findFirst({
            where: eq(DraftArticle.id, created_draft.id),
            with: {
              draft_articles_to_authors: {
                with: {
                  author: true,
                },
                orderBy: asc(PublishedArticlesToAuthors.order),
              },
            },
          });

          // console.log("created draft", draft_returning);

          if (!draft_returning) throw new Error("Created draft not found");
          return draft_returning;
        });
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
      console.log("publish input", input);

      // console.log("publish transaction", transaction);

      return await ctx.db.transaction(async (tx) => {
        let draft_article: typeof DraftArticle.$inferSelect | undefined;
        let published_article: typeof PublishedArticle.$inferSelect | undefined;

        // if draft_id is provided, get the draft and published article
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

        // delete content from published article, which we overwrite
        if (published_article) {
          const s3_url = get_s3_published_directory(
            published_article.url,
            published_article.created_at,
          );

          await delete_s3_directory(
            env.NEXT_PUBLIC_AWS_PUBLISHED_BUCKET_NAME,
            s3_url,
          );
        }

        // new published article value
        const value = klona(input.article);
        if (!value.created_at) throw new Error("created_at is required");

        const renamed_url = convert_title_to_url(value.title);

        const published_s3_url = get_s3_published_directory(
          renamed_url,
          value.created_at,
        );

        // rename urls and content
        const renamed_content = value.content
          ? await rename_s3_files_and_content(
              value.content,
              published_s3_url,
              false,
            )
          : undefined;

        // upload thumbnails
        if (draft_article?.id) {
          await s3_copy_thumbnails({
            source_bucket: env.NEXT_PUBLIC_AWS_DRAFT_BUCKET_NAME,
            source_path: get_s3_draft_directory(draft_article.id),
            destination_bucket: env.NEXT_PUBLIC_AWS_PUBLISHED_BUCKET_NAME,
            destination_url: published_s3_url,
            thumbnail_crop: value.thumbnail_crop ?? undefined,
          });
        }

        value.url = renamed_url;
        value.content = renamed_content;

        // finally insert or update published article
        if (published_article?.id) {
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

        // update authors
        await tx
          .delete(PublishedArticlesToAuthors)
          .where(
            eq(PublishedArticlesToAuthors.published_id, published_article.id),
          );

        if (input.author_ids.length !== 0) {
          await tx.insert(PublishedArticlesToAuthors).values(
            input.author_ids.map((author_id, index) => ({
              author_id,
              published_id: published_article.id,
              order: index,
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

        // get updated published article with authors to return
        const published_article_with_authors =
          await tx.query.PublishedArticle.findFirst({
            where: eq(PublishedArticle.id, published_article.id),
            with: {
              published_articles_to_authors: {
                with: { author: true },
                orderBy: asc(PublishedArticlesToAuthors.order),
              },
            },
          });

        if (!published_article_with_authors)
          throw new Error("Published draft_article not found");

        // update algolia index
        const algolia = searchClient(
          env.NEXT_PUBLIC_ALGOLIA_ID,
          env.ALGOLIA_ADMIN_KEY,
        );

        await algolia.addOrUpdateObject({
          indexName: "published_article",
          objectID: published_article_with_authors.id.toString(),
          body: convert_article_to_algolia_object(
            published_article_with_authors,
          ),
        });

        return published_article_with_authors;
      });
    }),

  check_if_url_duplicate: protectedProcedure
    .input(z.object({ url: z.string() }))
    .query(async ({ ctx, input }) => {
      const urls = await ctx.db.query.PublishedArticle.findMany({
        columns: {
          id: true,
          url: true,
          created_at: true,
        },
        where: eq(PublishedArticle.url, input.url),
      });

      return { urls };
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
        // get published article
        const all_published = await tx.query.PublishedArticle.findMany({
          where: eq(PublishedArticle.id, input),
          with: {
            published_articles_to_authors: {
              with: { author: true },
              orderBy: asc(PublishedArticlesToAuthors.order),
            },
          },
        });

        assert_one(all_published);
        const published = all_published[0];

        // delete article from algolia index
        try {
          const algolia = searchClient(
            env.NEXT_PUBLIC_ALGOLIA_ID,
            env.ALGOLIA_ADMIN_KEY,
          );

          await algolia.deleteObject({
            indexName: "published_article",
            objectID: published.id.toString(),
          });
        } catch (error) {
          console.error("algolia error", error);
        }

        // get the current draft, which will be overwritten
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

        const published_s3_url = get_s3_published_directory(
          published.url,
          published.created_at,
        );

        // copy published article to draft
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

        const draft_s3_url = get_s3_draft_directory(
          updated_or_created_draft.id,
        );

        // rename urls and content
        const renamed_content = published.content
          ? await rename_s3_files_and_content(
              published.content,
              draft_s3_url,
              true,
            )
          : undefined;

        if (renamed_content) {
          await tx
            .update(DraftArticle)
            .set({
              content: renamed_content,
            })
            .where(eq(DraftArticle.id, updated_or_created_draft.id));
        }

        // copy thumbnails from published to draft, then delete the published directory
        await s3_copy_thumbnails({
          source_bucket: env.NEXT_PUBLIC_AWS_PUBLISHED_BUCKET_NAME,
          source_path: published_s3_url,
          destination_bucket: env.NEXT_PUBLIC_AWS_DRAFT_BUCKET_NAME,
          destination_url: draft_s3_url,
          thumbnail_crop: published.thumbnail_crop ?? undefined,
        });

        await delete_s3_directory(
          env.NEXT_PUBLIC_AWS_PUBLISHED_BUCKET_NAME,
          published_s3_url,
        );

        // return updated draft with authors
        const updated_draft = await tx.query.DraftArticle.findFirst({
          where: eq(DraftArticle.id, updated_or_created_draft.id),
          with: {
            draft_articles_to_authors: {
              with: { author: true },
              orderBy: asc(PublishedArticlesToAuthors.order),
            },
          },
        });

        return updated_draft;
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
              indexName: "published_article",
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

  // input is draft id
  delete_custom_thumbnail: protectedProcedure
    .input(z.number())
    .mutation(async ({ ctx, input }) => {
      return await ctx.db.transaction(async (tx) => {
        console.log("delete_custom_thumbnail input", input);
        const draft = await tx.query.DraftArticle.findFirst({
          where: eq(DraftArticle.id, input),
        });

        if (!draft) throw new Error("Draft not found");

        const s3_url = `${get_s3_draft_directory(draft.id)}/thumbnail-uploaded.png`;

        await delete_objects(env.NEXT_PUBLIC_AWS_DRAFT_BUCKET_NAME, [s3_url]);

        return draft;
      });
    }),
});
