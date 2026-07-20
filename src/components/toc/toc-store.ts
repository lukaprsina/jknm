import { create } from "zustand";

interface TocVisibilityStore {
	has_toc: boolean;
}

/** Whether the currently mounted page has a non-empty TOC -- drives both
 * the `#shell-aside` sidebar layout and the `#mobile-toc` mount point. */
export const toc_visibility_store = create<TocVisibilityStore>(() => ({
	has_toc: false,
}));

export function useHasToc(): boolean {
	return toc_visibility_store((state) => state.has_toc);
}
