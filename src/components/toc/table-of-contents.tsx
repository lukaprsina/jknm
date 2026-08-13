"use client";

import {
	useCallback,
	useEffect,
	useMemo,
	useRef,
	useSyncExternalStore,
} from "react";
import { createPortal } from "react-dom";
import { ScrollArea } from "~/components/ui/scroll-area";
import type { TocEntry } from "~/lib/toc";
import { cn } from "~/lib/utils";
import { mobile_toc_store, useMobileTocOpen } from "../shell/mobile-header";
import {
	AnchorProvider,
	ScrollProvider,
	TOCItem,
	useActiveAnchors,
} from "./fumadocs-toc";
import { mobile_toc_progress_store, toc_visibility_store } from "./toc-store";

/** Lives inside `<AnchorProvider>` purely to read `useActiveAnchors()` (only
 * valid under that provider) and mirror it out to `mobile_toc_progress_store`
 * for `MobileTocPopover`, which renders outside the provider tree. */
function ActiveAnchorSync() {
	const active_ids = useActiveAnchors();

	useEffect(() => {
		mobile_toc_progress_store.setState({ active_id: active_ids[0] ?? null });
	}, [active_ids]);

	return null;
}

function no_op_subscribe() {
	return () => undefined;
}

function get_null() {
	return null;
}

function get_shell_aside() {
	return document.getElementById("shell-aside");
}

function TocList({ entries }: { entries: TocEntry[] }) {
	const container_ref = useRef<HTMLDivElement>(null);

	return (
		<ScrollProvider containerRef={container_ref}>
			<ScrollArea className="h-full max-h-[calc(100vh-8rem)] w-75 text-sm">
				<div ref={container_ref} className="flex flex-col py-4 pr-4">
					{entries.map((entry) => (
						<TOCItem
							key={entry.id}
							href={`#${entry.id}`}
							onClick={() => mobile_toc_store.setState({ open: false })}
							className={cn(
								"block border-l-2 border-border py-1 text-left text-muted-foreground transition-colors hover:text-foreground data-[active=true]:border-foreground data-[active=true]:text-foreground",
								entry.depth === 1 && "pl-2 font-medium",
								entry.depth === 2 && "pl-6",
								entry.depth === 3 && "pl-11",
							)}
						>
							{entry.title}
						</TOCItem>
					))}
				</div>
			</ScrollArea>
		</ScrollProvider>
	);
}

/** Renders `entries` as a scroll-spied TOC, portaled into `#shell-aside`
 * (desktop) and `#mobile-toc` (mobile, inside the "Na tej strani" sheet).
 * Renders nothing for an empty TOC, and flips `toc_visibility_store` so the
 * shell layout and mobile header can react to whether this page has one at
 * all. */
export function TableOfContents({ entries }: { entries: TocEntry[] }) {
	const mobile_sheet_open = useMobileTocOpen();

	// Both portal targets are read from the DOM via `useSyncExternalStore`,
	// never during render: reading `document` synchronously in the first
	// client render (the one hydration diffs against) would disagree with
	// the SSR pass, where `document` doesn't exist at all -- exactly the
	// server/client branch React's hydration-mismatch warning calls out.
	const aside_element = useSyncExternalStore(
		no_op_subscribe,
		get_shell_aside,
		get_null,
	);

	// `#mobile-toc` is rendered by `<MobileTocSheet>` (a separate component
	// subtree gated on the same store), which mounts it asynchronously via
	// Radix's sheet-open animation -- it isn't guaranteed to exist in the DOM
	// yet by the time the sheet opens, so watch for it via MutationObserver
	// instead of a single getElementById attempt.
	const subscribe_mobile_toc = useCallback(
		(on_store_change: () => void) => {
			if (!mobile_sheet_open) return () => undefined;

			const observer = new MutationObserver(on_store_change);
			observer.observe(document.body, { childList: true, subtree: true });
			return () => observer.disconnect();
		},
		[mobile_sheet_open],
	);
	const get_mobile_toc = useCallback(() => {
		if (!mobile_sheet_open) return null;
		return document.getElementById("mobile-toc");
	}, [mobile_sheet_open]);
	const mobile_element = useSyncExternalStore(
		subscribe_mobile_toc,
		get_mobile_toc,
		get_null,
	);

	useEffect(() => {
		toc_visibility_store.setState({ has_toc: entries.length > 0 });
		mobile_toc_progress_store.setState({ entries });
		return () => {
			toc_visibility_store.setState({ has_toc: false });
			mobile_toc_progress_store.setState({ entries: [], active_id: null });
		};
	}, [entries]);

	const items = useMemo(
		() =>
			entries.map((entry) => ({
				title: entry.title,
				url: `#${entry.id}`,
				depth: entry.depth,
			})),
		[entries],
	);

	if (entries.length === 0) return null;

	const mount_points = [aside_element, mobile_element].filter(
		(element) => element !== null,
	);

	return (
		<AnchorProvider toc={items}>
			<ActiveAnchorSync />
			{mount_points.map((element) =>
				createPortal(<TocList entries={entries} />, element, element.id),
			)}
		</AnchorProvider>
	);
}
