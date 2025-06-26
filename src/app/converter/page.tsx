import { notFound } from "next/navigation";

import { Shell } from "~/components/shell";
import { getServerAuthSession } from "~/server/auth";
import { article_variants, page_variants } from "~/lib/page-variants";
import { cn } from "~/lib/utils";
import { readFile } from "fs/promises"
import { ArticleConverter } from "./converter-editor";
import { type PublishedArticle } from "~/server/db/schema";

export type Articles = (typeof PublishedArticle.$inferSelect)[]

export default async function Page() {
  const session = await getServerAuthSession();

  if (!session) {
    notFound();
  }

  const raw_articles = await readFile(
    "scripts/articles.json", {
    encoding: "utf-8",
  })

  const articles = JSON.parse(raw_articles) as Articles;

  return (
    <Shell>
      <div className={cn(page_variants(), article_variants())}>
        <h1>
          Article converter: {articles.length ?? "napaka"} novičk
        </h1>
        <ArticleConverter articles={articles} />
      </div>
    </Shell>
  );
}
