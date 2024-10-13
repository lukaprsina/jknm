import { Shell } from "~/components/shell";
import { db } from "~/server/db";
import { PublishedArticle } from "~/server/db/schema";
import { asc } from "drizzle-orm";
import dynamic from "next/dynamic";
import { article_variants, page_variants } from "~/lib/page-variants";
import { cn } from "~/lib/utils";
import ArticleDescription from "~/components/article/description";
import type { PublishedArticleWithAuthors } from "~/components/article/adapter";

// import { PreveriClient } from "./preveri-client";
const PreveriClient = dynamic(
  () => import("./preveri-client").then((mod) => mod.PreveriClient),
  {
    ssr: false,
  },
);

export default async function PreveriPage() {
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
      <div
        className={cn(page_variants(), article_variants(), "max-w-none px-6")}
      >
        <PreveriClient
          articles={articles}
          description={(article: PublishedArticleWithAuthors) => (
            <ArticleDescription
              type="page"
              author_ids={article.published_articles_to_authors.map(
                (a) => a.author_id,
              )}
              created_at={article.created_at}
              old_id={article.old_id?.toString()}
            />
          )}
          /* csv_articles={csv_articles} */
        />
      </div>
    </Shell>
  );
}
