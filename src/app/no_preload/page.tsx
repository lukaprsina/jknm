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
  const first = Date.now();
  const session = await getServerAuthSession();
  const second = Date.now();
  // await api.author.get_all.prefetch();
  const third = Date.now();
  const drafts = (false as boolean)
    ? await api.article.get_all_drafts()
    : undefined;
  const fourth = Date.now();

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

  const fifth = Date.now();

  console.error({
    first,
    second,
    third,
    fourth,
    fifth,
  });

  const diff1 = second - first;
  const diff2 = third - second;
  const diff3 = fourth - third;
  const diff4 = fifth - fourth;

  console.error(new Date(first), new Date(fifth), {
    diff1,
    diff2,
    diff3,
    diff4,
  });

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
