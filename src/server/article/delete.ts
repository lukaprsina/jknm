"use server";

import type { z } from "zod";
import { db } from "../db";
import { DraftArticle, PublishedArticle } from "../db/schema";
import { eq } from "drizzle-orm";
import { assert_one } from "~/lib/assert-length";
import { delete_objects, delete_s3_directory } from "../s3-utils";
import { env } from "~/env";
import { algoliasearch as searchClient } from "algoliasearch";
import {
  get_s3_draft_directory,
  get_s3_published_directory,
} from "~/lib/article-utils";
import { revalidatePath, revalidateTag } from "next/cache";
import { delete_both_validator, delete_custom_thumbnail_validator, delete_draft_validator } from "./validators";

export async function delete_draft(
  input: z.infer<typeof delete_draft_validator>,
) {
  const validated_input = delete_draft_validator.safeParse(input);
  if (!validated_input.success) {
    throw new Error(validated_input.error.message);
  }

  const transaction = await db.transaction(async (tx) => {
    const draft_result = await tx
      .delete(DraftArticle)
      .where(eq(DraftArticle.id, input.draft_id))
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

  revalidateTag("drafts");
  revalidatePath("/");

  return transaction;
}

export async function delete_both(
  input: z.infer<typeof delete_both_validator>,
) {
  const validated_input = delete_both_validator.safeParse(input);
  if (!validated_input.success) {
    throw new Error(validated_input.error.message);
  }

  const transaction = await db.transaction(async (tx) => {
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

  revalidateTag("drafts");
  revalidatePath("/");

  return transaction;
}

export async function delete_custom_thumbnail(
  input: z.infer<typeof delete_custom_thumbnail_validator>,
) {
  const validated_input = delete_custom_thumbnail_validator.safeParse(input);
  if (!validated_input.success) {
    throw new Error(validated_input.error.message);
  }

  const transaction = await db.transaction(async (tx) => {
    const draft = await tx.query.DraftArticle.findFirst({
      where: eq(DraftArticle.id, input.draft_id),
    });

    if (!draft) throw new Error("Draft not found");

    const s3_url = `${get_s3_draft_directory(draft.id)}/thumbnail-uploaded.png`;

    await delete_objects(env.NEXT_PUBLIC_AWS_DRAFT_BUCKET_NAME, [s3_url]);

    return draft;
  });

  revalidateTag("drafts");
  revalidatePath("/");

  return transaction;
}
