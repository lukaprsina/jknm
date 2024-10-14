"use client";

import { ArticleTable } from "./article-table";
import { DEFAULT_REFINEMENT } from "./components";
import type { Session } from "next-auth";
import { Tabs, TabsContent } from "~/components/ui/tabs";
import { liteClient as algolia_search } from "algoliasearch/lite";
import { env } from "~/env";
import { useState } from "react";
import { InstantSearchNext } from "react-instantsearch-nextjs";
import dynamic from "next/dynamic";
import { Skeleton } from "~/components/ui/skeleton";
import { cn } from "~/lib/utils";
import { article_grid_variants } from "~/lib/page-variants";

const SearchControlsDynamic = dynamic(
  () => import("./search-controls").then((mod) => mod.SearchControls),
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
  () => import("./infinite-hits").then((mod) => mod.MyInfiniteHits),
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

export function Search2() {
  return (
    <InstantSearchNext
      future={{ preserveSharedStateOnUnmount: true }}
      indexName={DEFAULT_REFINEMENT}
      searchClient={searchClient}
      // insights={true}
      routing={{
        router: {
          cleanUrlOnDispose: false,
          /* windowTitle(routeState) {
              const indexState = routeState.indexName ?? {};
              return indexState.query
                ? `MyWebsite - Results for: ${indexState.query}`
                : "MyWebsite - Results page";
            }, */
        },
      }}
    >
      {/* <InfiniteHits /> */}
      {/* <Suspense fallback={<div>Loading (suspense)...</div>}> */}
      {/* <MyInfiniteHits /> */}
      <MyInfiniteHitsDynamic />
      {/* </Suspense> */}
    </InstantSearchNext>
  );
}

export function Search({ session }: { session: Session | null }) {
  const [activeTab, setActiveTab] = useState<"card" | "table">("card");

  return (
    <InstantSearchNext
      future={{ preserveSharedStateOnUnmount: true }}
      indexName={DEFAULT_REFINEMENT}
      searchClient={searchClient}
      // insights={true}
      routing={{
        router: {
          cleanUrlOnDispose: false,
          /* windowTitle(routeState) {
              const indexState = routeState.indexName ?? {};
              return indexState.query
                ? `MyWebsite - Results for: ${indexState.query}`
                : "MyWebsite - Results page";
            }, */
        },
      }}
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
    </InstantSearchNext>
  );
}
