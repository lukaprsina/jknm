"use server";

import type { z } from "zod";
import { db } from "../db";
import { asc, eq } from "drizzle-orm";
import {
  DraftArticle,
  PublishedArticle,
  PublishedArticlesToAuthors,
} from "../db/schema";
import { assert_at_most_one, assert_one } from "~/lib/assert-length";
import { algoliasearch as searchClient } from "algoliasearch";
import { env } from "~/env";
import {
  delete_s3_directory,
  rename_s3_files_and_content,
  s3_copy_thumbnails,
} from "../s3-utils";
import {
  get_s3_draft_directory,
  get_s3_published_directory,
} from "~/lib/article-utils";
import { revalidatePath, revalidateTag } from "next/cache";
import { unpublish_validator } from "./validators";

export async function unpublish(input: z.infer<typeof unpublish_validator>) {
  const validated_input = unpublish_validator.safeParse(input);
  if (!validated_input.success) {
    throw new Error(validated_input.error.message);
  }

  const transaction = await db.transaction(async (tx) => {
    const all_published = await tx.query.PublishedArticle.findMany({
      where: eq(PublishedArticle.id, input.published_id),
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
      where: eq(DraftArticle.published_id, input.published_id),
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
          .where(eq(DraftArticle.published_id, input.published_id))
          .returning()
      : await tx.insert(DraftArticle).values(draft_fields);

    await tx
      .delete(PublishedArticle)
      .where(eq(PublishedArticle.id, input.published_id));

    assert_one(draft_return);
    const updated_or_created_draft = draft_return[0];

    const draft_s3_url = get_s3_draft_directory(updated_or_created_draft.id);

    // rename urls and content
    const renamed_content = published.content
      ? await rename_s3_files_and_content(published.content, draft_s3_url, true)
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

  revalidateTag("drafts");
  revalidatePath("/");

  return transaction;
}
