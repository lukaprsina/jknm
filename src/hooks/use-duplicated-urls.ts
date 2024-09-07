"use client";

import { api } from "~/trpc/react";

export function useDuplicatedUrls() {
  const all_authors = api.article.get_duplicate_urls.useQuery(undefined, {
    staleTime: 1000 * 60 * 60 * 24, // 24 hours
    refetchOnMount: false,
    refetchOnReconnect: false,
    refetchOnWindowFocus: false,
  });

  return all_authors.data;
}
