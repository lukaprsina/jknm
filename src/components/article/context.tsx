"use client";

import { createContext } from "react";
import type {
  DraftArticleWithAuthors,
  PublishedArticleWithAuthors,
} from "./adapter";

export const PublishedArticleContext = createContext<
  PublishedArticleWithAuthors | undefined
>(undefined);

export const DraftArticleContext = createContext<
  DraftArticleWithAuthors | undefined
>(undefined);
