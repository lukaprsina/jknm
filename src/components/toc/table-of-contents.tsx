"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { ScrollArea } from "~/components/ui/scroll-area";
import type { TocEntry } from "~/lib/toc";
import { cn } from "~/lib/utils";
import { mobile_nav_store, useMobileNavOpen } from "../shell/mobile-header";
import { AnchorProvider, ScrollProvider, TOCItem } from "./fumadocs-toc";
import { toc_visibility_store } from "./toc-store";

function TocList({ entries }: { entries: TocEntry[] }) {
	const container_ref = useRef<HTMLDivElement>(null);

	return (
		<ScrollProvider containerRef={container_ref}>
			<ScrollArea className="h-full max-h-[calc(100vh-8rem)] w-[300px] text-sm">
				<div ref={container_ref} className="flex flex-col gap-1 py-4 pr-4">
					{entries.map((entry) => (
						<TOCItem
							key={entry.id}
							href={`#${entry.id}`}
							onClick={() => mobile_nav_store.setState({ open: false })}
							className={cn(
								"block border-l-2 border-transparent py-1 pl-3 text-muted-foreground transition-colors hover:text-foreground data-[active=true]:border-foreground data-[active=true]:text-foreground",
								entry.depth === 3 && "pl-6",
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
 * (desktop) and `#mobile-toc` (mobile, inside the nav sheet). Renders
 * nothing for an empty TOC, and flips `toc_visibility_store` so the shell
 * layout and mobile sheet can react to whether this page has one at all. */
export function TableOfContents({ entries }: { entries: TocEntry[] }) {
	// `#shell-aside` is always mounted by `TocAwareLayout`, so it's already in
	// the DOM by the time this runs client-side; guarded for the SSR pass,
	// where `document` doesn't exist yet even inside a "use client" component.
	const [aside_element] = useState<HTMLElement | null>(() =>
		typeof document === "undefined"
			? null
			: document.getElementById("shell-aside"),
	);
	const [mobile_element, set_mobile_element] = useState<HTMLElement | null>(
		null,
	);
	const mobile_sheet_open = useMobileNavOpen();

	useEffect(() => {
		set_mobile_element(mobile_sheet_open ? document.getElementById("mobile-toc") : null);
	}, [mobile_sheet_open]);

	useEffect(() => {
		toc_visibility_store.setState({ has_toc: entries.length > 0 });
		return () => toc_visibility_store.setState({ has_toc: false });
	}, [entries.length]);

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
			{mount_points.map((element) =>
				createPortal(<TocList entries={entries} />, element, element.id),
			)}
		</AnchorProvider>
	);
}
