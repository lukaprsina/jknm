import {
  AccordionItem,
  AccordionTrigger,
  AccordionContent,
  Accordion,
} from "~/components/ui/accordion";
import { article_variants, article_grid_variants } from "~/lib/page-variants";
import { DraftArticleDrizzleCard } from "./article/adapter";
import { db } from "~/server/db";
import { asc, desc } from "drizzle-orm";
import { DraftArticle, DraftArticlesToAuthors } from "~/server/db/schema";
import { memoize } from "nextjs-better-unstable-cache";

export const cachedDrafts = memoize(
  async () => {
    const articles = await db.query.DraftArticle.findMany({
      with: {
        draft_articles_to_authors: {
          with: {
            author: true,
          },
          orderBy: asc(DraftArticlesToAuthors.order),
        },
      },
      orderBy: desc(DraftArticle.updated_at),
    });

    console.log(
      "drafts",
      articles.map((a) => a.created_at),
    );
    for (const article of articles) {
      if (typeof article.created_at.toLocaleDateString !== "function") {
        console.log("draft-articles", {
          article,
          created_at_to_locale_date_string:
            // eslint-disable-next-line @typescript-eslint/unbound-method
            article.created_at.toLocaleDateString,
          created_at_to_locale_date_string_type:
            typeof article.created_at.toLocaleDateString,
          created_at_type: typeof article.created_at,
          created_at: article.created_at,
        });
        throw new Error("created_at is not a Date object");
      }
    }

    return articles;
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
                <DraftArticleDrizzleCard key={article.id} article={article} />
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
