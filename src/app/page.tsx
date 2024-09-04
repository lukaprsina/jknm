import { api } from "~/trpc/server";
import { Shell } from "../components/shell";
import { InfiniteArticles } from "../components/article/infinite-articles";

export default async function HomePageServer() {
  await api.article.get_infinite_published.prefetchInfinite(
    {
      limit: 6 * 5,
    },
    {
      getNextPageParam: (lastPage) => lastPage.nextCursor,
      pages: 1,
    },
  );

  return (
    <Shell without_footer>
      <InfiniteArticles />
    </Shell>
  );
}
