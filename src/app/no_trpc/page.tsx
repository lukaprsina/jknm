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

export default async function HomePageServer() {
  const queryClient = new QueryClient();

  await queryClient.prefetchInfiniteQuery({
    queryKey: ["infinite_published"],
    queryFn: get_infinite_published2,
    initialPageParam: null,
  });

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <Shell without_footer>
        <div className={cn(page_variants(), article_variants())}>
          <InfiniteArticles />
        </div>
      </Shell>
    </HydrationBoundary>
  );
}
