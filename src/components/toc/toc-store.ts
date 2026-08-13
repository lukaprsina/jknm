import { create } from "zustand";
import type { TocEntry } from "~/lib/toc";

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

interface MobileTocProgressStore {
	entries: TocEntry[];
	active_id: string | null;
}

/** Mirrors the current page's TOC entries and scroll-spied active heading
 * out to `MobileTocPopover`, which lives in the header -- outside the
 * `<AnchorProvider>` that tracks active-anchor state -- so its trigger can
 * show a reading-progress ring and the current heading's title. */
export const mobile_toc_progress_store = create<MobileTocProgressStore>(() => ({
	entries: [],
	active_id: null,
}));

export function useMobileTocProgress(): MobileTocProgressStore {
	return mobile_toc_progress_store();
}
