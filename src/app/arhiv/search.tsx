"use client";

import { LayoutDashboard, TableIcon } from "lucide-react";
import { Hits, InstantSearch } from "react-instantsearch";

import { ArticleAlgoliaCard } from "~/components/article/card-adapter";
import { article_variants } from "~/lib/page-variants";
import { ArticleTable } from "./article-table";
import { MyPagination } from "./pagination";
import {
  CustomClearRefinements,
  MySearchBox,
  MySortBy,
  MyStats,
  TimelineRefinement,
} from "./search-components";
import type { Session } from "next-auth";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "~/components/ui/tabs";
import { liteClient as algoliasearch } from "algoliasearch/lite";
import { env } from "~/env";
import { MyInfiniteHits } from "~/app/arhiv/infinite-hits";

const searchClient = algoliasearch(
  env.NEXT_PUBLIC_ALGOLIA_ID,
  env.NEXT_PUBLIC_ALGOLIA_SEARCH_KEY,
);

export function Search({ session }: { session: Session | null }) {
  return (
    <InstantSearch
      future={{ preserveSharedStateOnUnmount: true }}
      indexName="published_article_created_at_desc"
      searchClient={searchClient}
    >
      <Tabs defaultValue="card" className="pb-6 pt-2">
        <div className="flex flex-col gap-4">
          <div className="flex flex-col items-center justify-between gap-2 sm:flex-row">
            <MySearchBox />
            {/* <div className="flex items-center justify-between space-x-2">
            </div> */}
            <div className="flex flex-col items-center justify-between gap-6 text-nowrap sm:flex-row">
              <MySortBy />
              <TabsList>
                <TabsTrigger value="card">
                  <LayoutDashboard />
                </TabsTrigger>
                <TabsTrigger value="table">
                  <TableIcon />
                </TabsTrigger>
              </TabsList>
            </div>
          </div>
          <div className="flex w-full items-center justify-end gap-6">
            <MyStats />
            <CustomClearRefinements />
          </div>
          <div className="flex w-full items-center justify-between">
            <TimelineRefinement />
          </div>
        </div>
        <TabsContent
          value="card"
          className="flex flex-col justify-between gap-4"
        >
          {/* <Hits
            hitComponent={ArticleAlgoliaCard}
            classNames={{
              list: "container grid w-full grid-cols-1 gap-6 px-0 py-8 md:grid-cols-2 lg:grid-cols-3",
              item: article_variants({ variant: "card" }),
            }}
          /> */}
          <MyInfiniteHits />
        </TabsContent>
        <TabsContent value="table">
          <ArticleTable session={session} />
        </TabsContent>
      </Tabs>
      <MyPagination />
    </InstantSearch>
  );
}