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
				<div ref={container_ref} className="flex flex-col py-4 pr-4">
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
	// Both portal targets are read from the DOM only inside effects, never
	// during render: reading `document` synchronously in the first client
	// render (the one hydration diffs against) would disagree with the SSR
	// pass, where `document` doesn't exist at all -- exactly the
	// server/client branch React's hydration-mismatch warning calls out.
	const [aside_element, set_aside_element] = useState<HTMLElement | null>(
		null,
	);
	const [mobile_element, set_mobile_element] = useState<HTMLElement | null>(
		null,
	);
	const mobile_sheet_open = useMobileNavOpen();

	useEffect(() => {
		set_aside_element(document.getElementById("shell-aside"));
	}, []);

	useEffect(() => {
		if (!mobile_sheet_open) {
			set_mobile_element(null);
			return;
		}

		// `#mobile-toc` is rendered by `<MobileSheet>` (a separate component
		// subtree gated on the same store), which mounts it asynchronously
		// via Radix's sheet-open animation -- it isn't guaranteed to exist in
		// the DOM yet by the time this effect runs, so watch for it instead
		// of a single getElementById attempt.
		const existing = document.getElementById("mobile-toc");
		if (existing) {
			set_mobile_element(existing);
			return;
		}

		const observer = new MutationObserver(() => {
			const element = document.getElementById("mobile-toc");
			if (element) {
				set_mobile_element(element);
				observer.disconnect();
			}
		});
		observer.observe(document.body, { childList: true, subtree: true });
		return () => observer.disconnect();
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
