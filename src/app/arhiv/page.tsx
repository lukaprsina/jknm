import { getServerAuthSession } from "~/server/auth";
import { Shell } from "~/components/shell";
import { cn } from "~/lib/utils";
import { page_variants } from "~/lib/page-variants";
import { Search } from "./search";
import { Authors } from "~/components/authors";
import ArticleDescription from "~/components/article/description";
import type { PublishedArticleHit } from "~/lib/validators";
import type { Hit } from "instantsearch.js";

export default async function Novice() {
  const session = await getServerAuthSession();

  return (
    <Shell>
      <div className={cn(page_variants())}>
        <Search
          session={session}
          authors={(author_ids: number[]) => (
            <Authors author_ids={author_ids} />
          )}
          description={(hit: Hit<PublishedArticleHit>) => (
            <ArticleDescription
              type="card"
              author_ids={hit.author_ids}
              created_at={new Date(hit.created_at)}
            />
          )}
        />
      </div>
    </Shell>
  );
}
