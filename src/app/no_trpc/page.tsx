import { Shell } from "~/components/shell";
import { article_variants, page_variants } from "~/lib/page-variants";
import { cn } from "~/lib/utils";
import { InfiniteArticles } from "./infinite-no-trpc";

export default function HomePageServer() {
  return (
    <Shell without_footer>
      <div className={cn(page_variants(), article_variants())}>
        <InfiniteArticles />
      </div>
    </Shell>
  );
}
