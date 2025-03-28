import { notFound } from "next/navigation";

import { Shell } from "~/components/shell";
import { getServerAuthSession } from "~/server/auth";
import { article_variants, page_variants } from "~/lib/page-variants";
import { cn } from "~/lib/utils";
import { db } from "~/server/db";
import { count } from "drizzle-orm";
import { PublishedArticle } from "~/server/db/schema";
import { ArticleConverter } from "./converter-editor";

/* const DynamicArticleConverter = dynamic(
  () =>
    import("./converter-editor").then((mod) => ({
      default: mod.ArticleConverter,
    })),
  {
    ssr: false,
  },
); */

export default async function Page() {
  const session = await getServerAuthSession();

  if (!session) {
    notFound();
  }

  const article_count = await db
    .select({ count: count() })
    .from(PublishedArticle);

  return (
    <Shell>
      <div className={cn(page_variants(), article_variants())}>
        <h1>
          Article converter: {article_count.at(0)?.count ?? "napaka"} novičk
        </h1>
        {/* <DynamicArticleConverter /> */}
        <ArticleConverter />
      </div>
    </Shell>
  );
}
