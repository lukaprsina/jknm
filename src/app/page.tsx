import { Shell } from "~/components/shell";
import { InfiniteArticles } from "~/components/article/infinite-articles";
import { getServerAuthSession } from "~/server/auth";
import { Accordion } from "~/components/ui/accordion";
import { cn } from "~/lib/utils";
import { article_variants, page_variants } from "~/lib/page-variants";
import dynamic from "next/dynamic";
import { Skeleton } from "~/components/ui/skeleton";

// import { DraftArticles } from "~/components/draft-articles";
const DraftArticles = dynamic(
  () => import("~/components/draft-articles").then((mod) => mod.DraftArticles),
  {
    ssr: false,
    loading: () => <Skeleton className="h-14 w-full" />,
  },
);

export default async function HomePageServer() {
  // const first = Date.now();
  console.log("first", new Date());
  const session = await getServerAuthSession();
  // const second = Date.now();
  // await api.author.get_all.prefetch();
  // const third = Date.now();
  // const drafts = session ? await api.article.get_all_drafts() : undefined;
  // const fourth = Date.now();

  if (!session) {
    return (
      <Shell without_footer>
        <div className={cn(page_variants(), article_variants())}>
          <InfiniteArticles />
        </div>
      </Shell>
    );
  }

  // const fifth = Date.now();

  console.log("second", new Date());
  /* console.log({
    first,
    second,
    third,
    fourth,
    fifth,
  }); */

  /* const diff1 = second - first;
  const diff2 = third - second;
  const diff3 = fourth - third;
  const diff4 = fifth - fourth; */

  /* console.error({
    diff1,
    diff2,
    diff3,
    diff4,
  }); */

  return (
    <Shell>
      <div className={cn(page_variants())}>
        <Accordion type="single" collapsible>
          <DraftArticles />
        </Accordion>
        <div>
          <InfiniteArticles />
        </div>
      </div>
    </Shell>
  );
}
