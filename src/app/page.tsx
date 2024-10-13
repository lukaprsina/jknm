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
import ArticleDescription from "~/components/article/description";
import type { PublishedArticleWithAuthors } from "~/components/article/adapter";
import { cachedDuplicateUrls } from "~/server/cached-global-state";

export default async function HomePageServer() {
  const queryClient = new QueryClient();

  const [session, duplicate_urls] = await Promise.all([
    getServerAuthSession(),
    await cachedDuplicateUrls(),
    queryClient.prefetchInfiniteQuery({
      queryKey: ["infinite_published"],
      queryFn: (props) => get_infinite_published2({ limit: 31, ...props }),
      initialPageParam: undefined,
    }),
  ]);

  const description = (article: PublishedArticleWithAuthors) => (
    <ArticleDescription
      type="card"
      author_ids={article.published_articles_to_authors.map((a) => a.author.id)}
      created_at={article.created_at}
    />
  );

  if (!session) {
    return (
      <Shell without_footer>
        <div className={cn(page_variants(), article_variants())}>
          <InfiniteArticles
            description={description}
            duplicate_urls={duplicate_urls}
          />
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
            <InfiniteArticles
              description={description}
              duplicate_urls={duplicate_urls}
            />
          </div>
        </div>
      </Shell>
    </HydrationBoundary>
  );
}
