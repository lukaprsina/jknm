"use client";

import React, { createContext } from "react";
import type { PublishedArticle } from "~/server/db/schema";

const PublishedArticleContext = createContext<
  typeof PublishedArticle.$inferSelect | undefined
>(undefined);

interface PublishedArticleProviderProps {
  article: typeof PublishedArticle.$inferSelect;
  children: React.ReactNode;
}

export const PublishedArticleProvider: React.FC<
  PublishedArticleProviderProps
> = ({ article, children }) => {
  return (
    <PublishedArticleContext.Provider value={article}>
      {children}
    </PublishedArticleContext.Provider>
  );
};

export default PublishedArticleContext;
