// https://tanstack.com/query/latest/docs/framework/react/guides/advanced-ssr
"use client";

// Since QueryClientProvider relies on useContext under the hood, we have to put 'use client' on top
import { createStore } from "zustand-x";
import {
  isServer,
  QueryClient,
  QueryClientProvider,
} from "@tanstack/react-query";
import type { Author } from "~/server/db/schema";
import { useEffect } from "react";

function makeQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        // With SSR, we usually want to set some default staleTime
        // above 0 to avoid refetching immediately on the client
        staleTime: 60 * 1000,
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

interface CachedStateStoreType {
  all_authors: (typeof Author.$inferSelect)[];
  duplicate_urls: string[];
}

export const cached_state_store = createStore(
  "global_state",
)<CachedStateStoreType>(
  {
    all_authors: [],
    duplicate_urls: [],
  },
  {
    persist: {
      enabled: true,
    },
  },
);

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

  useEffect(() => {
    cached_state_store.set.all_authors(all_authors);
    cached_state_store.set.duplicate_urls(duplicate_urls);
  }, [all_authors, duplicate_urls]);

  return (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
}
