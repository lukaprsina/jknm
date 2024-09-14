"use server";

import { sql } from "drizzle-orm";
import { env } from "~/env";
import { db } from "~/server/db";
import { PublishedArticle, DraftArticle } from "~/server/db/schema";
import { delete_s3_directory } from "~/server/s3-utils";

export async function delete_articles() {
  console.log("deleting articles");
  await db.execute(
    sql`TRUNCATE TABLE ${PublishedArticle} RESTART IDENTITY CASCADE;`,
  );

  await db.execute(
    sql`TRUNCATE TABLE ${DraftArticle} RESTART IDENTITY CASCADE;`,
  );

  await delete_s3_directory(env.NEXT_PUBLIC_AWS_DRAFT_BUCKET_NAME, "");
  console.log("done");
}
