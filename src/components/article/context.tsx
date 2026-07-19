"use client";

import { createContext, useContext } from "react";
import type { EditorDraftArticle, PublishedArticleView } from "./new-adapter";

export const PublishedArticleContext = createContext<
	PublishedArticleView | undefined
>(undefined);

export const DraftArticleContext = createContext<
	EditorDraftArticle | undefined
>(undefined);

/**
 * True while editing a superseding draft (a revision of an already
 * published/archived article, linked via `supersedes_id`) — archive/delete
 * there act on the source, not this throwaway draft. See `lifecycle.ts`.
 */
export function useIsSupersedingDraft() {
	return Boolean(useContext(PublishedArticleContext));
}
