"use client";

import { ArticleTable } from "./article-table";
import { DEFAULT_REFINEMENT } from "./components";
import type { Session } from "next-auth";
import { Tabs, TabsContent } from "~/components/ui/tabs";
import { liteClient as algolia_search } from "algoliasearch/lite";
import { env } from "~/env";
import { useState } from "react";
import dynamic from "next/dynamic";
import { Skeleton } from "~/components/ui/skeleton";
import { cn } from "~/lib/utils";
import { article_grid_variants } from "~/lib/page-variants";
import { InstantSearch } from "react-instantsearch";
// import { createInstantSearchRouterNext } from "react-instantsearch-router-nextjs";
// import singletonRouter from "next/router";

const SearchControlsDynamic = dynamic(
  () =>
    import("./search-controls").then((mod) => ({
      default: mod.SearchControls,
    })),
  {
    ssr: false,
    loading: () => <Skeleton className="h-[172px] w-full bg-[hsl(0_0%_90%)]" />,
  },
);

/* import("./infinite-hits").then(async (mod) => {
      await new Promise((resolve) => setTimeout(resolve, 5000));
      return mod.MyInfiniteHits;
    }), */
const MyInfiniteHitsDynamic = dynamic(
  () =>
    import("./infinite-hits").then((mod) => ({
      default: mod.MyInfiniteHits,
    })),
  {
    ssr: false,
    loading: () => {
      return (
        <div className={cn(article_grid_variants())}>
          {Array.from({ length: 10 }).map((_, index) => (
            <Skeleton key={index} className="h-[441px] bg-[hsl(0_0%_90%)]" />
          ))}
        </div>
      );
    },
  },
);

const searchClient = algolia_search(
  env.NEXT_PUBLIC_ALGOLIA_ID,
  env.NEXT_PUBLIC_ALGOLIA_SEARCH_KEY,
);

export function Search({ session }: { session: Session | null }) {
  const [activeTab, setActiveTab] = useState<"card" | "table">("card");

  return (
    <InstantSearch
      future={{ preserveSharedStateOnUnmount: true }}
      indexName={DEFAULT_REFINEMENT}
      searchClient={searchClient}
      // insights={true}
      // TODO: broken, idk. Error: No router instance found.
      // routing={{ router: createInstantSearchRouterNext({ singletonRouter }) }}
    >
      <Tabs
        value={activeTab}
        onValueChange={(new_value) =>
          setActiveTab(new_value as "card" | "table")
        }
        defaultValue="card"
        className="pb-6 pt-2"
      >
        <SearchControlsDynamic activeTab={activeTab} />
        <TabsContent
          value="card"
          className="flex flex-col justify-between gap-4"
        >
          <MyInfiniteHitsDynamic />
        </TabsContent>
        <TabsContent value="table">
          <ArticleTable session={session} />
        </TabsContent>
      </Tabs>
    </InstantSearch>
  );
}
