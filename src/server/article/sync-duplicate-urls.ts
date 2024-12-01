"use server";

import { getServerAuthSession } from "../auth";
import { db } from "../db";
import { DuplicatedArticleUrls } from "../db/schema";
import { revalidatePath } from "next/cache";

export async function sync_duplicate_urls() {
  const session = await getServerAuthSession();
  if (!session) {
    throw new Error("Unauthorized");
  }

  const transaction = await db.transaction(async (tx) => {
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

  revalidatePath("/");

  return transaction;
}
