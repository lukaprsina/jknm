import { Shell } from "~/components/shell";
import { db } from "~/server/db";
import { PublishedArticle } from "~/server/db/schema";
import { asc } from "drizzle-orm";
import dynamic from "next/dynamic";
import { article_variants, page_variants } from "~/lib/page-variants";
import { cn } from "~/lib/utils";
import { memoize } from "nextjs-better-unstable-cache";

export const cachedAllPublished = memoize(
  async () => {
    return await db.query.PublishedArticle.findMany({
      columns: {
        id: true,
        old_id: true,
      },
      orderBy: asc(PublishedArticle.old_id),
    });
  },
  {
    revalidateTags: ["all-published"],
    // log: ["dedupe", "datacache", "verbose"],
    logid: "all-published",
  },
);

// import { PreveriClient } from "./preveri-client";
const PreveriClient = dynamic(
  () => import("./preveri-client").then((mod) => mod.PreveriClient),
  {
    ssr: false,
  },
);

export default async function PreveriPage() {
  const articles = await cachedAllPublished();

  // const csv_articles = await read_articles();

  return (
    <Shell without_footer>
      <div
        className={cn(page_variants(), article_variants(), "max-w-none px-6")}
      >
        <PreveriClient articles={articles} /* csv_articles={csv_articles} */ />
      </div>
    </Shell>
  );
}
