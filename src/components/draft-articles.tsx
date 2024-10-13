import {
  AccordionItem,
  AccordionTrigger,
  AccordionContent,
  Accordion,
} from "~/components/ui/accordion";
import { article_variants, article_grid_variants } from "~/lib/page-variants";
import { DraftArticleDrizzleCard } from "./article/adapter";
import { db } from "~/server/db";
import { asc } from "drizzle-orm";
import { DraftArticlesToAuthors } from "~/server/db/schema";
import { memoize } from "nextjs-better-unstable-cache";
import ArticleDescription from "./article/description";

export const cachedDrafts = memoize(
  async () => {
    return db.query.DraftArticle.findMany({
      with: {
        draft_articles_to_authors: {
          with: {
            author: true,
          },
          orderBy: asc(DraftArticlesToAuthors.order),
        },
      },
    });
  },
  {
    revalidateTags: ["drafts"],
    // log: ["dedupe", "datacache", "verbose"],
    logid: "drafts",
  },
);

export async function DraftArticles() {
  const drafts = await cachedDrafts();

  let sklon: string | undefined;
  if (drafts.length === 1) {
    sklon = "osnutek";
  } else if (drafts.length === 2) {
    sklon = "osnutka";
  } else if (drafts.length > 3 && drafts.length <= 4) {
    sklon = "osnutki";
  } else {
    sklon = "osnutkov";
  }

  return (
    <Accordion type="single" collapsible>
      <AccordionItem value="item-1">
        <AccordionTrigger>
          {drafts.length !== 0 ? (
            <span>
              <b>Osnutki</b> ({drafts.length} {sklon})
            </span>
          ) : (
            <span>Ni osnutkov</span>
          )}
        </AccordionTrigger>
        <AccordionContent className={article_variants({ variant: "card" })}>
          {drafts.length !== 0 ? (
            <div className={article_grid_variants()}>
              {drafts.map((article) => (
                <DraftArticleDrizzleCard
                  key={article.id}
                  article={article}
                  description={
                    <ArticleDescription
                      type="card"
                      author_ids={article.draft_articles_to_authors.map(
                        (a) => a.author.id,
                      )}
                      created_at={article.created_at}
                    />
                  }
                />
              ))}
            </div>
          ) : (
            <span>Ni osnutkov</span>
          )}
        </AccordionContent>
      </AccordionItem>
    </Accordion>
  );
}
