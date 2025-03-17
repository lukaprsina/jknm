"use server";

import type { z } from "zod";
import { db } from "../db";
import {
  DraftArticle,
  PublishedArticle,
  PublishedArticlesToAuthors,
} from "../db/schema";
import { asc, eq } from "drizzle-orm";
import {
  convert_title_to_url,
  get_s3_draft_directory,
  get_s3_published_directory,
} from "~/lib/article-utils";
import {
  delete_s3_directory,
  rename_s3_files_and_content,
  s3_copy_thumbnails,
} from "../s3-utils";
import { env } from "~/env";
import { klona } from "klona";
import { assert_one } from "~/lib/assert-length";
import { algoliasearch as searchClient } from "algoliasearch";
import { convert_article_to_algolia_object } from "~/lib/algoliasearch";
import { revalidatePath } from "next/cache";
import { publish_validator } from "./validators";
import { getServerAuthSession } from "../auth";

export async function publish(input: z.infer<typeof publish_validator>) {
  const session = await getServerAuthSession();
  if (!session) {
    throw new Error("Unauthorized");
  }

  const validated_input = publish_validator.safeParse(input);
  if (!validated_input.success) {
    throw new Error(validated_input.error.message);
  }

  const transaction = await db.transaction(async (tx) => {
    let draft_article: typeof DraftArticle.$inferSelect | undefined;
    let published_article: typeof PublishedArticle.$inferSelect | undefined;

    // if draft_id is provided, get the draft and published article
    if (input.draft_id) {
      draft_article = await tx.query.DraftArticle.findFirst({
        where: eq(DraftArticle.id, input.draft_id),
      });

      // console.log("publishing draft_article has draft_id", { draft });
      if (!draft_article) {
        console.warn(
          "Draft not found for draft_id",
          input.draft_id,
          ". Continuing to publish as new article.",
        );
      } else if (draft_article.published_id) {
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
      .where(eq(PublishedArticlesToAuthors.published_id, published_article.id));

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
      body: convert_article_to_algolia_object(published_article_with_authors),
    });

    return published_article_with_authors;
  });

  revalidatePath("/");
  return transaction;
}
