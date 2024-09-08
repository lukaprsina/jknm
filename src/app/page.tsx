import { api } from "~/trpc/server";
import { Shell } from "../components/shell";
import { InfiniteArticles } from "../components/article/infinite-articles";
import { getServerAuthSession } from "~/server/auth";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "~/components/ui/accordion";
import { DraftArticles } from "~/components/article/draft-articles";
import { cn } from "~/lib/utils";
import { article_variants, page_variants } from "~/lib/page-variants";

export default async function HomePageServer() {
  const session = await getServerAuthSession();

  const drafts = session ? await api.article.get_all_drafts() : undefined;

  await api.article.get_infinite_published.prefetchInfinite(
    {
      limit: 6 * 5,
    },
    {
      getNextPageParam: (lastPage) => lastPage.next_cursor,
      pages: 1,
    },
  );

  if (!session) {
    return (
      <Shell without_footer>
        <div
          className={cn(page_variants(), article_variants({ variant: "card" }))}
        >
          <InfiniteArticles />
        </div>
      </Shell>
    );
  }

  return (
    <Shell>
      <div className={cn(page_variants())}>
        <Accordion type="single" collapsible>
          <AccordionItem value="item-1">
            <AccordionTrigger>Osnutki: {drafts?.length}</AccordionTrigger>
            <AccordionContent className={article_variants({ variant: "card" })}>
              {drafts && drafts.length !== 0 ? (
                <DraftArticles articles={drafts} />
              ) : (
                <span>Ni osnutkov</span>
              )}
            </AccordionContent>
          </AccordionItem>
        </Accordion>
        <div className={cn(article_variants({ variant: "card" }))}>
          <InfiniteArticles />
        </div>
      </div>
    </Shell>
  );
}
