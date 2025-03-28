// https://tanstack.com/query/latest/docs/framework/react/guides/advanced-ssr
"use client";

// Since QueryClientProvider relies on useContext under the hood, we have to put 'use client' on top
import {
  defaultShouldDehydrateQuery,
  isServer,
  QueryClient,
  QueryClientProvider,
} from "@tanstack/react-query";
import type { Author } from "~/server/db/schema";
import { createContext } from "react";

function makeQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        // With SSR, we usually want to set some default staleTime
        // above 0 to avoid refetching immediately on the client
        staleTime: 60 * 1000,
      },
      dehydrate: {
        // include pending queries in dehydration
        shouldDehydrateQuery: (query) =>
          defaultShouldDehydrateQuery(query) ||
          query.state.status === "pending",
      },
    },
  });
}

let browserQueryClient: QueryClient | undefined = undefined;

function getQueryClient() {
  if (isServer) {
    // Server: always make a new query client
    return makeQueryClient();
  } else {
    // Browser: make a new query client if we don't already have one
    // This is very important, so we don't re-make a new client if React
    // suspends during the initial render. This may not be needed if we
    // have a suspense boundary BELOW the creation of the query client
    if (!browserQueryClient) browserQueryClient = makeQueryClient();
    return browserQueryClient;
  }
}

export const AllAuthorsContext = createContext<(typeof Author.$inferSelect)[]>(
  [],
);

export const DuplicateURLsContext = createContext<string[]>([]);

export default function Providers({
  all_authors,
  duplicate_urls,
  children,
}: {
  all_authors: (typeof Author.$inferSelect)[];
  duplicate_urls: string[];
  children: React.ReactNode;
}) {
  // NOTE: Avoid useState when initializing the query client if you don't
  //       have a suspense boundary between this and the code that may
  //       suspend because React will throw away the client on the initial
  //       render if it suspends and there is no boundary
  const queryClient = getQueryClient();

  return (
    <QueryClientProvider client={queryClient}>
      <AllAuthorsContext.Provider value={all_authors}>
        <DuplicateURLsContext.Provider value={duplicate_urls}>
          {children}
        </DuplicateURLsContext.Provider>
      </AllAuthorsContext.Provider>
    </QueryClientProvider>
  );
}
