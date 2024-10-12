"use server";

import { asc, eq } from "drizzle-orm";
import { db } from "~/server/db";
import {
  DraftArticle,
  DraftArticlesToAuthors,
  PublishedArticle,
  PublishedArticlesToAuthors,
} from "~/server/db/schema";
import { assert_one } from "~/lib/assert-length";
import {
  rename_s3_files_and_content,
  s3_copy_thumbnails,
} from "~/server/s3-utils";
import {
  get_s3_draft_directory,
  get_s3_published_directory,
} from "~/lib/article-utils";
import { env } from "~/env";
import type { PublishedArticleWithAuthors } from "~/components/article/adapter";
import { get_content_from_title } from "~/lib/get-content-from-title";
import type { z } from "zod";
import { revalidatePath, revalidateTag } from "next/cache";
import { create_draft_validator } from "./validators";

export async function create_draft(
  input: z.infer<typeof create_draft_validator>,
) {
  const validated_input = create_draft_validator.safeParse(input);
  if (!validated_input.success) {
    throw new Error(validated_input.error.message);
  }

  const transaction = await db.transaction(async (tx) => {
    if (
      typeof input.published_id === "undefined" &&
      typeof input.title === "undefined"
    ) {
      console.log("input", input);
      throw new Error("Either published_id or draft_article must be provided");
    }

    let published: PublishedArticleWithAuthors | undefined;

    if (typeof input.published_id === "number") {
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

      if (!published) throw new Error("Published draft_article not found");

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

      // if the draft already exists, return it
      if (draft) return draft;
    }

    // otherwise, create a new draft, copied from the published one
    let values: typeof DraftArticle.$inferInsert | undefined = undefined;
    if (input.title) {
      values = get_content_from_title(input.title);
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

    // update content with renamed urls (now that we have the id)
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

    if (!draft_returning) throw new Error("Created draft not found");
    return draft_returning;
  });

  revalidateTag("drafts");
  revalidatePath("/");
  return transaction;
}
