import { Shell } from "~/components/shell";
import { article_variants, page_variants } from "~/lib/page-variants";
import { cn } from "~/lib/utils";
import { InfiniteArticles } from "./infinite-no-trpc";
import {
  dehydrate,
  HydrationBoundary,
  QueryClient,
} from "@tanstack/react-query";
import { get_infinite_published2 } from "./infinite-server";
import { DraftArticles } from "~/components/draft-articles";
import { getServerAuthSession } from "~/server/auth";

export default async function HomePageServer() {
  const queryClient = new QueryClient();

  const [session] = await Promise.all([
    getServerAuthSession(),
    await queryClient.prefetchInfiniteQuery({
      queryKey: ["infinite_published"],
      queryFn: (props) => get_infinite_published2({ limit: 31, ...props }),
      initialPageParam: undefined,
    }),
  ]);

  if (!session) {
    return (
      <Shell without_footer>
        <div className={cn(page_variants(), article_variants())}>
          <InfiniteArticles />
        </div>
      </Shell>
    );
  }

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <Shell without_footer>
        <div className={cn(page_variants())}>
          <DraftArticles />
          <div>
            <InfiniteArticles />
          </div>
        </div>
      </Shell>
    </HydrationBoundary>
  );
}
