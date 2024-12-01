"use server";

import type { z } from "zod";
import { DraftArticle, DraftArticlesToAuthors } from "~/server/db/schema";
import { db } from "../db";
import { asc, eq } from "drizzle-orm";
import { revalidatePath, revalidateTag } from "next/cache";
import { save_draft_validator } from "./validators";
import { getServerAuthSession } from "../auth";

export async function save_draft(input: z.infer<typeof save_draft_validator>) {
  const session = await getServerAuthSession();
  if (!session) {
    throw new Error("Unauthorized");
  }

  const validated_input = save_draft_validator.safeParse(input);
  if (!validated_input.success) {
    throw new Error(validated_input.error.message);
  }

  const transaction = db.transaction(async (tx) => {
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

      // console.log("save_draft values", values);
      await tx.insert(DraftArticlesToAuthors).values(values);
    }

    const first_draft = await tx.query.DraftArticle.findFirst({
      where: eq(DraftArticle.id, input.draft_id),
      with: {
        draft_articles_to_authors: {
          with: { author: true },
          orderBy: asc(DraftArticlesToAuthors.order),
        },
      },
    });

    // console.log("save_draft first_draft", first_draft);

    return first_draft;
  });

  revalidateTag("drafts");
  revalidatePath("/");
  return transaction;
}
