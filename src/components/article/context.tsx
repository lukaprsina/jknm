"use client";

import { createContext } from "react";
import type { EditorDraftArticle, PublishedArticleView } from "./new-adapter";

export const PublishedArticleContext = createContext<
	PublishedArticleView | undefined
>(undefined);

export const DraftArticleContext = createContext<
	EditorDraftArticle | undefined
>(undefined);
