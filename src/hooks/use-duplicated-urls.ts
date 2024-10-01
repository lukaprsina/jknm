"use client";

import { api } from "~/trpc/react";

export function useDuplicatedUrls() {
  const duplicate_urls = api.article.get_duplicate_urls.useQuery(undefined, {
    staleTime: 1000 * 60 * 60 * 24, // 24 hours
    refetchOnMount: false,
    refetchOnReconnect: false,
    refetchOnWindowFocus: false,
  });

  return duplicate_urls.data;
}
