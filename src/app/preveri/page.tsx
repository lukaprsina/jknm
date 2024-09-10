import { Shell } from "~/components/shell";
import { PreveriClient } from "./preveri-client";
import { db } from "~/server/db";
import { PublishedArticle } from "~/server/db/schema";
import { asc } from "drizzle-orm";
import { api } from "~/trpc/server";

export default async function PreveriPage() {
  await api.author.get_all.prefetch();
  const articles = await db.query.PublishedArticle.findMany({
    columns: {
      id: true,
      old_id: true,
    },
    orderBy: asc(PublishedArticle.old_id),
  });

  // const csv_articles = await read_articles();

  return (
    <Shell without_footer>
      <PreveriClient articles={articles} /* csv_articles={csv_articles} */ />
    </Shell>
  );
}
