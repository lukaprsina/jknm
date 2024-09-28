import { api } from "~/trpc/server";
import { Shell } from "~/components/shell";
import { InfiniteArticles } from "~/components/article/infinite-articles";
import { getServerAuthSession } from "~/server/auth";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "~/components/ui/accordion";
import { cn } from "~/lib/utils";
import {
  article_grid_variants,
  article_variants,
  page_variants,
} from "~/lib/page-variants";
import { DraftArticleDrizzleCard } from "~/components/article/adapter";

export const dynamic = "force-dynamic";

export default async function HomePageServer() {
  const session = await getServerAuthSession();
  await api.author.get_all.prefetch();
  const drafts = session ? await api.article.get_all_drafts() : undefined;

  const test = await api.article.get_infinite_published({
    limit: 6 * 5,
  });

  console.log("infinite articles page", test.data.length);

  if (!session) {
    return (
      <Shell without_footer>
        <div className={cn(page_variants(), article_variants())}>
          <InfiniteArticles />
        </div>
      </Shell>
    );
  }

  let sklon: string | undefined;
  if (drafts) {
    if (drafts.length === 1) {
      sklon = "osnutek";
    } else if (drafts.length === 2) {
      sklon = "osnutka";
    } else if (drafts.length > 3 && drafts.length <= 4) {
      sklon = "osnutki";
    } else {
      sklon = "osnutkov";
    }
  }

  return (
    <Shell>
      <div className={cn(page_variants())}>
        <Accordion type="single" collapsible>
          <AccordionItem value="item-1">
            <AccordionTrigger>
              {drafts?.length === 0 ? (
                "Ni osnutkov"
              ) : (
                <span>
                  <b>Osnutki</b> ({drafts?.length} {sklon})
                </span>
              )}
            </AccordionTrigger>
            <AccordionContent className={article_variants({ variant: "card" })}>
              {drafts && drafts.length !== 0 ? (
                <div className={article_grid_variants()}>
                  {drafts.map((article) => (
                    <DraftArticleDrizzleCard
                      key={article.id}
                      article={article}
                    />
                  ))}
                </div>
              ) : (
                <span>Ni osnutkov</span>
              )}
            </AccordionContent>
          </AccordionItem>
        </Accordion>
        <div>
          <InfiniteArticles />
        </div>
      </div>
    </Shell>
  );
}
